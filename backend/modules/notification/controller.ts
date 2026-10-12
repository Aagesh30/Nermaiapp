import { Request, Response } from "express";
import admin from "firebase-admin";
import { randomUUID } from "crypto";
import { generalCache } from "../../shared/utils/cache";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "nermaiiasacademy-519c8",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nermaiiasacademy-519c8-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();
const COLLECTION = "announcements";

import { sendPushNotification } from "../../services/pushService";

async function dispatchPushToExpo(targets: {
    title: string;
    body: string;
    targetGroup?: string;
    targetStudentId?: string | null;
    targetBatch?: string | null;
    excludeUserId?: string | null;
    data?: Record<string, any>;
}) {
    let targetRole: "all" | "student" | "guest" | "admin" | "staff" | "super_admin" = "all";
    if (targets.targetGroup === "student") targetRole = "student";
    else if (targets.targetGroup === "guest" || targets.targetGroup === "free") targetRole = "guest";
    else if (targets.targetGroup === "staff") targetRole = "staff";

    try {
        return await sendPushNotification({
            title: targets.title,
            body: targets.body,
            targetRole,
            targetUserId: targets.targetStudentId || null,
            targetBatch: targets.targetBatch || null,
            excludeUserId: targets.excludeUserId || null,
            data: targets.data
        });
    } catch (e: any) {
        console.log("[Backend Notification] Push dispatch note:", e?.message);
        return { tokensFound: 0, ticketsOk: 0, ticketsError: 0, expoCount: 0, webCount: 0, totalTokens: 0, success: false };
    }
}

export class NotificationController {
    /**
     * CREATE NOTIFICATION (ALIAS FOR ANNOUNCEMENT CREATION)
     * POST /api/notification
     */
    static async create(req: Request, res: Response) {
        try {
            const { title, message, targetGroup, targetBatch, sentBy, priority, targetStudentId } = req.body;

            if (!title) {
                return res.status(400).json({ success: false, message: "Title is required" });
            }
            if (!message) {
                return res.status(400).json({ success: false, message: "Message is required" });
            }
            if (!targetGroup) {
                return res.status(400).json({ success: false, message: "Target group is required" });
            }

            // Check for duplicate notifications sent within the last 10 seconds to avoid double submission
            const dupSnapshot = await db.collection(COLLECTION)
                .where("title", "==", title)
                .where("content", "==", message)
                .where("isDeleted", "==", false)
                .get();

            const isDuplicate = dupSnapshot.docs.some(doc => {
                const data = doc.data();
                if (!data.createdAt) return false;
                try {
                    const createdTime = data.createdAt.toDate().getTime();
                    return (Date.now() - createdTime) < 10000;
                } catch {
                    return false;
                }
            });

            if (isDuplicate) {
                const dupDoc = dupSnapshot.docs[0].data();
                return res.status(200).json({
                    success: true,
                    message: "Duplicate notification ignored",
                    data: {
                        ...dupDoc,
                        createdAt: dupDoc.createdAt ? dupDoc.createdAt.toDate().toISOString() : new Date().toISOString()
                    }
                });
            }

            // Override existing fee payment alerts for this student to avoid duplicates
            if (targetStudentId && String(title).includes("Fee Payment Alert")) {
                const existingAlerts = await db.collection(COLLECTION)
                    .where("targetStudentId", "==", targetStudentId)
                    .where("isDeleted", "==", false)
                    .get();
                
                if (!existingAlerts.empty) {
                    const deleteBatch = db.batch();
                    existingAlerts.docs.forEach(doc => {
                        if (String(doc.data().title || "").includes("Fee Payment Alert")) {
                            deleteBatch.update(doc.ref, {
                                isDeleted: true,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                                deletedBy: "system_override"
                            });
                        }
                    });
                    await deleteBatch.commit();
                }
            }

            const id = randomUUID();
            const payload = {
                id,
                title,
                content: message,
                priority: priority === "high" ? "high" : "normal",
                targetDashboard: targetGroup, // "all" | "batch" | "free" | "paid" | "staff"
                targetBatch: targetBatch || null,
                targetStudentId: targetStudentId || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: sentBy || "admin",
                updatedBy: sentBy || "admin",
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
                isNotification: true
            };

            await db.collection(COLLECTION).doc(id).set(payload);

            // Invalidate student-facing cache so new notice is immediately visible
            generalCache.delete('all_active_announcements');

            // Dispatch remote push notification via Expo Push API to reached devices even if APK is closed
            const isFeeAlert = String(title).includes("Fee Payment Alert") || String(message).toLowerCase().includes("pending tuition fee");
            const pushResult = await dispatchPushToExpo({
                title,
                body: message,
                targetGroup,
                targetStudentId,
                targetBatch,
                excludeUserId: (req as any).user?.userId || (sentBy && sentBy !== "admin" ? sentBy : null) || null,
                data: {
                    targetTab: isFeeAlert ? "erp" : (targetGroup === "guest" ? "home" : "dashboard"),
                    targetSub: isFeeAlert ? "pay-fees" : "notices",
                    screen: isFeeAlert ? "erp" : (targetGroup === "guest" ? "home" : "dashboard"),
                    subTab: isFeeAlert ? "pay-fees" : "notices"
                }
            });

            return res.status(201).json({
                success: true,
                message: "Notification sent successfully",
                tokensFound: pushResult.tokensFound,
                ticketsOk: pushResult.ticketsOk,
                ticketsError: pushResult.ticketsError,
                data: {
                    ...payload,
                    createdAt: new Date().toISOString()
                }
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while sending the notification"
            });
        }
    }

