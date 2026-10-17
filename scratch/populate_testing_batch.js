const admin = require('d:/unistrix/NERMAI_IAS_ACADEMY/backend/node_modules/firebase-admin');
const sa = require('d:/unistrix/NERMAI_IAS_ACADEMY/backend/infrastructure/firebase/serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function populateBatchTesting() {
  const bDoc = db.collection('batches').doc('c0f9bdba-2cb0-49bc-a160-2febf1d281d5');
  const ordered = ['45', '43', 'Final testing batch'];
  let currentRoll = 7000;
  const rollMap = {};

  for (const bName of ordered) {
    const snap = await db.collection('students').where('batch', '==', bName).where('isDeleted', '==', false).get();
    const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    arr.sort((a, b) => {
      const rA = String(a.rollNumber || a.loginUsername || '');
      const rB = String(b.rollNumber || b.loginUsername || '');
      const numA = parseInt(rA.replace(/\D/g, ''), 10);
      const numB = parseInt(rB.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      const nameA = ((a.firstName || '') + ' ' + (a.lastName || '')).trim().toLowerCase();
      const nameB = ((b.firstName || '') + ' ' + (b.lastName || '')).trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    for (const st of arr) {
      rollMap[st.id] = String(currentRoll++);
      console.log('Assigned:', st.id, st.firstName, st.batch, '->', rollMap[st.id]);
    }
  }

  await bDoc.set({
    studentRollMap: rollMap,
    lastAssignedRollNo: currentRoll - 1,
    startingRollNo: '7000',
    orderedBatches: ordered,
    subBatches: ordered
  }, { merge: true });
  console.log('studentRollMap populated with count:', Object.keys(rollMap).length);
}

populateBatchTesting().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
