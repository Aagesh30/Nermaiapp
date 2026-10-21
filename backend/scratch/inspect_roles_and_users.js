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

async function inspect() {
    console.log("=== ROLE PERMISSIONS COLLECTION ===");
    const roleSnap = await db.collection("role_permissions").get();
    roleSnap.docs.forEach(doc => {
        console.log(`Role Doc: ${doc.id}`);
    });

    console.log("\n=== CHECKING TARGET USERNAMES ===");
    const usernames = ["kural", "ncoord", "nadmin1", "nadmin2", "nadmin3", "brinda", "lakshmi"];
    for (const u of usernames) {
        const uSnap = await db.collection("users").where("username", "==", u).get();
        const aSnap = await db.collection("admin_users").where("username", "==", u).get();
        console.log(`Username: ${u} -> users found: ${uSnap.size}, admin_users found: ${aSnap.size}`);
    }

    process.exit(0);
}

inspect().catch(err => {
    console.error("Error inspecting:", err);
    process.exit(1);
});
