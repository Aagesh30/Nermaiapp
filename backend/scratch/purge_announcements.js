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

async function purgeAllAnnouncements() {
    console.log("=== STARTING PURGE OF ALL ANNOUNCEMENTS FROM FIRESTORE ===");
    
    const collectionRef = db.collection("announcements");
    let totalDeleted = 0;

    while (true) {
        const snapshot = await collectionRef.limit(500).get();
        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;
        console.log(`Deleted batch of ${snapshot.size} notices. Total deleted so far: ${totalDeleted}`);
    }

    console.log(`🎉 COMPLETED: Successfully deleted ALL ${totalDeleted} notice documents from Firebase Firestore.`);
    process.exit(0);
}

purgeAllAnnouncements().catch((err) => {
    console.error("❌ Error purging announcements:", err);
    process.exit(1);
});
