const fs = require('fs');
const content = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  const l = line.trim();
  if (l.includes('role') && (l.includes('includes(') || l.includes('super_admin') || l.includes('role !== "admin"') || l.includes('role === "admin"'))) {
    console.log(`${index + 1}: ${l}`);
  }
});
