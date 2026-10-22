const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');
let count = 0;
lines.forEach((l, i) => {
  if (l.includes('"students"') || l.includes("'students'")) {
    if (l.includes('setDoc') || l.includes('addDoc') || l.includes('updateDoc') || l.includes('deleteDoc')) {
      console.log((i+1) + ': ' + l.trim());
      count++;
    }
  }
});
console.log('Total client-side write operations to students:', count);
