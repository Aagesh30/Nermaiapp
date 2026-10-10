import { Request, Response } from "express";
import admin from "firebase-admin";
import { randomUUID } from "crypto";
import { env } from "../../../config/env";
import { storage } from "../../../infrastructure/firebase";

const db = admin.firestore();
const CONTENT_COLLECTION = "dailyContent";

import { uploadFileToGoogleDrive, deleteFileFromGoogleDrive } from "../../../services/google_drive";
import { sendPushNotification } from "../../../services/pushService";

export class DailyContentController {
    /**
     * CREATE DAILY CONTENT (Admin/Staff)
     * POST /api/lms/daily-content
     */
    static async createDailyContent(req: Request, res: Response) {
        try {
            const {
                title,
                type,           // "image" | "pdf"
                source,         // "url" | "file"
                url,            // optional, for URL upload
                fileBase64,     // optional, for direct file upload (data URL or base64)
                fileName,       // optional, e.g. "Affairs_August_10.pdf"
                date,           // YYYY-MM-DD
                targetAudience, // "all" | "paid" | "batch"
                targetBatch,    // optional specific batch name e.g. "Batch 43"
                description,    // optional brief summary
                createdBy
            } = req.body;

            if (!title || !type || !source || !date) {
                return res.status(400).json({
                    success: false,
                    message: "title, type, source, and date are required fields"
                });
            }

            if (source === "url" && !url) {
                return res.status(400).json({
                    success: false,
                    message: "URL is required when source is 'url'"
                });
            }

            if (source === "file" && !fileBase64) {
                return res.status(400).json({
                    success: false,
                    message: "File payload is required when source is 'file'"
                });
            }

            const contentId = randomUUID();
            const now = admin.firestore.FieldValue.serverTimestamp();

            const payload: any = {
                id: contentId,
                title,
                type,
                source,
                date,
                targetAudience: targetAudience || "all",
                targetBatch: targetBatch || null,
                description: description || null,
                fileName: fileName || null,
                createdAt: now,
                updatedAt: now,
                createdBy: createdBy || "admin",
                isDeleted: false,
                status: req.body.status || "approved"
            };

            if (source === "url") {
                payload.url = url;
            } else if (source === "file" && fileBase64) {
                // Parse base64 and upload to Google Drive or Firebase Storage
                let pureBase64 = fileBase64;
                let detectedMime = type === "image" ? "image/jpeg" : "application/pdf";

                if (fileBase64.startsWith("data:")) {
                    const commaIdx = fileBase64.indexOf(",");
                    const mimeMatch = fileBase64.substring(0, commaIdx).match(/data:(.*?);base64/);
                    if (mimeMatch && mimeMatch[1]) {
                        detectedMime = mimeMatch[1];
                    }
                    pureBase64 = fileBase64.substring(commaIdx + 1);
                }

                const fileBuffer = Buffer.from(pureBase64, "base64");
                const safeFileTitle = (title || "content").replace(/[^a-zA-Z0-9_-]/g, "_");
                const ext = type === "image" ? "jpg" : "pdf";
                const targetFileName = fileName || `Daily_${date}_${safeFileTitle}.${ext}`;

                // Try Google Drive first
                try {
                    const driveUpload = await uploadFileToGoogleDrive({
                        fileName: targetFileName,
                        mimeType: detectedMime,
                        buffer: fileBuffer,
                        subPath: "LMS/Daily Content"
                    });

                    if (driveUpload && driveUpload.previewUrl) {
                        payload.url = driveUpload.previewUrl;
                        payload.googleDriveFileId = driveUpload.fileId;
                        payload.googleDriveWebViewLink = driveUpload.webViewLink;
                        payload.source = "drive";
                        console.log(`✅ Daily content synced to Google Drive: ${payload.url}`);
                    }
                } catch (driveErr: any) {
                    console.warn("Google Drive upload skipped/failed:", driveErr?.message);
                }

                // Primary Cloud Storage: Firebase / Google Cloud Storage (nermaiiasacademy-519c8-resources)
                if (!payload.url) {
                    try {
                        const bucketName = process.env.STORAGE_BUCKET || env.GCP_STORAGE_BUCKET || "nermaiiasacademy-519c8-resources";
                        const bucket = storage.bucket(bucketName);
                        const storagePath = `daily_content/${contentId}/${targetFileName}`;
                        const fileRef = bucket.file(storagePath);
                        await fileRef.save(fileBuffer, {
                            metadata: {
                                contentType: detectedMime,
                                cacheControl: "public, max-age=3600"
                            }
                        });
                        await fileRef.makePublic().catch((e: any) => console.warn("makePublic note:", e?.message));
                        const publicUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
                        payload.url = publicUrl;
                        payload.source = "storage";
                        console.log(`✅ Daily content uploaded to Firebase Storage: ${payload.url}`);
                    } catch (storageErr: any) {
                        console.error("Firebase Storage upload failed:", storageErr?.message);
                        throw new Error(`Failed to upload file to storage: ${storageErr?.message}`);
                    }
                }
            }

            await db.collection(CONTENT_COLLECTION).doc(contentId).set(payload);

            // Dispatch background push notification to target audience / batch
            sendPushNotification({
                title: "📰 Daily Study Content Released",
                body: `${title} (${date}) is now available in your LMS daily content.`,
                targetRole: "student",
                targetBatch: payload.targetBatch,
                data: {
                    targetTab: "lms",
                    targetSub: "daily-content",
                    contentId
                }
            }).catch(err => console.log("[Push] Daily content creation push note:", err?.message));

            return res.status(200).json({
                success: true,
                message: "Daily content added successfully",
                data: {
                    id: contentId,
                    title,
                    date,
                    url: payload.url || null,
                    targetAudience: payload.targetAudience,
                    targetBatch: payload.targetBatch
                }
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while saving daily content"
            });
        }
    }

