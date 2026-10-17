const fs = require('fs');

const code = fs.readFileSync('App.tsx', 'utf8');
const lines = code.split('\n');

// Track brackets, parentheses, braces from start up to line 47127
let braces = 0;
let parens = 0;
let brackets = 0;

const stack = [];

for (let i = 0; i < 47127; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    // Simple naive scanner (skipping comments roughly)
    if (char === '/' && line[j+1] === '/') break;
    if (char === '{') {
      braces++;
      stack.push({ type: '{', line: i + 1, col: j + 1 });
    } else if (char === '}') {
      braces--;
      const top = stack.pop();
      if (!top || top.type !== '{') {
        // mismatch
      }
    } else if (char === '(') {
      parens++;
      stack.push({ type: '(', line: i + 1, col: j + 1 });
    } else if (char === ')') {
      parens--;
      stack.pop();
    }
  }
}

console.log('At line 47127: braces =', braces, ', parens =', parens);
console.log('Unclosed items remaining on stack (last 10):');
stack.slice(-10).forEach(s => console.log(`Unclosed ${s.type} opened at line ${s.line}:${s.col} -> ${lines[s.line - 1].trim().slice(0, 80)}`));
