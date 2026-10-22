const fs = require('fs');
const path = require('path');

function scanFile(filePath, clientCols, backendCols) {
  const content = fs.readFileSync(filePath, 'utf8');
  const isBackend = filePath.startsWith('backend');
  
  // Direct firestore client SDK calls: collection(db, "...") or doc(db, "...")
  const clientRegex = /(?:collection|doc)\s*\(\s*(?:db|getFirestore\(\))\s*,\s*['"]([a-zA-Z0-9_\/-]+)['"]/g;
  let m;
  while ((m = clientRegex.exec(content)) !== null) {
    const col = m[1].split('/')[0];
    if (!clientCols[col]) clientCols[col] = new Set();
    clientCols[col].add(filePath);
  }

  // Admin SDK calls: db.collection("...")
  const adminRegex = /db\.collection\s*\(\s*['"]([a-zA-Z0-9_\/-]+)['"]/g;
  while ((m = adminRegex.exec(content)) !== null) {
    const col = m[1].split('/')[0];
    if (!backendCols[col]) backendCols[col] = new Set();
    backendCols[col].add(filePath);
  }
}

function walk(dir, clientCols, backendCols) {
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', '.expo', 'scratch', 'android'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, clientCols, backendCols);
    } else if (/\.(tsx|ts|js|jsx)$/.test(item)) {
      scanFile(full, clientCols, backendCols);
    }
  }
}

const clientCols = {};
const backendCols = {};

walk('.', clientCols, backendCols);

const report = {
  directClientCollections: Object.keys(clientCols).map(k => ({ col: k, filesCount: clientCols[k].size, files: Array.from(clientCols[k]) })),
  backendAdminCollections: Object.keys(backendCols).map(k => ({ col: k, filesCount: backendCols[k].size, files: Array.from(backendCols[k]) })),
};

fs.writeFileSync('scratch/scan_result.json', JSON.stringify(report, null, 2));
console.log('SCAN COMPLETED');
console.log('Client collections found:', Object.keys(clientCols));
