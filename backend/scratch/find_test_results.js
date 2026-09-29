const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('testSub === "results"') || line.includes('testSub === \'results\'')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
