const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('settings') && l.includes('Ionicons')) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
