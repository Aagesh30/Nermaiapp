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

async function inspect() {
  console.log('--- LATEST TESTS ---');
  const testsSnap = await db.collection('tests').orderBy('createdAt', 'desc').limit(5).get();
  for (const doc of testsSnap.docs) {
    const t = doc.data();
    console.log('\nTEST:', doc.id, '| Title:', t.title, '| targetAudience:', t.targetAudience, '| targetBatch:', t.targetBatch, '| isSpecialBatchTest:', t.isSpecialBatchTest);
    
    const results = await db.collection('results').where('testId', '==', doc.id).get();
    console.log('  Results count:', results.size);
    results.forEach(r => {
      const rd = r.data();
      console.log('    Result:', rd.studentId, rd.studentName, '| rollNumber:', rd.rollNumber, '| specialRollNo:', rd.specialRollNo);
    });

    const attempts = await db.collection('student_attempts').where('testId', '==', doc.id).get();
    console.log('  student_attempts count:', attempts.size);
    attempts.forEach(a => {
      const ad = a.data();
      console.log('    Attempt:', ad.studentId, ad.studentName, '| rollNumber:', ad.rollNumber, '| isSpecialBatchTest:', ad.isSpecialBatchTest, '| specialRollNo:', ad.specialRollNo);
    });
  }

  console.log('\n--- SPECIAL BATCHES ---');
  const batchesSnap = await db.collection('batches').where('isSpecial', '==', true).get();
  batchesSnap.forEach(b => {
    const bd = b.data();
    console.log('Batch:', b.id, bd.batchName, 'subBatches:', bd.subBatches, 'orderedBatches:', bd.orderedBatches, 'studentRollMap:', bd.studentRollMap);
  });
}

inspect().then(() => process.exit(0)).catch(e => { console.error('ERR:', e); process.exit(1); });
