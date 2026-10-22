const fs = require('fs');
const path = require('path');

function getFiles(dir, exts = ['.ts', '.tsx', '.js']) {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', '.expo', 'scratch', 'android'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full, exts));
    } else if (exts.some(e => item.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const files = getFiles('.');

// Rules collections
const rulesText = fs.readFileSync('firestore.rules', 'utf8');
const colMatches = rulesText.matchAll(/match\s+\/([a-zA-Z0-9_{}]+)\/\{[a-zA-Z0-9_{}]+\}/g);
const allCollections = [];
for (const m of colMatches) {
  if (m[1] !== 'databases' && !m[1].includes('{')) {
    allCollections.push(m[1]);
  }
}
const collections = Array.from(new Set(allCollections));

const table = {};
for (const col of collections) {
  table[col] = {
    webDirectReads: [],
    webDirectWrites: [],
    mobileDirectReads: [],
    mobileDirectWrites: [],
    backendAdminUsage: [],
  };
}

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const isBackend = f.startsWith('backend');
  const isMobile = f === 'App.tsx';
  const isWeb = f.startsWith('web_portal');

  lines.forEach((line, idx) => {
    for (const col of collections) {
      // Check direct client reference: (collection|doc)(db, 'col'...)
      const clientRegex = new RegExp(`(?:collection|doc)\\s*\\(\\s*(?:db|getFirestore\\(\\))\\s*,\\s*['"]${col}['"]`);
      if (clientRegex.test(line)) {
        const item = `${f}:${idx + 1} -> ${line.trim().slice(0, 100)}`;
        // Determine if read or write in surrounding 5 lines
        const context = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join('\n');
        const isWrite = /setDoc|addDoc|updateDoc|deleteDoc/.test(context);
        const isRead = /getDoc|getDocs|onSnapshot/.test(context);

        if (isWeb) {
          if (isWrite) table[col].webDirectWrites.push(item);
          if (isRead) table[col].webDirectReads.push(item);
          if (!isWrite && !isRead) table[col].webDirectReads.push(item); // default query/listener setup
        }
        if (isMobile) {
          if (isWrite) table[col].mobileDirectWrites.push(item);
          if (isRead) table[col].mobileDirectReads.push(item);
        }
      }

      // Backend admin SDK: db.collection('col')
      if (isBackend) {
        const adminRegex = new RegExp(`db\\.collection\\s*\\(\\s*['"]${col}['"]`);
        if (adminRegex.test(line)) {
          table[col].backendAdminUsage.push(`${f}:${idx + 1}`);
        }
      }
    }
  });
}

fs.writeFileSync('scratch/precise_rw_table.json', JSON.stringify(table, null, 2));
console.log('PRECISE RW INSPECTION COMPLETE');
