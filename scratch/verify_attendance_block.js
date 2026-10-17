const fs = require('fs');

const s = fs.readFileSync('web_portal/App.tsx', 'utf8');

const marker = '{erpSub === "offline-attendance" && isAdmin && (() => {';
const start = s.indexOf(marker);
const end = s.indexOf('{erpSub === "sacs"', start);

if (start === -1 || end === -1) {
  console.log('Markers not found', { start, end });
  process.exit(1);
}

const block = s.slice(start, end);
console.log('Block length:', block.length);
console.log('Contains offlineBatchNames:', block.includes('offlineBatchNames'));
console.log('Contains offlineStudents:', block.includes('offlineStudents'));
console.log('Contains attendanceBatchNames:', block.includes('attendanceBatchNames'));
console.log('Contains attendanceStudents:', block.includes('attendanceStudents'));
console.log('Contains attendanceModeFilter:', block.includes('attendanceModeFilter'));
