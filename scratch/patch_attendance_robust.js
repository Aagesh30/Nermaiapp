const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, 'web_portal', 'App.tsx');
let text = fs.readFileSync(targetFile, 'utf8');

// Normalize line endings to \n
const isCrlf = text.includes('\r\n');
const lines = text.split(/\r?\n/);

console.log('Total lines before:', lines.length);

// 1. Line 38697 & 38715: replace batchStuds filter
for (let i = 38690; i <= 38725; i++) {
  if (lines[i] && lines[i].includes('const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);')) {
    lines[i] = lines[i].replace(
      'const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);',
      'const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);'
    );
    console.log(`Replaced batchStuds at line ${i}`);
  }
}

// 2. Lines 38730 to 38784: replace batch list
const newBatchLines = `                                {attendanceBatchNames.length === 0 ? (
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
                                    })}`.split('\n');

// Replace lines from 38730 to 38784 inclusive
lines.splice(38730, (38784 - 38730 + 1), ...newBatchLines);
console.log('Replaced batch list block at 38730');

// Join and write
const newContent = lines.join(isCrlf ? '\r\n' : '\n');

// 3. Update student card and monthly rows
let updated = newContent;

const oldStudentCard = `<View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                <Text style={{ color: "#757575", fontSize: 12 }}>Roll: {rollNo}</Text>`;

const newStudentCard = `<View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                  <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                  <View style={{ backgroundColor: isStudentOnline(student) ? "#e3f2fd" : "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                    <Text style={{ color: isStudentOnline(student) ? "#1565c0" : "#d84315", fontSize: 10, fontWeight: "bold" }}>
                                                      {isStudentOnline(student) ? "Online" : "Offline"}
                                                    </Text>
                                                  </View>
                                                </View>
                                                <Text style={{ color: "#757575", fontSize: 12 }}>Roll: {rollNo}</Text>`;

if (updated.includes(oldStudentCard)) {
  updated = updated.replace(oldStudentCard, newStudentCard);
  console.log('Updated student card with Online/Offline badge');
} else {
  console.warn('oldStudentCard string not matched directly');
}

updated = updated.replace('No offline students in this batch.', 'No students in this batch.');

const oldMonthlyName = `<Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121", flex: 1 }} numberOfLines={1}>
                                                  {name || "Unnamed"}
                                                </Text>`;

const newMonthlyName = `<View style={{ flex: 1 }}>
                                                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121" }} numberOfLines={1}>
                                                    {name || "Unnamed"}
                                                  </Text>
                                                  <Text style={{ fontSize: 10, color: isStudentOnline(st) ? "#1976d2" : "#e64a19", fontWeight: "600" }}>
                                                    {isStudentOnline(st) ? "Online" : "Offline"}
                                                  </Text>
                                                </View>`;

if (updated.includes(oldMonthlyName)) {
  updated = updated.replace(oldMonthlyName, newMonthlyName);
  console.log('Updated monthly register name row with mode indicator');
}

fs.writeFileSync(targetFile, updated, 'utf8');
console.log('Done!');