    /**
     * CREATE BULK NOTIFICATIONS
     * POST /api/notification/bulk
     */
    static async createBulk(req: Request, res: Response) {
        try {
            const { notifications } = req.body;
            if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
                return res.status(400).json({ success: false, message: "Notifications array is required" });
            }

            const batch = db.batch();
            const results: any[] = [];

            for (const notif of notifications) {
                const { title, message, targetGroup, targetBatch, sentBy, priority, targetStudentId } = notif;
                if (!title || !message || !targetGroup) continue;

                // De-duplicate within bulk too (check database for duplicate sent in last 10 seconds)
                const dupSnapshot = await db.collection(COLLECTION)
                    .where("title", "==", title)
                    .where("content", "==", message)
                    .where("isDeleted", "==", false)
                    .get();

                const isDuplicate = dupSnapshot.docs.some(doc => {
                    const data = doc.data();
                    if (!data.createdAt) return false;
                    try {
                        const createdTime = data.createdAt.toDate().getTime();
                        return (Date.now() - createdTime) < 10000;
                    } catch {
                        return false;
                    }
                });
                if (isDuplicate) {
                    continue; // Skip this one to avoid duplicate
                }

                // Override existing fee payment alerts for this student to avoid duplicates
                if (targetStudentId && String(title).includes("Fee Payment Alert")) {
                    const existingAlerts = await db.collection(COLLECTION)
                        .where("targetStudentId", "==", targetStudentId)
                        .where("isDeleted", "==", false)
                        .get();
                    
                    existingAlerts.docs.forEach(doc => {
                        if (String(doc.data().title || "").includes("Fee Payment Alert")) {
                            batch.update(doc.ref, {
                                isDeleted: true,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                                deletedBy: "system_override"
                            });
                        }
                    });
                }

                const id = randomUUID();
                const payload = {
                    id,
                    title,
                    content: message,
                    priority: priority === "high" ? "high" : "normal",
                    targetDashboard: targetGroup,
                    targetBatch: targetBatch || null,
                    targetStudentId: targetStudentId || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: sentBy || "admin",
                    updatedBy: sentBy || "admin",
                    isDeleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    isNotification: true
                };

                const docRef = db.collection(COLLECTION).doc(id);
                batch.set(docRef, payload);
                results.push(payload);
            }

            let aggregateTokensFound = 0;
            let aggregateTicketsOk = 0;
            let aggregateTicketsError = 0;

            if (results.length > 0) {
                await batch.commit();
                // Invalidate student-facing cache so bulk notices are immediately visible
                generalCache.delete('all_active_announcements');

                // Trigger push notifications for bulk items (fee alerts or notices) in batches of 10
                const pushTasks = notifications.slice(0, 50).map(notifItem => {
                    const isFeeAlert = String(notifItem.title || "").includes("Fee Payment Alert");
                    return dispatchPushToExpo({
                        title: notifItem.title || "Academy Alert",
                        body: notifItem.message || notifItem.content || "Payment Reminder",
                        targetGroup: notifItem.targetGroup || "student",
                        targetStudentId: notifItem.targetStudentId || null,
                        targetBatch: notifItem.targetBatch || null,
                        data: {
                            targetTab: isFeeAlert ? "erp" : "dashboard",
                            targetSub: isFeeAlert ? "pay-fees" : "notices",
                            screen: isFeeAlert ? "erp" : "dashboard",
                            subTab: isFeeAlert ? "pay-fees" : "notices"
                        }
                    });
                });

                const pushResults = await Promise.allSettled(pushTasks);
                pushResults.forEach((res) => {
                    if (res.status === "fulfilled" && res.value) {
                        aggregateTokensFound += res.value.tokensFound || 0;
                        aggregateTicketsOk += res.value.ticketsOk || 0;
                        aggregateTicketsError += res.value.ticketsError || 0;
                    }
                });
            }

            return res.status(201).json({
                success: true,
                message: `Successfully sent ${results.length} notifications`,
                count: results.length,
                tokensFound: aggregateTokensFound,
                ticketsOk: aggregateTicketsOk,
                ticketsError: aggregateTicketsError
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while sending bulk notifications"
            });
        }
    }

    /**
     * GET NOTIFICATIONS FOR A USER (STUDENT OR GUEST)
     * GET /api/notification
     */
    static async getNotifications(req: Request, res: Response) {
        try {
            const { role, batch, studentId } = req.query;

            const cacheKey = `all_active_announcements`;
            let rawAnnouncements = generalCache.get<any[]>(cacheKey);

            if (!rawAnnouncements) {
                const snapshot = await db.collection(COLLECTION).where("isDeleted", "==", false).get();
                rawAnnouncements = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        message: data.content || data.message || "", // support both content/message fields
                        createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                        publishedAt: data.publishedAt ? (data.publishedAt as admin.firestore.Timestamp).toDate().toISOString() : null
                    };
                });
                generalCache.set(cacheKey, rawAnnouncements, 300); // 5 min cache
            }

            let notifications = [...rawAnnouncements];

            // Filter based on user target group
            if (role) {
                const userRole = String(role).toLowerCase();
                notifications = notifications.filter((notif: any) => {
                    // Filter out private notifications meant for other students
                    if (userRole === "student" && notif.targetStudentId) {
                        if (!studentId || String(notif.targetStudentId) !== String(studentId)) {
                            return false;
                        }
                    }

                    const target = String(notif.targetDashboard || notif.targetGroup || "all").toLowerCase();
                    if (target === "all") return true;

                    if (userRole === "guest") {
                        return target === "free";
                    }

                    if (userRole === "student") {
                        if (target === "paid" || target === "student") return true;
                        if (target === "batch") {
                            if (!batch) return false;
                            return String(notif.targetBatch).toLowerCase() === String(batch).toLowerCase();
                        }
                    }

                    if (userRole === "admin" || userRole === "staff") return true;

                    return false;
                });
            }

            // Sort: high priority first, then newest first
            notifications.sort((a: any, b: any) => {
                const priorityA = a.priority === "high" ? 1 : 0;
                const priorityB = b.priority === "high" ? 1 : 0;
                if (priorityA !== priorityB) return priorityB - priorityA;
                
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });

            return res.status(200).json({
                success: true,
                data: notifications
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving notifications"
            });
        }
    }

    /**
     * DELETE NOTIFICATION
     * DELETE /api/notification/:id
     */
    static async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const docRef = db.collection(COLLECTION).doc(id);
            const doc = await docRef.get();

            if (!doc.exists || doc.data()?.isDeleted) {
                return res.status(404).json({ success: false, message: "Notification not found" });
            }

            await docRef.update({ isDeleted: true });

            // Invalidate student-facing cache so deleted notice is no longer served
            generalCache.delete('all_active_announcements');

            return res.status(200).json({
                success: true,
                message: "Notification deleted successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while deleting the notification"
            });
        }
    }

    /**
     * UNREGISTER DEVICE PUSH TOKEN ON LOGOUT
     * POST /api/notification/unregister-token
     */
    static async unregisterToken(req: Request, res: Response) {
        try {
            const user = req.user;
            const targetId = user?.userId || user?.studentId || (user as any)?.id;
            const { token } = req.body;

            if (!targetId && !token) {
                return res.status(400).json({ success: false, message: "Authentication or token is required" });
            }

            const batch = db.batch();
            let count = 0;

            if (token) {
                const cleanDocId = token.replace(/[^a-zA-Z0-9_-]/g, "_");
                const webCleanDocId = "web_" + token.slice(-24).replace(/[^a-zA-Z0-9_-]/g, "_");
                batch.delete(db.collection("device_push_tokens").doc(cleanDocId));
                batch.delete(db.collection("device_push_tokens").doc(webCleanDocId));
                count++;
            }

            if (targetId) {
                const q1 = await db.collection("device_push_tokens").where("userId", "==", String(targetId)).get();
                q1.forEach((d) => batch.delete(d.ref));
                const q2 = await db.collection("device_push_tokens").where("studentId", "==", String(targetId)).get();
                q2.forEach((d) => batch.delete(d.ref));
                count += q1.size + q2.size;
            }

            await batch.commit();

            return res.status(200).json({
                success: true,
                message: "Token unregistered successfully",
                count
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to unregister token"
            });
        }
    }
}
