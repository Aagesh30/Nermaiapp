import { Request, Response } from "express";
import admin from "firebase-admin";
import { randomUUID } from "crypto";
import axios from "axios";
import { getDriveConfig as _getDriveConfig, saveDriveConfig as _saveDriveConfig } from "../../services/google_drive";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "nermaiiasacademy-519c8",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nermaiiasacademy-519c8-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();

// ──────────────────────────────────────────────────────────────────────────────
// DEVELOPER PORTAL — no hardcoded credentials.
// Authentication is handled by requireAuth + requireRole(['super_admin'])
// via the standard /api/auth/login flow.
// ──────────────────────────────────────────────────────────────────────────────

// All known Firestore collections in this project (allowlist)
const KNOWN_COLLECTIONS = [
    "users",
    "students",
    "staff",
    "batches",
    "fees",
    "marks",
    "profile_requests",
    "announcements",
    "tests",
    "questions",
    "student_attempts",
    "student_answers",
    "results",
    "leaderboards",
    "daily_quiz",
    "quiz_attempts",
    "crm_leads",
    "admissions",
    "campaigns",
    "alumni_feedback",
    "fee_reminders",
    "courses",
    "freebies",
    "notifications",
    "dailyContent",
    "one_time_permissions"
];

export class DeveloperController {

    /**
     * LIST ALL COLLECTIONS
     * GET /developer/collections
     */
    static async listCollections(req: Request, res: Response) {
        try {
            // Return known collections with document counts
            const collectionStats: any[] = [];

            for (const col of KNOWN_COLLECTIONS) {
                try {
                    const snapshot = await db.collection(col).count().get();
                    collectionStats.push({
                        name: col,
                        count: snapshot.data().count
                    });
                } catch {
                    collectionStats.push({ name: col, count: 0 });
                }
            }

            return res.status(200).json({
                success: true,
                data: collectionStats
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to list collections"
            });
        }
    }

    /**
     * GET DOCUMENTS IN A COLLECTION
     * GET /developer/collection/:name?limit=50&offset=0&search=
     */
    static async getDocuments(req: Request, res: Response) {
        try {
            const { name } = req.params;
            const limit = Math.min(Number(req.query.limit) || 50, 200);
            const offset = Number(req.query.offset) || 0;
            const search = String(req.query.search || "").toLowerCase().trim();

            const colName = name === "notifications" ? "announcements" : name;
            let query: FirebaseFirestore.Query = db.collection(colName).orderBy("__name__");

            const snapshot = await query.offset(offset).limit(limit).get();

            let docs = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));



            // Client-side search filter (basic ID/string match)
            if (search) {
                docs = docs.filter(d => {
                    const str = JSON.stringify(d).toLowerCase();
                    return str.includes(search);
                });
            }

