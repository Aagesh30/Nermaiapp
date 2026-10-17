const fs = require('fs');
const lines = fs.readFileSync('web_portal/App.tsx', 'utf8').split('\n');
lines.forEach((l, idx) => {
  if (l.includes('pay-fees') || l.includes('erpSub === "fees"') || l.includes('isStudentFeeBlocked')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});
