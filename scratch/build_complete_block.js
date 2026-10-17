const fs = require('fs');

// Read the complete original attendance block from commit 6911f9a
let block = fs.readFileSync('scratch/original_commit_block.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Helper function definition to detect online student
const helperCode = `{erpSub === "offline-attendance" && isAdmin && (() => {
                        // Helper to detect online student
                        const isStudentOnline = (s: any) => {
                          const t = (s.type || s.mode || s.accessTier || s.enrollmentMode || "").toLowerCase();
                          return t.includes("online") || (!t.includes("offline") && s.enrollmentMode !== "offline");
                        };

                        // Filter students based on attendanceModeFilter ("all" | "online" | "offline")
                        const attendanceStudents = students.filter((s: any) => {
                          const online = isStudentOnline(s);
                          if (attendanceModeFilter === "online") return online;
                          if (attendanceModeFilter === "offline") return !online;
                          return true;
                        });

                        // Counts for filter pills
                        const onlineCount = students.filter(isStudentOnline).length;
                        const offlineCount = students.filter((s: any) => !isStudentOnline(s)).length;
                        const totalAttendanceCount = students.length;

                        // Unique batch names from filtered students
                        const attendanceBatchNames: string[] = [];
                        attendanceStudents.forEach((s: any) => {
                          const bName = s.batch || "General / Unassigned";
                          if (!attendanceBatchNames.includes(bName)) attendanceBatchNames.push(bName);
                        });

                        const activeMonthlyBatch = offlineAttendanceMonthlyBatch || (attendanceBatchNames.length > 0 ? attendanceBatchNames[0] : "");

                        const studentsInBatch = offlineAttendanceBatch
                          ? attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch)
                          : [];`;

const targetStart = `{erpSub === "offline-attendance" && isAdmin && (() => {
                        // Only offline students
                        const offlineStudents = students.filter((s: any) => (s.type || "").toLowerCase() === "offline");
                        // Unique batch names from offline students
                        const offlineBatchNames: string[] = [];
                        offlineStudents.forEach((s: any) => {
                          if (s.batch && !offlineBatchNames.includes(s.batch)) offlineBatchNames.push(s.batch);
                        });

                        const activeMonthlyBatch = offlineAttendanceMonthlyBatch || (offlineBatchNames.length > 0 ? offlineBatchNames[0] : "");

                        const studentsInBatch = offlineAttendanceBatch
                          ? offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch)
                          : [];`;

if (!block.includes(targetStart)) {
  console.error("targetStart not found!");
  process.exit(1);
}
block = block.replace(targetStart, helperCode);
console.log("1. Replaced top definitions.");

// 2. In markAttendance and monthly calculation:
block = block.replace(
  'const monthlyStudents = offlineStudents.filter((s: any) => s.batch === activeMonthlyBatch);',
  'const monthlyStudents = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === activeMonthlyBatch);'
);
console.log("2. Replaced monthlyStudents definition.");

// 3. Header card title and subtitle + Export button and Mode Switcher pills
const targetHeaderTitle = `<Text style={styles.sectionTitle}>Offline Attendance Registry</Text>
                                  <Text style={{ color: "#757575", fontSize: 13, marginTop: 2 }}>
                                    Record daily attendance and review comprehensive monthly registers.
                                  </Text>`;

const newHeaderTitle = `<View>
                                    <Text style={styles.sectionTitle}>Attendance Registry</Text>
                                    <Text style={{ color: "#757575", fontSize: 13, marginTop: 2 }}>
                                      Track attendance for Online and Offline students. Live class attendance marks automatically.
                                    </Text>
                                  </View>`;

block = block.replace(targetHeaderTitle, newHeaderTitle);

const targetSwitcher = `{/* Segmented Tab Switcher */}`;
const newSwitcher = `{/* Student Mode Switcher: All | Online | Offline */}
                              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#616161", marginRight: 4 }}>STUDENT MODE:</Text>
                                {[
                                  { key: "all" as const, label: \`All Students (\${totalAttendanceCount})\` },
                                  { key: "online" as const, label: \`🌐 Online Students (\${onlineCount})\` },
                                  { key: "offline" as const, label: \`🏢 Offline Students (\${offlineCount})\` },
                                ].map(filterTab => {
                                  const isSelected = attendanceModeFilter === filterTab.key;
                                  return (
                                    <TouchableOpacity
                                      key={filterTab.key}
                                      onPress={() => {
                                        setAttendanceModeFilter(filterTab.key);
                                        setOfflineAttendanceBatch(null);
                                        setOfflineAttendanceMarks({});
                                      }}
                                      style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 7,
                                        borderRadius: 20,
                                        backgroundColor: isSelected ? "#c62828" : (darkMode ? "#2a2a2a" : "#f1f3f4"),
                                        borderWidth: 1,
                                        borderColor: isSelected ? "#c62828" : (darkMode ? "#444" : "#e0e0e0")
                                      }}
                                    >
                                      <Text style={{ fontSize: 12, fontWeight: isSelected ? "bold" : "600", color: isSelected ? "#fff" : (darkMode ? "#ddd" : "#424242") }}>
                                        {filterTab.label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>

                              {/* Segmented Tab Switcher */}`;

block = block.replace(targetSwitcher, newSwitcher);
console.log("3. Injected Student Mode Switcher pills.");

// 4. In Date selector: update batchStuds calculation
const targetBatchStuds = 'const batchStuds = offlineStudents.filter((s: any) => s.batch === offlineAttendanceBatch);';
const newBatchStuds = 'const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);';

while (block.includes(targetBatchStuds)) {
  block = block.replace(targetBatchStuds, newBatchStuds);
  console.log("4. Replaced an occurrence of batchStuds in date selector.");
}

// 5. Replace batch list block
const targetOldBatchList = `{offlineBatchNames.length === 0 ? (
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
                                    })}
                                  </View>`;

const newBatchList = `{attendanceBatchNames.length === 0 ? (
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
                                    })}
                                  </View>`;

if (!block.includes(targetOldBatchList)) {
  console.error("targetOldBatchList not found!");
  process.exit(1);
}
block = block.replace(targetOldBatchList, newBatchList);
console.log("5. Replaced batch list with attendanceBatchNames and mode badges.");

// 6. Update student card to show mode badge
const targetStudentCardName = `<Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>`;
const newStudentCardName = `<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                  <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                  <View style={{ backgroundColor: isStudentOnline(student) ? "#e3f2fd" : "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                    <Text style={{ color: isStudentOnline(student) ? "#1565c0" : "#d84315", fontSize: 10, fontWeight: "bold" }}>
                                                      {isStudentOnline(student) ? "Online" : "Offline"}
                                                    </Text>
                                                  </View>
                                                </View>`;

block = block.replace(targetStudentCardName, newStudentCardName);
console.log("6. Updated student card name to include Online/Offline mode badge.");

// 7. Update empty message in Daily Marking
block = block.replace('No offline students in this batch.', 'No students in this batch.');

// 8. In Monthly view: update batch mapping and student count
const targetMonthlyBatchPills = `{offlineBatchNames.map(batchName => {
                                        const isSelected = activeMonthlyBatch === batchName;
                                        const count = offlineStudents.filter((s: any) => s.batch === batchName).length;`;

const newMonthlyBatchPills = `{attendanceBatchNames.map(batchName => {
                                        const isSelected = activeMonthlyBatch === batchName;
                                        const count = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === batchName).length;`;

if (!block.includes(targetMonthlyBatchPills)) {
  console.error("targetMonthlyBatchPills not found!");
  process.exit(1);
}
block = block.replace(targetMonthlyBatchPills, newMonthlyBatchPills);
console.log("7. Updated Monthly batch pills to attendanceBatchNames & attendanceStudents.");

// 9. In Monthly table student row: add mode label
const targetMonthlyStudentName = `<Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121", flex: 1 }} numberOfLines={1}>
                                                  {name || "Unnamed"}
                                                </Text>`;

const newMonthlyStudentName = `<View style={{ flex: 1 }}>
                                                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121" }} numberOfLines={1}>
                                                    {name || "Unnamed"}
                                                  </Text>
                                                  <Text style={{ fontSize: 10, color: isStudentOnline(st) ? "#1976d2" : "#e64a19", fontWeight: "600" }}>
                                                    {isStudentOnline(st) ? "Online" : "Offline"}
                                                  </Text>
                                                </View>`;

block = block.replace(targetMonthlyStudentName, newMonthlyStudentName);
console.log("8. Updated Monthly table row with Online/Offline mode badge.");

// Save the complete transformed block
fs.writeFileSync('scratch/complete_attendance_registry_block.tsx', block, 'utf8');
console.log("SUCCESS: Built complete_attendance_registry_block.tsx with length:", block.length);
