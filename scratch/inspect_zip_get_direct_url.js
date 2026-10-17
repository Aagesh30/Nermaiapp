const fs = require('fs');
const path = require('path');

const zipWebApp = path.join(__dirname, 'zip_inspect/NERMAI_IAS_ACADEMY/web_portal/App.tsx');

if (fs.existsSync(zipWebApp)) {
    const lines = fs.readFileSync(zipWebApp, 'utf8').split('\n');
    console.log("--- ZIP FILE: LINES 70-110 of web_portal/App.tsx ---");
    for (let i = 69; i < 110; i++) {
        console.log(`L${i + 1}: ${lines[i]}`);
    }
}
