const fs = require('fs');
const lines = fs.readFileSync('web_portal/App.tsx', 'utf8').split('\n');
console.log('Total lines:', lines.length);
for (let i = 43350; i < 43420; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
