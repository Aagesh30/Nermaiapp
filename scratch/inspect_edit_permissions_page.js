const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('erpSub === "edit-permissions"')) {
    console.log(`Line ${i+1}: ${l}`);
    console.log(lines.slice(i, i+30).join('\n'));
  }
});
