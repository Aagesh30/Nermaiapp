const fs = require('fs');
const path = require('path');

const appFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let content = fs.readFileSync(appFile, 'utf8');
const isCrlf = content.includes('\r\n');
let lines = content.split(/\r?\n/);

for (let i = 29625; i < 29640; i++) {
  if (lines[i] && lines[i].includes('{hasSubjects && (') && lines[i+1] && lines[i+1].includes('{hasSubjects && (')) {
    console.log("Removing duplicated line at", i);
    lines.splice(i, 1);
    break;
  }
}

fs.writeFileSync(appFile, lines.join(isCrlf ? '\r\n' : '\n'), 'utf8');
console.log("Done fixing duplication!");
