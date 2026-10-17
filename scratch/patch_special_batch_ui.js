const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'web_portal', 'App.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

console.log('Total lines:', lines.length);

// 1. Find line index for `bulkTargetGroup === "mock"`
const idx1 = lines.findIndex(l => l.includes('{bulkTargetGroup === "mock" && (() => {'));
console.log('idx1:', idx1);

if (idx1 === -1) {
    console.error('Could not find idx1');
    process.exit(1);
}

// Find closing of that block: `})()}`
let endIdx1 = -1;
for (let i = idx1; i < idx1 + 100; i++) {
    if (lines[i].includes('})()}')) {
        endIdx1 = i;
        break;
    }
}
console.log('endIdx1:', endIdx1);

const newBlock1 = [
`                                  {bulkTargetGroup === "mock" && (() => {`,
`                                    const specialBatchList = batches.filter((b: any) => b.isSpecial);`,
`                                    if (specialBatchList.length === 0) {`,
`                                      return (`,
`                                        <View style={{ padding: 12, backgroundColor: "#fffbeb", borderRadius: 8, borderWidth: 1, borderColor: "#fde68a", marginTop: 4 }}>`,
`                                          <Text style={{ fontSize: 12, color: "#92400e", fontWeight: "bold", marginBottom: 4 }}>`,
`                                            No Special Batches Found`,
`                                          </Text>`,
`                                          <Text style={{ fontSize: 11, color: "#b45309", marginBottom: 8 }}>`,
`                                            Create a Special Batch with student roll numbers in Special Batch Management first.`,
`                                          </Text>`,
`                                          <TouchableOpacity`,
`                                            onPress={() => {`,
`                                              setActiveTab("lms");`,
`                                              setLmsSub("special-batch");`,
`                                            }}`,
`                                            style={{ alignSelf: "flex-start", backgroundColor: "#c62828", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}`,
`                                          >`,
`                                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>Go to Special Batches</Text>`,
`                                          </TouchableOpacity>`,
`                                        </View>`,
`                                      );`,
`                                    }`,
``,
`                                    const currentBatchObj = specialBatchList.find((b: any) => b.id === selectedMockForIdGen) || specialBatchList[0];`,
``,
`                                    return (`,
`                                      <View style={{ marginTop: 4 }}>`,
`                                        <Text style={[styles.label, { marginBottom: 6 }]}>Select Special Batch:</Text>`,
`                                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8, marginVertical: 4 }}>`,
`                                          {specialBatchList.map((sb: any) => {`,
`                                            const isSelected = (selectedMockForIdGen || specialBatchList[0]?.id) === sb.id;`,
`                                            const bCount = (sb.orderedBatches || sb.subBatches || []).length;`,
`                                            const sRoll = sb.startingRollNo || "182026";`,
`                                            return (`,
`                                              <TouchableOpacity`,
`                                                key={sb.id}`,
`                                                onPress={() => setSelectedMockForIdGen(sb.id)}`,
`                                                style={{`,
`                                                  paddingHorizontal: 14,`,
`                                                  paddingVertical: 8,`,
`                                                  borderRadius: 20,`,
`                                                  backgroundColor: isSelected ? "#c62828" : "#f5f5f5",`,
`                                                  borderWidth: 1,`,
`                                                  borderColor: isSelected ? "#c62828" : "#e0e0e0",`,
`                                                  marginRight: 8`,
`                                                }}`,
`                                              >`,
`                                                <Text style={{ color: isSelected ? "#fff" : "#424242", fontSize: 12, fontWeight: "bold" }}>`,
`                                                  {sb.batchName || "Special Batch"}`,
`                                                </Text>`,
`                                                <Text style={{ color: isSelected ? "#ffcdd2" : "#757575", fontSize: 10 }}>`,
`                                                  Rolls from: {sRoll} ({bCount} batches)`,
`                                                </Text>`,
`                                              </TouchableOpacity>`,
`                                            );`,
`                                          })}`,
`                                        </ScrollView>`,
``,
`                                        {currentBatchObj && (`,
`                                          <View style={{ marginTop: 8, padding: 10, backgroundColor: "#eff6ff", borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe" }}>`,
`                                            <Text style={{ fontSize: 11, color: "#1e40af", fontWeight: "bold" }}>`,
`                                              Active Special Batch: {currentBatchObj.batchName} (Starting Roll: {currentBatchObj.startingRollNo || "182026"})`,
`                                            </Text>`,
`                                            <Text style={{ fontSize: 10, color: "#3b82f6", marginTop: 2 }}>`,
`                                              Included Batches: {(currentBatchObj.orderedBatches || currentBatchObj.subBatches || []).join(", ") || "All Batches"}`,
`                                            </Text>`,
`                                          </View>`,
`                                        )}`,
`                                      </View>`,
`                                    );`,
`                                  })()}`
];

