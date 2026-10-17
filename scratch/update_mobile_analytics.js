const fs = require('fs');
const path = require('path');

const appFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let content = fs.readFileSync(appFile, 'utf8');
const isCrlf = content.includes('\r\n');
let lines = content.split(/\r?\n/);

// Find mobile Analytics button
let mobileBtnIndex = -1;
for (let i = 29620; i < 29660; i++) {
  if (lines[i] && lines[i].includes('{isDiagExpanded ? "Hide Analytics" : "Analytics"}')) {
    mobileBtnIndex = i;
    break;
  }
}

if (mobileBtnIndex === -1) {
  console.error("Could not find mobile button index!");
  process.exit(1);
}

// Lines 29630 to 29642 (13 lines):
// from "{hasSubjects && (" to ")}"
const startIdx = mobileBtnIndex - 9; // where "{hasSubjects && (" starts
const endIdx = mobileBtnIndex + 2;   // where ")}" ends

console.log("Replacing from line", startIdx, "to", endIdx);
console.log("Start line content:", lines[startIdx]);
console.log("End line content:", lines[endIdx]);

const newMobileBtnLines = [
  '                                                    {hasSubjects && (',
  '                                                      <TouchableOpacity',
  '                                                        onPress={() => {',
  '                                                          fetchTestDiagnostics(t.id);',
  '                                                          setMobileSubjectAnalyticsModalTest(t);',
  '                                                        }}',
  '                                                        style={{ flex: 1, backgroundColor: "#0284c7", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}',
  '                                                      >',
  '                                                        <Ionicons name="pie-chart-outline" size={14} color="#fff" />',
  '                                                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Analytics</Text>',
  '                                                      </TouchableOpacity>',
  '                                                    )}'
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newMobileBtnLines);

// Now find where reports modal ends to insert the mobile analytics modal
let reportsModalCloseIdx = -1;
for (let i = lines.length - 3000; i < lines.length; i++) {
  if (lines[i] && lines[i].includes('Close Reports Summary</Text>')) {
    // next lines are </TouchableOpacity>, </View>, </View>, </Modal>, )}
    reportsModalCloseIdx = i;
    break;
  }
}

if (reportsModalCloseIdx === -1) {
  console.error("Could not find reports modal close!");
  process.exit(1);
}

console.log("Found reports modal close at", reportsModalCloseIdx);
// Find the closing )} of the modal
let insertIdx = -1;
for (let i = reportsModalCloseIdx; i < reportsModalCloseIdx + 15; i++) {
  if (lines[i] && lines[i].trim() === ')}') {
    insertIdx = i + 1;
    break;
  }
}

console.log("Inserting mobile modal at line", insertIdx);

const mobileModalLines = [
  '',
  '      {/* ── MOBILE SEPARATE WINDOW / MODAL FOR SUBJECT ANALYTICS ── */}',
  '      {mobileSubjectAnalyticsModalTest && (',
  '        <Modal',
  '          visible={true}',
  '          animationType="slide"',
  '          onRequestClose={() => setMobileSubjectAnalyticsModalTest(null)}',
  '        >',
  '          <SafeAreaView style={{ flex: 1, backgroundColor: darkMode ? "#0f172a" : "#f8fafc" }}>',
  '            {/* Modal Top Header Bar */}',
  '            <View style={{',
  '              flexDirection: "row",',
  '              alignItems: "center",',
  '              justifyContent: "space-between",',
  '              paddingHorizontal: 16',
  '              paddingVertical: 14',
  '              backgroundColor: darkMode ? "#1e293b" : "#ffffff",',
  '              borderBottomWidth: 1,',
  '              borderBottomColor: darkMode ? "#334155" : "#e2e8f0",',
  '              shadowColor: "#000",',
  '              shadowOffset: { width: 0, height: 2 },',
  '              shadowOpacity: 0.08,',
  '              shadowRadius: 4,',
  '              elevation: 3',
  '            }}>',
  '              <View style={{ flex: 1, marginRight: 12 }}>',
  '                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>',
  '                  <Ionicons name="pie-chart" size={18} color="#c62828" />',
  '                  <Text style={{ fontSize: 16, fontWeight: "900", color: darkMode ? "#ffffff" : "#0f172a" }} numberOfLines={1}>',
  '                    Subject Analytics',
  '                  </Text>',
  '                </View>',
  '                <Text style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#64748b", marginTop: 2 }} numberOfLines={1}>',
  '                  {mobileSubjectAnalyticsModalTest.title || "Exam Diagnostics"}',
  '                </Text>',
  '              </View>',
  '',
  '              <TouchableOpacity',
  '                onPress={() => setMobileSubjectAnalyticsModalTest(null)}',
  '                style={{',
  '                  flexDirection: "row",',
  '                  alignItems: "center",',
  '                  gap: 4,',
  '                  paddingHorizontal: 12,',
  '                  paddingVertical: 6,',
  '                  borderRadius: 8,',
  '                  backgroundColor: darkMode ? "#334155" : "#fee2e2"',
  '                }}',
  '              >',
  '                <Ionicons name="close" size={18} color="#dc2626" />',
  '                <Text style={{ fontSize: 13, fontWeight: "800", color: "#dc2626" }}>Close</Text>',
  '              </TouchableOpacity>',
  '            </View>',
  '',
  '            {/* Scrollable Body */}',
  '            <ScrollView',
  '              style={{ flex: 1 }}',
  '              contentContainerStyle={{ padding: 12, paddingBottom: 40 }}',
  '              showsVerticalScrollIndicator={true}',
  '            >',
  '              {renderSubjectAnalyticsDiagnosticPanel(mobileSubjectAnalyticsModalTest)}',
  '            </ScrollView>',
  '          </SafeAreaView>',
  '        </Modal>',
  '      )}'
];

// Note the missing commas in style paddingHorizontal: 16, paddingVertical: 14:
// fix them in the array!
mobileModalLines[14] = "              paddingHorizontal: 16,";
mobileModalLines[15] = "              paddingVertical: 14,";

lines.splice(insertIdx, 0, ...mobileModalLines);

const updatedContent = lines.join(isCrlf ? '\r\n' : '\n');
fs.writeFileSync(appFile, updatedContent, 'utf8');
console.log("Updated App.tsx successfully!");
