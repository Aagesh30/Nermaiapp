const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('handleAuth') || l.includes('Enter Username') || l.includes('SIGNING IN')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
