const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (/AppState|blur|visibilitychange|proctor|strike|fullscreen/i.test(l)) {
    if (idx > 7000 && idx < 23000) {
      console.log((idx + 1) + ': ' + l.trim());
    }
  }
});
