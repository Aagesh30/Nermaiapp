const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines in web_portal/App.tsx:', lines.length);
lines.forEach((line, idx) => {
  if (line.includes('showAuthFlip') || line.includes('Public Learning & Examination Portal')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
