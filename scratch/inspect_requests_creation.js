const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

function findOccurrences(query, max=5) {
  const lines = content.split('\n');
  const results = [];
  lines.forEach((l, i) => {
    if (l.includes(query)) {
      results.push({ line: i + 1, text: l.trim() });
    }
  });
  return results.slice(0, max);
}

console.log('--- TEST ENTRY REQUESTS ---');
console.log(findOccurrences('offlineTestRequests'));
console.log(findOccurrences('offline_requests'));
console.log(findOccurrences('test-entry'));

console.log('--- QR PERMISSION REQUESTS ---');
console.log(findOccurrences('qrCodeRequested'));
console.log(findOccurrences('requestQrPermission'));

console.log('--- SACS REQUESTS ---');
console.log(findOccurrences('sacsRequests'));
console.log(findOccurrences('requestAccess'));

console.log('--- EDIT-BY-APPROVAL ---');
console.log(findOccurrences('admin_approvals'));
console.log(findOccurrences('adminApprovals'));
console.log(findOccurrences('profileEditRequested'));
