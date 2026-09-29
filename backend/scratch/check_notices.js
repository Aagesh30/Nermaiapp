const admin = require("firebase-admin");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    });
}

const db = admin.firestore();

async function inspectNotices() {
    const snapshot = await db.collection("announcements").get();
    console.log(`Total documents in announcements collection: ${snapshot.size}`);

    let isDeletedCount = 0;
    let activeCount = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isDeleted) {
            isDeletedCount++;
        } else {
            activeCount++;
        }
    });

    console.log(`Active notices (isDeleted: false / undefined): ${activeCount}`);
    console.log(`Soft-deleted notices (isDeleted: true): ${isDeletedCount}`);
}

inspectNotices().catch(console.error);
