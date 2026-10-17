const { execSync } = require('child_process');
const fs = require('fs');

const s = execSync('git show 6911f9a:web_portal/App.tsx', { maxBuffer: 100 * 1024 * 1024 }).toString('utf8');

const marker = '{erpSub === "offline-attendance" && isAdmin && (() => {';
const start = s.indexOf(marker);
const end = s.indexOf('{erpSub === "sacs"', start);

console.log('Indices in commit 6911f9a:', { start, end });

const block = s.slice(start, end);
fs.writeFileSync('scratch/original_commit_block.tsx', block, 'utf8');
console.log('Wrote scratch/original_commit_block.tsx, length:', block.length);