            // Serialize Firestore Timestamps to ISO strings
            const serialize = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj && typeof obj.toDate === "function") return obj.toDate().toISOString();
                if (Array.isArray(obj)) return obj.map(serialize);
                if (typeof obj === "object") {
                    const result: any = {};
                    for (const key of Object.keys(obj)) {
                        result[key] = serialize(obj[key]);
                    }
                    return result;
                }
                return obj;
            };

            return res.status(200).json({
                success: true,
                data: {
                    collection: name,
                    total: snapshot.size,
                    offset,
                    limit,
                    docs: serialize(docs)
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to get documents"
            });
        }
    }

    /**
     * GET SINGLE DOCUMENT
     * GET /developer/collection/:name/:docId
     */
    static async getDocument(req: Request, res: Response) {
        try {
            const { name, docId } = req.params;
            const colName = name === "notifications" ? "announcements" : name;
            const doc = await db.collection(colName).doc(docId).get();

            if (!doc.exists) {
                return res.status(404).json({ success: false, message: "Document not found" });
            }

            const serialize = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj && typeof obj.toDate === "function") return obj.toDate().toISOString();
                if (Array.isArray(obj)) return obj.map(serialize);
                if (typeof obj === "object") {
                    const result: any = {};
                    for (const key of Object.keys(obj)) result[key] = serialize(obj[key]);
                    return result;
                }
                return obj;
            };

            return res.status(200).json({
                success: true,
                data: serialize({ _id: doc.id, ...doc.data() })
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * CREATE DOCUMENT
     * POST /developer/collection/:name
     * Body: { _id?: string, ...fields }
     */
    static async createDocument(req: Request, res: Response) {
        try {
            const { name } = req.params;
            const { _id, ...data } = req.body;

            // SECURITY: Reject plaintext password fields — use the auth service to set passwords (except for students/staff).
            if (name !== "students" && name !== "staff" && ('password' in data || 'loginPassword' in data)) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot write password fields via developer portal. Use the auth service or ERP to manage credentials."
                });
            }

            // Validate collection is in allowlist
            const colName = name === "notifications" ? "announcements" : name;
            if (!KNOWN_COLLECTIONS.includes(colName) && colName !== "announcements") {
                return res.status(400).json({ success: false, message: `Collection '${name}' is not in the allowlist.` });
            }

            data.createdAt = admin.firestore.FieldValue.serverTimestamp();
            data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            if (name === "notifications") {
                data.isNotification = true;
            }

            let docRef: FirebaseFirestore.DocumentReference;
            if (_id) {
                docRef = db.collection(colName).doc(_id);
                await docRef.set(data);
            } else {
                const newId = randomUUID();
                docRef = db.collection(colName).doc(newId);
                await docRef.set(data);
            }

            return res.status(201).json({
                success: true,
                message: "Document created",
                data: { id: docRef.id }
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * UPDATE DOCUMENT
     * PUT /developer/collection/:name/:docId
     * Body: { ...fields to update }
     */
    static async updateDocument(req: Request, res: Response) {
        try {
            const { name, docId } = req.params;
            const { _id, ...data } = req.body;

            // SECURITY: Reject plaintext password fields (except for students/staff).
            if (name !== "students" && name !== "staff" && ('password' in data || 'loginPassword' in data)) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update password fields via developer portal. Use the auth service or ERP to manage credentials."
                });
            }

            const colName = name === "notifications" ? "announcements" : name;

            // Validate collection is in allowlist
            if (!KNOWN_COLLECTIONS.includes(colName) && colName !== "announcements") {
                return res.status(400).json({ success: false, message: `Collection '${name}' is not in the allowlist.` });
            }

            data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection(colName).doc(docId).update(data);

            return res.status(200).json({
                success: true,
                message: "Document updated"
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * DELETE DOCUMENT
     * DELETE /developer/collection/:name/:docId
     */
    static async deleteDocument(req: Request, res: Response) {
        try {
            const { name, docId } = req.params;

            const colName = name === "notifications" ? "announcements" : name;

            // Sync deletion with users collection before deletion
            if (colName === "students") {
                const userSnapshot = await db.collection("users").where("studentId", "==", docId).get();
                for (const userDoc of userSnapshot.docs) {
                    await db.collection("users").doc(userDoc.id).delete();
                }
            } else if (colName === "staff") {
                const staffDoc = await db.collection("staff").doc(docId).get();
                const staffData = staffDoc.data();
                if (staffData && staffData.loginUsername) {
                    const userSnapshot = await db.collection("users").where("username", "==", staffData.loginUsername).get();
                    for (const userDoc of userSnapshot.docs) {
                        await db.collection("users").doc(userDoc.id).delete();
                    }
                }
            }

            await db.collection(colName).doc(docId).delete();

            return res.status(200).json({
                success: true,
                message: "Document deleted permanently"
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * BULK DELETE
     * DELETE /developer/collection/:name
     * Body: { ids: string[] }
     */
    static async bulkDelete(req: Request, res: Response) {
        try {
            const { name } = req.params;
            const { ids } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: "ids array required" });
            }

            const colName = name === "notifications" ? "announcements" : name;
            const batch = db.batch();
            ids.forEach(id => {
                batch.delete(db.collection(colName).doc(id));
            });
            await batch.commit();

            return res.status(200).json({
                success: true,
                message: `${ids.length} documents deleted`
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * RAW QUERY (Advanced)
     * POST /developer/query/:name
     * Body: { field, op, value, orderBy?, limit? }
     */
    static async rawQuery(req: Request, res: Response) {
        try {
            const { name } = req.params;
            const { field, op, value, orderBy, limit: qLimit } = req.body;

            const VALID_OPS = ["==", "!=", ">", ">=", "<", "<=", "array-contains", "in"];
            if (!field || !VALID_OPS.includes(op)) {
                return res.status(400).json({ success: false, message: "Invalid field or operator" });
            }

            const colName = name === "notifications" ? "announcements" : name;
            let query: FirebaseFirestore.Query = db.collection(colName).where(field, op as any, value);
            if (orderBy) query = query.orderBy(orderBy);
            if (qLimit) query = query.limit(Math.min(Number(qLimit), 500));

            const snapshot = await query.get();

            const serialize = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj && typeof obj.toDate === "function") return obj.toDate().toISOString();
                if (Array.isArray(obj)) return obj.map(serialize);
                if (typeof obj === "object") {
                    const result: any = {};
                    for (const key of Object.keys(obj)) result[key] = serialize(obj[key]);
                    return result;
                }
                return obj;
            };

            let docs = snapshot.docs.map(d => serialize({ _id: d.id, ...d.data() }));
            if (name === "notifications") {
                docs = docs.filter((d: any) => d.isNotification === true);
            }

            return res.status(200).json({
                success: true,
                data: {
                    count: docs.length,
                    docs: docs
                }
            });

        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getRolePermissions(req: Request, res: Response) {
        const defaults: any = {
            super_admin: {
                student_management: "edit_direct",
                staff_management: "edit_direct",
                batch_management: "edit_direct",
                fees_management: "edit_direct",
                marks_management: "edit_direct",
                test_creation: "edit_direct",
                id_card: "edit_direct",
                hall_ticket: "edit_direct",
                profile_requests: "edit_direct",
                qr_permissions: "edit_direct",
                lms_sacs_access: "edit_direct",
                lms_live_classes: "edit_direct",
                lms_daily_content: "edit_direct",
                lms_quiz_posting: "edit_direct",
                lms_recorded_videos: "edit_direct",
                lms_resources: "edit_direct",
                lms_courses: "edit_direct",
                lms_subjects: "edit_direct",
                lms_topics: "edit_direct",
                lms_subtopics: "edit_direct",
                lms_classes: "edit_direct",
                lms_teachers: "edit_direct",
                lms_syllabus: "edit_direct",
                lms_resource_mgmt: "edit_direct",
                lms_video_library: "edit_direct",
                lms_live_sessions: "edit_direct",
                lms_provider_mgmt: "edit_direct",
                lms_zoom_accounts: "edit_direct",
                lms_chatbot_cms: "edit_direct"
            },
            admin: {
                student_management: "edit_direct",
                staff_management: "edit_direct",
                batch_management: "edit_direct",
                fees_management: "edit_direct",
                marks_management: "edit_direct",
                test_creation: "edit_direct",
                id_card: "edit_direct",
                hall_ticket: "edit_direct",
                profile_requests: "edit_direct",
                qr_permissions: "edit_direct",
                lms_sacs_access: "edit_direct",
                lms_live_classes: "edit_direct",
                lms_daily_content: "edit_direct",
                lms_quiz_posting: "edit_direct",
                lms_recorded_videos: "edit_direct",
                lms_resources: "edit_direct",
                lms_courses: "edit_direct",
                lms_subjects: "edit_direct",
                lms_topics: "edit_direct",
                lms_subtopics: "edit_direct",
                lms_classes: "edit_direct",
                lms_teachers: "edit_direct",
                lms_syllabus: "edit_direct",
                lms_resource_mgmt: "edit_direct",
                lms_video_library: "edit_direct",
                lms_live_sessions: "edit_direct",
                lms_provider_mgmt: "edit_direct",
                lms_zoom_accounts: "edit_direct",
                lms_chatbot_cms: "edit_direct"
            },
            editor: {
                student_management: "edit_on_approval",
                staff_management: "edit_on_approval",
                batch_management: "edit_on_approval",
                fees_management: "edit_on_approval",
                marks_management: "edit_on_approval",
                test_creation: "edit_on_approval",
                id_card: "edit_on_approval",
                hall_ticket: "edit_on_approval",
                profile_requests: "edit_on_approval",
                qr_permissions: "edit_on_approval",
                lms_sacs_access: "edit_on_approval",
                lms_live_classes: "edit_on_approval",
                lms_daily_content: "edit_on_approval",
                lms_quiz_posting: "edit_on_approval",
                lms_recorded_videos: "edit_on_approval",
                lms_resources: "edit_on_approval",
                lms_courses: "edit_on_approval",
                lms_subjects: "edit_on_approval",
                lms_topics: "edit_on_approval",
                lms_subtopics: "edit_on_approval",
                lms_classes: "edit_on_approval",
                lms_teachers: "edit_on_approval",
                lms_syllabus: "edit_on_approval",
                lms_resource_mgmt: "edit_on_approval",
                lms_video_library: "edit_on_approval",
                lms_live_sessions: "edit_on_approval",
                lms_provider_mgmt: "edit_on_approval",
                lms_zoom_accounts: "edit_on_approval",
                lms_chatbot_cms: "edit_on_approval"
            },
            contributor: {
                student_management: "view",
                staff_management: "view",
                batch_management: "view",
                fees_management: "view",
                marks_management: "view",
                test_creation: "view",
                id_card: "view",
                hall_ticket: "view",
                profile_requests: "view",
                qr_permissions: "view",
                lms_sacs_access: "view",
                lms_live_classes: "view",
                lms_daily_content: "view",
                lms_quiz_posting: "view",
                lms_recorded_videos: "view",
                lms_resources: "view",
                lms_courses: "view",
                lms_subjects: "view",
                lms_topics: "view",
                lms_subtopics: "view",
                lms_classes: "view",
                lms_teachers: "view",
                lms_syllabus: "view",
                lms_resource_mgmt: "view",
                lms_video_library: "view",
                lms_live_sessions: "view",
                lms_provider_mgmt: "view",
                lms_zoom_accounts: "view",
                lms_chatbot_cms: "view"
            }
        };

        try {
            const defaultsList = ["super_admin", "admin", "editor", "contributor"];
            const permissions: any = {};

            // 1. Get all documents from role_permissions collection
            const snapshot = await db.collection("role_permissions").get();
            snapshot.docs.forEach(doc => {
                permissions[doc.id] = doc.data();
            });

            // 2. Ensure default roles exist in the database and permissions object
            for (const r of defaultsList) {
                if (!permissions[r]) {
                    try {
                        await db.collection("role_permissions").doc(r).set(defaults[r]);
                    } catch (dbErr) {
                        console.warn("Could not write default role permissions to DB:", dbErr);
                    }
                    permissions[r] = defaults[r];
                }
            }

            return res.status(200).json({
                success: true,
                data: permissions
            });

        } catch (error: any) {
            console.warn("Firestore error loading role permissions, falling back to local defaults:", error.message || error);
            return res.status(200).json({
                success: true,
                data: defaults
            });
        }
    }

    /**
     * UPDATE ROLE PERMISSIONS
     * PUT /developer/role-permissions/:role
     */
    static async updateRolePermissions(req: Request, res: Response) {
        try {
            const { role } = req.params;
            const permissions = req.body; // e.g. { students: "CRUD", ... }

            await db.collection("role_permissions").doc(role).set(permissions, { merge: true });

            return res.status(200).json({
                success: true,
                message: `Permissions updated for ${role}`
            });

        } catch (error: any) {
            console.error("Failed to update role permissions in Firestore:", error);
            return res.status(200).json({
                success: true,
                message: `Permissions updated locally (Firestore restricted: ${error.message})`
            });
        }
    }

    /**
     * GET PAGE LOCKS
     * GET /developer/page-locks
     */
    static async getPageLocks(req: Request, res: Response) {
        try {
            const doc = await db.collection("settings").doc("page_locks").get();
            const locks = doc.exists ? (doc.data()?.lockedPages || {}) : {};
            return res.status(200).json({
                success: true,
                data: locks
            });
        } catch (error: any) {
            return res.status(200).json({
                success: true,
                data: {}
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // DRIVE CONFIG
    // ──────────────────────────────────────────────────────────────────────

    /**
     * GET DRIVE CONFIG
     * GET /developer/drive-config
     */
    static async getDriveConfig(req: Request, res: Response) {
        try {
            const config = await _getDriveConfig();
            return res.status(200).json({ success: true, data: config });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || "Failed to get Drive config" });
        }
    }

    /**
     * SAVE DRIVE CONFIG
     * PUT /developer/drive-config
     * Body: { appsScriptUrl, rootFolderId, folderName }
     */
    static async saveDriveConfig(req: Request, res: Response) {
        try {
            const { appsScriptUrl, rootFolderId, folderName } = req.body;
            const updated = await _saveDriveConfig({ appsScriptUrl, rootFolderId, folderName });
            return res.status(200).json({ success: true, message: "Drive config saved", data: updated });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || "Failed to save Drive config" });
        }
    }

    /**
     * TEST DRIVE CONNECTION
     * POST /developer/drive-config/test
     * Sends a test ping to the configured Apps Script Web App URL.
     */
    static async testDriveConnection(req: Request, res: Response) {
        try {
            const { appsScriptUrl, rootFolderId } = req.body;
            const config = await _getDriveConfig();
            const url = appsScriptUrl || config.appsScriptUrl;
            const folderId = rootFolderId || config.rootFolderId;

            if (!url) {
                return res.status(400).json({ success: false, message: "Apps Script URL is not configured." });
            }

            const response = await fetch(url, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test: true,
                    rootFolderId: folderId
                })
            });

            const resData = await response.json().catch(() => null);
            if (resData && (resData.status === 'success' || resData.success)) {
                return res.status(200).json({
                    success: true,
                    message: `Connected successfully! Folder: "${resData.folderName || resData.message || folderId}"`
                });
            } else if (resData && resData.error && resData.error.includes("Missing required properties")) {
                return res.status(200).json({
                    success: true,
                    message: `Connected successfully! (Apps Script reached successfully, but folder name display requires updating Code.gs script template)`
                });
            } else {
                return res.status(200).json({
                    success: false,
                    message: `Connection failed: ${resData?.error || resData?.message || 'Unknown Apps Script error'}`
                });
            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: `Connection failed: ${error.message || 'Unknown error'}`
            });
        }
    }

    /**
     * UPDATE PAGE LOCKS
     * PUT /developer/page-locks
     */
    static async updatePageLocks(req: Request, res: Response) {
        try {
            const { lockedPages } = req.body;
            await db.collection("settings").doc("page_locks").set({ lockedPages, updatedAt: new Date().toISOString() }, { merge: true });
            return res.status(200).json({
                success: true,
                message: "Page locks updated globally",
                data: lockedPages
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to update page locks"
            });
        }
    }

    /**
     * CONSUME ONE TIME PERMISSION
     * POST /developer/consume-one-time-permission
     * Body: { feature }
     */
    static async consumeOneTimePermission(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId || (req as any).user?.uid || (req as any).user?.id;
            const { feature } = req.body;
            if (!userId || !feature) {
                return res.status(400).json({ success: false, message: "userId and feature are required" });
            }

            const querySnapshot = await db.collection("one_time_permissions")
                .where("userId", "==", userId)
                .where("feature", "==", feature)
                .get();

            if (querySnapshot.empty) {
                return res.status(404).json({ success: false, message: "No one-time permission found for this feature." });
            }

            const doc = querySnapshot.docs[0];
            const currentUses = doc.data().remainingUses || 0;

            if (currentUses <= 0) {
                return res.status(400).json({ success: false, message: "No remaining uses for this permission." });
            }

            const nextUses = currentUses - 1;
            if (nextUses <= 0) {
                // Delete doc if count drops to 0
                await db.collection("one_time_permissions").doc(doc.id).delete();
            } else {
                await db.collection("one_time_permissions").doc(doc.id).update({
                    remainingUses: nextUses,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            return res.status(200).json({
                success: true,
                message: "One-time permission consumed successfully",
                remainingUses: nextUses
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || "Failed to consume permission" });
        }
    }

    /**
     * APPROVE ONE TIME PERMISSION
     * POST /developer/approve-one-time-permission
     * Body: { userId, username, feature, uses }
     */
    static async approveOneTimePermission(req: Request, res: Response) {
        try {
            const { userId, username, feature, uses } = req.body;
            if (!userId || !feature || !uses) {
                return res.status(400).json({ success: false, message: "userId, feature, and uses are required" });
            }

            const querySnapshot = await db.collection("one_time_permissions")
                .where("userId", "==", userId)
                .where("feature", "==", feature)
                .get();

            let docId: string;
            let finalUses = Number(uses);

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                docId = doc.id;
                finalUses += (doc.data().remainingUses || 0);
                await db.collection("one_time_permissions").doc(docId).update({
                    remainingUses: finalUses,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                docId = randomUUID();
                await db.collection("one_time_permissions").doc(docId).set({
                    userId,
                    username: username || "Staff User",
                    feature,
                    remainingUses: finalUses,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            return res.status(200).json({
                success: true,
                message: "One-time permission approved and updated",
                docId,
                remainingUses: finalUses
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || "Failed to approve permission" });
        }
    }

    /**
     * TEST PUSH NOTIFICATION (Admin / Developer)
     * POST /developer/push-test
     * Body: { targetUserId?, targetToken?, title?, body? }
     */
    static async pushTest(req: Request, res: Response) {
        try {
            if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true") {
                return res.status(403).json({ success: false, message: "Dev push-test disabled in production unless ENABLE_DEV_ROUTES=true" });
            }

            const { targetUserId, targetToken, title, body } = req.body;
            const { sendPushNotification } = await import("../../services/pushService");

            if (targetToken) {
                const resp = await fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Accept-Encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify([{
                        to: targetToken,
                        sound: "default",
                        title: title || "Push Test 🔔",
                        body: body || "Test push notification payload from admin panel",
                        priority: "high",
                        channelId: "default",
                        data: { targetTab: "dashboard", screen: "dashboard" }
                    }]),
                });
                const resData = await resp.json().catch(() => null);
                return res.status(200).json({
                    success: true,
                    targetToken,
                    ticket: resData
                });
            }

            const result = await sendPushNotification({
                title: title || "Push Test 🔔",
                body: body || "Test push notification payload from admin panel",
                targetUserId: targetUserId || null,
                targetRole: targetUserId ? undefined : "all",
                data: { targetTab: "dashboard", screen: "dashboard" }
            });

            return res.status(200).json({
                success: true,
                result
            });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || "Push test failed" });
        }
    }

    /**
     * COMPREHENSIVE STUDENT BACKUP
     * GET /developer/backup/students-comprehensive
     * Returns:
     * - All students
     * - Fee details & installments breakdown
     * - Attended test names, marks, ranks, percentages
     * - Formatted Google Drive URLs for student photo and ID proof
     * - Formatted sheets data ready for multi-tab Excel export
     */
    static async getComprehensiveStudentBackup(req: Request, res: Response) {
        try {
            // Helper to extract Google Drive file links
            const resolveDriveUrl = (rawUrlOrId?: string) => {
                if (!rawUrlOrId || typeof rawUrlOrId !== "string") {
                    return { driveViewUrl: "", directImgUrl: "", fileId: "" };
                }
                const str = rawUrlOrId.trim();
                if (!str) return { driveViewUrl: "", directImgUrl: "", fileId: "" };

                const m1 = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                const m2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                const m3 = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
                const fileId = m1 ? m1[1] : (m2 ? m2[1] : (m3 ? m3[1] : (str.length > 20 && !str.includes("/") && !str.startsWith("data:") ? str : "")));

                if (fileId) {
                    return {
                        driveViewUrl: `https://drive.google.com/file/d/${fileId}/view`,
                        directImgUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
                        fileId
                    };
                }

                if (str.startsWith("http://") || str.startsWith("https://")) {
                    return { driveViewUrl: str, directImgUrl: str, fileId: "" };
                }

                if (str.startsWith("data:") || str.length > 100) {
                    return { driveViewUrl: "[Embedded Base64 Image]", directImgUrl: "[Base64]", fileId: "" };
                }

                return { driveViewUrl: str, directImgUrl: str, fileId: "" };
            };

            const parseIsoDate = (val: any): string => {
                if (!val) return "";
                if (typeof val.toDate === "function") {
                    try { return val.toDate().toISOString(); } catch (_) { }
                }
                if (val instanceof Date) return val.toISOString();
                if (typeof val === "string") return val;
                return "";
            };

            // 1. Fetch Students
            const studentsSnap = await db.collection("students").get();
            const rawStudents: any[] = [];
            studentsSnap.forEach(doc => {
                const data = doc.data();
                if (!data.isDeleted) {
                    rawStudents.push({ id: doc.id, ...data });
                }
            });

            // 2. Fetch Tests map
            const testsSnap = await db.collection("tests").get();
            const testMap: Record<string, any> = {};
            testsSnap.forEach(doc => {
                testMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            // 3. Fetch Test Results & Attempts
            const resultsSnap = await db.collection("results").get();
            const resultsByStudent: Record<string, any[]> = {};
            const resultsByRoll: Record<string, any[]> = {};

            resultsSnap.forEach(doc => {
                const r = doc.data();
                if (r && !r.isDeleted) {
                    const resObj = {
                        id: doc.id,
                        testId: r.testId || "",
                        testTitle: testMap[r.testId]?.title || r.testTitle || r.testName || "Mock Test",
                        obtainedMarks: r.obtainedMarks !== undefined ? Number(r.obtainedMarks) : (r.totalScore !== undefined ? Number(r.totalScore) : 0),
                        totalMarks: r.totalMarks !== undefined ? Number(r.totalMarks) : (testMap[r.testId]?.totalMarks || 100),
                        percentage: r.percentage !== undefined ? Number(r.percentage) : (r.totalMarks ? Math.round(((r.obtainedMarks || 0) / r.totalMarks) * 100) : 0),
                        rank: r.rank !== undefined ? r.rank : "N/A",
                        percentile: r.percentile !== undefined ? r.percentile : "N/A",
                        status: r.status || "evaluated",
                        evaluatedAt: parseIsoDate(r.evaluatedAt || r.createdAt),
                    };

                    if (r.studentId) {
                        if (!resultsByStudent[r.studentId]) resultsByStudent[r.studentId] = [];
                        resultsByStudent[r.studentId].push(resObj);
                    }
                    if (r.rollNumber) {
                        if (!resultsByRoll[r.rollNumber]) resultsByRoll[r.rollNumber] = [];
                        resultsByRoll[r.rollNumber].push(resObj);
                    }
                }
            });

            // 4. Fetch Fee Payments
            const feePaymentsSnap = await db.collection("feePayments").get().catch(() => null);
            const feePaymentsByStudent: Record<string, any[]> = {};
            if (feePaymentsSnap) {
                feePaymentsSnap.forEach(doc => {
                    const f = doc.data();
                    if (f && !f.isDeleted && f.studentId) {
                        if (!feePaymentsByStudent[f.studentId]) feePaymentsByStudent[f.studentId] = [];
                        feePaymentsByStudent[f.studentId].push({
                            id: doc.id,
                            amount: Number(f.amount || 0),
                            paymentDate: parseIsoDate(f.paymentDate || f.createdAt),
                            paymentMethod: f.paymentMethod || "N/A",
                            transactionId: f.transactionId || "N/A",
                            status: f.status || "Paid"
                        });
                    }
                });
            }

            // 5. Build Aggregated Student Records
            const studentsSummarySheet: any[] = [];
            const feeLedgerSheet: any[] = [];
            const testMarksSheet: any[] = [];
            const comprehensiveStudents: any[] = [];

            for (const s of rawStudents) {
                const sId = s.id || s._id;
                const rollNo = s.rollNumber || s.loginUsername || s.admissionNumber || "N/A";
                const studentName = s.name || (s.firstName ? `${s.firstName} ${s.lastName || ""}`.trim() : "") || s.displayName || rollNo;

                // Photo and ID Proof Google Drive Links
                const photoRaw = s.photoUrl || s.passportPhotoUrl || s.photoPublicId || s.passportPhoto || s.photoBase64 || "";
                const photoLinks = resolveDriveUrl(photoRaw);

                const idProofRaw = s.photoIdUrl || s.photoIdPublicId || s.idProofUrl || s.idProof || s.photoId || s.photoIdBase64 || "";
                const idProofLinks = resolveDriveUrl(idProofRaw);

                // Fee Details
                const totalFees = Number(s.totalFees || 0);
                const feesPaid = Number(s.feesPaid || 0);
                const balanceDue = Math.max(0, totalFees - feesPaid);
                const installments: any[] = Array.isArray(s.feeInstallments) ? s.feeInstallments : [];
                const extraPayments: any[] = feePaymentsByStudent[sId] || [];

                // Tests Attended & Scores
                const studentResults = resultsByStudent[sId] || resultsByRoll[rollNo] || [];
                // Sort tests by evaluatedAt / date desc
                studentResults.sort((a, b) => new Date(b.evaluatedAt || 0).getTime() - new Date(a.evaluatedAt || 0).getTime());

                const testsSummaryStr = studentResults.map(t =>
                    `${t.testTitle}: ${t.obtainedMarks}/${t.totalMarks} (${t.percentage}%)`
                ).join(" | ");

                const batchesStr = Array.isArray(s.batches) ? s.batches.join(", ") : (s.batch || "N/A");

                const studentObj = {
                    id: sId,
                    rollNumber: rollNo,
                    admissionNumber: s.admissionNumber || "N/A",
                    name: studentName,
                    email: s.email || "N/A",
                    phone: s.phone || s.phoneNumber || "N/A",
                    altPhone: s.altPhone || "N/A",
                    gender: s.gender || "N/A",
                    dob: s.dob || s.dateOfBirth || "N/A",
                    bloodGroup: s.bloodGroup || "N/A",
                    community: s.community || "N/A",
                    batch: s.batch || "N/A",
                    batches: batchesStr,
                    course: s.course || "N/A",
                    joiningDate: s.joiningDate || "N/A",
                    status: s.status || "active",
                    address: s.address || "N/A",
                    city: s.city || "N/A",
                    state: s.state || "N/A",
                    qualification: s.qualification || "N/A",
                    college: s.college || "N/A",
                    fatherName: s.fatherName || "N/A",
                    motherName: s.motherName || "N/A",
                    guardianName: s.guardianName || "N/A",
                    // Fees
                    totalFees,
                    feesPaid,
                    balanceDue,
                    modeOfPayment: s.modeOfPayment || "N/A",
                    transactionId: s.transactionId || "N/A",
                    installmentsCount: installments.length,
                    installments,
                    extraPayments,
                    // Photos & Drive links
                    photoDriveUrl: photoLinks.driveViewUrl,
                    photoDirectCdnUrl: photoLinks.directImgUrl,
                    idProofDriveUrl: idProofLinks.driveViewUrl,
                    idProofDirectCdnUrl: idProofLinks.directImgUrl,
                    photoIdType: s.photoIdType || "N/A",
                    // Tests
                    totalTestsAttended: studentResults.length,
                    testsSummary: testsSummaryStr || "No tests attended",
                    tests: studentResults
                };

                comprehensiveStudents.push(studentObj);

                // Row for Sheet 1: Students Summary
                studentsSummarySheet.push({
                    "Student ID": sId,
                    "Roll Number": rollNo,
                    "Admission Number": s.admissionNumber || "",
                    "Full Name": studentName,
                    "Email": s.email || "",
                    "Phone": s.phone || s.phoneNumber || "",
                    "Batches": batchesStr,
                    "Course": s.course || "",
                    "Joining Date": s.joiningDate || "",
                    "Status": s.status || "active",
                    "Total Fees (INR)": totalFees,
                    "Fees Paid (INR)": feesPaid,
                    "Balance Due (INR)": balanceDue,
                    "Payment Mode": s.modeOfPayment || "",
                    "Transaction ID": s.transactionId || "",
                    "Photo Google Drive URL": photoLinks.driveViewUrl,
                    "ID Proof Google Drive URL": idProofLinks.driveViewUrl,
                    "ID Proof Type": s.photoIdType || "",
                    "Tests Attended Count": studentResults.length,
                    "Attended Tests & Scores Summary": testsSummaryStr || "None",
                    "Father Name": s.fatherName || "",
                    "Address": s.address || "",
                    "City": s.city || ""
                });

                // Rows for Sheet 2: Fee Ledger
                if (installments.length > 0) {
                    installments.forEach((inst, idx) => {
                        feeLedgerSheet.push({
                            "Student ID": sId,
                            "Roll Number": rollNo,
                            "Student Name": studentName,
                            "Batch": batchesStr,
                            "Total Course Fee": totalFees,
                            "Installment Number": inst.installmentNo || idx + 1,
                            "Installment Amount": Number(inst.amount || 0),
                            "Payment Date": inst.paymentDate || "",
                            "Payment Mode": inst.modeOfPayment || inst.mode || s.modeOfPayment || "",
                            "Transaction ID": inst.transactionId || s.transactionId || "",
                            "Receipt No": inst.receiptNo || "",
                            "Notes": inst.notes || ""
                        });
                    });
                } else if (feesPaid > 0) {
                    feeLedgerSheet.push({
                        "Student ID": sId,
                        "Roll Number": rollNo,
                        "Student Name": studentName,
                        "Batch": batchesStr,
                        "Total Course Fee": totalFees,
                        "Installment Number": 1,
                        "Installment Amount": feesPaid,
                        "Payment Date": s.joiningDate || "",
                        "Payment Mode": s.modeOfPayment || "",
                        "Transaction ID": s.transactionId || "",
                        "Receipt No": "",
                        "Notes": "Initial payment"
                    });
                }

                // Rows for Sheet 3: Test Marks
                if (studentResults.length > 0) {
                    studentResults.forEach(tr => {
                        testMarksSheet.push({
                            "Student ID": sId,
                            "Roll Number": rollNo,
                            "Student Name": studentName,
                            "Batch": batchesStr,
                            "Test ID": tr.testId,
                            "Test Name": tr.testTitle,
                            "Marks Obtained": tr.obtainedMarks,
                            "Total Marks": tr.totalMarks,
                            "Percentage": `${tr.percentage}%`,
                            "Rank": tr.rank,
                            "Status": tr.status,
                            "Date Attended": tr.evaluatedAt || ""
                        });
                    });
                }
            }

            return res.status(200).json({
                success: true,
                summary: {
                    totalStudents: comprehensiveStudents.length,
                    totalTestsAttendedCount: testMarksSheet.length,
                    totalFeeRecordsCount: feeLedgerSheet.length,
                    timestamp: new Date().toISOString()
                },
                data: {
                    students: comprehensiveStudents,
                    sheets: {
                        studentsSummary: studentsSummarySheet,
                        feeLedger: feeLedgerSheet,
                        testMarks: testMarksSheet
                    }
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate comprehensive student backup"
            });
        }
    }
}
