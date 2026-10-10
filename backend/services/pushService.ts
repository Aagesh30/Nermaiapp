import admin from "firebase-admin";
import { db, messaging } from "../infrastructure/firebase";

export interface PushNotificationPayload {
  title: string;
  body: string;
  targetRole?: "all" | "student" | "guest" | "admin" | "staff" | "super_admin";
  targetBatch?: string | null;
  targetUserId?: string | null;
  targetAudience?: string | null;
  data?: Record<string, any>;
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
    const { title, body, targetRole, targetBatch, targetUserId, data } = payload;
    if (!title || !body) {
      console.warn("[PushService] Skipped: title and body are required");
      return result;
    }

    const docsMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();

    if (targetUserId) {
      const targetStr = String(targetUserId).trim();
      // Query by userId field
      const q1 = await db.collection("device_push_tokens").where("userId", "==", targetStr).get();
      q1.forEach((d) => docsMap.set(d.id, d));
      // Query by studentId field
      const q2 = await db.collection("device_push_tokens").where("studentId", "==", targetStr).get();
      q2.forEach((d) => docsMap.set(d.id, d));
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

    const expoTokenDocMap = new Map<string, string>(); // token -> docId
    const webTokens: string[] = [];

    docsMap.forEach((docSnap) => {
      const d = docSnap.data();
      const token = d?.token;
      if (!token || typeof token !== "string") return;

      // Filter by targetBatch if specified and user is student
      if (
        targetBatch &&
        targetBatch !== "all" &&
        targetBatch !== "all_paid" &&
        String(targetBatch).trim() !== "" &&
        d.role === "student" &&
        d.batch
      ) {
        if (String(d.batch).trim().toLowerCase() !== String(targetBatch).trim().toLowerCase()) {
          return;
        }
      }

      if (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken")) {
        expoTokenDocMap.set(token, docSnap.id);
      } else if (d.platform === "web" || token.length > 50) {
        webTokens.push(token);
      } else {
        expoTokenDocMap.set(token, docSnap.id);
      }
    });

    const uniqueExpo = Array.from(expoTokenDocMap.keys());
    const uniqueWeb = Array.from(new Set(webTokens));
    result.tokensFound = uniqueExpo.length + uniqueWeb.length;
    result.totalTokens = result.tokensFound;

    const cleanData: Record<string, string> = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        cleanData[k] = typeof v === "string" ? v : JSON.stringify(v);
      });
    }

    // Default screen navigation mapping
    cleanData.targetTab = cleanData.targetTab || cleanData.screen || "dashboard";
    cleanData.targetSub = cleanData.targetSub || cleanData.subTab || "";
    cleanData.screen = cleanData.targetTab;
    cleanData.subTab = cleanData.targetSub;

    // 1. Dispatch to Expo Push API (Physical Android Devices)
    if (uniqueExpo.length > 0) {
      const expoMessages = uniqueExpo.map((to) => ({
        to,
        sound: "default",
        title,
        body,
        priority: "high",
        channelId: "default",
        data: cleanData,
      }));

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
                const docId = expoTokenDocMap.get(targetToken);

                if (ticket.status === "ok") {
                  result.ticketsOk++;
                  result.expoCount++;
                  result.ticketDetails?.push({ token: masked, status: "ok", receiptId: ticket.id });
                } else if (ticket.status === "error") {
                  result.ticketsError++;
                  const errCode = ticket.details?.error || ticket.message || "UnknownError";
                  console.warn(`[PushService] Ticket error for token ${masked}: ${errCode}`);
                  result.ticketDetails?.push({ token: masked, status: "error", error: errCode });

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

    // 2. Dispatch to Web FCM (Browsers via Firebase Admin Messaging)
    if (uniqueWeb.length > 0) {
      for (let i = 0; i < uniqueWeb.length; i += 500) {
        const chunk = uniqueWeb.slice(i, i + 500);
        try {
          const response = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: {
              title,
              body,
            },
            data: cleanData,
            webpush: {
              notification: {
                title,
                body,
                icon: "/favicon.png",
                badge: "/favicon.png",
              },
              fcmOptions: {
                link: cleanData.targetTab ? `/#${cleanData.targetTab}` : "/",
              },
            },
          });
          result.webCount += response.successCount;
          result.ticketsOk += response.successCount;
          result.ticketsError += response.failureCount;
        } catch (e: any) {
          console.warn("[PushService] Web FCM delivery error:", e?.message);
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

