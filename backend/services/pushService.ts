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
  expoCount: number;
  webCount: number;
  totalTokens: number;
  success: boolean;
  ticketDetails?: any[];
}

/**
 * Mask push token for safe logging (e.g. ExponentPushToken[xxxx...yyyy])
 */
function maskToken(token: string): string {
  if (!token || token.length < 15) return "***";
  return token.slice(0, 15) + "..." + token.slice(-4);
}

/**
 * Check Expo push receipts (~15 minutes after ticket generation)
 */
export async function checkExpoReceipts(receiptIds: string[]): Promise<Record<string, any>> {
  if (!receiptIds || receiptIds.length === 0) return {};
  try {
    const resp = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: receiptIds }),
    });
    if (!resp.ok) {
      console.warn("[PushService] Receipt check HTTP error:", resp.status);
      return {};
    }
    const data: any = await resp.json();
    console.log("[PushService] Receipt check results:", JSON.stringify(data?.data || {}));
    return data?.data || {};
  } catch (err: any) {
    console.warn("[PushService] Failed checking receipts:", err?.message);
    return {};
  }
}

/**
 * Centralized Push Notification Service for NERMAI IAS Academy
 * Dispatches high-priority push notifications to:
 * 1. Physical Android devices (Expo Push API / FCM) even when app is killed / closed.
 * 2. Desktop & Mobile Web Browsers (Web Push / FCM Service Worker).
 */
