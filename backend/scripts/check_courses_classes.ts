import { db } from '../infrastructure/firebase';

async function checkCoursesAndClasses() {
  console.log('--- ALL COURSES ---');
  const cSnap = await db.collection('courses').get();
  cSnap.forEach(d => console.log('Course ID:', d.id, JSON.stringify(d.data(), null, 2)));

  console.log('--- ALL RECORDED CLASSES ---');
  const clsSnap = await db.collection('classes').where('isDeleted', '==', false).get();
  clsSnap.forEach(d => {
    const data = d.data();
    console.log('Class ID:', d.id, 'title:', data.title, 'courseId:', data.courseId, 'targetBatchIds:', data.targetBatchIds, 'classType:', data.classType);
  });
}

checkCoursesAndClasses().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
