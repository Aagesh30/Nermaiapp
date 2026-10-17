const fs = require('fs');
const path = require('path');

const zipBackendCtrl = path.join(__dirname, 'zip_inspect/NERMAI_IAS_ACADEMY/backend/modules/crm/campaigns/controller.ts');

if (fs.existsSync(zipBackendCtrl)) {
    const lines = fs.readFileSync(zipBackendCtrl, 'utf8').split('\n');
    console.log("--- ZIP BACKEND CONTROLLER: LINES 35-85 ---");
    for (let i = 34; i < 85; i++) {
        console.log(`L${i + 1}: ${lines[i]}`);
    }
}
