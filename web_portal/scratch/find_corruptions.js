const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');

const regex = /[\u00C0-\u00FF\u0100-\u017F][\u0080-\u00FF]*/g;
const lines = content.split('\n');

const findings = [];
lines.forEach((line, idx) => {
  if (line.includes('â') || line.includes('ð') || line.includes('Ã')) {
    findings.push({ lineNum: idx + 1, text: line.trim() });
  }
});

console.log('Total matched lines:', findings.length);
findings.slice(0, 30).forEach(f => {
  console.log(`${f.lineNum}: ${f.text}`);
});
