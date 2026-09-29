const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split(/\r?\n/);
for (let i = 35350; i < 36380; i++) {
  if (lines[i].includes('/* ==================') || lines[i].includes('styles.bottomNav') || lines[i].includes('styles.bottomBar')) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
