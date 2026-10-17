const fs = require('fs');

function findInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('admin_approvals') || l.includes('adminApprovals') || l.includes('profileEditRequested: true') || l.includes('requestApproval') || l.includes('/admin-approvals') || l.includes('/approvals')) {
      if (l.includes('post') || l.includes('addDoc') || l.includes('setDoc') || l.includes('updateDoc') || l.includes('request')) {
        console.log(`${filePath}:${i+1}: ${l.trim()}`);
      }
    }
  });
}

const path = require('path');
function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === 'dist') return;
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) findInFile(p);
  });
}

walk('web_portal');
