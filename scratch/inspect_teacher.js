const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('role === "teacher"') || l.includes('role === "staff"')) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
