const fs = require('fs');

const content = fs.readFileSync('web_portal/lms/admin/MergedLeadsAdmissionsPage.tsx', 'utf8');
const lines = content.split('\n');

console.log('=== Modals in MergedLeadsAdmissionsPage.tsx ===');
lines.forEach((l, idx) => {
  if (l.includes('<Modal')) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
