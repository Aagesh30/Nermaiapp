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
  const t = await db.collection('tests').doc('1e6f3c92-b215-4b69-b3ad-d54d900eff1c').get();
  const td = t.data();
  console.log('Test Title:', td.title);
  console.log('targetAudience:', td.targetAudience);
  console.log('targetBatch:', td.targetBatch);
  console.log('isSpecialBatchTest:', td.isSpecialBatchTest);
  console.log('mockConfig:', td.mockConfig);
  console.log('isSpecialMock:', td.isSpecialMock);
  console.log('specialMock:', td.specialMock);
}

inspect().then(() => process.exit(0)).catch(e => { console.error('ERR:', e); process.exit(1); });
