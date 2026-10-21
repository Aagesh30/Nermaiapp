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

// ─── PERMISSION DEFINITIONS ──────────────────────────────────────────────────

// Admin permissions
const adminPermissions = {
    // ── ERP ──────────────────────────────────────────────────────
    profile_requests: "edit_direct",          // Profile Request page - full access
    qr_permissions: "edit_direct",            // QR code permission - full access
    profile_edit_permissions: "edit_on_approval", // profile edit permission edit by approval
    security_alerts: "none",                  // security alert no access
    student_management: "edit_on_approval",   // Students - edit by approval
    notices_announcements: "edit_direct",     // Notice - full access
    fees_management: "edit_direct",           // fee - full access
    offline_attendance: "edit_direct",        // attendance registry - full access
    staff_management: "none",                 // Admin - no access
    approvals_queue: "none",                  // approval queue no access
    id_card: "edit_direct",                   // id card - full access
    hall_ticket: "edit_on_approval",          // hall ticket - edit by approval
    batch_management: "edit_on_approval",     // Batchs - edit by approval
    analytics: "none",                        // analytics - no access
    drive_storage: "none",                    // drive and storage - no access
    
    // ── LMS ────────────────────────────────────────────────────── (full access to LMS)
    lms_sacs_access: "edit_direct",
    lms_live_classes: "edit_direct",
    lms_daily_content: "edit_direct",
    lms_quiz_posting: "edit_direct",
    lms_recorded_videos: "edit_direct",
    lms_resources: "edit_direct",
    lms_teachers: "edit_direct",
    lms_courses: "edit_direct",
    lms_subjects: "edit_direct",
    lms_topics: "edit_direct",
    lms_subtopics: "edit_direct",
    lms_syllabus: "edit_direct",
    lms_zoom_accounts: "edit_direct",
    lms_chatbot_cms: "edit_direct",

    // ── CRM ────────────────────────────────────────────────────── (full access for CRM)
    admissions: "edit_direct",
    leads: "edit_direct",
    campaigns: "edit_direct",
    fee_reminders: "edit_direct",
    alumni_feedback: "edit_direct",
    crm_courses_freebies: "edit_direct",

    // ── Test Portal ────────────────────────────────────────────── (test portal full access)
    test_creation: "edit_direct",
    question_bank: "edit_direct",
    examinations: "edit_direct",
    test_results: "edit_direct",
    test_review: "edit_direct",

    // ── System ───────────────────────────────────────────────────
    push_notifications: "none"
};

// Coordinator permissions (full access like super admin, client will modify later)
const coordinatorPermissions = {
    profile_requests: "edit_direct",
    qr_permissions: "edit_direct",
    profile_edit_permissions: "edit_direct",
    security_alerts: "edit_direct",
    student_management: "edit_direct",
    notices_announcements: "edit_direct",
    fees_management: "edit_direct",
    offline_attendance: "edit_direct",
    staff_management: "edit_direct",
    approvals_queue: "edit_direct",
    id_card: "edit_direct",
    hall_ticket: "edit_direct",
    batch_management: "edit_direct",
    analytics: "edit_direct",
    drive_storage: "edit_direct",

    lms_sacs_access: "edit_direct",
    lms_live_classes: "edit_direct",
    lms_daily_content: "edit_direct",
    lms_quiz_posting: "edit_direct",
    lms_recorded_videos: "edit_direct",
    lms_resources: "edit_direct",
    lms_teachers: "edit_direct",
    lms_courses: "edit_direct",
    lms_subjects: "edit_direct",
    lms_topics: "edit_direct",
    lms_subtopics: "edit_direct",
    lms_syllabus: "edit_direct",
    lms_zoom_accounts: "edit_direct",
    lms_chatbot_cms: "edit_direct",

    admissions: "edit_direct",
    leads: "edit_direct",
    campaigns: "edit_direct",
    fee_reminders: "edit_direct",
    alumni_feedback: "edit_direct",
    crm_courses_freebies: "edit_direct",

    test_creation: "edit_direct",
    question_bank: "edit_direct",
    examinations: "edit_direct",
    test_results: "edit_direct",
    test_review: "edit_direct",

    push_notifications: "edit_direct"
};

