const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

// Find all screen rendering sections
const matches = [...content.matchAll(/activeTab\s*===\s*["']([^"']+)["']/g)];
const tabs = new Set(matches.map(m => m[1]));

console.log('--- ACTIVE TABS IDENTIFIED ---');
console.log([...tabs]);

const subMatches = [...content.matchAll(/erpSub\s*===\s*["']([^"']+)["']/g)];
const subTabs = new Set(subMatches.map(m => m[1]));

console.log('\n--- ERP SUB TABS IDENTIFIED ---');
console.log([...subTabs]);

// Check flex vs hardcoded width in styles
const flexCount = (content.match(/flex:\s*1/g) || []).length;
const fixedWidthCount = (content.match(/width:\s*\d{3,4}/g) || []).length;
const minWidthCount = (content.match(/minWidth:\s*\d{3,4}/g) || []).length;
const flexWrapCount = (content.match(/flexWrap:\s*["']wrap["']/g) || []).length;

console.log('\n--- LAYOUT METRICS ---');
console.log({
  flexCount,
  fixedWidthCount,
  minWidthCount,
  flexWrapCount
});
