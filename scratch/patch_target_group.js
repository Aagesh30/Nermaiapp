const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'web_portal', 'App.tsx');
let text = fs.readFileSync(filePath, 'utf8');

const targetOld = 'targetGroup: bulkTargetGroup,';
const targetNew = `targetGroup: bulkTargetGroup === "mock" ? "special_batch" : bulkTargetGroup,
                                                          specialBatchId: activeSpecialBatchObj?.id,
                                                          specialBatchName: activeSpecialBatchObj?.batchName,`;

let count = 0;
while (text.includes(targetOld)) {
    text = text.replace(targetOld, targetNew);
    count++;
}
console.log('Replaced targetGroup lines:', count);
fs.writeFileSync(filePath, text, 'utf8');
