const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const clientEmail = process.env.GCP_CLIENT_EMAIL || process.env.DRIVE_CLIENT_EMAIL;
let privateKey = (process.env.DRIVE_PRIVATE_KEY || '').trim();
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'nermaiiasacademy-519c8',
    clientEmail,
    privateKey
  })
});

const db = admin.firestore();

async function inspectStudents() {
  const arunDoc = await db.collection('students').doc('bb4d40e2-5c87-412e-9e5e-b146557c899f').get();
  console.log('Arun in students collection:', arunDoc.exists ? arunDoc.data() : 'NOT IN students collection');

  const arunUserDoc = await db.collection('users').doc('bb4d40e2-5c87-412e-9e5e-b146557c899f').get();
  console.log('Arun in users collection:', arunUserDoc.exists ? arunUserDoc.data() : 'NOT IN users collection');

  // Let's search Arun across students
  const querySnap = await db.collection('students').where('rollNumber', '==', '123').get();
  console.log('Students with rollNumber 123:', querySnap.size);
  querySnap.forEach(d => console.log('  Doc id:', d.id, d.data().firstName, d.data().batch, d.data().batches));

  const querySnap2 = await db.collection('users').where('rollNumber', '==', '123').get();
  console.log('Users with rollNumber 123:', querySnap2.size);
  querySnap2.forEach(d => console.log('  Doc id:', d.id, d.data().name, d.data().batch, d.data().batches));
}

inspectStudents().then(() => process.exit(0)).catch(e => { console.error('ERR:', e); process.exit(1); });
