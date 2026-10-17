const fs = require('fs');
const content = fs.readFileSync('D:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('typeof')) {
    console.log(`L${i + 1}: ${l}`);
  }
});
