const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('activeTab === "crm"') || line.includes("activeTab === 'crm'")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
