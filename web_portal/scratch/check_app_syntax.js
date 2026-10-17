const fs = require('fs');
const babel = require('./node_modules/@babel/core');

const code = fs.readFileSync('App.tsx', 'utf8');
const lines = code.split('\n');
console.log('Total lines:', lines.length);

// Let's use ts parser or babel parser with syntax error location
const parser = require('./node_modules/@babel/parser');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('Parsed successfully with @babel/parser!');
} catch (err) {
  console.error('Parser Error:', err.message);
  console.error('Line:', err.loc?.line, 'Column:', err.loc?.column);
  const errLine = err.loc?.line;
  if (errLine) {
    console.log('--- Context around line', errLine, '---');
    for (let l = Math.max(1, errLine - 15); l <= Math.min(lines.length, errLine + 5); l++) {
      console.log(`${l}: ${lines[l - 1]}`);
    }
  }
}
