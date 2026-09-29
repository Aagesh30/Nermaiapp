const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../web_portal/App.tsx'), 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
lines.forEach((line, index) => {
    if (line.toLowerCase().includes('notice') || line.toLowerCase().includes('announcement')) {
        if (line.includes('Registry') || line.includes('Active Notice') || line.includes('publish') || line.includes('Publish') || line.includes('api/notification') || line.includes('fetch')) {
            console.log(`L${index + 1}: ${line.trim().slice(0, 150)}`);
        }
    }
});
