const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(22175, 22388).map((l, i) => `${22176 + i}: ${l}`).join('\n'));
