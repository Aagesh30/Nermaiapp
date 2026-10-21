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

async function checkUsersWithRoles() {
    for (const r of ["demo", "testing", "editor"]) {
        const uSnap = await db.collection("users").where("role", "==", r).get();
        const aSnap = await db.collection("admin_users").where("role", "==", r).get();
        const sSnap = await db.collection("staff").where("role", "==", r).get();
        console.log(`Role ${r}: users=${uSnap.size}, admin_users=${aSnap.size}, staff=${sSnap.size}`);
        uSnap.docs.forEach(d => console.log(`  user doc: ${d.id}, username: ${d.data().username}`));
        sSnap.docs.forEach(d => console.log(`  staff doc: ${d.id}, name: ${d.data().firstName} ${d.data().lastName}`));
    }
    process.exit(0);
}

checkUsersWithRoles().catch(console.error);
