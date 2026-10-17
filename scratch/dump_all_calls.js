const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === 'dist' || file === '.git') return;
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const files = getFiles(path.resolve('backend'));
const calls = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('sendPushNotification(') && !f.includes('pushService.ts')) {
      let end = i + 1;
      let depth = 0;
      let started = false;
      for (let j = i; j < Math.min(lines.length, i + 35); j++) {
        const line = lines[j];
        for (const char of line) {
          if (char === '(' || char === '{') { depth++; started = true; }
          else if (char === ')' || char === '}') { depth--; }
        }
        if (started && depth <= 0) {
          end = j + 1;
          break;
        }
      }
      calls.push({
        file: path.relative(path.resolve('.'), f).replace(/\\/g, '/'),
        line: i + 1,
        code: lines.slice(i, end).join('\n')
      });
    }
  });
});

let out = `Total calls found: ${calls.length}\n`;
calls.forEach((c, idx) => {
  out += `\n=================== CALL #${idx + 1} ===================\n`;
  out += `Location: ${c.file}:${c.line}\n`;
  out += `${c.code}\n`;
});

fs.writeFileSync('scratch/all_push_calls.txt', out, 'utf8');
console.log('Saved', calls.length, 'calls to scratch/all_push_calls.txt');
