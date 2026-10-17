const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('admin_approvals') || l.includes('edit_with_approval') || l.includes('/admin-approvals')) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
