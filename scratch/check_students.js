const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env.local') });
if (!process.env.FIREBASE_PRIVATE_KEY) {
  dotenv.config({ path: path.join(__dirname, '../backend/.env') });
}

const admin = require('../backend/node_modules/firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID || 'nermaiiasacademy-519c8';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey
  })
});

const db = admin.firestore();

async function checkStudents() {
  try {
    const studentsSnap = await db.collection('students').get();
    console.log(`\n========================================`);
    console.log(`TOTAL DOCUMENTS IN 'students' COLLECTION: ${studentsSnap.size}`);
    console.log(`========================================`);

    const usersSnap = await db.collection('users').get();
    console.log(`TOTAL DOCUMENTS IN 'users' COLLECTION: ${usersSnap.size}`);

    const studentUsers = usersSnap.docs.filter(d => {
      const data = d.data();
      return data.role === 'student' || data.isStudent || data.userType === 'student';
    });
    console.log(`TOTAL USERS WITH ROLE == 'student': ${studentUsers.length}`);

    console.log('\n--- ALL STUDENTS IN FIRESTORE ---');
    studentsSnap.docs.forEach((d, index) => {
      const data = d.data();
      const name = data.name || data.fullName || data.studentName || data.displayName || 'No Name';
      const roll = data.rollNumber || d.id;
      const mode = data.mode || data.studentType || 'N/A';
      console.log(`${index+1}. ID: ${d.id} | Roll: ${roll} | Name: ${name} | Mode: ${mode}`);
    });

  } catch (err) {
    console.error('Error querying Firebase:', err);
  } finally {
    process.exit(0);
  }
}

checkStudents();
