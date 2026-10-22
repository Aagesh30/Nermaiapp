const fs = require('fs');
const path = require('path');

// Extract all collections from firestore.rules
const rulesText = fs.readFileSync('firestore.rules', 'utf8');
const colMatches = rulesText.matchAll(/match\s+\/([a-zA-Z0-9_{}]+)\/\{[a-zA-Z0-9_{}]+\}/g);
const allCollections = [];
for (const m of colMatches) {
  if (m[1] !== 'databases' && !m[1].includes('{')) {
    allCollections.push(m[1]);
  }
}
const collections = Array.from(new Set(allCollections));

// Scan directories
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

const allCodeFiles = getFiles('.');

const analysis = {};
for (const col of collections) {
  analysis[col] = {
    webDirectRead: false,
    webDirectWrite: false,
    mobileDirectRead: false,
    mobileDirectWrite: false,
    backendRead: false,
    backendWrite: false,
    readFiles: [],
    writeFiles: [],
  };
}

for (const file of allCodeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const isBackend = file.startsWith('backend');
  const isMobile = file === 'App.tsx';
  const isWeb = file.startsWith('web_portal');

  for (const col of collections) {
    // Regex for direct firestore client call
    // collection(db, "col") or doc(db, "col", ...)
    const clientRefRegex = new RegExp(`(?:collection|doc)\\s*\\(\\s*(?:db|getFirestore\\(\\))\\s*,\\s*['"]${col}['"]`);
    if (clientRefRegex.test(content)) {
      if (isWeb) {
        // Check for read
        if (content.includes('getDocs(') || content.includes('getDoc(') || content.includes('onSnapshot(')) {
          analysis[col].webDirectRead = true;
          analysis[col].readFiles.push(file);
        }
        // Check for write
        if (content.includes('setDoc(') || content.includes('addDoc(') || content.includes('updateDoc(') || content.includes('deleteDoc(')) {
          analysis[col].webDirectWrite = true;
          analysis[col].writeFiles.push(file);
        }
      }
      if (isMobile) {
        if (content.includes('getDocs(') || content.includes('getDoc(') || content.includes('onSnapshot(')) {
          analysis[col].mobileDirectRead = true;
        }
        if (content.includes('setDoc(') || content.includes('addDoc(') || content.includes('updateDoc(') || content.includes('deleteDoc(')) {
          analysis[col].mobileDirectWrite = true;
        }
      }
    }

    // Backend admin SDK calls: db.collection('col')
    if (isBackend) {
      const adminRefRegex = new RegExp(`db\\.collection\\s*\\(\\s*['"]${col}['"]`);
      if (adminRefRegex.test(content)) {
        if (content.includes('.get(') || content.includes('.listDocuments(')) {
          analysis[col].backendRead = true;
        }
        if (content.includes('.add(') || content.includes('.set(') || content.includes('.update(') || content.includes('.delete(') || content.includes('.batch()')) {
          analysis[col].backendWrite = true;
        }
      }
    }
  }
}

fs.writeFileSync('scratch/table_analysis.json', JSON.stringify(analysis, null, 2));
console.log('Collection table analysis complete for', collections.length, 'collections');
