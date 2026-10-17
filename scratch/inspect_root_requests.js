const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('offlineTestPermissionRequests') || l.includes('permission-requests') || l.includes('qrCodeRequested') || l.includes('sacs') || l.includes('admin_approvals') || l.includes('profileEditRequested')) {
    console.log(`Line ${i+1}: ${l}`);
  }
});
