const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'web_portal', 'App.tsx');
let text = fs.readFileSync(filePath, 'utf8');

const oldSnippet = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup,`.replace(/\n/g, '\r\n');

const newSnippet = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup === "mock" ? "special_batch" : bulkTargetGroup,
                                                           specialBatchId: activeSpecialBatchObj?.id,
                                                           specialBatchName: activeSpecialBatchObj?.batchName,`.replace(/\n/g, '\r\n');

let occurrences = 0;
while (text.includes(oldSnippet)) {
    text = text.replace(oldSnippet, newSnippet);
    occurrences++;
}
console.log('Replaced occurrences:', occurrences);

const oldRoll = `mockRollNumbers: activeMockObj?.mockConfig?.mockRollNumbers || {},`;
const newRoll = `mockRollNumbers: activeSpecialBatchObj?.studentRollMap || activeMockObj?.mockConfig?.mockRollNumbers || {},`;

let rollOccurrences = 0;
while (text.includes(oldRoll)) {
    text = text.replace(oldRoll, newRoll);
    rollOccurrences++;
}
console.log('Replaced roll occurrences:', rollOccurrences);

fs.writeFileSync(filePath, text, 'utf8');
console.log('Done!');
