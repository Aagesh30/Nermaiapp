const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('renderSidebarItem(') && lines[i].includes('erpSub')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
