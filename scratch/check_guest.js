const fs = require('fs');
const lines = fs.readFileSync('web_portal/App.tsx', 'utf8').split('\n');
lines.forEach((l, idx) => {
  if (l.includes('role === "guest"') || l.includes("role === 'guest'") || l.includes('isStudentOrGuest')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});
