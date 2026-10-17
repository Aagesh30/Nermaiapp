const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

const queries = [
  'recorded',
  'live class',
  'live_class',
  'offlineTestPermissionRequests',
  'access_requests',
  'qr',
  'hall ticket',
  'id card',
  'id_card',
  'approval',
  'pending_approvals',
  'teacher'
];

queries.forEach(q => {
  const matches = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(q)) {
      matches.push((idx + 1) + ': ' + line.trim().slice(0, 100));
    }
  });
  console.log(`=== Query: "${q}" (${matches.length} matches) ===`);
  matches.slice(0, 5).forEach(m => console.log(m));
});