export async function sendPushNotification(
  payload: PushNotificationPayload
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = {
    tokensFound: 0,
    ticketsOk: 0,
    ticketsError: 0,
    expoCount: 0,
    webCount: 0,
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

    // Resolve excluded candidate IDs if excludeUserId is passed
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

    const docsMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();

    if (targetUserId) {
      const targetStr = String(targetUserId).trim();
      const candidateIds = new Set<string>([targetStr]);

      try {
        // 1. Resolve via students collection (students doc ID -> userId field, or userId field -> doc ID)
        const studentDocDirect = await db.collection("students").doc(targetStr).get();
        if (studentDocDirect.exists) {
          const uId = studentDocDirect.data()?.userId;
          if (uId && typeof uId === "string" && uId.trim()) candidateIds.add(uId.trim());
        }
        const studentByUserIdSnap = await db.collection("students").where("userId", "==", targetStr).get();
        studentByUserIdSnap.forEach((d) => candidateIds.add(d.id));

        // 2. Resolve via users collection (users doc ID -> studentId field, or studentId field -> doc ID)
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
      console.log(`[PushService] No tokens found for targetRole=${targetRole}, targetUserId=${targetUserId}`);
      return result;
    }

    // Parse and resolve targetBatch filter
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

        // Fetch batches collection once per send to map doc ID -> batchName / name
        let batchIdToNameMap = new Map<string, string>();
        try {
          const [bSnap, sbSnap] = await Promise.all([
            db.collection("batches").get().catch(() => ({ docs: [] })),
            db.collection("student_batches").get().catch(() => ({ docs: [] }))
          ]);
          const allDocs = [...(bSnap.docs || []), ...(sbSnap.docs || [])];
          allDocs.forEach((doc) => {
            const data = doc.data();
            const bName = (data.batchName || data.name || data.code || "").toString().trim().toLowerCase();
            if (bName) {
              batchIdToNameMap.set(doc.id.trim().toLowerCase(), bName);
            }
          });
        } catch (lookupErr: any) {
          console.warn("[PushService] Batch lookup warning (falling back to direct names):", lookupErr?.message);
        }

        for (const item of candidateBatches) {
          resolvedTargetBatches.add(item);
          if (batchIdToNameMap.has(item)) {
            resolvedTargetBatches.add(batchIdToNameMap.get(item)!);
          }
        }
      }
    }

    const tokenDocMap = new Map<string, string>(); // token -> docId
    const tokenRoleMap = new Map<string, string>(); // token -> role
    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    docsMap.forEach((docSnap) => {
      const d = docSnap.data();
      const token = d?.token;
      if (!token || typeof token !== "string") return;

      // Exclude sender / performed user if specified
      if (excludeSet.size > 0) {
        const uId = d.userId ? String(d.userId).trim() : "";
        const sId = d.studentId ? String(d.studentId).trim() : "";
        if (excludeSet.has(uId) || (sId && excludeSet.has(sId)) || excludeSet.has(docSnap.id)) {
          return;
        }
      }

      // Filter by targetBatch if specified and user is student
      if (resolvedTargetBatches && resolvedTargetBatches.size > 0) {
        if (d.role !== "student" || !d.batch) {
          return;
        }
        const tokenBatchLower = String(d.batch).trim().toLowerCase();
        if (!resolvedTargetBatches.has(tokenBatchLower)) {
          return;
        }
      }

      const roleStr = String(d.role || "").toLowerCase();
      tokenRoleMap.set(token, roleStr);
      tokenDocMap.set(token, docSnap.id);

      // Route tokens accurately: ExponentPushToken -> Expo API, everything else (Native Android FCM & Web FCM) -> Direct Google FCM
      if (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken")) {
        expoTokens.push(token);
      } else {
        fcmTokens.push(token);
      }
    });

    const uniqueExpo = Array.from(new Set(expoTokens));
    const uniqueWeb = Array.from(new Set(fcmTokens));
    result.tokensFound = uniqueExpo.length + uniqueWeb.length;
    result.totalTokens = result.tokensFound;

    const cleanData: Record<string, string> = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        cleanData[String(k)] = typeof v === "string" ? v : (v === null || v === undefined ? "" : JSON.stringify(v));
      });
    }

    // Default screen navigation mapping
    cleanData.targetTab = cleanData.targetTab || cleanData.screen || "dashboard";
    cleanData.targetSub = cleanData.targetSub || cleanData.subTab || "";
    cleanData.screen = cleanData.targetTab;
    cleanData.subTab = cleanData.targetSub;

    // 1. Dispatch to Expo Push API (Physical Android Devices)
    if (uniqueExpo.length > 0) {
      const expoMessages = uniqueExpo.map((to) => {
        const tokenRole = tokenRoleMap.get(to) || "student";
        const isAdmin = ["admin", "super_admin", "staff", "developer"].includes(tokenRole);
        const isGuest = tokenRole === "guest";
        const tokenData = { ...cleanData };
        if (isGuest) {
          if (tokenData.targetTab === "test" || tokenData.targetTab === "tests" || tokenData.targetSub === "tests" || tokenData.targetSub === "available") {
            tokenData.targetTab = "guest";
            tokenData.targetSub = "tests";
          } else if (tokenData.targetTab === "resources" || tokenData.targetTab === "lms" || tokenData.targetSub === "resources" || tokenData.targetSub === "daily-content") {
            tokenData.targetTab = "guest";
            tokenData.targetSub = "resources";
          } else if (tokenData.targetTab === "crm" || tokenData.targetSub === "admissions" || tokenData.targetSub === "apply") {
            tokenData.targetTab = "guest";
            tokenData.targetSub = "apply";
          } else {
            tokenData.targetTab = "guest";
            tokenData.targetSub = "home";
          }
          tokenData.screen = tokenData.targetTab;
          tokenData.subTab = tokenData.targetSub;
        }
        return {
          to,
          sound: "default",
          title,
          body,
          priority: "high",
          channelId: "default",
          data: tokenData,
          ...(tokenData.dedupeId ? { collapseId: tokenData.dedupeId } : {}),
        };
      });

      for (let i = 0; i < expoMessages.length; i += 100) {
        const chunk = expoMessages.slice(i, i + 100);
        try {
          const resp = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          if (resp.ok) {
            const resBody: any = await resp.json().catch(() => null);
            const tickets = resBody?.data || [];
            if (Array.isArray(tickets)) {
              for (let tIdx = 0; tIdx < tickets.length; tIdx++) {
                const ticket = tickets[tIdx];
                const targetToken = chunk[tIdx]?.to || "";
                const masked = maskToken(targetToken);
                const docId = tokenDocMap.get(targetToken);

                if (ticket.status === "ok") {
                  result.ticketsOk++;
                  result.expoCount++;
                  result.ticketDetails?.push({ token: masked, status: "ok", receiptId: ticket.id });
                } else if (ticket.status === "error") {
                  result.ticketsError++;
                  const errCode = ticket.details?.error || "UnknownError";
                  const errMsg = ticket.message || "";
                  console.warn(`[PushService] Ticket error for token ${masked}: [${errCode}] ${errMsg}`);
                  result.ticketDetails?.push({ token: masked, status: "error", error: `${errCode}: ${errMsg}` });

                  if (errCode === "DeviceNotRegistered" && docId) {
                    console.log(`[PushService] Deleting stale unregistered token doc ${docId} (${masked})`);
                    db.collection("device_push_tokens").doc(docId).delete().catch(() => {});
                  } else if (errCode === "InvalidCredentials" || errCode === "MismatchSenderId") {
                    console.error(`[PushService] CRITICAL EXPO/FCM CONFIG ERROR: ${errCode} for token ${masked}`);
                  }
                }
              }
            } else {
              result.expoCount += chunk.length;
              result.ticketsOk += chunk.length;
            }
          } else {
            console.warn(`[PushService] Expo HTTP error status: ${resp.status}`);
            result.ticketsError += chunk.length;
          }
        } catch (e: any) {
          console.warn("[PushService] Expo chunk delivery error:", e?.message);
          result.ticketsError += chunk.length;
        }
      }
    }

    // 2. Dispatch to Direct FCM (Native Android & Web Browsers via Firebase Admin SDK)
    if (uniqueWeb.length > 0) {
      const isTestAvailable = cleanData.targetTab === "test" && cleanData.targetSub === "available";

      for (let i = 0; i < uniqueWeb.length; i += 500) {
        const chunk = uniqueWeb.slice(i, i + 500);

        // Subdivide chunk into recipient payloads based on role (guest, admin, student)
        const subChunks: Array<{ tokens: string[]; payloadData: Record<string, string>; link: string }> = [];
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

        // 2a. Guest Web FCM payload & link
        if (guestTokens.length > 0) {
          let guestSub = "home";
          if (cleanData.targetTab === "test" || cleanData.targetTab === "tests" || cleanData.targetSub === "tests" || cleanData.targetSub === "available") {
            guestSub = "tests";
          } else if (cleanData.targetTab === "resources" || cleanData.targetTab === "lms" || cleanData.targetSub === "resources" || cleanData.targetSub === "daily-content") {
            guestSub = "resources";
          } else if (cleanData.targetTab === "crm" || cleanData.targetSub === "admissions" || cleanData.targetSub === "apply") {
            guestSub = "apply";
          }
          subChunks.push({
            tokens: guestTokens,
            payloadData: { ...cleanData, targetTab: "guest", targetSub: guestSub, screen: "guest", subTab: guestSub },
            link: `https://nermaiiasacademy-519c8.web.app/#guest/${guestSub}`,
          });
        }

        // 2b. Admin Web FCM payload & link
        if (adminTokens.length > 0) {
          if (isTestAvailable) {
            subChunks.push({
              tokens: adminTokens,
              payloadData: { ...cleanData, targetSub: "available", subTab: "available" },
              link: `https://nermaiiasacademy-519c8.web.app/#test/available`,
            });
          } else {
            const adminPath = cleanData.targetTab ? `/#${cleanData.targetTab}${cleanData.targetSub ? `/${cleanData.targetSub}` : ''}` : "/";
            subChunks.push({
              tokens: adminTokens,
              payloadData: cleanData,
              link: `https://nermaiiasacademy-519c8.web.app${adminPath}`,
            });
          }
        }

        // 2c. Student Web FCM payload & link
        if (studentTokens.length > 0) {
          const studentPath = isTestAvailable ? "/#test" : (cleanData.targetTab ? `/#${cleanData.targetTab}${cleanData.targetSub ? `/${cleanData.targetSub}` : ''}` : "/");
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
              notification: {
                title,
                body,
              },
              data: sub.payloadData,
              android: {
                priority: "high",
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
                fcmOptions: {
                  link: sub.link,
                },
              },
            });
            result.webCount += response.successCount;
            result.ticketsOk += response.successCount;
            result.ticketsError += response.failureCount;

          if (response.failureCount > 0 && Array.isArray(response.responses)) {
            let staleWebCount = 0;
            const batch = db.batch();
            response.responses.forEach((resp, idx) => {
              const targetToken = chunk[idx] || "";
              const masked = maskToken(targetToken);
              if (!resp.success && resp.error) {
                const code = resp.error.code || (resp.error as any).status || "unknown";
                const msg = resp.error.message || JSON.stringify(resp.error) || "Unknown error";
                const fullErr = `[${code}] ${msg}${resp.error.stack ? ` | stack: ${resp.error.stack}` : ""}`;
                console.warn(`[PushService] Web FCM error for token ${masked}: ${fullErr}`);
                result.ticketDetails?.push({ token: masked, status: "error", error: `${code}: ${msg}`, rawError: resp.error });

                if (
                  code === "messaging/registration-token-not-registered" ||
                  code === "messaging/invalid-registration-token"
                ) {
                  if (targetToken) {
                    const knownDocId = tokenDocMap.get(targetToken);
                    if (knownDocId) {
                      batch.delete(db.collection("device_push_tokens").doc(knownDocId));
                      staleWebCount++;
                    } else {
                      const cleanDocId = targetToken.replace(/[^a-zA-Z0-9_-]/g, "_");
                      batch.delete(db.collection("device_push_tokens").doc(cleanDocId));
                      const webCleanDocId = "web_" + targetToken.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
                      batch.delete(db.collection("device_push_tokens").doc(webCleanDocId));
                      staleWebCount++;
                    }
                  }
                }
              }
            });
            if (staleWebCount > 0) {
              await batch.commit().catch(() => {});
              console.log(`[PushService] Cleaned up ${staleWebCount} stale/invalid FCM token docs.`);
            }
          }
        } catch (e: any) {
          console.warn("[PushService] Web FCM delivery error:", e?.message);
          result.ticketsError += chunk.length;
        }
      }
    }
  }

  result.success = result.ticketsOk > 0;
  console.log(`[PushService] Push complete: tokensFound=${result.tokensFound}, ticketsOk=${result.ticketsOk}, ticketsError=${result.ticketsError}`);
  return result;
} catch (error: any) {
  console.error("[PushService] Global error in sendPushNotification:", error?.message);
  return result;
}
}

