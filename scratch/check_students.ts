import { db } from '../backend/infrastructure/firebase';

async function checkStudents() {
  try {
    const studentsSnap = await db.collection('students').get();
    console.log(`Total documents in 'students' collection: ${studentsSnap.size}`);

    const usersSnap = await db.collection('users').get();
    console.log(`Total documents in 'users' collection: ${usersSnap.size}`);
    
    // Count student users in 'users' collection
    const studentUsers = usersSnap.docs.filter(d => {
      const data = d.data();
      return data.role === 'student' || data.isStudent;
    });
    console.log(`Total users with role=='student': ${studentUsers.length}`);

    // Print student names/roll numbers sample
    console.log('\n--- First 10 Students in Firestore ---');
    studentsSnap.docs.slice(0, 10).forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id} | Name: ${data.name || data.fullName} | Roll: ${data.rollNumber}`);
    });
  } catch (err) {
    console.error('Error fetching from Firebase:', err);
  } finally {
    process.exit(0);
  }
}

checkStudents();
