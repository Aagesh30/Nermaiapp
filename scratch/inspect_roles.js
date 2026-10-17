const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const roles = content.match(/role\s*===?\s*['"][a-zA-Z0-9_-]+['"]/g) || [];
console.log('Roles found:', Array.from(new Set(roles)));
