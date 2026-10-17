const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('accessRequests') || l.includes('sacsRequests') || l.includes('access_requests') || l.includes('sacs_requests')) {
    if (l.includes('addDoc') || l.includes('setDoc') || l.includes('post(') || l.includes('collection(')) {
      console.log(`Line ${i+1}: ${l}`);
      console.log(lines.slice(Math.max(0, i-3), Math.min(lines.length, i+5)).join('\n'));
    }
  }
});