lines.splice(idx1, endIdx1 - idx1 + 1, ...newBlock1);

// 2. Find line index for `const activeMockObj = (bulkTargetGroup === "mock")`
const idx2 = lines.findIndex(l => l.includes('const activeMockObj = (bulkTargetGroup === "mock")'));
console.log('idx2:', idx2);

if (idx2 === -1) {
    console.error('Could not find idx2');
    process.exit(1);
}

// Find where `const sampleStudentForPreview = generationMode === "batch"` starts and ends
const sampleStart = lines.findIndex((l, idx) => idx > idx2 && l.includes('const sampleStudentForPreview = generationMode === "batch"'));
let sampleEnd = -1;
for (let i = sampleStart; i < sampleStart + 50; i++) {
    if (lines[i].includes(': selectedIdStudent;')) {
        sampleEnd = i;
        break;
    }
}
console.log('sampleStart:', sampleStart, 'sampleEnd:', sampleEnd);

const newBlock2 = [
`                                const activeSpecialBatchObj = (bulkTargetGroup === "mock")`,
`                                  ? (batches.find((b: any) => b.isSpecial && b.id === selectedMockForIdGen) || batches.find((b: any) => b.isSpecial))`,
`                                  : null;`,
`                                const activeMockObj = (bulkTargetGroup === "mock")`,
`                                  ? (activeSpecialBatchObj || tests.find((t: any) => t.id === selectedMockForIdGen && (t.isSpecialMock || t.mockConfig)) || tests.find((t: any) => t.isSpecialMock || t.mockConfig))`,
`                                  : null;`,
``,
`                                const targetDisplayName = generationMode === "batch"`,
`                                  ? (bulkTargetGroup === "mock"`,
`                                    ? \`Special Batch: \${activeSpecialBatchObj?.batchName || activeMockObj?.title || "Special Batch"}\``,
`                                    : bulkTargetGroup === "paid" ? \`Batch: \${selectedBatchForGen}\` : bulkTargetGroup === "free" ? "All Guest/Free Users" : "All App Users (Paid & Guest)")`,
`                                  : \`\${selectedIdStudent.firstName} \${selectedIdStudent.lastName}\`;`,
``,
`                                const sampleStudentForPreview = generationMode === "batch"`,
`                                  ? (activeSpecialBatchObj`,
`                                    ? {`,
`                                      firstName: "Sample",`,
`                                      lastName: "Candidate",`,
`                                      rollNumber: "890001",`,
`                                      mockRollNumber: String(activeSpecialBatchObj?.startingRollNo || "182026"),`,
`                                      specialRollNo: String(activeSpecialBatchObj?.startingRollNo || "182026"),`,
`                                      course: activeSpecialBatchObj?.course || "UPSC Special Batch",`,
`                                      batch: (activeSpecialBatchObj?.orderedBatches || activeSpecialBatchObj?.subBatches)?.[0] || activeSpecialBatchObj?.batchName || "Batch 1"`,
`                                    }`,
`                                    : (activeMockObj`,
`                                      ? {`,
`                                        firstName: "Sample",`,
`                                        lastName: "Candidate",`,
`                                        rollNumber: "890001",`,
`                                        mockRollNumber: String(activeMockObj?.mockConfig?.startingRoll || activeMockObj?.mockConfig?.startingRollNo || "182026"),`,
`                                        specialRollNo: String(activeMockObj?.mockConfig?.startingRoll || activeMockObj?.mockConfig?.startingRollNo || "182026"),`,
`                                        course: "UPSC Special Mock",`,
`                                        batch: activeMockObj?.mockConfig?.orderedBatches?.[0] || "Mock Batch 1"`,
`                                      }`,
`                                      : {`,
`                                        firstName: "Sample",`,
`                                        lastName: "Student",`,
`                                        rollNumber: "ROLL-2026-XYZ",`,
`                                        course: "UPSC Civil Services",`,
`                                        batch: bulkTargetGroup === "paid" ? (selectedBatchForGen === "All Batches" ? "General cohort" : selectedBatchForGen) : "Guest Cohort"`,
`                                      }`,
`                                    )`,
`                                  )`,
`                                  : selectedIdStudent;`
];

