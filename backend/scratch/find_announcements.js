const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../web_portal/App.tsx'), 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('setAnnouncements(')) {
        console.log(`L${index + 1}: ${line.trim()}`);
    }
});
