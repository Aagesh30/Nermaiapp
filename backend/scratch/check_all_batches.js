const admin = require("firebase-admin");
const dotenv = require("dotenv");
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

async function checkBatches() {
  const snapshot = await db.collection('students').get();
  const batchSet = new Map();

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const batch = data.batch || data.batchName || data.courseBatch || data.targetBatch || 'NONE';
    batchSet.set(batch, (batchSet.get(batch) || 0) + 1);
  });

  console.log('Batch breakdown:');
  console.log(Object.fromEntries(batchSet));

  // Also check ERP batches collection to list all configured batches
  const batchDocs = await db.collection('batches').get();
  console.log('\nConfigured Batches in system:');
  batchDocs.docs.forEach(d => {
    console.log(`- ${d.id}: ${JSON.stringify(d.data().name || d.data())}`);
  });
}

checkBatches().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
