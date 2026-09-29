require("dotenv").config({ path: "backend/.env" });
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "nermaiiasacademy-519c8"
    });
}

const db = admin.firestore();

async function run() {
    try {
        console.log("Searching for '18 MOTS - Test 3'...");
        const snapshot = await db.collection("tests").get();
        let targetTest = null;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.title && data.title.includes("18 MOTS - Test 3")) {
                targetTest = { id: doc.id, ...data };
            }
        });

        if (!targetTest) {
            console.log("Test not found! Total tests:", snapshot.size);
            return;
        }

        console.log("Found Test ID:", targetTest.id);
        console.log("Title:", targetTest.title);
        console.log("subjectSections:", JSON.stringify(targetTest.subjectSections));
        console.log("totalQuestions:", targetTest.totalQuestions);

        // Check results
        const resultsSnap = await db.collection("results")
            .where("testId", "==", targetTest.id)
            .get();
        console.log("Results count:", resultsSnap.size);
        resultsSnap.docs.forEach((d, i) => {
            const r = d.data();
            console.log(`Result ${i + 1}: id=${d.id}, isDeleted=${r.isDeleted}, studentName=${r.studentName}, qDetails count=${r.questionDetails?.length}`);
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

run();
