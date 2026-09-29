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

async function createSuperAdmin() {
    const username = "admin@unistrix";
    const password = "unistrix@admin";
    const docId = "super_admin_unistrix";

    console.log(`=== CREATING SUPER ADMIN ${username} ===`);

    const passwordHash = await bcrypt.hash(password, 12);

    // 1. admin_users collection
    await db.collection("admin_users").doc(docId).set({
        username: username,
        email: username,
        name: "Unistrix Super Admin",
        role: "super_admin",
        passwordHash: passwordHash,
        tenantId: "default_tenant",
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Set admin_users doc: ${docId}`);

    // 2. users collection
    await db.collection("users").doc(docId).set({
        id: docId,
        username: username,
        password: password,
        passwordHash: passwordHash,
        name: "Unistrix Super Admin",
        email: username,
        role: "super_admin",
        customPermissions: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isDeleted: false
    }, { merge: true });
    console.log(`✅ Set users doc: ${docId}`);

    // 3. staff collection
    await db.collection("staff").doc(docId).set({
        id: docId,
        employeeId: "EMP-SUPER-02",
        firstName: "Unistrix",
        lastName: "Super Admin",
        dateOfBirth: "",
        gender: "",
        bloodGroup: "",
        email: username,
        phone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        designation: "Super Administrator",
        department: "Management",
        qualification: "",
        experienceYears: "",
        salary: "",
        joiningDate: new Date().toISOString().split("T")[0],
        photoUrl: "",
        emergencyContact: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        role: "super_admin",
        customPermissions: {},
        isDeleted: false,
        deletedAt: null,
        loginPassword: password
    }, { merge: true });
    console.log(`✅ Set staff doc: ${docId}`);

    console.log(`🎉 Super admin ${username} created successfully without any conflict!`);
    process.exit(0);
}

createSuperAdmin().catch((err) => {
    console.error("❌ Error creating super admin:", err);
    process.exit(1);
});
