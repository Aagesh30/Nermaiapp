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
admin.initializeApp({ credential: admin.credential.cert(cert) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  console.log('Total users:', users.size);
  users.forEach(u => {
    const d = u.data();
    if (d.name?.toLowerCase().includes('arun') || d.email?.toLowerCase().includes('arun') || d.username?.toLowerCase().includes('arun')) {
      console.log('User:', u.id, { name: d.name, email: d.email, role: d.role, batch: d.batch, batches: d.batches, studentId: d.studentId });
    }
  });

  const students = await db.collection('students').get();
  students.forEach(s => {
    const d = s.data();
    if (d.name?.toLowerCase().includes('arun') || d.batch?.toLowerCase().includes('final')) {
      console.log('Student:', s.id, { name: d.name, rollNumber: d.rollNumber, batch: d.batch, batches: d.batches, userId: d.userId, type: d.type });
    }
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
