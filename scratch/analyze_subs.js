const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lmsMatches = content.match(/lmsSub === ['"][a-zA-Z0-9_-]+['"]/g) || [];
console.log('lmsSub values:', Array.from(new Set(lmsMatches.map(m => m.split('===')[1].trim()))));

const erpMatches = content.match(/erpSub === ['"][a-zA-Z0-9_-]+['"]/g) || [];
console.log('erpSub values:', Array.from(new Set(erpMatches.map(m => m.split('===')[1].trim()))));

const testMatches = content.match(/testSub === ['"][a-zA-Z0-9_-]+['"]/g) || [];
console.log('testSub values:', Array.from(new Set(testMatches.map(m => m.split('===')[1].trim()))));

const crmMatches = content.match(/crmSub === ['"][a-zA-Z0-9_-]+['"]/g) || [];
console.log('crmSub values:', Array.from(new Set(crmMatches.map(m => m.split('===')[1].trim()))));
