const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('lmsSub === "lms-teachers"') || l.includes('lmsSub === \'lms-teachers\'')) {
    console.log(`LMS Teacher component at line ${i+1}: ${l}`);
  }
  if (l.includes('erpSub === "staff"') || l.includes('erpSub === \'staff\'')) {
    console.log(`ERP Staff component at line ${i+1}: ${l}`);
  }
});
