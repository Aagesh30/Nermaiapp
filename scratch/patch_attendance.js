const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, 'web_portal', 'App.tsx');
let text = fs.readFileSync(targetFile, 'utf8');

// Normalize to \n
text = text.replace(/\r\n/g, '\n');

// 1. In date selector onChangeText & Today
text = text.replace(
  'const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);',
  'const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);'
);
text = text.replace(
  'const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);',
  'const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);'
);

// 2. In batch empty message and batch list
const oldBatch = `                                {offlineBatchNames.length === 0 ? (
                                  <View style={[styles.card, styles.emptyContainer]}>
                                    <Ionicons name="people-outline" size={48} color="#bdbdbd" />
                                    <Text style={styles.emptyText}>No offline students registered yet.</Text>
                                    <Text style={{ color: "#999", fontSize: 12, textAlign: "center" }}>
                                      Register students with enrollment type "Offline" to use this panel.
                                    </Text>
                                  </View>
                                ) : !offlineAttendanceBatch ? (
                                  // Show batch list
                                  <View style={{ gap: 10 }}>
                                    <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14, marginBottom: 4 }}>Select a Batch to Mark</Text>
                                    {offlineBatchNames.map((batchName: string) => {
                                      const count = offlineStudents.filter((s: any) => s.batch === batchName).length;
                                      const batchInfo = batches.find((b: any) => b.batchName === batchName);
                                      return (
                                        <TouchableOpacity
                                          key={batchName}
                                          onPress={() => {
                                            setOfflineAttendanceBatch(batchName);
                                            const initialMarks: Record<string, "present" | "absent" | null> = {};
                                            const batchStuds = offlineStudents.filter((s: any) => s.batch === batchName);
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
                                            <Text style={{ color: "#c62828", fontSize: 12, marginTop: 4, fontWeight: "600" }}>
                                              {count} offline student{count !== 1 ? "s" : ""}
                                            </Text>
                                          </View>
                                          <View style={{ backgroundColor: "#ffebee", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <Text style={{ color: "#c62828", fontWeight: "bold", fontSize: 13 }}>Mark</Text>
                                            <Ionicons name="arrow-forward-outline" size={16} color="#c62828" />
                                          </View>
                                        </TouchableOpacity>
                                      );
                                    })}`;

const newBatch = `                                {attendanceBatchNames.length === 0 ? (
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
                                    })}`;

if (!text.includes(oldBatch)) {
  console.error('Error: oldBatch not found in text!');
  process.exit(1);
}

text = text.replace(oldBatch, newBatch);

// 3. Update student card to show mode badge
const oldStudentCardHeader = `<View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                <Text style={{ color: "#757575", fontSize: 12 }}>Roll: {rollNo}</Text>`;

const newStudentCardHeader = `<View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                  <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                  <View style={{ backgroundColor: isStudentOnline(student) ? "#e3f2fd" : "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                    <Text style={{ color: isStudentOnline(student) ? "#1565c0" : "#d84315", fontSize: 10, fontWeight: "bold" }}>
                                                      {isStudentOnline(student) ? "Online" : "Offline"}
                                                    </Text>
                                                  </View>
                                                </View>
                                                <Text style={{ color: "#757575", fontSize: 12 }}>Roll: {rollNo}</Text>`;

if (!text.includes(oldStudentCardHeader)) {
  console.error('Error: oldStudentCardHeader not found!');
  process.exit(1);
}

text = text.replace(oldStudentCardHeader, newStudentCardHeader);

// 4. Update empty student list text in Daily Marking
text = text.replace(
  'No offline students in this batch.',
  'No students in this batch.'
);

// 5. Update Monthly register student row to show mode badge next to name
const oldMonthlyRowName = `<Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121", flex: 1 }} numberOfLines={1}>
                                                  {name || "Unnamed"}
                                                </Text>`;

const newMonthlyRowName = `<View style={{ flex: 1 }}>
                                                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121" }} numberOfLines={1}>
                                                    {name || "Unnamed"}
                                                  </Text>
                                                  <Text style={{ fontSize: 10, color: isStudentOnline(st) ? "#1976d2" : "#e64a19", fontWeight: "600" }}>
                                                    {isStudentOnline(st) ? "Online" : "Offline"}
                                                  </Text>
                                                </View>`;

if (!text.includes(oldMonthlyRowName)) {
  console.error('Error: oldMonthlyRowName not found!');
  process.exit(1);
}

text = text.replace(oldMonthlyRowName, newMonthlyRowName);

fs.writeFileSync(targetFile, text, 'utf8');
console.log('App.tsx successfully patched with unified Attendance Registry!');
