const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Replace batchStuds
const oldBatchStuds = 'const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);';
const newBatchStuds = 'const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);';

while (content.includes(oldBatchStuds)) {
  content = content.replace(oldBatchStuds, newBatchStuds);
  console.log('Replaced an occurrence of batchStuds');
}

// 2. Find start of batch list
const startStr = '{offlineBatchNames.length === 0 ? (';
const startIdx = content.indexOf(startStr);

const endMarkerCrlf = '                                    })}\r\n                                  </View>';
const endMarkerLf = '                                    })}\n                                  </View>';

let endIdx = content.indexOf(endMarkerCrlf, startIdx);
let markerLen = endMarkerCrlf.length;
if (endIdx === -1) {
  endIdx = content.indexOf(endMarkerLf, startIdx);
  markerLen = endMarkerLf.length;
}

console.log('startIdx:', startIdx, 'endIdx:', endIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `{attendanceBatchNames.length === 0 ? (
                                  <View style={[styles.card, styles.emptyContainer]}>
                                    <Ionicons name="people-outline" size={48} color="#bdbdbd" />
                                    <Text style={styles.emptyText}>No students found for this mode filter.</Text>
                                    <Text style={{ color: "#999", fontSize: 12, textAlign: "center" }}>
                                      Switch the student mode filter or enroll students to view and mark attendance.
                                    </Text>
                                  </View>
                                ) : !offlineAttendanceBatch ? (
                                  // Show batch list
                                  <View style={{ gap: 10 }}>
                                    <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14, marginBottom: 4 }}>Select a Batch to Mark</Text>
                                    {attendanceBatchNames.map((batchName: string) => {
                                      const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === batchName);
                                      const count = batchStuds.length;
                                      const batchInfo = batches.find((b: any) => b.batchName === batchName);
                                      const onlineInBatch = batchStuds.filter(isStudentOnline).length;
                                      const offlineInBatch = count - onlineInBatch;
                                      return (
                                        <TouchableOpacity
                                          key={batchName}
                                          onPress={() => {
                                            setOfflineAttendanceBatch(batchName);
                                            const initialMarks: Record<string, "present" | "absent" | null> = {};
                                            batchStuds.forEach((s: any) => {
                                              if (s.attendanceLog && s.attendanceLog[offlineAttendanceDate]) {
                                                initialMarks[s.id] = s.attendanceLog[offlineAttendanceDate];
                                              }
                                            });
                                            setOfflineAttendanceMarks(initialMarks);
                                          }}
                                          style={[styles.card, {
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            borderLeftWidth: 4,
                                            borderLeftColor: "#c62828",
                                            paddingVertical: 16,
                                            gap: 10
                                          }]}
                                        >
                                          <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 15 }}> {batchName}</Text>
                                            {batchInfo?.course && (
                                              <Text style={{ color: "#757575", fontSize: 12, marginTop: 2 }}>{batchInfo.course}</Text>
                                            )}
                                            <View style={{ flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" }}>
                                              <Text style={{ color: "#c62828", fontSize: 12, fontWeight: "600" }}>
                                                {count} student{count !== 1 ? "s" : ""}
                                              </Text>
                                              {onlineInBatch > 0 && (
                                                <View style={{ backgroundColor: "#e3f2fd", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                  <Text style={{ color: "#1565c0", fontSize: 10, fontWeight: "600" }}>🌐 {onlineInBatch} Online</Text>
                                                </View>
                                              )}
                                              {offlineInBatch > 0 && (
                                                <View style={{ backgroundColor: "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                  <Text style={{ color: "#d84315", fontSize: 10, fontWeight: "600" }}>🏢 {offlineInBatch} Offline</Text>
                                                </View>
                                              )}
                                            </View>
                                          </View>
                                          <View style={{ backgroundColor: "#ffebee", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <Text style={{ color: "#c62828", fontWeight: "bold", fontSize: 13 }}>Mark</Text>
                                            <Ionicons name="arrow-forward-outline" size={16} color="#c62828" />
                                          </View>
                                        </TouchableOpacity>
                                      );
                                    })}\r\n                                  </View>`;

  content = content.substring(0, startIdx) + replacement + content.substring(endIdx + markerLen);
  console.log('Successfully replaced batch list block!');
}

// 3. Update student card
const oldCardSearch = '<Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>';
const cardIdx = content.indexOf(oldCardSearch, startIdx);
if (cardIdx !== -1) {
  const newCard = `<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                  <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                  <View style={{ backgroundColor: isStudentOnline(student) ? "#e3f2fd" : "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                    <Text style={{ color: isStudentOnline(student) ? "#1565c0" : "#d84315", fontSize: 10, fontWeight: "bold" }}>
                                                      {isStudentOnline(student) ? "Online" : "Offline"}
                                                    </Text>
                                                  </View>
                                                </View>`;
  content = content.substring(0, cardIdx) + newCard + content.substring(cardIdx + oldCardSearch.length);
  console.log('Successfully updated student card header!');
}

content = content.replace('No offline students in this batch.', 'No students in this batch.');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Done rewriting App.tsx!');
