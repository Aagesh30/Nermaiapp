const fs = require('fs');
const path = require('path');

// List of all collections in firestore.rules
const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
const ruleCollections = [];
const matchRegex = /match\s+\/([a-zA-Z0-9_{}]+)\/\{[a-zA-Z0-9_{}]+\}/g;
let rm;
while ((rm = matchRegex.exec(rulesContent)) !== null) {
  if (rm[1] !== 'databases') {
    ruleCollections.push(rm[1]);
  }
}

const uniqueCollections = Array.from(new Set(ruleCollections));

// Inspect each collection in client and backend
const results = {};

for (const col of uniqueCollections) {
  results[col] = {
    webRead: false,
    webWrite: false,
    mobileRead: false,
    mobileWrite: false,
    backendAdmin: false,
    clientFiles: [],
    details: []
  };
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const isBackend = filePath.startsWith('backend');
  const isMobileApp = filePath === 'App.tsx' || filePath.startsWith('assets');
  const isWebPortal = filePath.startsWith('web_portal');

  for (const col of uniqueCollections) {
    // Check if collection is referenced
    const regex = new RegExp(`['"]${col}['"]`, 'g');
    if (!regex.test(content)) continue;

    if (isBackend) {
      if (content.includes(`db.collection('${col}')`) || content.includes(`db.collection("${col}")`)) {
        results[col].backendAdmin = true;
        results[col].details.push(`Backend Admin: ${filePath}`);
      }
    } else {
      // Check client operations
      // Direct Firestore SDK
      const hasClientRef = new RegExp(`(?:collection|doc)\\s*\\(\\s*(?:db|getFirestore\\(\\))\\s*,\\s*['"]${col}['"]`).test(content);
      if (hasClientRef) {
        results[col].clientFiles.push(filePath);
        
        // Check read
        if (content.includes('getDocs(') || content.includes('getDoc(') || content.includes('onSnapshot(')) {
          if (isMobileApp) results[col].mobileRead = true;
          if (isWebPortal) results[col].webRead = true;
        }
        // Check write
        if (content.includes('setDoc(') || content.includes('addDoc(') || content.includes('updateDoc(') || content.includes('deleteDoc(')) {
          if (isMobileApp) results[col].mobileWrite = true;
          if (isWebPortal) results[col].webWrite = true;
        }
      }
    }
  }
}

function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', '.expo', 'scratch', 'android'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(tsx|ts|js|jsx)$/.test(item)) {
      analyzeFile(full);
    }
  }
}

walk('.');

fs.writeFileSync('scratch/deep_collection_analysis.json', JSON.stringify(results, null, 2));
console.log('DEEP ANALYSIS COMPLETE');
