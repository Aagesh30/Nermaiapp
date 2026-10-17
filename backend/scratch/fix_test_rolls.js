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

async function fixTestAndResults() {
  const testRef = db.collection('tests').doc('1e6f3c92-b215-4b69-b3ad-d54d900eff1c');
  const testDoc = await testRef.get();
  if (!testDoc.exists) {
    console.log('Test not found');
    return;
  }
  const tData = testDoc.data();
  console.log('Test:', tData.title, 'targetBatch:', tData.targetBatch);

  // Mark isSpecialBatchTest: true
  await testRef.update({ isSpecialBatchTest: true });
  console.log('Updated test doc with isSpecialBatchTest: true');

  // Load special batch "testing"
  const batchDoc = await db.collection('batches').doc('c0f9bdba-2cb0-49bc-a160-2febf1d281d5').get();
  const rollMap = (batchDoc.exists && batchDoc.data().studentRollMap) || {};
  console.log('Batch studentRollMap:', rollMap);

  // Update existing attempts and results for this test so their stored rollNumber also reflects the special mock batch roll
  const attemptsSnap = await db.collection('student_attempts').where('testId', '==', '1e6f3c92-b215-4b69-b3ad-d54d900eff1c').get();
  for (const doc of attemptsSnap.docs) {
    const ad = doc.data();
    const assignedRoll = rollMap[ad.studentId];
    if (assignedRoll) {
      console.log(`Updating attempt ${doc.id} for ${ad.studentName} (${ad.studentId}): rollNumber -> ${assignedRoll}`);
      await doc.ref.update({
        isSpecialBatchTest: true,
        specialRollNo: assignedRoll,
        rollNumber: assignedRoll
      });
    }
  }

  const resultsSnap = await db.collection('results').where('testId', '==', '1e6f3c92-b215-4b69-b3ad-d54d900eff1c').get();
  for (const doc of resultsSnap.docs) {
    const rd = doc.data();
    const assignedRoll = rollMap[rd.studentId];
    if (assignedRoll) {
      console.log(`Updating result ${doc.id} for ${rd.studentName} (${rd.studentId}): rollNumber -> ${assignedRoll}`);
      await doc.ref.update({
        isSpecialBatchTest: true,
        specialRollNo: assignedRoll,
        rollNumber: assignedRoll
      });
    }
  }

  // Also check if Arun (bb4d40e2-5c87-412e-9e5e-b146557c899f) is in rollMap
  console.log('Is Arun in rollMap?', rollMap['bb4d40e2-5c87-412e-9e5e-b146557c899f']);
}

fixTestAndResults().then(() => process.exit(0)).catch(e => { console.error('ERR:', e); process.exit(1); });
