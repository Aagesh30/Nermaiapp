const fs = require('fs');

const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');

console.log('--- Searching for Modals ---');
lines.forEach((l, idx) => {
  if (l.includes('<Modal')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});

console.log('--- Searching for instruction / guideline / rules ---');
lines.forEach((l, idx) => {
  if (/instruction|guideline|rule/i.test(l) && !l.includes('firestore.rules')) {
    if (idx < 7000) { // test portal is usually around lines 3000-6500
      console.log(`Line ${idx + 1}: ${l.trim()}`);
    }
  }
});
