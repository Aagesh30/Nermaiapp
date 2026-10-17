const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('setOfflineTestRequests(')) {
    console.log(`Line ${i+1}: ${l}`);
    console.log(lines.slice(Math.max(0, i-5), Math.min(lines.length, i+15)).join('\n'));
  }
});
