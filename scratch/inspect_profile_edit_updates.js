const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('profileEdit') && (l.includes('setDoc') || l.includes('updateDoc') || l.includes('post(') || l.includes('put('))) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
