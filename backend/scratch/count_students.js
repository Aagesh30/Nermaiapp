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

async function getStudentStats() {
  const snapshot = await db.collection('students').get();
  
  let totalActive = 0;
  let totalDeleted = 0;
  const batchActiveCounts = {};

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const rawBatch = data.batch || data.batchName || data.courseBatch;
    const batchName = rawBatch && String(rawBatch).trim() ? String(rawBatch).trim() : 'Unassigned / No Batch';

    if (!data.isDeleted) {
      totalActive++;
      batchActiveCounts[batchName] = (batchActiveCounts[batchName] || 0) + 1;
    } else {
      totalDeleted++;
    }
  });

  console.log('=== OVERALL SUMMARY ===');
  console.log('Total Active Students:', totalActive);
  console.log('Total Soft-Deleted Students:', totalDeleted);
  console.log('Total Student Documents in Database:', snapshot.docs.length);

  console.log('\n=== ACTIVE STUDENTS PER BATCH ===');
  const sortedBatches = Object.keys(batchActiveCounts).sort();
  sortedBatches.forEach(batch => {
    console.log(`- Batch "${batch}": ${batchActiveCounts[batch]} student(s)`);
  });
}

getStudentStats().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
