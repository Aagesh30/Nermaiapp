const admin = require("firebase-admin");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
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

const usersToCheck = [
    { username: "kural", password: "laruk@27" },
    { username: "ncoord", password: "coord@nia" },
    { username: "nadmin1", password: "1adm@nia" },
    { username: "nadmin2", password: "2adm@nia" },
    { username: "nadmin3", password: "3adm@nia" },
    { username: "brinda", password: "admin@2026" },
    { username: "lakshmi", password: "admin@2026" }
];

async function verifyLogins() {
    console.log("=== VERIFYING CREDENTIALS ===");
    for (const u of usersToCheck) {
        const snap = await db.collection("admin_users").where("username", "==", u.username).get();
        if (snap.empty) {
            console.error(`❌ User ${u.username} not found in admin_users!`);
            continue;
        }
        const data = snap.docs[0].data();
        const ok = await bcrypt.compare(u.password, data.passwordHash);
        console.log(`User ${u.username}: role=${data.role}, bcrypt password match=${ok}`);
    }

    console.log("\n=== VERIFYING ROLE PERMISSIONS IN DB ===");
    const roleSnap = await db.collection("role_permissions").get();
    roleSnap.docs.forEach(d => {
        console.log(`Role: ${d.id}, feature count: ${Object.keys(d.data()).length}`);
    });

    process.exit(0);
}

verifyLogins().catch(console.error);
