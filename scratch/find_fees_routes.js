const fs = require('fs');

const content = fs.readFileSync('D:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('erpSub === "fees"') || l.includes('erpSub === "pay-fees"')) {
    console.log(`Line ${i + 1}: ${l.trim().substring(0, 120)}`);
  }
});
