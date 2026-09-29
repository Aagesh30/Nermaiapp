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

async function checkLatestNotice() {
    const snapshot = await db.collection("announcements").get();
    console.log(`Total notices in collection: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
        console.log("Doc ID:", doc.id);
        console.log("Data:", JSON.stringify(doc.data(), null, 2));
    });
}

checkLatestNotice().catch(console.error);
