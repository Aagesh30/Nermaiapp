const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/precise_rw_table.json', 'utf8'));

console.log('Total collections evaluated:', Object.keys(data).length);

const summary = [];
for (const [col, info] of Object.entries(data)) {
  const hasClientRead = info.webDirectReads.length > 0 || info.mobileDirectReads.length > 0;
  const hasClientWrite = info.webDirectWrites.length > 0 || info.mobileDirectWrites.length > 0;
  const hasBackend = info.backendAdminUsage.length > 0;

  let whoReads = [];
  if (info.webDirectReads.length > 0) whoReads.push('Web (Direct Firestore SDK)');
  if (info.mobileDirectReads.length > 0) whoReads.push('Mobile (Direct)');
  if (hasBackend) whoReads.push('Backend (Admin SDK)');
  if (whoReads.length === 0) whoReads.push('None (Unused or rules-only)');

  let whoWrites = [];
  if (info.webDirectWrites.length > 0) whoWrites.push('Web (Direct Firestore SDK)');
  if (info.mobileDirectWrites.length > 0) whoWrites.push('Mobile (Direct)');
  if (hasBackend) whoWrites.push('Backend (Admin SDK)');
  if (whoWrites.length === 0) whoWrites.push('None (Read-only / Backend only)');

  summary.push({
    collection: col,
    whoReads: whoReads.join(' + '),
    whoWrites: whoWrites.join(' + '),
    hasClientDirectAccess: hasClientRead || hasClientWrite,
    webReadCount: info.webDirectReads.length,
    webWriteCount: info.webDirectWrites.length,
    backendCount: info.backendAdminUsage.length
  });
}

fs.writeFileSync('scratch/phase1_summary.json', JSON.stringify(summary, null, 2));
console.log('Saved scratch/phase1_summary.json');
