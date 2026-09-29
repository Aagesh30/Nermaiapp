const fs = require('fs');
const path = require('path');

const audit = JSON.parse(fs.readFileSync(path.join(__dirname, 'full_audit_report.json'), 'utf8'));

console.log("=== DETAILED PAGE BY PAGE SYNC ANALYSIS ===");
audit.forEach(item => {
  if (item.filePath.includes('lms') || item.filePath.includes('App.tsx')) {
    console.log(`\nFile: ${item.filePath}`);
    console.log(` - Has onSnapshot: ${item.hasOnSnapshot}`);
    if (item.snapshotCollections.length) {
      console.log(` - Snapshot Collections: ${item.snapshotCollections.join(', ')}`);
    }
    if (item.apiCalls.length) {
      console.log(` - REST API calls: ${item.apiCalls.slice(0, 8).join(', ')}... (total ${item.apiCalls.length})`);
    }
  }
});
