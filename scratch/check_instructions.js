const fs = require('fs');

console.log('--- App.tsx ---');
const app = fs.readFileSync('App.tsx', 'utf8');
console.log('App.tsx includes showInstructions:', app.includes('showInstructions'));

console.log('--- web_portal/App.tsx ---');
const webApp = fs.readFileSync('web_portal/App.tsx', 'utf8');
console.log('web_portal/App.tsx includes showInstructions:', webApp.includes('showInstructions'));
