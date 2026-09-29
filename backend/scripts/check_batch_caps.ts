import { db } from '../infrastructure/firebase';

async function checkBatchCaps() {
  console.log('--- BATCH CAPABILITIES FOR "43" ---');
  const doc1 = await db.collection('batch_capabilities').doc('43').get();
  console.log('43 exists:', doc1.exists, doc1.data());

  console.log('--- BATCH CAPABILITIES FOR UUID "b3318564-4428-4806-9dad-e0be89f5d0ee" ---');
  const doc2 = await db.collection('batch_capabilities').doc('b3318564-4428-4806-9dad-e0be89f5d0ee').get();
  console.log('UUID exists:', doc2.exists, doc2.data());

  console.log('--- ALL BATCH CAPABILITIES DOCS ---');
  const snap = await db.collection('batch_capabilities').get();
  snap.forEach(d => console.log('Doc ID:', d.id, d.data()));
}

checkBatchCaps().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
