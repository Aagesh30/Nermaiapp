const fs = require('fs');
const path = require('path');

// 1. Scan web_portal and find all React components / pages
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '_expo', 'android', 'ios'].includes(file)) {
        getFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allWebFiles = getFiles(path.join(__dirname, '../web_portal'));
const rootAppFile = path.join(__dirname, '../App.tsx');

const auditResults = [];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasOnSnapshot = content.includes('onSnapshot(');
  const apiCalls = [];
  const regexGet = /api\.get\(['"`]([^'"`]+)['"`]\)/g;
  let match;
  while ((match = regexGet.exec(content)) !== null) {
    apiCalls.push(match[1]);
  }
  const regexFetch = /fetch\(['"`]([^'"`]+)['"`]/g;
  while ((match = regexFetch.exec(content)) !== null) {
    apiCalls.push(match[1]);
  }

  // Check onSnapshot collections
  const snapshotCollections = [];
  const regexSnap = /collection\([^,]+,\s*['"`]([^'"`]+)['"`]\)/g;
  while ((match = regexSnap.exec(content)) !== null) {
    snapshotCollections.push(match[1]);
  }
  const regexDocSnap = /doc\([^,]+,\s*['"`]([^'"`]+)['"`]/g;
  while ((match = regexDocSnap.exec(content)) !== null) {
    snapshotCollections.push(`doc:${match[1]}`);
  }

  return {
    filePath: path.relative(path.join(__dirname, '..'), filePath),
    hasOnSnapshot,
    snapshotCollections: [...new Set(snapshotCollections)],
    apiCalls: [...new Set(apiCalls)],
    lineCount: content.split('\n').length
  };
}

allWebFiles.forEach(f => {
  const res = analyzeFile(f);
  if (res.hasOnSnapshot || res.apiCalls.length > 0) {
    auditResults.push(res);
  }
});

const rootRes = analyzeFile(rootAppFile);
auditResults.push(rootRes);

fs.writeFileSync(path.join(__dirname, 'full_audit_report.json'), JSON.stringify(auditResults, null, 2));
console.log(`Analyzed ${allWebFiles.length} files. Saved to full_audit_report.json`);
