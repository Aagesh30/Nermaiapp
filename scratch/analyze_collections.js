const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const regex = /collection\s*\(\s*db\s*,\s*["']([^"']+)["']\s*\)/g;
const collections = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  collections.add(match[1]);
}

console.log("Collections in web_portal/App.tsx:");
Array.from(collections).sort().forEach(c => console.log(" - " + c));
