const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const regex = /activeTab\s*===\s*["']([^"']+)["']/g;
let match;
const set = new Set();
while ((match = regex.exec(content)) !== null) {
  set.add(match[1]);
}
console.log('Active Tabs in App.tsx:', Array.from(set));

const subRegex = /(testSub|erpSub|lmsSub|crmSub)\s*===\s*["']([^"']+)["']/g;
const subSet = new Set();
while ((match = subRegex.exec(content)) !== null) {
  subSet.add(match[1] + ' = ' + match[2]);
}
console.log('Sub Tabs in App.tsx:', Array.from(subSet));
