const fs = require('fs');

const code = fs.readFileSync('App.tsx', 'utf8');
const search = `studentsRef.current = students;`;
console.log('Includes search:', code.includes(search));
const idx = code.indexOf(search);
console.log('Context:', JSON.stringify(code.slice(idx - 50, idx + 100)));
