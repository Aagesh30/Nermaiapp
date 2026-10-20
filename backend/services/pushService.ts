import admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { db, messaging, getFirebaseApp } from "../infrastructure/firebase";

export interface PushNotificationPayload {
  title: string;
  body: string;
  targetRole?: "all" | "student" | "guest" | "admin" | "staff" | "super_admin";
  targetBatch?: string | string[] | null;
  targetUserId?: string | null;
  targetAudience?: string | null;
  data?: Record<string, any>;
  excludeUserId?: string | null;
}

export interface PushDeliveryResult {
  tokensFound: number;
  ticketsOk: number;
  ticketsError: number;
  fcmCount: number;       // renamed from webCount — now all tokens are FCM
  totalTokens: number;
  success: boolean;
  ticketDetails?: any[];
}

/**
 * Mask push token for safe logging
 */
function maskToken(token: string): string {
  if (!token || token.length < 15) return "***";
  return token.slice(0, 15) + "..." + token.slice(-4);
}

/**
 * Centralized Push Notification Service — NERMAI IAS Academy
 *
 * STACK: Pure FCM via Firebase Admin SDK sendEachForMulticast.
 *   - APK:  Expo getDevicePushTokenAsync() → native FCM device token → stored in device_push_tokens.
 *   - Web:  Firebase Messaging getToken() (VAPID) → stored in device_push_tokens with "web_" prefix.
 *   - No Expo Push API, no Expo relay servers. Everything goes direct to Google FCM.
 *
 * TARGETING:
 *   targetUserId   → query device_push_tokens where userId OR studentId == targetUserId
 *   targetRole     → role field in device_push_tokens (student/admin/super_admin/guest/staff)
 *   targetBatch    → further filter by batch field (students only)
 *   excludeUserId  → exclude the actor/sender (prevents notifying yourself)
 */
