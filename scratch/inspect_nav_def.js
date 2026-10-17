const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('setActiveTab("') && (lines[i].includes('nav') || lines[i].includes('Button') || lines[i].includes('touchable') || lines[i].includes('Tab'))) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}

// Check where the main navigation tabs are rendered
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('navigationTabs') || lines[i].includes('navItems') || lines[i].includes('mainTabs')) {
    console.log(`Tabs def: ${i+1}: ${lines[i]}`);
  }
}
