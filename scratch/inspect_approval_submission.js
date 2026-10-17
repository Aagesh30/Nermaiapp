const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('one_time_permissions') || l.includes('edit_with_approval') || l.includes('request_edit') || l.includes('approval_request')) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