    /**
     * GET DAILY CONTENT (Students/Admins)
     * GET /api/lms/daily-content
     */
    static async getDailyContent(req: Request, res: Response) {
        try {
            const { date, batch, isPaid } = req.query;
            let finalBatch = batch;
            let finalIsPaid = isPaid;

            if (req.user && req.user.role === "student") {
                const userDoc = await db.collection("users").doc(req.user.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const studentId = userData?.studentId || req.user.userId;
                    const studentDoc = await db.collection("students").doc(studentId).get();
                    if (studentDoc.exists) {
                        const studentData = studentDoc.data();
                        if (!finalBatch) {
                            if (Array.isArray(studentData?.batches) && studentData.batches.length > 0) {
                                finalBatch = studentData.batches.join(',');
                            } else if (studentData?.batch || studentData?.batchName) {
                                finalBatch = studentData?.batch || studentData?.batchName;
                            }
                        }
                        if (finalIsPaid === undefined) {
                            const isPaidStudent = studentData?.isPaid || (Number(studentData?.feesPaid) > 0) || studentData?.type === "paid" || userData?.type === "paid" || studentData?.status === "active" || studentData?.status === "enrolled" || userData?.status === "active" || userData?.status === "enrolled" || !!studentData?.batch;
                            finalIsPaid = isPaidStudent ? "true" : "false";
                        }
                    } else if (finalIsPaid === undefined) {
                        const isPaidUser = userData?.type === "paid" || userData?.isPaid || userData?.status === "active" || userData?.status === "enrolled" || !!userData?.batch;
                        finalIsPaid = isPaidUser ? "true" : "false";
                    }
                }
            }

            let query: admin.firestore.Query = db.collection(CONTENT_COLLECTION)
                .where("isDeleted", "==", false);

            if (date) {
                query = query.where("date", "==", date as string);
            }

            const snapshot = await query.get();
             let contentList = snapshot.docs.map(doc => {
                const data = doc.data();
                const driveId = data.googleDriveFileId || (data.url ? (data.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || data.url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]) : null);
                const cdnUrl = driveId ? `https://lh3.googleusercontent.com/d/${driveId}` : (data.url || null);
                return {
                    id: doc.id,
                    title: data.title,
                    type: data.type,
                    source: data.source,
                    url: data.url || null,
                    cdnUrl: cdnUrl,
                    googleDriveFileId: driveId || null,
                    fileBase64: data.fileBase64 || null,
                    fileName: data.fileName || null,
                    date: data.date,
                    targetAudience: data.targetAudience || "all",
                    targetBatch: data.targetBatch || null,
                    description: data.description || null,
                    createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                    createdBy: data.createdBy,
                    status: data.status || "approved"
                };
            });

            // Filter out pending content unless includePending is true
            const includePending = req.query.includePending === "true";
            if (!includePending) {
                contentList = contentList.filter(c => c.status !== "pending");
            }

            let studentBatches: string[] = [];
            if (finalBatch) {
                studentBatches = String(finalBatch).split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
            }

            // Staff and Admin roles always see all content
            const isStaffOrAdmin = req.user && ['admin', 'super_admin', 'superadmin', 'management', 'staff', 'teacher', 'developer'].includes((req.user.role || '').toLowerCase());

            if (!isStaffOrAdmin) {
                if (finalBatch || finalIsPaid !== undefined) {
                    const isPaidBool = String(finalIsPaid) === "true";
                    const batchStr = typeof finalBatch === "string" ? finalBatch.trim().toLowerCase() : "";
                    contentList = contentList.filter(c => {
                        const aud = c.targetAudience || "all";
                        if (aud === "all" || aud === "guest" || aud === "free") return true;
                        // All enrolled students get full access to daily content
                        if (isPaidBool) return true;
                        if (aud === "batch") {
                            if (!c.targetBatch || !c.targetBatch.trim()) return true;
                            const targetBatches = c.targetBatch.split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean);
                            if (targetBatches.length === 0) return true;
                            if (studentBatches.length > 0 && studentBatches.some(sb => targetBatches.includes(sb))) return true;
                            return batchStr ? targetBatches.includes(batchStr) : false;
                        }
                        return false;
                    });
                } else if (req.user && req.user.role === "guest") {
                    contentList = contentList.filter(c => {
                        const aud = c.targetAudience || "all";
                        return aud === "all" || aud === "guest" || aud === "free";
                    });
                }
            }

