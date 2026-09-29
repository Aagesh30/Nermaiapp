import { db } from '../infrastructure/firebase';

async function main() {
  console.log('--- USERS BY STUDENT ID 56f7e585-cc8e-4b2e-87e2-a50645c09286 ---');
  const u1 = await db.collection('users').where('studentId', '==', '56f7e585-cc8e-4b2e-87e2-a50645c09286').get();
  u1.forEach(d => console.log('User ID:', d.id, JSON.stringify(d.data(), null, 2)));

  console.log('--- USERS BY USERNAME 9999 ---');
  const u2 = await db.collection('users').where('username', '==', '9999').get();
  u2.forEach(d => console.log('User ID:', d.id, JSON.stringify(d.data(), null, 2)));

  console.log('--- STUDENT DOC 56f7e585-cc8e-4b2e-87e2-a50645c09286 ---');
  const sDoc = await db.collection('students').doc('56f7e585-cc8e-4b2e-87e2-a50645c09286').get();
  console.log('Student data:', sDoc.data());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
