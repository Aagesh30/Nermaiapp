const fs = require('fs');
const lines = fs.readFileSync('web_portal/App.tsx', 'utf8').split('\n');
lines.forEach((l, idx) => {
  if (l.includes('renderSidebarItem') || l.includes('activeTab === "dashboard"') || l.includes('activeTab === "test_portal"')) {
    if (idx > 28000 && idx < 31000) {
      console.log((idx + 1) + ': ' + l.trim());
    }
  }
});