            // Sort client-side by date desc, then createdAt desc to avoid requiring complex Firestore composite indexes
            contentList.sort((a, b) => {
                const dateA = String(a.date || "").trim();
                const dateB = String(b.date || "").trim();
                if (dateA && dateB && dateA !== dateB) {
                    const dateCompare = dateB.localeCompare(dateA);
                    if (dateCompare !== 0) return dateCompare;
                }
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (bTime !== aTime) return bTime - aTime;
                return String(b.id || "").localeCompare(String(a.id || ""));
            });

            return res.status(200).json({
                success: true,
                data: contentList
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while fetching daily content"
            });
        }
    }

    /**
     * DELETE DAILY CONTENT (Admin/Staff)
     * DELETE /api/lms/daily-content/:id
     */
    static async deleteDailyContent(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "ID is required for deletion"
                });
            }

            // Fetch the document first to get the Drive file ID if it exists
            const docRef = db.collection(CONTENT_COLLECTION).doc(id);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                const driveFileId = data?.googleDriveFileId;
                if (driveFileId) {
                    // Delete from Google Drive silently (don't block deletion if Drive fails)
                    deleteFileFromGoogleDrive(driveFileId).catch(err =>
                        console.warn(`Drive delete skipped for ${driveFileId}:`, err?.message)
                    );
                }
                // Also clean up local disk file if applicable
                if (data?.source === "local" && data?.url) {
                    try {
                        const fs = require("fs");
                        const path = require("path");
                        const localPath = path.resolve(process.cwd(), "public", data.url);
                        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
                    } catch (fsErr: any) {
                        console.warn("Local file cleanup failed:", fsErr?.message);
                    }
                }
            }

            await docRef.delete();

            return res.status(200).json({
                success: true,
                message: "Daily content deleted successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while deleting daily content"
            });
        }
    }

    /**
     * STREAM DAILY CONTENT (Direct proxy to completely bypass client CORS)
     * GET /api/lms/daily-content/:id/stream
     */
    static async streamDailyContent(req: Request, res: Response) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).send("ID is required");

            const docRef = db.collection(CONTENT_COLLECTION).doc(id);
            const doc = await docRef.get();
            if (!doc.exists) return res.status(404).send("Content not found");

            const data = doc.data();
            const rawUrl = data?.url;

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

            // If stored in Firebase / Google Cloud Storage, pipe directly
            if (rawUrl && rawUrl.includes("storage.googleapis.com")) {
                const bucketName = process.env.STORAGE_BUCKET || env.GCP_STORAGE_BUCKET || "nermaiiasacademy-519c8-resources";
                const match = rawUrl.match(new RegExp(`${bucketName}/(.+)`));
                if (match && match[1]) {
                    const storagePath = decodeURIComponent(match[1]);
                    const bucket = storage.bucket(bucketName);
                    const fileRef = bucket.file(storagePath);
                    const [exists] = await fileRef.exists();
                    if (exists) {
                        const [metadata] = await fileRef.getMetadata();
                        res.setHeader("Content-Type", metadata.contentType || (data?.type === "image" ? "image/jpeg" : "application/pdf"));
                        if (metadata.size) res.setHeader("Content-Length", metadata.size);
                        return fileRef.createReadStream().pipe(res);
                    }
                }
            }

            if (rawUrl) {
                return res.redirect(rawUrl);
            }
            return res.status(404).send("File not available");
        } catch (error: any) {
            console.error("Stream daily content error:", error);
            return res.status(500).send(error.message || "Failed to stream content");
        }
    }
}

