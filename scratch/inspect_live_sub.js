const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('lmsSub === "live-classes"') || l.includes('lmsSub === "my-live"')) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
