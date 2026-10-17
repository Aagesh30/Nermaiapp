const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

// Find where navigation bar tabs are defined
const matches = content.match(/setActiveTab\([^)]+\)/g) || [];
console.log('setActiveTab calls:', Array.from(new Set(matches)));

// Find teacher tabs
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('isTeacher') && (lines[i].includes('tab') || lines[i].includes('Tab') || lines[i].includes('nav') || lines[i].includes('Nav'))) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
