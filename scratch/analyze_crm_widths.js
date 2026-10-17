const fs = require('fs');

const content = fs.readFileSync('web_portal/lms/admin/MergedLeadsAdmissionsPage.tsx', 'utf8');
const lines = content.split('\n');

console.log('=== Checking width, minWidth, isMobile, useWindowDimensions in MergedLeadsAdmissionsPage.tsx ===');

lines.forEach((line, idx) => {
  if (/(minWidth|maxWidth|width:\s*[0-9]{3,}|width:\s*['"][0-9]{3,}|useWindowDimensions|Dimensions|isMobile)/i.test(line)) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