// Personal Admin permissions (brinda & lakshmi)
const personalAdminPermissions = {
    // ── ERP ────────────────────────────────────────────────────── (only notices full access)
    profile_requests: "none",
    qr_permissions: "none",
    profile_edit_permissions: "none",
    security_alerts: "none",
    student_management: "none",
    notices_announcements: "edit_direct",     // only notice on ERP
    fees_management: "none",
    offline_attendance: "none",
    staff_management: "none",
    approvals_queue: "none",
    id_card: "none",
    hall_ticket: "none",
    batch_management: "none",
    analytics: "none",
    drive_storage: "none",

    // ── LMS ────────────────────────────────────────────────────── (only upload resource, daily content, recorded)
    lms_sacs_access: "none",
    lms_live_classes: "none",
    lms_daily_content: "edit_direct",         // daily content
    lms_quiz_posting: "none",
    lms_recorded_videos: "edit_direct",       // recorded
    lms_resources: "edit_direct",             // upload resource
    lms_teachers: "none",
    lms_courses: "none",
    lms_subjects: "none",
    lms_topics: "none",
    lms_subtopics: "none",
    lms_syllabus: "none",
    lms_zoom_accounts: "none",
    lms_chatbot_cms: "none",

    // ── CRM ────────────────────────────────────────────────────── (no access for now)
    admissions: "none",
    leads: "none",
    campaigns: "none",
    fee_reminders: "none",
    alumni_feedback: "none",
    crm_courses_freebies: "none",

    // ── Test Portal ────────────────────────────────────────────── (full access for test portal)
    test_creation: "edit_direct",
    question_bank: "edit_direct",
    examinations: "edit_direct",
    test_results: "edit_direct",
    test_review: "edit_direct",

    // ── System ───────────────────────────────────────────────────
    push_notifications: "none"
};

// ─── 7 USERS TO CREATE ────────────────────────────────────────────────────────
const usersToCreate = [
    {
        username: "kural",
        password: "laruk@27",
        name: "Kural",
        firstName: "Kural",
        lastName: "Super Admin",
        role: "super_admin",
        designation: "Super Administrator",
        department: "Administration"
    },
    {
        username: "ncoord",
        password: "coord@nia",
        name: "Coordinator",
        firstName: "Coordinator",
        lastName: "NIA",
        role: "coordinator",
        designation: "Coordinator",
        department: "Coordination"
    },
    {
        username: "nadmin1",
        password: "1adm@nia",
        name: "Admin 1",
        firstName: "Admin",
        lastName: "One",
        role: "admin",
        designation: "Administrator",
        department: "Administration"
    },
    {
        username: "nadmin2",
        password: "2adm@nia",
        name: "Admin 2",
        firstName: "Admin",
        lastName: "Two",
        role: "admin",
        designation: "Administrator",
        department: "Administration"
    },
    {
        username: "nadmin3",
        password: "3adm@nia",
        name: "Admin 3",
        firstName: "Admin",
        lastName: "Three",
        role: "admin",
        designation: "Administrator",
        department: "Administration"
    },
    {
        username: "brinda",
        password: "admin@2026",
        name: "Brinda",
        firstName: "Brinda",
        lastName: "Admin",
        role: "personal_admin",
        designation: "Personal Administrator",
        department: "Academic Operations"
    },
    {
        username: "lakshmi",
        password: "admin@2026",
        name: "Lakshmi",
        firstName: "Lakshmi",
        lastName: "Admin",
        role: "personal_admin",
        designation: "Personal Administrator",
        department: "Academic Operations"
    }
];

async function execute() {
    console.log("=== 1. DELETING TESTING, DEMO, EDITOR ROLES ===");
    for (const r of ["testing", "demo", "editor"]) {
        await db.collection("role_permissions").doc(r).delete();
        console.log(`Deleted role doc: ${r}`);
    }

    console.log("\n=== 2. UPDATING ROLE PERMISSIONS MATRIX ===");
    await db.collection("role_permissions").doc("admin").set(adminPermissions);
    console.log("Updated admin permissions in role_permissions");

    await db.collection("role_permissions").doc("coordinator").set(coordinatorPermissions);
    console.log("Updated coordinator permissions in role_permissions");

    await db.collection("role_permissions").doc("personal_admin").set(personalAdminPermissions);
    console.log("Updated personal_admin permissions in role_permissions");

    console.log("\n=== 3. CREATING 7 USERS IN admin_users, users, staff ===");
    for (const u of usersToCreate) {
        const passwordHash = await bcrypt.hash(u.password, 12);
        const docId = `usr_${u.username}`;

        // 1. admin_users
        await db.collection("admin_users").doc(docId).set({
            username: u.username,
            email: `${u.username}@nermaiias.com`,
            name: u.name,
            role: u.role,
            passwordHash: passwordHash,
            tenantId: "default_tenant",
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. users
        await db.collection("users").doc(docId).set({
            id: docId,
            username: u.username,
            password: u.password,
            passwordHash: passwordHash,
            name: u.name,
            email: `${u.username}@nermaiias.com`,
            role: u.role,
            customPermissions: {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isDeleted: false
        }, { merge: true });

        // 3. staff
        await db.collection("staff").doc(docId).set({
            id: docId,
            employeeId: `EMP-${u.username.toUpperCase()}`,
            firstName: u.firstName,
            lastName: u.lastName,
            email: `${u.username}@nermaiias.com`,
            designation: u.designation,
            department: u.department,
            loginUsername: u.username,
            loginPassword: u.password,
            role: u.role,
            customPermissions: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: "super_admin",
            isDeleted: false
        }, { merge: true });

        console.log(`✅ Created user: ${u.username} (${u.role})`);
    }

    console.log("\n🎉 ALL DATABASE OPERATIONS COMPLETED SUCCESSFULLY!");
    process.exit(0);
}

execute().catch(err => {
    console.error("❌ Fatal error executing database setup:", err);
    process.exit(1);
});
