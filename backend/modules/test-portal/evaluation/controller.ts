import { Request, Response } from "express";
import admin from "firebase-admin";
import { generalCache } from "../../../shared/utils/cache";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "nermaiiasacademy-519c8",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nermaiiasacademy-519c8-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();

export class EvaluationController {

    private static normalize(str: any): string {
        return String(str || "").trim().toLowerCase();
    }

    private static async recalculateSingleStudentRank(
        testId: string, 
        studentId: string, 
        attemptId: string, 
        score: number, 
        resultPayload: any
    ) {
        // Standard Competition Rank: Count of scores strictly higher than current + 1
        const rankSnap = await db.collection("results")
            .where("testId", "==", testId)
            .where("isDeleted", "==", false)
            .where("obtainedMarks", ">", score)
            .count()
            .get();
        const rank = rankSnap.data().count + 1;

        // Total count of results for this test
        const totalSnap = await db.collection("results")
            .where("testId", "==", testId)
            .where("isDeleted", "==", false)
            .count()
            .get();
        const total = totalSnap.data().count;

        // Percentile: (Count of scores strictly less than S) / (N - 1) * 100
        const lessSnap = await db.collection("results")
            .where("testId", "==", testId)
            .where("isDeleted", "==", false)
            .where("obtainedMarks", "<", score)
            .count()
            .get();
        const countLess = lessSnap.data().count;
        const percentile = total > 1 ? Math.round((countLess / (total - 1)) * 10000) / 100 : 100;

        // Update the submitting student's result doc with rank & percentile
        await db.collection("results").doc(attemptId).update({
            rank,
            percentile,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update only this student's leaderboard entry if it is their best score
        const leaderboardDocId = `${testId}_${studentId}`;
        const leaderboardRef = db.collection("leaderboards").doc(leaderboardDocId);
        const leaderboardSnap = await leaderboardRef.get();
        
        let shouldUpdateLeaderboard = true;
        if (leaderboardSnap.exists) {
            const existing = leaderboardSnap.data()!;
            if ((existing.obtainedMarks || 0) >= score) {
                shouldUpdateLeaderboard = false;
            }
        }

        if (shouldUpdateLeaderboard) {
            await leaderboardRef.set({
                id: leaderboardDocId,
                testId,
                studentId,
                attemptId,
                obtainedMarks: score,
                totalMarks: resultPayload.totalMarks,
                percentage: resultPayload.percentage,
                rank,
                percentile,
                status: resultPayload.status,
                correct: resultPayload.correct ?? 0,
                wrong: resultPayload.wrong ?? 0,
                skipped: resultPayload.skipped ?? 0,
                studentName: resultPayload.studentName || "Student",
                rollNumber: resultPayload.rollNumber || "N/A",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    private static async recalculateAllRanksForTest(testId: string) {
        const resultsSnapshot = await db.collection("results")
            .where("testId", "==", testId)
            .where("isDeleted", "==", false)
            .get();

        if (resultsSnapshot.empty) {
            // Clean up leaderboard for this test if no results
            const leaderboardSnapshot = await db.collection("leaderboards")
                .where("testId", "==", testId)
                .get();
            if (!leaderboardSnapshot.empty) {
                const batch = db.batch();
                leaderboardSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            return;
        }

        const results = resultsSnapshot.docs.map(doc => ({
            docId: doc.id,
            ...doc.data()
        })) as any[];

        // Sort by obtainedMarks desc
        results.sort((a, b) => b.obtainedMarks - a.obtainedMarks);

        const N = results.length;
        const batch = db.batch();
        const bestStudentScores: { [studentId: string]: any } = {};

        for (let i = 0; i < N; i++) {
            const currentResult = results[i];
            const score = currentResult.obtainedMarks;

            const rank = results.filter(r => r.obtainedMarks > score).length + 1;
            const countLess = results.filter(r => r.obtainedMarks < score).length;
            const percentile = N > 1 ? Math.round((countLess / (N - 1)) * 10000) / 100 : 100;

            const resultRef = db.collection("results").doc(currentResult.docId);
            batch.update(resultRef, {
                rank,
                percentile,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const studentId = currentResult.studentId;
            if (!bestStudentScores[studentId] || score > bestStudentScores[studentId].obtainedMarks) {
                bestStudentScores[studentId] = {
                    ...currentResult,
                    rank,
                    percentile
                };
            }
        }

        await batch.commit();

        // Update leaderboard collection
        const leaderboardSnapshot = await db.collection("leaderboards")
            .where("testId", "==", testId)
            .get();

        const leaderboardBatch = db.batch();

        leaderboardSnapshot.docs.forEach(doc => {
            leaderboardBatch.delete(doc.ref);
        });

        for (const studentId of Object.keys(bestStudentScores)) {
            const best = bestStudentScores[studentId];
            const leaderboardDocId = `${testId}_${studentId}`;
            const leaderboardRef = db.collection("leaderboards").doc(leaderboardDocId);

            leaderboardBatch.set(leaderboardRef, {
                id: leaderboardDocId,
                testId,
                studentId,
                attemptId: best.attemptId,
                obtainedMarks: best.obtainedMarks,
                totalMarks: best.totalMarks,
                percentage: best.percentage,
                rank: best.rank,
                percentile: best.percentile,
                status: best.status,
                correct: best.correct ?? 0,
                wrong: best.wrong ?? 0,
                skipped: best.skipped ?? 0,
                studentName: best.studentName || "Student",
                rollNumber: best.rollNumber || "N/A",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await leaderboardBatch.commit();
    }

    /**
     * EVALUATE ATTEMPT
     * POST /evaluate/:attemptId
     */
    static async evaluateAttempt(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const attemptDoc = await db.collection("student_attempts").doc(attemptId).get();
            if (!attemptDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Attempt not found"
                });
            }

            const attempt = attemptDoc.data()!;
            if (attempt.isDeleted) {
                return res.status(400).json({
                    success: false,
                    message: "This attempt has been deleted"
                });
            }

            const testDoc = await db.collection("tests").doc(attempt.testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Test not found"
                });
            }

            const test = testDoc.data()!;
            const questionIds = test.questionIds || [];

            let questions: any[] = [];
            if (questionIds.length > 0) {
                const questionRefs = questionIds.map((id: string) => db.collection("questions").doc(id));
                const questionDocs = await db.getAll(...questionRefs);
                questions = questionDocs
                    .filter(doc => doc.exists && !doc.data()?.isDeleted)
                    .map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const studentAnswers = Object.entries(attempt.answers || {}).map(([qId, val]) => ({
                questionId: qId,
                selectedAnswer: val
            }));

            // ─────────────────────────────────────────────────────────────
            // MARKS LOGIC:
            //   Correct answer  → +marksPerQuestion (default 1)
            //   Wrong answer    → -negativeMarks    (default 0.25)
            //   Unattempted     → 0
            // ─────────────────────────────────────────────────────────────
            const marksPerQ    = Number(test.marksPerQuestion) || 1;
            const negMarksPerQ = Number(test.negativeMarks)    || 0.25;

            let totalMarks    = questions.length * marksPerQ;
            let obtainedMarks = 0;
            const questionDetails: any[] = [];

            for (const question of questions) {
                const qId   = question.id;
                const qType = String(question.type || "").toUpperCase();

                const studentAns = studentAnswers.find(sa => sa.questionId === qId);
                const selected   = studentAns ? studentAns.selectedAnswer : null;

                let isCorrect          = false;
                let isPartiallyCorrect = false;
                let scoreAwarded       = 0;
                let studentLetter      = "";

                if (selected !== null && selected !== undefined && selected !== "") {
                    const selStr = String(selected).trim();
                    if (/^[A-D]$/i.test(selStr)) {
                        studentLetter = selStr.toUpperCase();
                    } else {
                        const opts = question.options || [];
                        const optsTa = question.optionsTa || [];
                        const idx = opts.findIndex((o: any) => String(o || "").trim().toLowerCase() === selStr.toLowerCase());
                        const idxTa = idx === -1 ? optsTa.findIndex((o: any) => String(o || "").trim().toLowerCase() === selStr.toLowerCase()) : -1;
                        const finalIdx = idx !== -1 ? idx : idxTa;
                        if (finalIdx !== -1) {
                            studentLetter = ["A", "B", "C", "D"][finalIdx];
                        } else {
                            const prefixMatch = selStr.match(/^([A-D])[.):\-]/i);
                            if (prefixMatch) {
                                studentLetter = prefixMatch[1].toUpperCase();
                            }
                        }
                    }
                }

                const isAttempted = studentLetter !== "";

                if (isAttempted) {
                    const correct = String(question.correctAnswer || "").trim().toUpperCase();
                    if (studentLetter === correct && correct !== "") {
                        // ✅ Correct
                        isCorrect    = true;
                        scoreAwarded = marksPerQ;
                    } else {
                        // ❌ Wrong
                        scoreAwarded = -negMarksPerQ;
                    }
                } else {
                    // ⚠️ Unattempted / Unattended
                    const unattendedMarksPerQ = test.unattendedMarks !== undefined ? Number(test.unattendedMarks) : 0;
                    scoreAwarded = unattendedMarksPerQ;
                }

                obtainedMarks += scoreAwarded;

                questionDetails.push({
                    questionId: qId,
                    type:       question.type || "MCQ",
                    marks:      marksPerQ,
                    negativeMarks: negMarksPerQ,
                    selectedAnswer:  studentLetter || null,
                    correctAnswer:   question.correctAnswer,
                    isCorrect,
                    isPartiallyCorrect,
                    scoreAwarded: Math.round(scoreAwarded * 100) / 100
                });
            }

            // Round to 2 decimal places; cap displayed score at 0 (never show negative total)
            const actualObtainedMarks = Math.round(obtainedMarks * 100) / 100;
            const finalObtainedMarks  = Math.max(0, actualObtainedMarks);
            const percentage          = totalMarks > 0 ? (finalObtainedMarks / totalMarks) * 100 : 0;
            const passingMarks        = Number(test.passingMarks) || 0;
            let status = "fail";
            if (finalObtainedMarks > 0) {
                if (passingMarks > 0) {
                    status = finalObtainedMarks >= passingMarks ? "pass" : "fail";
                } else {
                    status = finalObtainedMarks >= (totalMarks * 0.35) ? "pass" : "fail";
                }
            }

            // Compute aggregate counts
            const correctCount  = questionDetails.filter(qd => qd.isCorrect).length;
            const wrongCount    = questionDetails.filter(qd => !qd.isCorrect && qd.selectedAnswer !== null && qd.selectedAnswer !== undefined && qd.selectedAnswer !== "").length;
            const skippedCount  = questionDetails.filter(qd => qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "").length;

            // Resolve student name and roll number for O(1) reads later
            let studentName = "";
            let rollNumber = "";
            try {
                const studentDoc = await db.collection("students").doc(attempt.studentId).get();
                if (studentDoc.exists) {
                    const sData = studentDoc.data()!;
                    studentName = `${sData.firstName || ""} ${sData.lastName || ""}`.trim() || sData.fullName || sData.name || "";
                    rollNumber = sData.rollNumber || sData.rollNo || sData.admissionNumber || sData.loginUsername || "";
                }
                if (!studentName) {
                    const userDoc = await db.collection("users").doc(attempt.studentId).get();
                    if (userDoc.exists) {
                        const uData = userDoc.data()!;
                        studentName = uData.name || uData.fullName || uData.username || uData.loginUsername || uData.email?.split("@")[0] || uData.phone || "";
                        rollNumber = uData.username || uData.loginUsername || uData.rollNumber || uData.phone || studentName || "";
                    }
                }
                if (!studentName) {
                    const leadDoc = await db.collection("leads").doc(attempt.studentId).get();
                    if (leadDoc.exists) {
                        const lData = leadDoc.data()!;
                        studentName = lData.name || lData.fullName || lData.username || lData.email?.split("@")[0] || lData.phone || "";
                        rollNumber = "Guest";
                    }
                }
            } catch (e) {
                console.log("Error loading student profile during evaluation:", e);
            }
            if (!studentName && req.user) {
                const u = req.user as any;
                studentName = u.name || u.fullName || u.username || u.email?.split("@")[0] || u.phone || "";
                rollNumber = u.rollNumber || u.username || u.loginUsername || "Guest";
            }
            if (!studentName || studentName === "Student") studentName = attempt.studentName && attempt.studentName !== "Student" ? attempt.studentName : (attempt.username || "Guest User");
            const isPhoneNum = (val: string) => {
                if (!val) return false;
                const clean = String(val).trim().replace(/[\s\-\+\(\)]/g, "");
                return /^\d{7,15}$/.test(clean);
            };
            if (!rollNumber || rollNumber === "N/A" || rollNumber === "Student" || isPhoneNum(rollNumber) || rollNumber === studentName) rollNumber = "Guest";
            if (attempt.isSpecialBatchTest && (attempt.specialRollNo || (attempt.rollNumber && attempt.rollNumber !== "Guest"))) {
                rollNumber = attempt.specialRollNo || attempt.rollNumber;
            }

            const resultPayload = {
                id: attemptId,
                attemptId,
                testId: attempt.testId,
                studentId: attempt.studentId,
                studentName,
                rollNumber,
                totalMarks,
                obtainedMarks: finalObtainedMarks,
                percentage: Math.round(percentage * 100) / 100,
                status,
                rank: 1, // Will be computed in the recalculate stage
                percentile: 100, // Will be computed in the recalculate stage
                correct: correctCount,
                wrong: wrongCount,
                skipped: skippedCount,
                tabLeaveCount: attempt.tabLeaveCount || 0,
                questionDetails,
                evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
                isDeleted: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection("results").doc(attemptId).set(resultPayload);

            // Update attempt status to evaluated
            await db.collection("student_attempts").doc(attemptId).update({
                status: "evaluated",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Recalculate ranks and percentiles for this test using single student method
            await EvaluationController.recalculateSingleStudentRank(attempt.testId, attempt.studentId, attemptId, finalObtainedMarks, resultPayload);

            // Retrieve updated result with rank & percentile
            const updatedDoc = await db.collection("results").doc(attemptId).get();

            // Notify student that their test result is ready
            try {
                const { sendPushNotification } = await import("../../../services/pushService");
                const testTitle = attempt.testTitle || attempt.testName || "Your Test";
                const scoreText = `${finalObtainedMarks}/${totalMarks} (${Math.round(percentage)}%)`;
                sendPushNotification({
                    title: "✅ Test Result Ready",
                    body: `"${testTitle}" is complete! You scored ${scoreText}. Tap to view your result.`,
                    targetUserId: attempt.studentId,
                    data: {
                        targetTab: "test",
                        targetSub: "results",
                        screen: "test",
                        subTab: "results",
                        testId: attempt.testId,
                        attemptId,
                        dedupeId: `test_result_${attemptId}`
                    }
                }).catch(err => console.log("[Push] Test result push note:", err?.message));

                // Notify admins & super admins that a student has finished the test
                const displayName = studentName || attempt.studentName || attempt.username || "A student";
                sendPushNotification({
                    title: "📋 Test Submission Received",
                    body: `${displayName} submitted "${testTitle}". Score: ${scoreText}.`,
                    targetRole: "admin",
                    data: {
                        targetTab: "test",
                        targetSub: "results",
                        screen: "test",
                        subTab: "results",
                        testId: attempt.testId,
                        attemptId,
                        studentId: attempt.studentId,
                        dedupeId: `test_submission_admin_${attemptId}`
                    }
                }).catch(err => console.log("[Push] Test submission admin push:", err?.message));
            } catch (_) {}

            return res.status(200).json({
                success: true,
                message: "Attempt evaluated successfully",
                data: updatedDoc.data()
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred during evaluation"
            });
        }
    }

    /**
     * GET EVALUATION RESULT
     * GET /result/:attemptId
     */
    static async getResult(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Result not found"
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result has been deleted"
                });
            }

            return res.status(200).json({
                success: true,
                data: result
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving result"
            });
        }
    }

    private static async enrichResult(r: any): Promise<any> {
        if (!r) return r;
        let studentName = r.studentName || "";
        let rollNumber = r.rollNumber || "";
        
        if (r.studentId === "student-default") {
            return {
                ...r,
                studentName: "Student User (Demo)",
                rollNumber: "DEMO-001"
            };
        }
        
        const isGenericName = (name: string) => {
            if (!name) return true;
            const s = String(name).trim().toLowerCase();
            return s === "student" || s === "guest" || s === "guest user" || s === "n/a" || s.startsWith("guest:") || s.startsWith("guest ") || s.startsWith("student (") || s.startsWith("stu-");
        };

        // If result document already has explicit valid studentName and rollNumber stored, use them directly (0 reads)
        if (studentName && !isGenericName(studentName) && rollNumber && rollNumber !== "N/A") {
            return {
                ...r,
                studentName,
                rollNumber,
                tabLeaveCount: r.tabLeaveCount || 0
            };
        }

        const profileCacheKey = `student_profile_${r.studentId}`;
        const cachedProfile = generalCache.get<{ studentName: string; rollNumber: string }>(profileCacheKey);
        if (cachedProfile) {
            studentName = cachedProfile.studentName;
            rollNumber = cachedProfile.rollNumber;
        } else {
            try {
                // First check if r.studentId is a student document ID
                const studentDoc = await db.collection("students").doc(r.studentId).get();
                if (studentDoc.exists) {
                    const studentData = studentDoc.data()!;
                    const first = studentData.firstName || "";
                    const last = studentData.lastName || "";
                    const full = (first + " " + last).trim();
                    studentName = full || studentData.fullName || studentData.name || studentName;
                    rollNumber = studentData.rollNumber || "";
                } else {
                    // If not found in students, check if it is a user UID in users collection
                    const userDoc = await db.collection("users").doc(r.studentId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data()!;
                        studentName = userData.name || userData.fullName || userData.username || userData.email?.split("@")[0] || userData.phone || studentName;
                        
                        if (userData.studentId) {
                            const studentDoc2 = await db.collection("students").doc(userData.studentId).get();
                            if (studentDoc2.exists) {
                                const studentData2 = studentDoc2.data()!;
                                const first = studentData2.firstName || "";
                                const last = studentData2.lastName || "";
                                const full = (first + " " + last).trim();
                                studentName = full || studentData2.fullName || studentName;
                                rollNumber = studentData2.rollNumber || "";
                            }
                        } else {
                            rollNumber = userData.username || userData.loginUsername || studentName;
                        }
                    } else {
                        // Try finding in leads (guests)
                        const leadDoc = await db.collection("leads").doc(r.studentId).get();
                        if (leadDoc.exists) {
                            const leadData = leadDoc.data()!;
                            studentName = leadData.name || leadData.fullName || leadData.username || leadData.email?.split("@")[0] || leadData.phone || studentName;
                            rollNumber = "Guest";
                        }
                    }
                }
                generalCache.set(profileCacheKey, { studentName: studentName || "Guest User", rollNumber: rollNumber || "Guest" }, 300); // 5 min TTL
            } catch (err) {
                console.log("Error enriching result:", err);
            }
        }
        
        if (!studentName || isGenericName(studentName)) {
            studentName = (r.studentName && !isGenericName(r.studentName)) ? r.studentName : (r.username || r.name || (r.studentId ? `Guest: ${r.studentId.substring(0, 8)}` : "Guest User"));
        }
        const isPhoneNum = (val: string) => /^\d{7,15}$/.test(String(val || "").trim().replace(/[\s\-\+\(\)]/g, ""));
        if (!rollNumber || rollNumber === "N/A" || isGenericName(rollNumber) || isPhoneNum(rollNumber) || rollNumber === studentName) {
            rollNumber = "Guest";
        }

        let tabLeaveCount = r.tabLeaveCount;
        if (tabLeaveCount === undefined || tabLeaveCount === null) {
            tabLeaveCount = 0;
        }
        
        return {
            ...r,
            studentName,
            rollNumber,
            tabLeaveCount: tabLeaveCount || 0
        };
    }

    /**
     * GET STUDENT RESULT BY TEST
     * GET /student/:studentId/test/:testId
     */
    static async getStudentResult(req: Request, res: Response) {
        try {
            const { studentId, testId } = req.params;

            const snapshot = await db.collection("results")
                .where("studentId", "==", studentId)
                .where("testId", "==", testId)
                .where("isDeleted", "==", false)
                .get();

            if (snapshot.empty) {
                return res.status(404).json({
                    success: false,
                    message: "No result found for this student and test"
                });
            }

            const docs = snapshot.docs.map(doc => doc.data());
            docs.sort((a: any, b: any) => (b.obtainedMarks || 0) - (a.obtainedMarks || 0));

            const enriched = await EvaluationController.enrichResult(docs[0]);

            return res.status(200).json({
                success: true,
                data: enriched
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving student result"
            });
        }
    }

    /**
     * GET ALL RESULTS OF A TEST
     * GET /test/:testId
     */
    static async getTestResults(req: Request, res: Response) {
        try {
            const { testId } = req.params;

            const snapshot = await db.collection("results")
                .where("testId", "==", testId)
                .where("isDeleted", "==", false)
                .get();

            const results = snapshot.docs.map(doc => doc.data());
            results.sort((a: any, b: any) => (b.obtainedMarks || 0) - (a.obtainedMarks || 0));
            const enrichedResults = await Promise.all(results.map(r => EvaluationController.enrichResult(r)));

            return res.status(200).json({
                success: true,
                data: enrichedResults
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving test results"
            });
        }
    }

    /**
     * RECALCULATE RESULT
     * POST /recalculate/:attemptId
     */
    static async recalculateResult(req: Request, res: Response) {
        // Just call evaluateAttempt, as it fetches latest keys and re-evaluates
        return EvaluationController.evaluateAttempt(req, res);
    }

    /**
     * DELETE RESULT
     * DELETE /result/:resultId
     */
    static async deleteResult(req: Request, res: Response) {
        try {
            const { resultId } = req.params;

            const resultDoc = await db.collection("results").doc(resultId).get();
            if (!resultDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Result not found"
                });
            }

            const result = resultDoc.data()!;
            await db.collection("results").doc(resultId).update({
                isDeleted: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Recalculate ranks & percentiles for remaining results of the test
            await EvaluationController.recalculateAllRanksForTest(result.testId);

            return res.status(200).json({
                success: true,
                message: "Result deleted and ranks recalculated successfully"
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while deleting result"
            });
        }
    }

    /**
     * GET ALL RESULTS OF A STUDENT
     * GET /student/:studentId
     */
    static async getStudentAllResults(req: Request, res: Response) {
        try {
            const { studentId } = req.params;

            const snapshot = await db.collection("results")
                .where("studentId", "==", studentId)
                .where("isDeleted", "==", false)
                .get();

            const results = snapshot.docs.map(doc => doc.data());
            
            // Enrich results
            const enriched = await Promise.all(
                results.map(r => EvaluationController.enrichResult(r))
            );

            // Fetch tests to get topic/title and dates if needed
            const testIds = Array.from(new Set(enriched.map(r => r.testId)));
            const testMap: { [id: string]: any } = {};
            if (testIds.length > 0) {
                const testRefs = testIds.map(id => db.collection("tests").doc(id));
                const testDocs = await db.getAll(...testRefs);
                testDocs.forEach(doc => {
                    if (doc.exists) {
                        testMap[doc.id] = doc.data();
                    }
                });
            }

            const history = enriched.map(r => {
                const test = testMap[r.testId] || {};
                return {
                    ...r,
                    testTitle: test.title || r.testTitle || "Unknown Test",
                    testDescription: test.description || "",
                    createdAt: test.createdAt || null
                };
            });

            // Sort in memory by evaluatedAt/createdAt descending
            history.sort((a, b) => {
                const timeA = a.evaluatedAt ? (a.evaluatedAt.toDate ? a.evaluatedAt.toDate().getTime() : new Date(a.evaluatedAt).getTime()) : 0;
                const timeB = b.evaluatedAt ? (b.evaluatedAt.toDate ? b.evaluatedAt.toDate().getTime() : new Date(b.evaluatedAt).getTime()) : 0;
                return timeB - timeA;
            });

            return res.status(200).json({
                success: true,
                data: history
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving student results"
            });
        }
    }

    /**
     * UPLOAD OFFLINE EXCEL RESULTS & AUTO-EVALUATE
     * POST /offline-upload/:testId
     */
    static async uploadOfflineResults(req: Request, res: Response) {
        try {
            const { testId } = req.params;
            const { records } = req.body;

            if (!Array.isArray(records) || records.length === 0) {
                return res.status(400).json({ success: false, message: "No records found in upload payload" });
            }

            const testDoc = await db.collection("tests").doc(testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({ success: false, message: "Test not found" });
            }
            const test = testDoc.data()!;
            const marksPerQ = Number(test.marksPerQuestion) || 1;
            const negMarksPerQ = Math.abs(Number(test.negativeMarks) || 0.33);
            const unattendedMarksPerQ = test.unattendedMarks !== undefined ? Number(test.unattendedMarks) : 0;
            const questionIds: string[] = test.questionIds || [];

            // Load test questions to get correct answers
            const questionsMap = new Map<number, any>();
            if (questionIds.length > 0) {
                const chunks: string[][] = [];
                for (let i = 0; i < questionIds.length; i += 30) {
                    chunks.push(questionIds.slice(i, i + 30));
                }
                const allQuestions: any[] = [];
                for (const chunk of chunks) {
                    const snap = await db.collection("questions").where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
                    snap.docs.forEach(d => allQuestions.push({ id: d.id, ...d.data() }));
                }
                questionIds.forEach((qId, idx) => {
                    const found = allQuestions.find(q => q.id === qId);
                    if (found) questionsMap.set(idx + 1, found);
                });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const totalQuestions = questionIds.length > 0 ? questionIds.length : (Number(test.totalQuestions) || 100);
            const totalMarks = totalQuestions * marksPerQ;
            let addedCount = 0;

            const recordBatches: any[][] = [];
            for (let i = 0; i < records.length; i += 400) {
                recordBatches.push(records.slice(i, i + 400));
            }

            for (const chunk of recordBatches) {
                const writeBatch = db.batch();
                for (const rec of chunk) {
                    const studentName = String(rec.studentName || rec.name || "Offline Student").trim();
                    const rollNumber = String(rec.rollNumber || rec.rollNo || "Guest").trim();
                    const answers = rec.answers || {};

                    let correctCount = 0;
                    let wrongCount = 0;
                    let skippedCount = 0;
                    let obtainedMarks = 0;

                    for (let qNo = 1; qNo <= totalQuestions; qNo++) {
                        const q = questionsMap.get(qNo);
                        let correctAns = String(q?.correctAnswer || "").trim().toUpperCase();
                        if (!correctAns && q?.options && Array.isArray(q.options)) {
                            correctAns = String(q.answer || "").trim().toUpperCase();
                        }
                        const rawChosen = answers[qNo] ?? answers[`Q${qNo}`] ?? answers[`q${qNo}`] ?? answers[`Q.${qNo}`] ?? answers[`q.${qNo}`] ?? "";
                        const chosen = String(rawChosen).trim().toUpperCase();

                        if (!chosen) {
                            skippedCount++;
                            obtainedMarks += unattendedMarksPerQ;
                        } else if (chosen === correctAns && correctAns !== "") {
                            correctCount++;
                            obtainedMarks += marksPerQ;
                        } else {
                            wrongCount++;
                            obtainedMarks -= negMarksPerQ;
                        }
                    }

                    const finalObtainedMarks = Math.max(0, Math.round(obtainedMarks * 100) / 100);
                    const percentage = totalMarks > 0 ? (finalObtainedMarks / totalMarks) * 100 : 0;
                    const passingMarks = Number(test.passingMarks) || 0;
                    const status = finalObtainedMarks >= (passingMarks > 0 ? passingMarks : totalMarks * 0.35) ? "pass" : "fail";

                    const safeRoll = rollNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
                    const attemptId = `offline_${testId}_${safeRoll || Date.now()}_${addedCount}`;
                    const resultRef = db.collection("results").doc(attemptId);

                    writeBatch.set(resultRef, {
                        id: attemptId,
                        attemptId,
                        testId,
                        studentId: attemptId,
                        studentName,
                        rollNumber,
                        totalMarks,
                        obtainedMarks: finalObtainedMarks,
                        percentage: Math.round(percentage * 100) / 100,
                        status,
                        correct: correctCount,
                        wrong: wrongCount,
                        skipped: skippedCount,
                        isOffline: true,
                        evaluatedAt: now,
                        isDeleted: false,
                        createdAt: now,
                        updatedAt: now
                    });
                    addedCount++;
                }
                await writeBatch.commit();
            }

            return res.status(200).json({
                success: true,
                message: `Successfully evaluated and imported ${addedCount} offline student result(s)`,
                count: addedCount
            });

        } catch (error: any) {
            console.error("Error in uploadOfflineResults:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while evaluating offline results"
            });
        }
    }
}
