import { Request, Response } from "express";
import admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "nermaiiasacademy-519c8",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://nermaiiasacademy-519c8-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();

export class ReviewController {

    /**
     * REVIEW COMPLETE ATTEMPT
     * GET /attempt/:attemptId
     */
    static async getAttemptReview(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            let resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                // Auto-evaluate unevaluated attempts on-the-fly
                try {
                    const { EvaluationController } = await import("../evaluation/controller");
                    const fakeReq = { params: { attemptId } } as any;
                    let fakeStatus = 200;
                    const fakeRes = {
                        status: (code: number) => { fakeStatus = code; return fakeRes; },
                        json: (data: any) => data
                    } as any;
                    await EvaluationController.evaluateAttempt(fakeReq, fakeRes);
                    resultDoc = await db.collection("results").doc(attemptId).get();
                } catch (e: any) {
                    console.log("On-the-fly evaluation note:", e?.message);
                }

                if (!resultDoc.exists) {
                    return res.status(400).json({
                        success: false,
                        message: "Attempt review is not available. Ensure the attempt is evaluated."
                    });
                }
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "This attempt review has been deleted"
                });
            }

            const testDoc = await db.collection("tests").doc(result.testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Associated test not found"
                });
            }

            const test = testDoc.data()!;
            const questionIds = test.questionIds || [];

            let questionsMap: { [id: string]: any } = {};
            if (questionIds.length > 0) {
                const questionRefs = questionIds.map((id: string) => db.collection("questions").doc(id));
                const questionDocs = await db.getAll(...questionRefs);
                questionDocs.forEach(doc => {
                    if (doc.exists) {
                        questionsMap[doc.id] = doc.data();
                    }
                });
            }

            const reviewDetails = (result.questionDetails || []).map((qd: any) => {
                const q = questionsMap[qd.questionId] || {};
                return {
                    ...q,
                    questionId: qd.questionId,
                    questionText: q.questionText || q.question || "",
                    questionTa: q.questionTa || "",
                    options: q.options || [],
                    optionsTa: q.optionsTa || [],
                    images: q.images || q.imageUrl || null,
                    type: qd.type || q.type || "",
                    marks: qd.marks,
                    negativeMarks: qd.negativeMarks,
                    selectedAnswer: qd.selectedAnswer,
                    correctAnswer: qd.correctAnswer,
                    explanation: q.explanation || "",
                    isCorrect: qd.isCorrect,
                    isPartiallyCorrect: qd.isPartiallyCorrect,
                    scoreAwarded: qd.scoreAwarded
                };
            });

            return res.status(200).json({
                success: true,
                message: "Attempt review retrieved successfully",
                data: {
                    attemptId: result.attemptId,
                    testId: result.testId,
                    testTitle: test.title,
                    studentId: result.studentId,
                    totalMarks: result.totalMarks,
                    obtainedMarks: result.obtainedMarks,
                    percentage: result.percentage,
                    rank: result.rank,
                    percentile: result.percentile,
                    status: result.status,
                    evaluatedAt: result.evaluatedAt,
                    questions: reviewDetails
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving attempt review"
            });
        }
    }

    /**
     * REVIEW A SINGLE QUESTION
     * GET /attempt/:attemptId/question/:questionId
     */
    static async getQuestionReview(req: Request, res: Response) {
        try {
            const { attemptId, questionId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(400).json({
                    success: false,
                    message: "Attempt review is not available. Ensure the attempt is evaluated."
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result deleted"
                });
            }

            const qd = (result.questionDetails || []).find((q: any) => q.questionId === questionId);
            if (!qd) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found in this attempt"
                });
            }

            const questionDoc = await db.collection("questions").doc(questionId).get();
            const qData = questionDoc.exists ? questionDoc.data()! : {};

            return res.status(200).json({
                success: true,
                message: "Question review retrieved successfully",
                data: {
                    ...qData,
                    questionId: qd.questionId,
                    questionText: qData.questionText || qData.question || "",
                    questionTa: qData.questionTa || "",
                    options: qData.options || [],
                    optionsTa: qData.optionsTa || [],
                    images: qData.images || qData.imageUrl || null,
                    type: qd.type || qData.type || "",
                    marks: qd.marks,
                    negativeMarks: qd.negativeMarks,
                    selectedAnswer: qd.selectedAnswer,
                    correctAnswer: qd.correctAnswer,
                    explanation: qData.explanation || "",
                    isCorrect: qd.isCorrect,
                    isPartiallyCorrect: qd.isPartiallyCorrect,
                    scoreAwarded: qd.scoreAwarded
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving question review"
            });
        }
    }

    /**
     * GET CORRECT ANSWERS
     * GET /answers/:attemptId
     */
    static async getCorrectAnswers(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(400).json({
                    success: false,
                    message: "Answers are only available after evaluation."
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result deleted"
                });
            }

            const correctAnswers = (result.questionDetails || []).map((qd: any) => ({
                questionId: qd.questionId,
                correctAnswer: qd.correctAnswer
            }));

            return res.status(200).json({
                success: true,
                message: "Correct answers retrieved successfully",
                data: {
                    attemptId,
                    correctAnswers
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving correct answers"
            });
        }
    }

    /**
     * GET EXPLANATIONS
     * GET /explanations/:attemptId
     */
    static async getExplanations(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(400).json({
                    success: false,
                    message: "Explanations are only available after evaluation."
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result deleted"
                });
            }

            const testDoc = await db.collection("tests").doc(result.testId).get();
            const questionIds = testDoc.exists ? (testDoc.data()!.questionIds || []) : [];

            let explanations: any[] = [];
            if (questionIds.length > 0) {
                const questionRefs = questionIds.map((id: string) => db.collection("questions").doc(id));
                const questionDocs = await db.getAll(...questionRefs);
                explanations = questionDocs
                    .filter(doc => doc.exists)
                    .map(doc => {
                        const data = doc.data()!;
                        return {
                            questionId: doc.id,
                            explanation: data.explanation || ""
                        };
                    });
            }

            return res.status(200).json({
                success: true,
                message: "Explanations retrieved successfully",
                data: {
                    attemptId,
                    explanations
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving explanations"
            });
        }
    }

    /**
     * TOPIC ANALYSIS
     * GET /analysis/topic/:attemptId
     */
    static async getTopicAnalysis(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(400).json({
                    success: false,
                    message: "Topic analysis is only available after evaluation."
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result deleted"
                });
            }

            const testDoc = await db.collection("tests").doc(result.testId).get();
            const questionIds = testDoc.exists ? (testDoc.data()!.questionIds || []) : [];

            let questionsMap: { [id: string]: any } = {};
            if (questionIds.length > 0) {
                const refs = questionIds.map((id: string) => db.collection("questions").doc(id));
                const docs = await db.getAll(...refs);
                docs.forEach(doc => {
                    if (doc.exists) {
                        questionsMap[doc.id] = doc.data();
                    }
                });
            }

            const topicMap: { [topic: string]: any } = {};

            for (const qd of (result.questionDetails || [])) {
                const q = questionsMap[qd.questionId] || {};
                const topic = q.topic || "General";

                if (!topicMap[topic]) {
                    topicMap[topic] = {
                        topic,
                        totalQuestions: 0,
                        correctCount: 0,
                        wrongCount: 0,
                        skippedCount: 0,
                        totalMarks: 0,
                        obtainedMarks: 0
                    };
                }

                const t = topicMap[topic];
                t.totalQuestions++;
                t.totalMarks += qd.marks || 0;
                t.obtainedMarks += qd.scoreAwarded || 0;

                if (qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "") {
                    t.skippedCount++;
                } else if (qd.isCorrect) {
                    t.correctCount++;
                } else {
                    t.wrongCount++;
                }
            }

            const topicAnalysis = Object.values(topicMap).map((t: any) => {
                const nonSkipped = t.totalQuestions - t.skippedCount;
                return {
                    ...t,
                    accuracy: nonSkipped > 0 ? Math.round((t.correctCount / nonSkipped) * 10000) / 100 : 0
                };
            });

            return res.status(200).json({
                success: true,
                message: "Topic analysis retrieved successfully",
                data: topicAnalysis
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred during topic analysis"
            });
        }
    }

    /**
     * DIFFICULTY ANALYSIS
     * GET /analysis/difficulty/:attemptId
     */
    static async getDifficultyAnalysis(req: Request, res: Response) {
        try {
            const { attemptId } = req.params;

            const resultDoc = await db.collection("results").doc(attemptId).get();
            if (!resultDoc.exists) {
                return res.status(400).json({
                    success: false,
                    message: "Difficulty analysis is only available after evaluation."
                });
            }

            const result = resultDoc.data()!;
            if (result.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: "Result deleted"
                });
            }

            const testDoc = await db.collection("tests").doc(result.testId).get();
            const questionIds = testDoc.exists ? (testDoc.data()!.questionIds || []) : [];

            let questionsMap: { [id: string]: any } = {};
            if (questionIds.length > 0) {
                const refs = questionIds.map((id: string) => db.collection("questions").doc(id));
                const docs = await db.getAll(...refs);
                docs.forEach(doc => {
                    if (doc.exists) {
                        questionsMap[doc.id] = doc.data();
                    }
                });
            }

            const diffMap: { [difficulty: string]: any } = {};

            for (const qd of (result.questionDetails || [])) {
                const q = questionsMap[qd.questionId] || {};
                const difficulty = q.difficulty || "Medium";

                if (!diffMap[difficulty]) {
                    diffMap[difficulty] = {
                        difficulty,
                        totalQuestions: 0,
                        correctCount: 0,
                        wrongCount: 0,
                        skippedCount: 0,
                        totalMarks: 0,
                        obtainedMarks: 0
                    };
                }

                const d = diffMap[difficulty];
                d.totalQuestions++;
                d.totalMarks += qd.marks || 0;
                d.obtainedMarks += qd.scoreAwarded || 0;

                if (qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "") {
                    d.skippedCount++;
                } else if (qd.isCorrect) {
                    d.correctCount++;
                } else {
                    d.wrongCount++;
                }
            }

            const difficultyAnalysis = Object.values(diffMap).map((d: any) => {
                const nonSkipped = d.totalQuestions - d.skippedCount;
                return {
                    ...d,
                    accuracy: nonSkipped > 0 ? Math.round((d.correctCount / nonSkipped) * 10000) / 100 : 0
                };
            });

            return res.status(200).json({
                success: true,
                message: "Difficulty analysis retrieved successfully",
                data: difficultyAnalysis
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred during difficulty analysis"
            });
        }
    }

    /**
     * STUDENT ATTEMPT HISTORY
     * GET /history/:studentId
     */
    static async getAttemptHistory(req: Request, res: Response) {
        try {
            const { studentId } = req.params;

            // Fetch matching student record IDs in O(1) using index-backed queries (0 full scans)
            const matchedStudentIds = new Set<string>([studentId]);
            
            try {
                const studentDoc = await db.collection("students").doc(studentId).get();
                if (studentDoc.exists) {
                    const s = studentDoc.data()!;
                    if (s.userId) matchedStudentIds.add(s.userId);
                }
                const studentQuery = await db.collection("students").where("userId", "==", studentId).get();
                studentQuery.docs.forEach(doc => {
                    matchedStudentIds.add(doc.id);
                    const s = doc.data();
                    if (s.userId) matchedStudentIds.add(s.userId);
                });
            } catch (_) {}

            try {
                const userDoc = await db.collection("users").doc(studentId).get();
                if (userDoc.exists) {
                    const u = userDoc.data()!;
                    if (u.studentId) matchedStudentIds.add(u.studentId);
                }
                const userQuery = await db.collection("users").where("studentId", "==", studentId).get();
                userQuery.docs.forEach(doc => {
                    matchedStudentIds.add(doc.id);
                    const u = doc.data();
                    if (u.studentId) matchedStudentIds.add(u.studentId);
                });
            } catch (_) {}

            let attempts: any[] = [];
            for (const sid of matchedStudentIds) {
                const attemptsSnapshot = await db.collection("student_attempts")
                    .where("studentId", "==", sid)
                    .where("isDeleted", "==", false)
                    .get();
                attemptsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (!attempts.some(a => a.id === data.id)) {
                        attempts.push(data);
                    }
                });
            }
            
            // Sort in memory by createdAt desc
            attempts.sort((a, b) => {
                const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
                const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
                return timeB - timeA;
            });

            // Fetch results for scores
            const resultsMap: { [attemptId: string]: any } = {};
            for (const sid of matchedStudentIds) {
                const resultsSnapshot = await db.collection("results")
                    .where("studentId", "==", sid)
                    .where("isDeleted", "==", false)
                    .get();
                resultsSnapshot.docs.forEach(doc => {
                    resultsMap[doc.data().attemptId] = doc.data();
                });
            }

            // Fetch tests for titles
            const testIds = Array.from(new Set(attempts.map(a => a.testId)));
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

            const history = attempts.map(a => {
                const resData = resultsMap[a.id];
                const test = testMap[a.testId];
                return {
                    attemptId: a.id,
                    testId: a.testId,
                    testTitle: test ? test.title : "Deleted/Unknown Test",
                    status: a.status,
                    startTime: a.startTime,
                    endTime: a.endTime,
                    isSubmitted: a.isSubmitted,
                    submittedAt: a.submittedAt,
                    score: resData ? resData.obtainedMarks : null,
                    totalMarks: resData ? resData.totalMarks : (test ? test.totalMarks : null),
                    percentage: resData ? resData.percentage : null,
                    passFailStatus: resData ? (((resData.obtainedMarks || 0) <= 0) ? "fail" : resData.status) : null,
                    rank: resData ? resData.rank : null,
                    percentile: resData ? resData.percentile : null
                };
            });

            return res.status(200).json({
                success: true,
                message: "Attempt history retrieved successfully",
                data: history
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving attempt history"
            });
        }
    }

    /**
     * LEADERBOARD
     * GET /leaderboard/:testId
     */
    static async getLeaderboard(req: Request, res: Response) {
        try {
            const { testId } = req.params;

            // Fetch test document to evaluate schedulingType & cutoff rules
            const testDoc = await db.collection("tests").doc(testId).get();
            const testData = testDoc.exists ? testDoc.data()! : {};
            const schedulingType = (testData.schedulingType === "fixed" || testData.schedulingMode === "fixed") ? "fixed" : "flexible_window";

            let endTimeDate: Date | null = null;
            if (testData.endTime) {
                endTimeDate = testData.endTime.toDate ? testData.endTime.toDate() : new Date(testData.endTime);
            } else if (testData.windowEndTime) {
                endTimeDate = testData.windowEndTime.toDate ? testData.windowEndTime.toDate() : new Date(testData.windowEndTime);
            }

            const now = new Date();
            const isFixed = schedulingType === "fixed";
            const isFinalized = isFixed ? (endTimeDate ? now >= endTimeDate : true) : true;
            const ranksLocked = isFixed && !isFinalized;

            const snapshot = await db.collection("leaderboards")
                .where("testId", "==", testId)
                .get();

            let entries = snapshot.docs.map(doc => doc.data()) as any[];

            // Fallback: If leaderboards collection has no documents for this test, query results collection directly
            if (entries.length === 0) {
                const resultsSnapshot = await db.collection("results")
                    .where("testId", "==", testId)
                    .where("isDeleted", "==", false)
                    .get();
                entries = resultsSnapshot.docs.map(doc => doc.data()) as any[];
            }

            const isGenericName = (name: string) => {
                if (!name) return true;
                const s = String(name).trim().toLowerCase();
                return s === "student" || s === "guest" || s === "guest user" || s === "n/a" || s.startsWith("guest:") || s.startsWith("guest ") || s.startsWith("student (") || s.startsWith("stu-");
            };

            const isPhoneNum = (val: string) => {
                if (!val) return false;
                const clean = String(val).trim().replace(/[\s\-\+\(\)]/g, "");
                return /^\d{7,15}$/.test(clean);
            };

            const enrichedEntries = await Promise.all(entries.map(async entry => {
                let sName = entry.studentName || "";
                let rNum = entry.rollNumber || "";

                if ((isGenericName(sName) || !rNum || isPhoneNum(rNum)) && entry.studentId) {
                    try {
                        const sid = entry.studentId;
                        const leadDoc = await db.collection("leads").doc(sid).get();
                        if (leadDoc.exists) {
                            const lData = leadDoc.data()!;
                            if (lData.name && !isGenericName(lData.name)) sName = lData.name;
                            rNum = "Guest";
                        }
                        if (isGenericName(sName)) {
                            const userDoc = await db.collection("users").doc(sid).get();
                            if (userDoc.exists) {
                                const uData = userDoc.data()!;
                                sName = uData.name || uData.fullName || uData.username || "";
                                rNum = uData.rollNumber || uData.username || "Guest";
                            }
                        }
                        if (isGenericName(sName) || rNum === "Guest") {
                            const studentDoc = await db.collection("students").doc(sid).get();
                            if (studentDoc.exists) {
                                const stData = studentDoc.data()!;
                                sName = `${stData.firstName || ""} ${stData.lastName || ""}`.trim() || stData.fullName || stData.name || sName;
                                rNum = stData.rollNumber || stData.rollNo || rNum;
                            }
                        }
                    } catch (_) {}
                }

                if (isGenericName(sName)) sName = "Guest User";
                if (isGenericName(rNum) || isPhoneNum(rNum) || rNum === sName) rNum = "Guest";

                // Enrich with special mock sequential roll number if test has mockConfig or offline entry
                if (testData?.mockConfig?.mockRollNumbers && entry.studentId && testData.mockConfig.mockRollNumbers[entry.studentId]) {
                    rNum = testData.mockConfig.mockRollNumbers[entry.studentId];
                } else if (entry.mockRollNumber) {
                    rNum = entry.mockRollNumber;
                }

                return {
                    ...entry,
                    studentName: sName,
                    rollNumber: rNum
                };
            }));

            // Sort by obtainedMarks desc, then by updatedAt asc to compute live dynamic ranks
            enrichedEntries.sort((a: any, b: any) => {
                if (b.obtainedMarks !== a.obtainedMarks) {
                    return (b.obtainedMarks || 0) - (a.obtainedMarks || 0);
                }
                const timeA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime()) : 0;
                const timeB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime()) : 0;
                return timeA - timeB;
            });

            // Assign ranks sequentially in memory
            enrichedEntries.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            return res.status(200).json({
                success: true,
                message: ranksLocked ? `Official Ranks will release at ${endTimeDate?.toISOString() || "test end time"}` : "Leaderboard retrieved successfully",
                schedulingType,
                isFinalized,
                ranksLocked,
                ranksReleaseAt: endTimeDate ? endTimeDate.toISOString() : null,
                data: enrichedEntries
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving leaderboard"
            });
        }
    }

    /**
     * TOP RANKERS
     * GET /top-rankers/:testId
     */
    static async getTopRankers(req: Request, res: Response) {
        try {
            const { testId } = req.params;

            const snapshot = await db.collection("leaderboards")
                .where("testId", "==", testId)
                .get();

            let entries = snapshot.docs.map(doc => doc.data());
            if (entries.length === 0) {
                const resultsSnapshot = await db.collection("results")
                    .where("testId", "==", testId)
                    .where("isDeleted", "==", false)
                    .get();
                entries = resultsSnapshot.docs.map(doc => doc.data());
            }
            
            // Sort in memory by rank asc
            entries.sort((a, b) => (b.obtainedMarks || 0) - (a.obtainedMarks || 0));
            const top10 = entries.slice(0, 10);

            return res.status(200).json({
                success: true,
                message: "Top rankers retrieved successfully",
                data: top10
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving top rankers"
            });
        }
    }

    /**
     * STUDENT ANALYTICS
     * GET /analytics/:studentId
     */
    static async getStudentAnalytics(req: Request, res: Response) {
        try {
            const { studentId } = req.params;

            const snapshot = await db.collection("results")
                .where("studentId", "==", studentId)
                .where("isDeleted", "==", false)
                .get();

            if (snapshot.empty) {
                return res.status(200).json({
                    success: true,
                    data: {
                        totalAttempts: 0,
                        accuracy: 0,
                        wrongAnswers: 0,
                        skippedQuestions: 0,
                        averageScore: 0,
                        bestScore: 0,
                        worstScore: 0,
                        passRate: 0
                    }
                });
            }

            const results = snapshot.docs.map(doc => doc.data());
            let totalQuestionsEvaluated = 0;
            let totalCorrect = 0;
            let totalWrong = 0;
            let totalSkipped = 0;
            let scoreSum = 0;
            let bestScore = -Infinity;
            let worstScore = Infinity;
            let passCount = 0;

            for (const resData of results) {
                const obtained = resData.obtainedMarks || 0;
                scoreSum += obtained;
                if (obtained > bestScore) bestScore = obtained;
                if (obtained < worstScore) worstScore = obtained;
                if (resData.status === "pass") passCount++;

                const details = resData.questionDetails || [];
                for (const qd of details) {
                    totalQuestionsEvaluated++;
                    if (qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "") {
                        totalSkipped++;
                    } else if (qd.isCorrect) {
                        totalCorrect++;
                    } else {
                        totalWrong++;
                    }
                }
            }

            const totalAttempts = results.length;
            const averageScore = scoreSum / totalAttempts;
            const passRate = (passCount / totalAttempts) * 100;
            const accuracy = totalQuestionsEvaluated > totalSkipped ? (totalCorrect / (totalQuestionsEvaluated - totalSkipped)) * 100 : 0;

            return res.status(200).json({
                success: true,
                data: {
                    totalAttempts,
                    accuracy: Math.round(accuracy * 100) / 100,
                    wrongAnswers: totalWrong,
                    skippedQuestions: totalSkipped,
                    averageScore: Math.round(averageScore * 100) / 100,
                    bestScore: bestScore === -Infinity ? 0 : bestScore,
                    worstScore: worstScore === Infinity ? 0 : worstScore,
                    passRate: Math.round(passRate * 100) / 100
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving student analytics"
            });
        }
    }

    /**
     * GET ALL TEST RESULTS (Admin Results Log)
     * GET /results/all-tests?keyword=&date=&schedulingType=&batch=
     * Returns results grouped by test with aggregate stats & scheduling metadata
     */
    static async getAllTestResults(req: Request, res: Response) {
        try {
            const keyword = String(req.query.keyword || req.query.search || "").toLowerCase().trim();
            const dateFilter = String(req.query.date || "").trim(); // YYYY-MM-DD format
            const schedulingTypeFilter = String(req.query.schedulingType || "all").toLowerCase().trim();
            const batchFilter = String(req.query.batch || "").toLowerCase().trim();

            // 1. Fetch all tests
            const testsSnapshot = await db.collection("tests")
                .where("isDeleted", "==", false)
                .get();

            const allTests = testsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            
            // Sort in memory by createdAt desc
            allTests.sort((a, b) => {
                const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
                const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
                return timeB - timeA;
            });

            // 2. Fetch all non-deleted results
            const resultsSnapshot = await db.collection("results")
                .where("isDeleted", "==", false)
                .get();

            const allResults = resultsSnapshot.docs.map(doc => doc.data()) as any[];

            const now = new Date();
            const testResultsLog: any[] = [];

            for (const test of allTests) {
                const schedType = (test.schedulingType === "fixed" || test.schedulingMode === "fixed") ? "fixed" : "flexible_window";

                // Filter by schedulingType if specified
                if (schedulingTypeFilter !== "all" && schedulingTypeFilter !== schedType) continue;

                // Apply keyword filter on test title / subject
                if (keyword && !test.title?.toLowerCase().includes(keyword) && !test.subject?.toLowerCase().includes(keyword)) continue;

                // Apply batch filter if specified
                if (batchFilter && test.batch && !String(test.batch).toLowerCase().includes(batchFilter)) continue;

                // Apply date filter on test createdAt
                if (dateFilter) {
                    let testDate = "";
                    if (test.createdAt?.toDate) {
                        testDate = test.createdAt.toDate().toISOString().slice(0, 10);
                    } else if (test.createdAt) {
                        testDate = new Date(test.createdAt).toISOString().slice(0, 10);
                    }
                    if (testDate !== dateFilter) continue;
                }

                // Check end time for strict fixed tests
                let endTimeDate: Date | null = null;
                if (test.endTime) {
                    endTimeDate = test.endTime.toDate ? test.endTime.toDate() : new Date(test.endTime);
                } else if (test.windowEndTime) {
                    endTimeDate = test.windowEndTime.toDate ? test.windowEndTime.toDate() : new Date(test.windowEndTime);
                }

                const isFixed = schedType === "fixed";
                const isFinalized = isFixed ? (endTimeDate ? now >= endTimeDate : true) : true;

                const testResults = allResults.filter(r => r.testId === test.id);

                // Sort by obtainedMarks descending
                testResults.sort((a, b) => (b.obtainedMarks || 0) - (a.obtainedMarks || 0));

                let totalScoreSum = 0;
                let highestScore = 0;
                let passCount = 0;

                // Build ranked entries with correct/wrong counts
                const entries = testResults.map((r, idx) => {
                    const rawName = r.studentName || r.studentId || "Unknown Student";
                    const isGuestRoll = !r.rollNumber || r.rollNumber === "N/A" || r.rollNumber === "Guest" || String(r.rollNumber).startsWith("STU-");
                    const rollNumber = isGuestRoll ? rawName : r.rollNumber;
                    const studentName = rawName;
                    const obtainedMarks = r.obtainedMarks ?? 0;

                    totalScoreSum += obtainedMarks;
                    if (obtainedMarks > highestScore) highestScore = obtainedMarks;
                    if (r.status === "pass" || obtainedMarks > 0) passCount++;

                    // Compute correct/wrong from questionDetails
                    const details = r.questionDetails || [];
                    let correct = 0, wrong = 0, skipped = 0;
                    for (const qd of details) {
                        if (qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "") {
                            skipped++;
                        } else if (qd.isCorrect) {
                            correct++;
                        } else {
                            wrong++;
                        }
                    }

                    let evaluatedAt = "";
                    if (r.evaluatedAt?.toDate) {
                        evaluatedAt = r.evaluatedAt.toDate().toISOString();
                    } else if (r.evaluatedAt) {
                        evaluatedAt = new Date(r.evaluatedAt).toISOString();
                    }

                    return {
                        serialNo: idx + 1,
                        rank: idx + 1,
                        studentId: r.studentId,
                        rollNumber,
                        studentName,
                        attemptId: r.attemptId,
                        obtainedMarks,
                        totalMarks: r.totalMarks ?? (test.totalMarks || 100),
                        percentage: r.percentage ?? 0,
                        status: (obtainedMarks <= 0) ? "fail" : (r.status || "pass"),
                        correct,
                        wrong,
                        skipped,
                        totalQuestions: details.length,
                        evaluatedAt
                    };
                });

                let testCreatedAt = "";
                if (test.createdAt?.toDate) {
                    testCreatedAt = test.createdAt.toDate().toISOString();
                } else if (test.createdAt) {
                    testCreatedAt = new Date(test.createdAt).toISOString();
                }

                const totalSubmissions = entries.length;
                const avgScore = totalSubmissions > 0 ? Math.round((totalScoreSum / totalSubmissions) * 100) / 100 : 0;
                const passPercentage = totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) / 100 : 0;

                testResultsLog.push({
                    testId: test.id,
                    testTitle: test.title || "Untitled Test",
                    subject: test.subject || test.category || "General",
                    testType: test.testType || "mock",
                    category: test.testType || "mock",
                    schedulingType: schedType,
                    startTime: test.startTime || test.windowStartTime || null,
                    endTime: test.endTime || test.windowEndTime || null,
                    isFinalized,
                    statusText: isFixed ? (isFinalized ? "Results Finalized" : "Ranks Pending (Locked until End Time)") : "Live Rolling Ranks",
                    subjectSections: test.subjectSections || [],
                    totalQuestions: test.totalQuestions || (test.questionIds?.length ?? 0),
                    totalMarks: test.totalMarks || 100,
                    marksPerQuestion: test.marksPerQuestion || 1,
                    negativeMarks: test.negativeMarks || 0.25,
                    totalSubmissions,
                    totalParticipants: totalSubmissions,
                    avgScore,
                    highestScore,
                    passPercentage,
                    createdAt: testCreatedAt,
                    entries
                });
            }

            return res.status(200).json({
                success: true,
                message: "All test results retrieved successfully",
                data: testResultsLog
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while retrieving all test results"
            });
        }
    }

    /**
     * GET /diagnostics/:testId
     * Returns subject-wise analytical aggregates and per-question 30% diagnostic metrics
     */
    static async getTestSubjectDiagnostics(req: Request, res: Response) {
        try {
            const { testId } = req.params;
            if (!testId) {
                return res.status(400).json({ success: false, message: "testId is required" });
            }

            const testDoc = await db.collection("tests").doc(testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({ success: false, message: "Test not found" });
            }

            const test = { id: testDoc.id, ...testDoc.data() } as any;

            // Fetch all non-deleted results for this test
            const resultsSnapshot = await db.collection("results")
                .where("testId", "==", testId)
                .where("isDeleted", "==", false)
                .get();

            const allResults = resultsSnapshot.docs.map(doc => doc.data()) as any[];
            const totalSubmissions = allResults.length;

            // Resolve questions
            let questionsList: any[] = [];
            if (Array.isArray(test.questions) && test.questions.length > 0) {
                questionsList = test.questions;
            } else if (Array.isArray(test.questionIds) && test.questionIds.length > 0) {
                // Fetch full question docs
                const qDocs = await Promise.all(
                    test.questionIds.map(async (qId: string) => {
                        try {
                            const qd = await db.collection("questions").doc(qId).get();
                            return qd.exists ? { id: qd.id, ...qd.data() } : { id: qId };
                        } catch {
                            return { id: qId };
                        }
                    })
                );
                questionsList = qDocs;
            }

            const totalQCount = Math.max(
                Number(test.totalQuestions) || 0,
                questionsList.length,
                allResults[0]?.questionDetails?.length || 0
            );

            // Base subject sections
            const configuredSections: any[] = Array.isArray(test.subjectSections) ? [...test.subjectSections] : [];

            // Detect unassigned question ranges and assign to "Others"
            const assignedQuestions = new Set<number>();
            configuredSections.forEach(sec => {
                const f = Math.max(1, Number(sec.fromQ) || 1);
                const t = Math.min(totalQCount, Number(sec.toQ) || totalQCount);
                for (let qNum = f; qNum <= t; qNum++) {
                    assignedQuestions.add(qNum);
                }
            });

            const unassignedRanges: Array<{ fromQ: number; toQ: number }> = [];
            let currentRangeStart: number | null = null;

            for (let q = 1; q <= totalQCount; q++) {
                if (!assignedQuestions.has(q)) {
                    if (currentRangeStart === null) currentRangeStart = q;
                } else {
                    if (currentRangeStart !== null) {
                        unassignedRanges.push({ fromQ: currentRangeStart, toQ: q - 1 });
                        currentRangeStart = null;
                    }
                }
            }
            if (currentRangeStart !== null) {
                unassignedRanges.push({ fromQ: currentRangeStart, toQ: totalQCount });
            }

            // Create complete sections array including "Others"
            const allSections: any[] = [...configuredSections];
            unassignedRanges.forEach((range, idx) => {
                allSections.push({
                    subject: unassignedRanges.length > 1 ? `Others (${idx + 1})` : "Others",
                    fromQ: range.fromQ,
                    toQ: range.toQ,
                    isOthers: true
                });
            });

            // If no sections were configured at all, group all questions under "General"
            if (allSections.length === 0 && totalQCount > 0) {
                allSections.push({
                    subject: test.subject || "General",
                    fromQ: 1,
                    toQ: totalQCount
                });
            }

            // Calculate per-question diagnostics
            const questionDiagnostics: any[] = [];

            for (let qIdx = 0; qIdx < totalQCount; qIdx++) {
                const qNum = qIdx + 1;
                const qObj = questionsList[qIdx] || {};

                let correctCount = 0;
                let wrongCount = 0;
                let skippedCount = 0;
                const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
                const wrongOptionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

                let resolvedCorrectAns = qObj.correctAnswer || "";

                allResults.forEach(r => {
                    const qd = r.questionDetails?.[qIdx];
                    if (!resolvedCorrectAns && qd?.correctAnswer) {
                        resolvedCorrectAns = qd.correctAnswer;
                    }

                    if (!qd || qd.selectedAnswer === null || qd.selectedAnswer === undefined || qd.selectedAnswer === "") {
                        skippedCount++;
                    } else {
                        const sel = String(qd.selectedAnswer).trim().toUpperCase();
                        if (optionCounts[sel] !== undefined) optionCounts[sel]++;
                        else optionCounts[sel] = 1;

                        if (qd.isCorrect) {
                            correctCount++;
                        } else {
                            wrongCount++;
                            if (wrongOptionCounts[sel] !== undefined) wrongOptionCounts[sel]++;
                            else wrongOptionCounts[sel] = 1;
                        }
                    }
                });

                const attemptedCount = correctCount + wrongCount;
                const skipRate = totalSubmissions > 0 ? Math.round((skippedCount / totalSubmissions) * 100) : 0;
                const errorRate = totalSubmissions > 0 ? Math.round((wrongCount / totalSubmissions) * 100) : 0;
                const attemptErrorRate = attemptedCount > 0 ? Math.round((wrongCount / attemptedCount) * 100) : 0;
                const accuracyRate = totalSubmissions > 0 ? Math.round((correctCount / totalSubmissions) * 100) : 0;

                // 30% rule indicators
                const isRepeatedSkip = skipRate >= 30;
                const isRepeatedWrong = errorRate >= 30 || attemptErrorRate >= 30;

                // Find top trap option
                let trapOption = "";
                let trapCount = 0;
                Object.entries(wrongOptionCounts).forEach(([opt, cnt]) => {
                    if (cnt > trapCount) {
                        trapCount = cnt;
                        trapOption = opt;
                    }
                });

                // Difficulty tier
                let difficulty = "Moderate";
                if (accuracyRate >= 70) difficulty = "Easy";
                else if (accuracyRate < 35) difficulty = "Hard";

                // Resolve matching subject section
                const parentSection = allSections.find(s => qNum >= Number(s.fromQ) && qNum <= Number(s.toQ));
                const subjectName = parentSection ? parentSection.subject : "Others";

                questionDiagnostics.push({
                    qNum,
                    questionId: qObj.id || `q_${qNum}`,
                    subject: subjectName,
                    questionText: qObj.question || qObj.questionText || qObj.title || `Question ${qNum}`,
                    options: qObj.options || ["Option A", "Option B", "Option C", "Option D"],
                    correctAnswer: resolvedCorrectAns,
                    explanation: qObj.explanation || "",
                    totalSubmissions,
                    attemptedCount,
                    correctCount,
                    wrongCount,
                    skippedCount,
                    accuracyRate,
                    skipRate,
                    errorRate,
                    attemptErrorRate,
                    isRepeatedSkip,
                    isRepeatedWrong,
                    trapOption: trapCount > 0 ? trapOption : "",
                    trapCount,
                    trapPercentage: wrongCount > 0 ? Math.round((trapCount / wrongCount) * 100) : 0,
                    optionCounts,
                    wrongOptionCounts,
                    difficulty
                });
            }

            // Aggregate subject section analytics for the Pie Chart and diagnostics
            let overallTotalScore = 0;
            let overallMaxPossible = 0;

            const subjectAnalytics = allSections.map((sec, secIdx) => {
                const f = Math.max(1, Number(sec.fromQ) || 1);
                const t = Math.min(totalQCount, Number(sec.toQ) || totalQCount);
                const secQCount = Math.max(1, t - f + 1);

                const secQuestions = questionDiagnostics.filter(q => q.qNum >= f && q.qNum <= t);

                // Calculate average score percentage across student submissions for this subject
                let secCorrectTotal = 0;
                let secAttemptedTotal = 0;
                let secSkippedTotal = 0;
                let secWrongTotal = 0;

                secQuestions.forEach(q => {
                    secCorrectTotal += q.correctCount;
                    secAttemptedTotal += q.attemptedCount;
                    secSkippedTotal += q.skippedCount;
                    secWrongTotal += q.wrongCount;
                });

                const totalPossibleAnswers = totalSubmissions * secQCount;
                const avgAccuracy = totalPossibleAnswers > 0 ? Math.round((secCorrectTotal / totalPossibleAnswers) * 100) : 0;
                const attemptRate = totalPossibleAnswers > 0 ? Math.round((secAttemptedTotal / totalPossibleAnswers) * 100) : 0;

                overallTotalScore += secCorrectTotal;
                overallMaxPossible += totalPossibleAnswers;

                // Collect repeated wrong questions (>= 30% error), sorted descending
                const repeatedWrong = secQuestions
                    .filter(q => q.isRepeatedWrong)
                    .sort((a, b) => b.errorRate - a.errorRate);

                // Collect repeatedly skipped questions (>= 30% skip), sorted descending
                const repeatedSkipped = secQuestions
                    .filter(q => q.isRepeatedSkip)
                    .sort((a, b) => b.skipRate - a.skipRate);

                // Dynamic visual performance color
                let perfColor = "#2e7d32"; // Green
                if (avgAccuracy < 40) perfColor = "#c62828"; // Red
                else if (avgAccuracy < 70) perfColor = "#f57f17"; // Amber

                return {
                    id: `sec_${secIdx}`,
                    subject: sec.subject,
                    fromQ: f,
                    toQ: t,
                    questionCount: secQCount,
                    isOthers: !!sec.isOthers,
                    avgAccuracy,
                    attemptRate,
                    correctCount: secCorrectTotal,
                    wrongCount: secWrongTotal,
                    skippedCount: secSkippedTotal,
                    perfColor,
                    repeatedWrongCount: repeatedWrong.length,
                    repeatedSkippedCount: repeatedSkipped.length,
                    repeatedWrongQuestions: repeatedWrong,
                    repeatedSkippedQuestions: repeatedSkipped,
                    allQuestions: secQuestions
                };
            });

            const overallClassAvg = overallMaxPossible > 0 ? Math.round((overallTotalScore / overallMaxPossible) * 100) : 0;

            return res.status(200).json({
                success: true,
                data: {
                    testId: test.id,
                    testTitle: test.title || "Untitled Test",
                    testType: test.testType || "mock",
                    totalQuestions: totalQCount,
                    totalSubmissions,
                    overallClassAvg,
                    subjectAnalytics,
                    questionDiagnostics
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while computing test subject diagnostics"
            });
        }
    }

    /**
     * BATCH ACADEMIC ANALYTICS
     * GET /api/test-portal/review/batch-analytics?batchName=...
     * Aggregates recent tests, identifying batch trends, top improvers, and at-risk students
     */
    static async getBatchAcademicAnalytics(req: Request, res: Response) {
        try {
            const { batchName } = req.query;

            // Fetch the last 10 published tests
            const testsSnapshot = await db.collection("tests")
                .where("isDeleted", "==", false)
                .where("published", "==", true)
                .limit(15)
                .get();

            let allTests = testsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort tests chronologically descending, then pick up to 10
            allTests.sort((a: any, b: any) => {
                const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
                const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
                return timeB - timeA;
            });
            const recentTests: any[] = allTests.slice(0, 10);

            // Fetch students for the target batch if specified
            let batchStudentQuery: any = db.collection("students").where("isDeleted", "==", false);
            if (batchName && String(batchName).trim() && String(batchName) !== "all") {
                batchStudentQuery = batchStudentQuery.where("batch", "==", String(batchName));
            }
            const studentsSnap = await batchStudentQuery.get();
            const enrolledStudents: any[] = studentsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            const studentIdSet = new Set(enrolledStudents.map((s: any) => s.id));
            const studentUserMap = new Map();
            enrolledStudents.forEach((s: any) => {
                studentUserMap.set(s.id, s);
                if (s.userId) studentUserMap.set(s.userId, s);
            });

            // Gather evaluated results for these tests
            const testOverviewList: any[] = [];
            const studentRecentScores: Record<string, { studentName: string, scores: { testId: string, testTitle: string, pct: number, date: any }[] }> = {};

            for (const t of recentTests) {
                const resultsSnap = await db.collection("results")
                    .where("testId", "==", t.id)
                    .where("isDeleted", "==", false)
                    .get();

                let results = resultsSnap.docs.map((doc: any) => doc.data());
                if (studentIdSet.size > 0 && batchName && String(batchName) !== "all") {
                    results = results.filter((r: any) => studentIdSet.has(r.studentId) || (r.userId && studentUserMap.has(r.userId)));
                }

                const totalSubmissions = results.length;
                let sumPct = 0;
                let passCount = 0;

                results.forEach((r: any) => {
                    const pct = r.percentage !== undefined ? Number(r.percentage) : (r.totalMarks > 0 ? (r.obtainedMarks / r.totalMarks) * 100 : 0);
                    sumPct += pct;
                    if (pct >= 40) passCount++;

                    // Track per student for trajectory
                    const sid = r.studentId || r.userId;
                    if (sid) {
                        const sObj = studentUserMap.get(sid) || { name: r.studentName || "Student" };
                        if (!studentRecentScores[sid]) {
                            studentRecentScores[sid] = {
                                studentName: sObj.name || r.studentName || "Candidate",
                                scores: []
                            };
                        }
                        studentRecentScores[sid].scores.push({
                            testId: t.id,
                            testTitle: t.title || "Mock Test",
                            pct: Math.round(pct),
                            date: t.createdAt
                        });
                    }
                });

                const avgScore = totalSubmissions > 0 ? Math.round(sumPct / totalSubmissions) : 0;
                const passRate = totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0;
                const participationRate = enrolledStudents.length > 0 ? Math.round((totalSubmissions / enrolledStudents.length) * 100) : 0;

                testOverviewList.push({
                    testId: t.id,
                    title: t.title || "Untitled Mock",
                    totalSubmissions,
                    avgScore,
                    passRate,
                    participationRate,
                    date: t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate().toISOString() : t.createdAt) : null
                });
            }

            // Identify Top Improvers & At-Risk Students
            const topImprovers: any[] = [];
            const atRiskStudents: any[] = [];

            Object.entries(studentRecentScores).forEach(([sid, record]) => {
                const sScores = record.scores; // in reverse chronological order
                const latest = sScores[0];
                const prev = sScores[1];

                if (latest && prev) {
                    const delta = latest.pct - prev.pct;
                    if (delta > 5) {
                        topImprovers.push({
                            studentId: sid,
                            studentName: record.studentName,
                            delta,
                            latestScore: latest.pct,
                            previousScore: prev.pct
                        });
                    }
                }

                // Check At-Risk criteria
                // 1. Latest score under 35%
                // 2. Two falling scores in a row
                let isFallingTwice = false;
                if (sScores.length >= 3) {
                    if (sScores[0].pct < sScores[1].pct && sScores[1].pct < sScores[2].pct) {
                        isFallingTwice = true;
                    }
                }

                const sObj = studentUserMap.get(sid);
                const isCriticalLow = latest && latest.pct < 35;

                if (isCriticalLow || isFallingTwice) {
                    atRiskStudents.push({
                        studentId: sid,
                        studentName: record.studentName,
                        latestScore: latest ? latest.pct : 0,
                        reason: isCriticalLow ? "Score critically below 35%" : "Falling test scores consecutively",
                        unpaidFees: sObj?.totalFees && sObj?.feesPaid ? (Number(sObj.totalFees) - Number(sObj.feesPaid)) : 0
                    });
                }
            });

            // Sort top improvers descending
            topImprovers.sort((a, b) => b.delta - a.delta);

            return res.status(200).json({
                success: true,
                data: {
                    batchName: batchName || "all",
                    enrolledCount: enrolledStudents.length,
                    testOverview: testOverviewList,
                    topImprovers: topImprovers.slice(0, 5),
                    atRiskStudents: atRiskStudents.slice(0, 10)
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "An error occurred while generating batch academic analytics"
            });
        }
    }
}