export async function sendPushNotification(
  payload: PushNotificationPayload
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = {
    tokensFound: 0,
    ticketsOk: 0,
    ticketsError: 0,
    fcmCount: 0,
    totalTokens: 0,
    success: false,
    ticketDetails: [],
  };

  try {
    const { title, body, targetRole, targetBatch, targetUserId, data, excludeUserId } = payload;
    if (!title || !body) {
      console.warn("[PushService] Skipped: title and body are required");
      return result;
    }

    // ── Build exclude set (sender + linked student/user IDs) ───────────────
    const excludeSet = new Set<string>();
    if (excludeUserId) {
      const exStr = String(excludeUserId).trim();
      if (exStr) {
        excludeSet.add(exStr);
        try {
          const sDoc = await db.collection("students").doc(exStr).get();
          if (sDoc.exists) {
            const uId = sDoc.data()?.userId;
            if (uId && typeof uId === "string" && uId.trim()) excludeSet.add(uId.trim());
          }
          const uDoc = await db.collection("users").doc(exStr).get();
          if (uDoc.exists) {
            const sId = uDoc.data()?.studentId;
            if (sId && typeof sId === "string" && sId.trim()) excludeSet.add(sId.trim());
          }
        } catch (_) {}
      }
    }

    // ── Fetch token documents ──────────────────────────────────────────────
    const docsMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();

    if (targetUserId) {
      // Resolve all candidate IDs (student doc ID ↔ userId field, user doc ID ↔ studentId field)
      const targetStr = String(targetUserId).trim();
      const candidateIds = new Set<string>([targetStr]);

      try {
        const studentDocDirect = await db.collection("students").doc(targetStr).get();
        if (studentDocDirect.exists) {
          const uId = studentDocDirect.data()?.userId;
          if (uId && typeof uId === "string" && uId.trim()) candidateIds.add(uId.trim());
        }
        const studentByUserIdSnap = await db.collection("students").where("userId", "==", targetStr).get();
        studentByUserIdSnap.forEach((d) => candidateIds.add(d.id));

        const userDocDirect = await db.collection("users").doc(targetStr).get();
        if (userDocDirect.exists) {
          const sId = userDocDirect.data()?.studentId;
          if (sId && typeof sId === "string" && sId.trim()) candidateIds.add(sId.trim());
        }
        const userByStudentIdSnap = await db.collection("users").where("studentId", "==", targetStr).get();
        userByStudentIdSnap.forEach((d) => candidateIds.add(d.id));
      } catch (linkErr: any) {
        console.warn("[PushService] Note while resolving candidate IDs:", linkErr?.message);
      }

      for (const id of candidateIds) {
        const q1 = await db.collection("device_push_tokens").where("userId", "==", id).get();
        q1.forEach((d) => docsMap.set(d.id, d));
        const q2 = await db.collection("device_push_tokens").where("studentId", "==", id).get();
        q2.forEach((d) => docsMap.set(d.id, d));
      }
    } else {
      let q: admin.firestore.Query = db.collection("device_push_tokens");
      if (targetRole && targetRole !== "all") {
        if (targetRole === "admin") {
          q = q.where("role", "in", ["admin", "super_admin", "staff", "teacher", "developer"]);
        } else if (targetRole === "super_admin") {
          q = q.where("role", "in", ["super_admin", "developer"]);
        } else if (targetRole === "staff") {
          q = q.where("role", "in", ["admin", "super_admin", "staff", "teacher"]);
        } else if (targetRole === "student") {
          q = q.where("role", "==", "student");
        } else if (targetRole === "guest") {
          q = q.where("role", "==", "guest");
        }
      }
      const snap = await q.get();
      snap.forEach((d) => docsMap.set(d.id, d));
    }

    if (docsMap.size === 0) {
      console.log(`[PushService] No tokens for targetRole=${targetRole}, targetUserId=${targetUserId}`);
      return result;
    }

    // ── Resolve targetBatch filter ─────────────────────────────────────────
    let resolvedTargetBatches: Set<string> | null = null;
    if (targetBatch && targetBatch !== "all" && targetBatch !== "all_paid") {
      const rawBatchItems: string[] = Array.isArray(targetBatch)
        ? targetBatch.map((s) => String(s || "")).filter(Boolean)
        : String(targetBatch).split(",");

      const candidateBatches = rawBatchItems
        .map((b) => b.trim().toLowerCase())
        .filter((b) => b && b !== "all" && b !== "all_paid");

      if (candidateBatches.length > 0) {
        resolvedTargetBatches = new Set<string>();

        let batchIdToNameMap = new Map<string, string>();
        try {
          const [bSnap, sbSnap] = await Promise.all([
            db.collection("batches").get().catch(() => ({ docs: [] })),
            db.collection("student_batches").get().catch(() => ({ docs: [] }))
          ]);
          const allDocs = [...(bSnap.docs || []), ...(sbSnap.docs || [])];
          allDocs.forEach((doc) => {
            const d = doc.data();
            const bName = (d.batchName || d.name || d.code || "").toString().trim().toLowerCase();
            if (bName) batchIdToNameMap.set(doc.id.trim().toLowerCase(), bName);
          });
        } catch (lookupErr: any) {
          console.warn("[PushService] Batch lookup warning:", lookupErr?.message);
        }

        for (const item of candidateBatches) {
          resolvedTargetBatches.add(item);
          if (batchIdToNameMap.has(item)) {
            resolvedTargetBatches.add(batchIdToNameMap.get(item)!);
          }
        }
      }
    }

    // ── Filter tokens: exclude sender, apply batch filter ─────────────────
    const tokenDocMap = new Map<string, string>();  // token → docId
    const tokenRoleMap = new Map<string, string>(); // token → role
    const allFcmTokens: string[] = [];

    docsMap.forEach((docSnap) => {
      const d = docSnap.data();
      const token = d?.token;
      if (!token || typeof token !== "string") return;

      // Reject Expo Push Tokens if any stale ones exist in DB (migration safety)
      if (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken")) {
        console.warn(`[PushService] Skipping stale Expo Push Token (${maskToken(token)}) — migrate device to FCM by re-logging in.`);
        return;
      }

      // Exclude sender
      if (excludeSet.size > 0) {
        const uId = d.userId ? String(d.userId).trim() : "";
        const sId = d.studentId ? String(d.studentId).trim() : "";
        if (excludeSet.has(uId) || (sId && excludeSet.has(sId)) || excludeSet.has(docSnap.id)) return;
      }

      // Batch filter — applies to students AND admins
      if (resolvedTargetBatches && resolvedTargetBatches.size > 0) {
        const roleStr = String(d.role || "").toLowerCase();
        const isAdmin = ["admin", "super_admin", "staff", "developer"].includes(roleStr);

        if (isAdmin) {
          // Admin batch filtering: only notify admins who manage this batch.
          // If assignedBatches is empty or missing → super admin → receives ALL batch notifications.
          const adminBatches: string[] = Array.isArray(d.assignedBatches)
            ? d.assignedBatches.map((b: any) => String(b).trim().toLowerCase()).filter(Boolean)
            : [];
          if (adminBatches.length > 0) {
            // This admin has specific batch assignments — check if any overlap with target
            const hasOverlap = adminBatches.some((b) => resolvedTargetBatches!.has(b));
            if (!hasOverlap) return; // Skip this admin — they don't manage this batch
          }
          // adminBatches.length === 0 → super admin → passes through, receives the notification
        } else {
          // Student batch filter: match their `batch` field (supports exact, normalized & substring variations)
          if (!d.batch) return;
          const tokenBatchLower = String(d.batch).trim().toLowerCase();
          const cleanTokenBatch = tokenBatchLower.replace(/\s*batch\s*/gi, "").trim();

          const isBatchMatch = resolvedTargetBatches.has(tokenBatchLower) ||
            resolvedTargetBatches.has(cleanTokenBatch) ||
            Array.from(resolvedTargetBatches).some(tb => {
              const cleanTb = tb.replace(/\s*batch\s*/gi, "").trim();
              return tb === "all" ||
                tb === "all batches" ||
                tb === tokenBatchLower ||
                cleanTb === cleanTokenBatch ||
                tokenBatchLower.includes(cleanTb) ||
                cleanTokenBatch.includes(cleanTb);
            });

          if (!isBatchMatch) return;
        }
      }

      const roleStr = String(d.role || "").toLowerCase();
      tokenRoleMap.set(token, roleStr);
      tokenDocMap.set(token, docSnap.id);
      allFcmTokens.push(token);
    });

    const uniqueTokens = Array.from(new Set(allFcmTokens));
    result.tokensFound = uniqueTokens.length;
    result.totalTokens = uniqueTokens.length;

    if (uniqueTokens.length === 0) {
      console.log("[PushService] No FCM tokens after filtering.");
      return result;
    }

    // ── Build clean data payload (FCM data values must all be strings) ────
    const cleanData: Record<string, string> = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        cleanData[String(k)] = typeof v === "string" ? v : (v === null || v === undefined ? "" : JSON.stringify(v));
      });
    }
    cleanData.targetTab = cleanData.targetTab || cleanData.screen || "dashboard";
    cleanData.targetSub = cleanData.targetSub || cleanData.subTab || "";
    cleanData.screen    = cleanData.targetTab;
    cleanData.subTab    = cleanData.targetSub;

    // ── Dispatch via Firebase Admin SDK sendEachForMulticast ───────────────
    // Process in chunks of 500 (Firebase Admin SDK limit per call)
    for (let i = 0; i < uniqueTokens.length; i += 500) {
      const chunk = uniqueTokens.slice(i, i + 500);

      // Group tokens by role to set role-appropriate deep-link URL for web push
      const studentTokens: string[] = [];
      const adminTokens: string[] = [];
      const guestTokens: string[] = [];

      chunk.forEach((t) => {
        const r = tokenRoleMap.get(t) || "student";
        if (["admin", "super_admin", "staff", "developer"].includes(r)) {
          adminTokens.push(t);
        } else if (r === "guest") {
          guestTokens.push(t);
        } else {
          studentTokens.push(t);
        }
      });

      const subChunks: Array<{ tokens: string[]; payloadData: Record<string, string>; link: string }> = [];

      // Guest — remap tabs to guest navigation
      if (guestTokens.length > 0) {
        let guestSub = "home";
        if (cleanData.targetTab === "test" || cleanData.targetSub === "available") guestSub = "tests";
        else if (cleanData.targetTab === "lms" || cleanData.targetSub === "resources" || cleanData.targetSub === "daily-content") guestSub = "resources";
        else if (cleanData.targetTab === "crm" || cleanData.targetSub === "apply") guestSub = "apply";
        subChunks.push({
          tokens: guestTokens,
          payloadData: { ...cleanData, targetTab: "guest", targetSub: guestSub, screen: "guest", subTab: guestSub },
          link: `https://nermaiiasacademy-519c8.web.app/#guest/${guestSub}`,
        });
      }

      // Admin
      if (adminTokens.length > 0) {
        const adminPath = cleanData.targetTab
          ? `/#${cleanData.targetTab}${cleanData.targetSub ? `/${cleanData.targetSub}` : ""}`
          : "/";
        subChunks.push({
          tokens: adminTokens,
          payloadData: cleanData,
          link: `https://nermaiiasacademy-519c8.web.app${adminPath}`,
        });
      }

      // Student
      if (studentTokens.length > 0) {
        const studentPath = cleanData.targetTab
          ? `/#${cleanData.targetTab}${cleanData.targetSub ? `/${cleanData.targetSub}` : ""}`
          : "/";
        subChunks.push({
          tokens: studentTokens,
          payloadData: cleanData,
          link: `https://nermaiiasacademy-519c8.web.app${studentPath}`,
        });
      }

      for (const sub of subChunks) {
        try {
          const firebaseApp = getFirebaseApp();
          const activeMessaging = getMessaging(firebaseApp);
          const response = await activeMessaging.sendEachForMulticast({
            tokens: sub.tokens,
            notification: { title, body },
            data: sub.payloadData,
            android: {
              priority: "high",
              ttl: 86400 * 1000,  // 24 hours in ms — FCM retries while device is in Doze
              collapseKey: sub.payloadData.dedupeId || undefined,
              notification: {
                title,
                body,
                channelId: "default",
                sound: "default",
                priority: "max",
                defaultVibrateTimings: true,
                defaultSound: true,
                clickAction: "fcm.ACTION.NOTIFICATION_CLICK",
                tag: sub.payloadData.dedupeId || undefined,
              },
            },
            webpush: {
              notification: {
                title,
                body,
                icon: "/favicon.png",
                badge: "/favicon.png",
                tag: sub.payloadData.dedupeId || undefined,
              },
              fcmOptions: { link: sub.link },
            },
          });

          result.fcmCount  += response.successCount;
          result.ticketsOk += response.successCount;
          result.ticketsError += response.failureCount;

          // Clean up stale / invalid FCM tokens
          if (response.failureCount > 0 && Array.isArray(response.responses)) {
            let staleCount = 0;
            const batchWrite = db.batch();
            response.responses.forEach((resp, idx) => {
              const targetToken = sub.tokens[idx] || "";
              const masked = maskToken(targetToken);
              if (!resp.success && resp.error) {
                const code = resp.error.code || (resp.error as any).status || "unknown";
                const msg  = resp.error.message || JSON.stringify(resp.error) || "Unknown error";
                console.warn(`[PushService] FCM error for ${masked}: [${code}] ${msg}`);
                result.ticketDetails?.push({ token: masked, status: "error", error: `${code}: ${msg}` });

                if (
                  code === "messaging/registration-token-not-registered" ||
                  code === "messaging/invalid-registration-token"
                ) {
                  const knownDocId = tokenDocMap.get(targetToken);
                  if (knownDocId) {
                    batchWrite.delete(db.collection("device_push_tokens").doc(knownDocId));
                    staleCount++;
                  } else if (targetToken) {
                    // Try both formats
                    const cleanDocId = targetToken.replace(/[^a-zA-Z0-9_-]/g, "_");
                    batchWrite.delete(db.collection("device_push_tokens").doc(cleanDocId));
                    const webCleanDocId = "web_" + targetToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
                    batchWrite.delete(db.collection("device_push_tokens").doc(webCleanDocId));
                    staleCount++;
                  }
                }
              }
            });
            if (staleCount > 0) {
              await batchWrite.commit().catch(() => {});
              console.log(`[PushService] Cleaned up ${staleCount} stale FCM token doc(s).`);
            }
          }
        } catch (e: any) {
          console.warn("[PushService] FCM delivery error:", e?.message);
          result.ticketsError += sub.tokens.length;
        }
      }
    }

    result.success = result.ticketsOk > 0;
    console.log(`[PushService] Push complete: tokensFound=${result.tokensFound}, ok=${result.ticketsOk}, err=${result.ticketsError}`);
    return result;
  } catch (error: any) {
    console.error("[PushService] Global error:", error?.message);
    return result;
  }
}
