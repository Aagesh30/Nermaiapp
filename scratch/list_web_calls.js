const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const regex = /(collection|doc)\s*\(\s*db\s*,\s*['"]([a-zA-Z0-9_\/-]+)['"]/g;
let m;
const occurrences = [];
while ((m = regex.exec(content)) !== null) {
  occurrences.push({ type: m[1], target: m[2], index: m.index });
}

console.log('Total occurrences in web_portal/App.tsx:', occurrences.length);

const grouped = {};
for (const o of occurrences) {
  const col = o.target.split('/')[0];
  if (!grouped[col]) grouped[col] = 0;
  grouped[col]++;
}

console.log('Grouped counts:', grouped);

// For each collection, find sample surrounding context (lines)
const lines = content.split('\n');
for (const col of Object.keys(grouped)) {
  console.log('\n--- Collection: ' + col + ' ---');
  let count = 0;
  lines.forEach((line, idx) => {
    if (count < 3 && (line.includes(`"${col}"`) || line.includes(`'${col}'`)) && (line.includes('collection(') || line.includes('doc('))) {
      console.log(`  Line ${idx + 1}: ${line.trim()}`);
      count++;
    }
  });
}