lines.splice(idx2, sampleEnd - idx2 + 1, ...newBlock2);

let fullText = lines.join('\r\n');

// 3. Update credential generation payload
const oldPayload = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup,
                                                           type: "idcard",
                                                           mockTestId: selectedMockForIdGen || activeMockObj?.id,
                                                           mockRollNumbers: activeMockObj?.mockConfig?.mockRollNumbers || {},
                                                           ...payload
                                                         });`;

const newIdPayload = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup === "mock" ? "special_batch" : bulkTargetGroup,
                                                           specialBatchId: activeSpecialBatchObj?.id,
                                                           specialBatchName: activeSpecialBatchObj?.batchName,
                                                           type: "idcard",
                                                           mockTestId: selectedMockForIdGen || activeMockObj?.id,
                                                           mockRollNumbers: activeSpecialBatchObj?.studentRollMap || activeMockObj?.mockConfig?.mockRollNumbers || {},
                                                           ...payload
                                                         });`;

fullText = fullText.replace(oldPayload.replace(/\n/g, '\r\n'), newIdPayload.replace(/\n/g, '\r\n'));

const oldHallPayload = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup,
                                                           type: "hallticket",
                                                           mockTestId: selectedMockForIdGen || activeMockObj?.id,
                                                           mockRollNumbers: activeMockObj?.mockConfig?.mockRollNumbers || {},
                                                           ...payload
                                                         });`;

const newHallPayload = `                                                         const res = await api.post("/erp/student/bulk/credentials", {
                                                           batch: selectedBatchForGen,
                                                           targetGroup: bulkTargetGroup === "mock" ? "special_batch" : bulkTargetGroup,
                                                           specialBatchId: activeSpecialBatchObj?.id,
                                                           specialBatchName: activeSpecialBatchObj?.batchName,
                                                           type: "hallticket",
                                                           mockTestId: selectedMockForIdGen || activeMockObj?.id,
                                                           mockRollNumbers: activeSpecialBatchObj?.studentRollMap || activeMockObj?.mockConfig?.mockRollNumbers || {},
                                                           ...payload
                                                         });`;

fullText = fullText.replace(oldHallPayload.replace(/\n/g, '\r\n'), newHallPayload.replace(/\n/g, '\r\n'));

// 4. Update Hall Ticket HTML candidate details & PDF name
const searchTicketRoll = `Roll No:</strong> \${myRecord.mockRollNumber || myRecord.rollNumber || "N/A"}`;
const replaceTicketRoll = `Roll No:</strong> \${(myRecord.hallTicketIsSpecial ? (myRecord.specialRollNo || myRecord.mockRollNumber) : (myRecord.rollNumber || myRecord.specialRollNo || myRecord.mockRollNumber)) || "N/A"}`;
fullText = fullText.replace(searchTicketRoll, replaceTicketRoll);

const searchTicketPdf = `HallTicket_\${myRecord.mockRollNumber || myRecord.registerNumber || myRecord.rollNumber || 'Student'}.pdf`;
const replaceTicketPdf = `HallTicket_\${(myRecord.hallTicketIsSpecial ? (myRecord.specialRollNo || myRecord.mockRollNumber) : (myRecord.rollNumber || myRecord.specialRollNo || myRecord.mockRollNumber)) || 'Student'}.pdf`;
fullText = fullText.replace(searchTicketPdf, replaceTicketPdf);

fs.writeFileSync(filePath, fullText, 'utf8');
console.log('App.tsx updated successfully!');
