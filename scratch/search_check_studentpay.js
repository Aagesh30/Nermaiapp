const fs = require('fs');

const content = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Check') || line.includes('Circle') || line.includes('Ionicons') || line.includes('toast') || line.includes('useToast') || line.includes('alert') || line.includes('Alert')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
