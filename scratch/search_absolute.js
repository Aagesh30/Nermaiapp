const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (idx > 41900 && idx < 43100) {
    if (l.includes('position: "absolute"') || l.includes("position: 'absolute'")) {
      console.log(`${idx + 1}: ${l.trim()}`);
    }
  }
});
