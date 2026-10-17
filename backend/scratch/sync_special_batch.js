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

async function syncSpecialBatch() {
  const batchRef = db.collection('batches').doc('c0f9bdba-2cb0-49bc-a160-2febf1d281d5');
  const bDoc = await batchRef.get();
  const bData = bDoc.data();
  console.log('Batch:', bData.batchName, 'orderedBatches:', bData.orderedBatches);

  const orderedBatches = bData.orderedBatches || bData.subBatches || [];
  const norm = s => String(s || '').trim().toLowerCase();

  const studentsSnap = await db.collection('students').where('isDeleted', '==', false).get();
  const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let currentRoll = parseInt(String(bData.startingRollNo || '7000'), 10);
  if (isNaN(currentRoll) || currentRoll <= 0) currentRoll = 7000;
  const startRoll = currentRoll;

  const studentRollMap = {};

  for (const bName of orderedBatches) {
    const normB = norm(bName);
    const bStudents = allStudents.filter(s => {
      const sBatches = [
        s.batch,
        s.batchName,
        ...(Array.isArray(s.batches) ? s.batches.map(b => typeof b === 'string' ? b : b?.batchName) : [])
      ].filter(Boolean).map(norm);
      return sBatches.some(sb => sb === normB || sb.startsWith(normB + ' ') || sb.startsWith(normB + '('));
    });

    bStudents.sort((a, b) => {
      const rA = String(a.rollNumber || a.name || a.firstName || '');
      const rB = String(b.rollNumber || b.name || b.firstName || '');
      return rA.localeCompare(rB, undefined, { numeric: true });
    });

    console.log(`Batch ${bName}: found ${bStudents.length} students:`);
    for (const s of bStudents) {
      const assigned = String(currentRoll++);
      studentRollMap[s.id] = assigned;
      console.log(`  Student: ${s.firstName || s.name} (${s.id}) -> Roll ${assigned}`);

      // Update student specialRollNumbers
      const updatedSpecialRolls = { ...(s.specialRollNumbers || {}), [bData.batchName]: assigned };
      await db.collection('students').doc(s.id).update({
        specialRollNumbers: updatedSpecialRolls,
        specialRollNo: assigned
      });
    }
  }

  await batchRef.update({
    studentRollMap,
    lastAssignedRollNo: currentRoll > startRoll ? currentRoll - 1 : startRoll
  });

  console.log('Updated special batch studentRollMap successfully!');

  // Now update any attempts and results for test 1e6f3c92-b215-4b69-b3ad-d54d900eff1c
  const attemptsSnap = await db.collection('student_attempts').where('testId', '==', '1e6f3c92-b215-4b69-b3ad-d54d900eff1c').get();
  for (const doc of attemptsSnap.docs) {
    const ad = doc.data();
    const assigned = studentRollMap[ad.studentId];
    if (assigned) {
      console.log(`Updating attempt for ${ad.studentName} -> ${assigned}`);
      await doc.ref.update({
        isSpecialBatchTest: true,
        specialRollNo: assigned,
        rollNumber: assigned
      });
    }
  }

  const resultsSnap = await db.collection('results').where('testId', '==', '1e6f3c92-b215-4b69-b3ad-d54d900eff1c').get();
  for (const doc of resultsSnap.docs) {
    const rd = doc.data();
    const assigned = studentRollMap[rd.studentId];
    if (assigned) {
      console.log(`Updating result for ${rd.studentName} -> ${assigned}`);
      await doc.ref.update({
        isSpecialBatchTest: true,
        specialRollNo: assigned,
        rollNumber: assigned
      });
    }
  }
}

syncSpecialBatch().then(() => process.exit(0)).catch(e => { console.error('ERR:', e); process.exit(1); });
