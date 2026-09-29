const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const lines = content.split('\n');

const pageRenderLines = [];

lines.forEach((l, idx) => {
  if (l.includes('{activeTab ===') || l.includes('{erpSub ===') || l.includes('{render')) {
    if (idx > 15000) { // JSX rendering area in MainApp
      pageRenderLines.push({ line: idx + 1, code: l.trim() });
    }
  }
});

console.log('Found JSX render triggers in MainApp:', pageRenderLines.length);
pageRenderLines.slice(0, 40).forEach(p => console.log(`${p.line}: ${p.code}`));
