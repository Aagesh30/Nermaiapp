const path = require('path');
const admin = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'firebase-admin'));
const sa = require(path.resolve(__dirname, '..', 'backend', 'infrastructure', 'firebase', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function runBackfill() {
  console.log('--- STARTING HISTORICAL LIVE ATTENDANCE BACKFILL ---');

  // 1. Preload users map: userId -> studentId, and username -> studentId
  const usersSnap = await db.collection('users').get();
  const userToStudentId = new Map();
  const usernameToStudentId = new Map();

  usersSnap.docs.forEach(doc => {
    const d = doc.data();
    if (d.studentId) {
      userToStudentId.set(doc.id, d.studentId);
    }
    if (d.username && d.studentId) {
      usernameToStudentId.set(String(d.username).trim(), d.studentId);
    }
  });

  // 2. Preload students map: docId -> student, and rollNo -> docId
  const studentsSnap = await db.collection('students').get();
  const studentDocMap = new Map();
  const rollToStudentId = new Map();

  studentsSnap.docs.forEach(doc => {
    const d = doc.data();
    studentDocMap.set(doc.id, { id: doc.id, ...d });
    const roll = d.rollNumber || d.rollNo || d.regNo || d.admissionNumber;
    if (roll) {
      rollToStudentId.set(String(roll).trim(), doc.id);
    }
    if (d.userId) {
      userToStudentId.set(d.userId, doc.id);
    }
  });

  console.log(`Loaded ${usersSnap.size} users, ${studentsSnap.size} students`);

  // Helper to resolve an arbitrary ID/string to a canonical students collection doc ID
  function resolveStudentId(rawId, rollNo, studentName) {
    if (!rawId) return null;
    // 1. Direct student doc id
    if (studentDocMap.has(rawId)) return rawId;
    // 2. User mapped student id
    if (userToStudentId.has(rawId)) return userToStudentId.get(rawId);
    // 3. Roll number match
    if (rollNo && rollToStudentId.has(String(rollNo).trim())) {
      return rollToStudentId.get(String(rollNo).trim());
    }
    if (rawId && rollToStudentId.has(String(rawId).trim())) {
      return rollToStudentId.get(String(rawId).trim());
    }
    // 4. Username match
    if (usernameToStudentId.has(String(rawId).trim())) {
      return usernameToStudentId.get(String(rawId).trim());
    }
    return null;
  }

  // 3. Collect unique present dates for each canonical student: Map<canonicalStudentId, Set<YYYY-MM-DD>>
  const studentPresentDates = new Map();
  function addPresentDate(canonicalId, dateStr) {
    if (!canonicalId || !dateStr) return;
    if (!studentPresentDates.has(canonicalId)) {
      studentPresentDates.set(canonicalId, new Set());
    }
    studentPresentDates.get(canonicalId).add(dateStr);
  }

  // A. Scan new_attendance
  const newAttSnap = await db.collection('new_attendance').get();
  console.log(`Processing ${newAttSnap.size} new_attendance records...`);
  newAttSnap.docs.forEach(doc => {
    const d = doc.data();
    const joined = d.joinedAt || d.createdAt;
    if (joined) {
      const dateStr = new Date(joined).toISOString().slice(0, 10);
      const canonicalId = resolveStudentId(d.studentId, d.rollNo, d.studentName);
      if (canonicalId) {
        addPresentDate(canonicalId, dateStr);
      }
    }
  });

  // B. Scan lms_class_attendance
  const lmsAttSnap = await db.collection('lms_class_attendance').get();
  console.log(`Processing ${lmsAttSnap.size} lms_class_attendance records...`);
  lmsAttSnap.docs.forEach(doc => {
    const d = doc.data();
    const joined = d.joinedAt || d.createdAt;
    if (joined) {
      const dateStr = new Date(joined).toISOString().slice(0, 10);
      const canonicalId = resolveStudentId(d.studentId, d.regNo, d.studentName);
      if (canonicalId) {
        addPresentDate(canonicalId, dateStr);
      }
    }
  });

  // C. Scan live_sessions joinedParticipantsDetails
  const liveSessionsSnap = await db.collection('live_sessions').get();
  console.log(`Processing ${liveSessionsSnap.size} live_sessions participant details...`);
  liveSessionsSnap.docs.forEach(doc => {
    const d = doc.data();
    const participants = d.joinedParticipantsDetails || {};
    for (const [pKey, pVal] of Object.entries(participants)) {
      if (pVal && (pVal.role === 'student' || pVal.role === undefined)) {
        const joined = pVal.joinedAt || d.createdAt;
        if (joined) {
          const dateStr = new Date(joined).toISOString().slice(0, 10);
          const canonicalId = resolveStudentId(pKey, pVal.regNo, pVal.name);
          if (canonicalId) {
            addPresentDate(canonicalId, dateStr);
          }
        }
      }
    }
  });

  console.log(`\nIdentified ${studentPresentDates.size} students with historical live class attendance.`);

  // 4. Update each student doc
  let updatedCount = 0;
  for (const [canonicalId, datesSet] of studentPresentDates.entries()) {
    const sDocRef = db.collection('students').doc(canonicalId);
    const sDoc = await sDocRef.get();
    if (!sDoc.exists) continue;

    const sData = sDoc.data() || {};
    const existingLog = { ...(sData.attendanceLog || {}) };
    let changed = false;

    for (const dateStr of datesSet) {
      if (existingLog[dateStr] !== 'present') {
        existingLog[dateStr] = 'present';
        changed = true;
      }
    }

    if (changed) {
      const totalPresentDays = Object.values(existingLog).filter(v => v === 'present').length;
      const sortedDates = Object.keys(existingLog).sort();
      const latestDate = sortedDates[sortedDates.length - 1];

      await sDocRef.update({
        attendanceLog: existingLog,
        attendedDays: totalPresentDays,
        lastAttendanceDate: latestDate,
        lastAttendanceStatus: existingLog[latestDate] || 'present',
        updatedAt: new Date().toISOString()
      });

      const sName = sData.name || sData.displayName || canonicalId;
      console.log(`[UPDATED] Student ${sName} (${sData.rollNumber || canonicalId}): added dates [${Array.from(datesSet).join(', ')}] -> attendedDays = ${totalPresentDays}`);
      updatedCount++;
    } else {
      const sName = sData.name || sData.displayName || canonicalId;
      console.log(`[NO CHANGE] Student ${sName} already had all dates logged.`);
    }
  }

  console.log(`\nBackfill complete! Updated ${updatedCount} student profiles in Firestore.`);
  process.exit(0);
}

runBackfill().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
