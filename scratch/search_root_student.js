const fs = require('fs');
const lines = fs.readFileSync('App.tsx', 'utf8').split('\n');
lines.forEach((l, idx) => {
  if (l.includes('role === "student"') || l.includes('role === \'student\'')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});
