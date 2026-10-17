const fs = require('fs');
const path = require('path');

const zipBackendCtrl = path.join(__dirname, 'zip_inspect/NERMAI_IAS_ACADEMY/backend/modules/crm/campaigns/controller.ts');
const currBackendCtrl = path.join(__dirname, '../backend/modules/crm/campaigns/controller.ts');

const zipWebApp = path.join(__dirname, 'zip_inspect/NERMAI_IAS_ACADEMY/web_portal/App.tsx');
const currWebApp = path.join(__dirname, '../web_portal/App.tsx');

console.log("--- ORIGINAL BACKEND CAMPAIGN CONTROLLER IN ZIP ---");
if (fs.existsSync(zipBackendCtrl)) {
    console.log(fs.readFileSync(zipBackendCtrl, 'utf8'));
} else {
    console.log("Zip backend controller not found");
}

console.log("\n--- SEARCHING FOR CAMPAIGN LOGIC IN ORIGINAL WEB PORTAL APP.TSX IN ZIP ---");
if (fs.existsSync(zipWebApp)) {
    const zipAppContent = fs.readFileSync(zipWebApp, 'utf8');
    const lines = zipAppContent.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('saveCampaign') || line.includes('getCampaignPosterUri') || line.includes('getDirectImageUrl') || line.includes('Special Highlights')) {
            console.log(`L${idx + 1}: ${line.substring(0, 120)}`);
        }
    });
}
