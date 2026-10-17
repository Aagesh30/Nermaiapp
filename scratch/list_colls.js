const fs = require('fs');
const lines = fs.readFileSync('web_portal/App.tsx', 'utf8').split('\n');
const colls = new Set();
lines.forEach(l => {
  const m = l.match(/collection\(db,\s*["']([^"']+)["']\)/);
  if (m) colls.add(m[1]);
});
console.log(Array.from(colls));
