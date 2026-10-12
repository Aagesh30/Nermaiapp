import { Request, Response } from "express";
import admin from "firebase-admin";
import { randomUUID } from "crypto";
import { sendPushNotification } from "../../../services/pushService";

const db = admin.firestore();
const ADMISSIONS_COLLECTION = "admissions";

export class AdmissionController {
    /**
     * SUBMIT ADMISSION APPLICATION (Free/Guest User)
     * POST /api/crm/admission
     * Fields: name, phone, email (optional), city, preferredCourse
     */
    static async create(req: Request, res: Response) {
        try {
            const {
                name,
                email,
                phone,
                city,
                preferredCourse,
                course,
                preferredMode,
                mode,
                message,
                notes,
                remarks1,
                remarks2,
                natureOfEnquiry,
                atten,
                reference,
                joinStatus,
                status,
                createdBy
            } = req.body;

            if (!name || !phone) {
                return res.status(400).json({
                    success: false,
                    message: "Name and Phone are required"
                });
            }

            const id = randomUUID();
            const submittedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection(ADMISSIONS_COLLECTION).doc(id).set({
                id,
                name,
                email: email || "",
                phone,
                city: city || "",
                preferredCourse: preferredCourse || course || "",
                // legacy compat
                course: preferredCourse || course || "",
                preferredMode: preferredMode || mode || "",   // "online" | "offline" | "recorded"
                mode: mode || preferredMode || "Offline",
                message: message || "",
                notes: notes || remarks1 || "",
                remarks1: remarks1 || notes || "",
                remarks2: remarks2 || "",
                natureOfEnquiry: natureOfEnquiry || "phone",
                atten: atten || "Admin Staff",
                reference: reference || "",
                joinStatus: joinStatus || "new",
                status: status || (joinStatus === 'joined' ? 'converted' : 'pending'),
                submittedAt,
                createdAt: submittedAt,
                updatedAt: submittedAt,
                createdBy: createdBy || "guest",
                isDeleted: false
            });

            // Update the lead record to mark as applied (if found by email or phone)
            const leadQuery = email
                ? await db.collection("leads").where("email", "==", email.toLowerCase()).where("isDeleted", "==", false).limit(1).get()
                : await db.collection("leads").where("phone", "==", phone).where("isDeleted", "==", false).limit(1).get();

            if (!leadQuery.empty) {
                const batch = db.batch();
                leadQuery.docs.forEach(doc => {
                    batch.update(doc.ref, {
                        status: "applied",
                        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
                        // Also update name/phone on the lead if they were missing
                        name: doc.data().name || name,
                        phone: doc.data().phone || phone,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
            }

            // Dispatch push to admins
            sendPushNotification({
                title: "🎓 New Admission Application",
                body: `${name} (${phone}) submitted an application for ${preferredCourse || course || 'Academy Course'}.`,
                targetRole: "admin",
                excludeUserId: (req as any).user?.userId || null,
                data: {
                    targetTab: "crm",
                    targetSub: "admissions",
                    admissionId: id
                }
            }).catch(err => console.log("[Push] Admission push note:", err?.message));

            return res.status(201).json({
                success: true,
                message: "Admission application submitted successfully",
                data: { id }
            });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }

    /**
     * GET ALL ADMISSIONS (Admin)
     * GET /api/crm/admission
     * Query params: fromDate, toDate (ISO strings for filtering)
     */
    static async getAll(req: Request, res: Response) {
        try {
            const { fromDate, toDate } = req.query;

            let snapshot = await db.collection(ADMISSIONS_COLLECTION)
                .where("isDeleted", "==", false)
                .get();

            let admissions = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                    submittedAt: data.submittedAt ? (data.submittedAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                    updatedAt: data.updatedAt ? (data.updatedAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                };
            });

            // Sort by createdAt descending in memory
            admissions.sort((a, b) => {
                const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tB - tA;
            });

            // Filter by date range if provided
            if (fromDate) {
                const from = new Date(fromDate as string).getTime();
                admissions = admissions.filter(a => {
                    const ts = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    return ts >= from;
                });
            }
            if (toDate) {
                const to = new Date(toDate as string).getTime();
                admissions = admissions.filter(a => {
                    const ts = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
                    return ts <= to;
                });
            }

            return res.status(200).json({ success: true, data: admissions });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }

    /**
     * UPDATE ADMISSION STATUS (Admin)
     * PATCH /api/crm/admission/:id
     */
    static async updateStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const docRef = db.collection(ADMISSIONS_COLLECTION).doc(id);
            const doc = await docRef.get();

            if (!doc.exists || doc.data()?.isDeleted) {
                return res.status(404).json({ success: false, message: "Admission not found" });
            }

            const adminName = (req as any).user?.name || (req as any).user?.username || (req as any).user?.email || "Admin Staff";
            const updateData: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: req.body.updatedBy || adminName,
                updatedByAdminName: req.body.updatedByAdminName || req.body.atten || adminName
            };

            const allowedFields = [
                'status',
                'joinStatus',
                'updatedByAdminName',
                'natureOfEnquiry',
                'mode',
                'preferredMode',
                'atten',
                'attendedBy',
                'reminder1',
                'reminder2',
                'reminder3',
                'reference',
                'remarks1',
                'remarks2',
                'notes',
                'name',
                'studentName',
                'phone',
                'mobile',
                'email',
                'course',
                'preferredCourse',
                'city',
                'address'
            ];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            }

            // Synchronize status and joinStatus
            if (req.body.joinStatus) {
                updateData.joinStatus = req.body.joinStatus;
                if (!req.body.status) {
                    updateData.status = req.body.joinStatus === 'joined' ? 'converted' : 'pending';
                }
            } else if (req.body.status) {
                if (!req.body.joinStatus) {
                    if (req.body.status === 'converted') updateData.joinStatus = 'joined';
                    else if (req.body.status === 'applied') updateData.joinStatus = 'follow_up';
                    else if (req.body.status === 'new' || req.body.status === 'pending') updateData.joinStatus = 'new';
                }
            }

            await docRef.update(updateData);

            return res.status(200).json({ success: true, message: "Admission status updated", data: updateData });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }

    /**
     * DELETE ADMISSION (Admin - Soft delete)
     * DELETE /api/crm/admission/:id
     */
    static async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await db.collection(ADMISSIONS_COLLECTION).doc(id).update({
                isDeleted: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(200).json({ success: true, message: "Admission deleted" });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }
}
