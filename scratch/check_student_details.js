const admin = require('../backend/node_modules/firebase-admin');
const dotenv = require('../backend/node_modules/dotenv');
dotenv.config({ path: './backend/.env' });

let key = process.env.DRIVE_PRIVATE_KEY || '';
if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
key = key.replace(/\\n/g, '\n');

const cert = {
  projectId: process.env.GCP_PROJECT_ID,
  clientEmail: process.env.GCP_CLIENT_EMAIL,
  privateKey: key
};
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cert) });
}
const db = admin.firestore();

async function checkDetails() {
  const userId = 'b792db53-471a-4bfd-b9ea-643cc16db8fc';
  const studentDocId = 'c9fb4d79-745f-4e39-a0c6-0a22a5d19bba';

  console.log('--- USER DOC ---');
  const user = await db.collection('users').doc(userId).get();
  console.log('User exists?', user.exists, user.data());

  console.log('--- STUDENT DOC ---');
  const student = await db.collection('students').doc(studentDocId).get();
  console.log('Student exists?', student.exists, student.data());

  // Check all requests / special requests / approval docs
  const colsToCheck = [
    'requests', 'access_requests', 'special_access_requests', 
    'live_class_requests', 'class_requests', 'approvals',
    'student_requests', 'pending_requests', 'notifications',
    'special_batches', 'batches'
  ];

  for (const c of colsToCheck) {
    try {
      const snap = await db.collection(c).get();
      snap.forEach(d => {
        const str = JSON.stringify(d.data());
        if (str.includes(userId) || str.includes(studentDocId) || str.toLowerCase().includes('other')) {
          console.log(`\nMatch in collection [${c}] doc [${d.id}]:`, d.data());
        }
      });
    } catch (e) {
      // collection might not exist
    }
  }
}

checkDetails().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
