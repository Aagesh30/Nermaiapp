{erpSub === "offline-attendance" && isAdmin && (() => {
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
                          : [];

                        // Daily Marking function
                        const markAttendance = async (student: any, status: "present" | "absent") => {
                          const prev = offlineAttendanceMarks[student.id];
                          if (prev === status) return; // toggle off — set null
                          setOfflineAttendanceMarks(m => ({ ...m, [student.id]: status }));
                          setOfflineAttendanceSaving(s => ({ ...s, [student.id]: true }));
                          try {
                            const attended = Number(student.attendedDays || 0);
                            let newAttended = attended;
                            if (status === "present" && prev !== "present") newAttended = attended + 1;
                            else if (status === "absent" && prev === "present") newAttended = Math.max(0, attended - 1);

                            const updatedLog = { ...(student.attendanceLog || {}), [offlineAttendanceDate]: status };

                            await api.put(`/erp/student/${student.id}`, {
                              attendedDays: newAttended,
                              lastAttendanceDate: offlineAttendanceDate,
                              lastAttendanceStatus: status,
                              attendanceLog: updatedLog,
                            });
                            // Update local student list
                            setStudents((prevList: any[]) => prevList.map((s: any) => s.id === student.id ? { ...s, attendedDays: newAttended, attendanceLog: updatedLog } : s));
                          } catch (e) {
                            Alert.alert("Error", "Failed to save attendance. Please try again.");
                            setOfflineAttendanceMarks(m => ({ ...m, [student.id]: prev || null }));
                          } finally {
                            setOfflineAttendanceSaving(s => ({ ...s, [student.id]: false }));
                          }
                        };

                        // Helper for Monthly calculation
                        const [currYear, currMonthNum] = (offlineAttendanceMonth || new Date().toISOString().slice(0, 7)).split("-").map(Number);
                        const daysInMonthCount = new Date(currYear, currMonthNum, 0).getDate();
                        const daysArray = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

                        const formatMonthTitle = (ym: string) => {
                          try {
                            const [y, m] = ym.split("-").map(Number);
                            const d = new Date(y, m - 1, 1);
                            return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                          } catch {
                            return ym;
                          }
                        };

                        const changeMonthlyMonth = (offset: number) => {
                          const [y, m] = (offlineAttendanceMonth || new Date().toISOString().slice(0, 7)).split("-").map(Number);
                          const d = new Date(y, m - 1 + offset, 1);
                          const newY = d.getFullYear();
                          const newM = String(d.getMonth() + 1).padStart(2, "0");
                          setOfflineAttendanceMonth(`${newY}-${newM}`);
                        };

                        // Monthly students in selected batch
                        const monthlyStudents = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === activeMonthlyBatch);

                        // Batch statistics for monthly register
                        let totalBatchMonthlyPresent = 0;
                        let totalBatchMonthlyMarks = 0;
                        let monthlyDefaultersCount = 0;
                        const recordedDaysSet = new Set<number>();

                        monthlyStudents.forEach((st: any) => {
                          const log = st.attendanceLog || {};
                          let stP = 0;
                          let stTotal = 0;
                          daysArray.forEach(d => {
                            const dateKey = `${offlineAttendanceMonth}-${String(d).padStart(2, "0")}`;
                            const val = log[dateKey];
                            if (val === "present") {
                              stP++;
                              stTotal++;
                              recordedDaysSet.add(d);
                            } else if (val === "absent") {
                              stTotal++;
                              recordedDaysSet.add(d);
                            }
                          });
                          totalBatchMonthlyPresent += stP;
                          totalBatchMonthlyMarks += stTotal;
                          const pct = stTotal > 0 ? (stP / stTotal) * 100 : 0;
                          if (stTotal > 0 && pct < 75) monthlyDefaultersCount++;
                        });

                        const batchAvgAttendanceRate = totalBatchMonthlyMarks > 0 ? Math.round((totalBatchMonthlyPresent / totalBatchMonthlyMarks) * 100) : 0;
                        const totalWorkingDaysRecorded = recordedDaysSet.size;

                        // Toggle a cell in Monthly table
                        const toggleCellAttendance = async (student: any, dateStr: string, currentStatus?: string) => {
                          const cellKey = `${student.id}_${dateStr}`;
                          if (offlineAttendanceCellSaving[cellKey]) return;

                          setOfflineAttendanceCellSaving(prev => ({ ...prev, [cellKey]: true }));

                          let nextStatus: "present" | "absent" | undefined;
                          if (!currentStatus) {
                            nextStatus = "present";
                          } else if (currentStatus === "present") {
                            nextStatus = "absent";
                          } else if (currentStatus === "absent") {
                            nextStatus = undefined; // clear
                          }

                          const currentLog = { ...(student.attendanceLog || {}) };
                          if (nextStatus) {
                            currentLog[dateStr] = nextStatus;
                          } else {
                            delete currentLog[dateStr];
                          }

                          const attended = Number(student.attendedDays || 0);
                          let newAttended = attended;
                          if (nextStatus === "present" && currentStatus !== "present") {
                            newAttended = attended + 1;
                          } else if (currentStatus === "present" && nextStatus !== "present") {
                            newAttended = Math.max(0, attended - 1);
                          }

                          // Optimistic update
                          setStudents((prevList: any[]) =>
                            prevList.map((s: any) =>
                              s.id === student.id
                                ? {
                                  ...s,
                                  attendanceLog: currentLog,
                                  attendedDays: newAttended,
                                  lastAttendanceDate: dateStr,
                                  lastAttendanceStatus: nextStatus || s.lastAttendanceStatus,
                                }
                                : s
                            )
                          );

                          try {
                            await api.put(`/erp/student/${student.id}`, {
                              attendanceLog: currentLog,
                              attendedDays: newAttended,
                              lastAttendanceDate: dateStr,
                              lastAttendanceStatus: nextStatus || "absent",
                            });
                          } catch (e) {
                            console.error("Failed to update attendance cell:", e);
                            Alert.alert("Error", "Failed to update attendance record.");
                            setStudents((prevList: any[]) =>
                              prevList.map((s: any) => (s.id === student.id ? student : s))
                            );
                          } finally {
                            setOfflineAttendanceCellSaving(prev => ({ ...prev, [cellKey]: false }));
                          }
                        };

                        // Export to Excel function
                        const handleExportMonthlyExcel = () => {
                          try {
                            const [y, m] = (offlineAttendanceMonth || new Date().toISOString().slice(0, 7)).split("-");
                            const daysCount = new Date(parseInt(y), parseInt(m), 0).getDate();

                            const headers = ["Roll / Reg No", "Student Name", "Batch"];
                            for (let d = 1; d <= daysCount; d++) {
                              headers.push(String(d));
                            }
                            headers.push("Total Present (P)", "Total Absent (A)", "Attendance %");

                            const dataRows = monthlyStudents.map((st: any, idx: number) => {
                              const roll = st.rollNumber || st.admissionNumber || `S${idx + 1}`;
                              const name = getStudentName(st);
                              const log = st.attendanceLog || {};

                              let pCount = 0;
                              let aCount = 0;
                              const dayValues: string[] = [];

                              for (let d = 1; d <= daysCount; d++) {
                                const dateKey = `${offlineAttendanceMonth}-${String(d).padStart(2, "0")}`;
                                const dayOfWeek = new Date(parseInt(y), parseInt(m) - 1, d).getDay();
                                const status = log[dateKey];
                                if (status === "present") {
                                  pCount++;
                                  dayValues.push("P");
                                } else if (status === "absent") {
                                  aCount++;
                                  dayValues.push("A");
                                } else if (dayOfWeek === 0) {
                                  dayValues.push("Sun");
                                } else {
                                  dayValues.push("-");
                                }
                              }
                              const totalMarked = pCount + aCount;
                              const pct = totalMarked > 0 ? `${Math.round((pCount / totalMarked) * 100)}%` : "0%";

                              return [roll, name, st.batch || activeMonthlyBatch, ...dayValues, pCount, aCount, pct];
                            });

                            const worksheetData = [headers, ...dataRows];
                            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "Monthly Register");
                            XLSX.writeFile(wb, `Attendance_${activeMonthlyBatch || "Batch"}_${offlineAttendanceMonth}.xlsx`);
                          } catch (err) {
                            console.error("Excel export error:", err);
                            Alert.alert("Export Error", "Failed to generate Excel export file.");
                          }
                        };

                        if (isInitialLoading) return <RNTableSkeleton rows={5} darkMode={darkMode} />;

                        return (
                          <View style={{ gap: 16 }}>
                            {/* Navigation Header Card */}
                            <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: "#c62828", gap: 10 }]}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                <View>
                                  <View>
                                    <Text style={styles.sectionTitle}>Attendance Registry</Text>
                                    <Text style={{ color: "#757575", fontSize: 13, marginTop: 2 }}>
                                      Track attendance for Online and Offline students. Live class attendance marks automatically.
                                    </Text>
                                  </View>
                                </View>
                                {offlineAttendanceViewMode === "monthly" && (
                                  <TouchableOpacity
                                    onPress={handleExportMonthlyExcel}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      backgroundColor: "#e8f5e9",
                                      borderColor: "#2e7d32",
                                      borderWidth: 1,
                                      borderRadius: 8,
                                      paddingHorizontal: 12,
                                      paddingVertical: 7,
                                    }}
                                  >
                                    <Ionicons name="download-outline" size={16} color="#2e7d32" />
                                    <Text style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 12 }}>Export Excel</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Student Mode Switcher: All | Online | Offline */}
                              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#616161", marginRight: 4 }}>STUDENT MODE:</Text>
                                {[
                                  { key: "all" as const, label: `All Students (${totalAttendanceCount})` },
                                  { key: "online" as const, label: `🌐 Online Students (${onlineCount})` },
                                  { key: "offline" as const, label: `🏢 Offline Students (${offlineCount})` },
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

                              {/* Segmented Tab Switcher */}
                              <View style={{ flexDirection: "row", backgroundColor: darkMode ? "#2a2a2a" : "#f1f3f4", borderRadius: 10, padding: 4, marginTop: 4 }}>
                                <TouchableOpacity
                                  onPress={() => setOfflineAttendanceViewMode("daily")}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 9,
                                    borderRadius: 8,
                                    backgroundColor: offlineAttendanceViewMode === "daily" ? (darkMode ? "#1e1e1e" : "#fff") : "transparent",
                                    alignItems: "center",
                                    shadowColor: "#000",
                                    shadowOpacity: offlineAttendanceViewMode === "daily" ? 0.08 : 0,
                                    shadowRadius: 3,
                                    elevation: offlineAttendanceViewMode === "daily" ? 2 : 0,
                                  }}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Ionicons name="create-outline" size={16} color={offlineAttendanceViewMode === "daily" ? "#c62828" : "#757575"} />
                                    <Text style={{ fontWeight: "bold", fontSize: 13, color: offlineAttendanceViewMode === "daily" ? "#c62828" : "#757575" }}>
                                      Daily Marking
                                    </Text>
                                  </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => setOfflineAttendanceViewMode("monthly")}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 9,
                                    borderRadius: 8,
                                    backgroundColor: offlineAttendanceViewMode === "monthly" ? (darkMode ? "#1e1e1e" : "#fff") : "transparent",
                                    alignItems: "center",
                                    shadowColor: "#000",
                                    shadowOpacity: offlineAttendanceViewMode === "monthly" ? 0.08 : 0,
                                    shadowRadius: 3,
                                    elevation: offlineAttendanceViewMode === "monthly" ? 2 : 0,
                                  }}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Ionicons name="calendar" size={16} color={offlineAttendanceViewMode === "monthly" ? "#c62828" : "#757575"} />
                                    <Text style={{ fontWeight: "bold", fontSize: 13, color: offlineAttendanceViewMode === "monthly" ? "#c62828" : "#757575" }}>
                                      Monthly Register & History
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* ==================== VIEW 1: DAILY MARKING ==================== */}
                            {offlineAttendanceViewMode === "daily" && (
                              <View style={{ gap: 14 }}>
                                {/* Date Selector Card */}
                                <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }]}>
                                  <Ionicons name="calendar-outline" size={18} color="#c62828" />
                                  <Text style={{ fontWeight: "bold", color: "#424242", fontSize: 13 }}>Marking Date:</Text>
                                  <TextInput
                                    style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 6, fontSize: 13 }]}
                                    value={offlineAttendanceDate}
                                    onChangeText={d => {
                                      setOfflineAttendanceDate(d);
                                      if (offlineAttendanceBatch) {
                                        const initialMarks: Record<string, "present" | "absent" | null> = {};
                                        const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);
                                        batchStuds.forEach((s: any) => {
                                          if (s.attendanceLog && s.attendanceLog[d]) {
                                            initialMarks[s.id] = s.attendanceLog[d];
                                          }
                                        });
                                        setOfflineAttendanceMarks(initialMarks);
                                      }
                                    }}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#999"
                                  />
                                  <TouchableOpacity
                                    onPress={() => {
                                      const todayStr = new Date().toISOString().slice(0, 10);
                                      setOfflineAttendanceDate(todayStr);
                                      if (offlineAttendanceBatch) {
                                        const initialMarks: Record<string, "present" | "absent" | null> = {};
                                        const batchStuds = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === offlineAttendanceBatch);
                                        batchStuds.forEach((s: any) => {
                                          if (s.attendanceLog && s.attendanceLog[todayStr]) {
                                            initialMarks[s.id] = s.attendanceLog[todayStr];
                                          }
                                        });
                                        setOfflineAttendanceMarks(initialMarks);
                                      }
                                    }}
                                    style={{ backgroundColor: "#ffebee", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}
                                  >
                                    <Text style={{ color: "#c62828", fontSize: 12, fontWeight: "bold" }}>Today</Text>
                                  </TouchableOpacity>
                                </View>

                                {attendanceBatchNames.length === 0 ? (
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
                                  </View>
                                ) : (
                                  // Show students in selected batch
                                  <View style={{ gap: 12 }}>
                                    {/* Back button + batch header */}
                                    <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }]}>
                                      <TouchableOpacity
                                        onPress={() => { setOfflineAttendanceBatch(null); setOfflineAttendanceMarks({}); }}
                                        style={{ backgroundColor: "#ffebee", borderRadius: 8, padding: 8 }}
                                      >
                                        <Ionicons name="arrow-back-outline" size={18} color="#c62828" />
                                      </TouchableOpacity>
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: "bold", color: "#c62828", fontSize: 15 }}> {offlineAttendanceBatch}</Text>
                                        <Text style={{ color: "#757575", fontSize: 12 }}>Date: {offlineAttendanceDate} · {studentsInBatch.length} student{studentsInBatch.length !== 1 ? "s" : ""}</Text>
                                      </View>
                                    </View>

                                    {/* Summary pills */}
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                      <View style={{ flex: 1, backgroundColor: "#e8f5e9", borderRadius: 10, padding: 12, alignItems: "center" }}>
                                        <Text style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 20 }}>
                                          {Object.values(offlineAttendanceMarks).filter(v => v === "present").length}
                                        </Text>
                                        <Text style={{ color: "#2e7d32", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Present</Text>
                                      </View>
                                      <View style={{ flex: 1, backgroundColor: "#ffebee", borderRadius: 10, padding: 12, alignItems: "center" }}>
                                        <Text style={{ color: "#c62828", fontWeight: "bold", fontSize: 20 }}>
                                          {Object.values(offlineAttendanceMarks).filter(v => v === "absent").length}
                                        </Text>
                                        <Text style={{ color: "#c62828", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Absent</Text>
                                      </View>
                                      <View style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: 10, padding: 12, alignItems: "center" }}>
                                        <Text style={{ color: "#757575", fontWeight: "bold", fontSize: 20 }}>
                                          {studentsInBatch.length - Object.values(offlineAttendanceMarks).filter(v => v !== null && v !== undefined).length}
                                        </Text>
                                        <Text style={{ color: "#757575", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Unmarked</Text>
                                      </View>
                                    </View>

                                    {/* Mark All row */}
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                      <TouchableOpacity
                                        style={{ flex: 1, backgroundColor: "#e8f5e9", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#2e7d32" }}
                                        onPress={() => {
                                          const newMarks: Record<string, "present" | "absent" | null> = {};
                                          studentsInBatch.forEach((s: any) => { newMarks[s.id] = "present"; });
                                          setOfflineAttendanceMarks(newMarks);
                                        }}
                                      >
                                        <Text style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 13 }}>Mark All Present</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={{ flex: 1, backgroundColor: "#ffebee", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#c62828" }}
                                        onPress={() => {
                                          const newMarks: Record<string, "present" | "absent" | null> = {};
                                          studentsInBatch.forEach((s: any) => { newMarks[s.id] = "absent"; });
                                          setOfflineAttendanceMarks(newMarks);
                                        }}
                                      >
                                        <Text style={{ color: "#c62828", fontWeight: "bold", fontSize: 13 }}>Mark All Absent</Text>
                                      </TouchableOpacity>
                                    </View>

                                    {/* Student list */}
                                    {studentsInBatch.length === 0 ? (
                                      <View style={[styles.card, styles.emptyContainer]}>
                                        <Text style={styles.emptyText}>No students in this batch.</Text>
                                      </View>
                                    ) : (
                                      studentsInBatch.map((student: any) => {
                                        const mark = offlineAttendanceMarks[student.id] || null;
                                        const isSaving = offlineAttendanceSaving[student.id] || false;
                                        const rollNo = student.rollNumber || student.admissionNumber || student.id.substring(0, 6);
                                        const name = getStudentName(student);
                                        const attended = Number(student.attendedDays || 0);
                                        const total = Number(student.totalDays || 0);
                                        const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

                                        return (
                                          <View
                                            key={student.id}
                                            style={[
                                              styles.card,
                                              {
                                                borderLeftWidth: 4,
                                                borderLeftColor: mark === "present" ? "#2e7d32" : mark === "absent" ? "#c62828" : "#e0e0e0",
                                                paddingVertical: 12,
                                                gap: 10
                                              }
                                            ]}
                                          >
                                            {/* Student info row */}
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                              {/* Avatar */}
                                              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: mark === "present" ? "#e8f5e9" : mark === "absent" ? "#ffebee" : "#f5f5f5", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: mark === "present" ? "#2e7d32" : mark === "absent" ? "#c62828" : "#e0e0e0" }}>
                                                <Text style={{ fontWeight: "bold", color: mark === "present" ? "#2e7d32" : mark === "absent" ? "#c62828" : "#757575", fontSize: 14 }}>
                                                  {name ? name.charAt(0).toUpperCase() : "?"}
                                                </Text>
                                              </View>
                                              <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                  <Text style={{ fontWeight: "bold", color: "#212121", fontSize: 14 }} numberOfLines={1}>{name || "Unnamed"}</Text>
                                                  <View style={{ backgroundColor: isStudentOnline(student) ? "#e3f2fd" : "#fbe9e7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                    <Text style={{ color: isStudentOnline(student) ? "#1565c0" : "#d84315", fontSize: 10, fontWeight: "bold" }}>
                                                      {isStudentOnline(student) ? "Online" : "Offline"}
                                                    </Text>
                                                  </View>
                                                </View>
                                                <Text style={{ color: "#757575", fontSize: 12 }}>Roll: {rollNo}</Text>
                                                {total > 0 && (
                                                  <Text style={{ color: pct >= 75 ? "#2e7d32" : pct >= 50 ? "#f57c00" : "#c62828", fontSize: 11, marginTop: 1, fontWeight: "600" }}>
                                                    Overall: {attended}/{total} days ({pct}%)
                                                  </Text>
                                                )}
                                              </View>
                                              {/* Status badge */}
                                              {mark && (
                                                <View style={{ backgroundColor: mark === "present" ? "#e8f5e9" : "#ffebee", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                                                  <Text style={{ color: mark === "present" ? "#2e7d32" : "#c62828", fontWeight: "bold", fontSize: 12 }}>
                                                    {mark === "present" ? "Present" : "Absent"}
                                                  </Text>
                                                </View>
                                              )}
                                            </View>

                                            {/* Present / Absent buttons */}
                                            {isSaving ? (
                                              <View style={{ alignItems: "center", paddingVertical: 4 }}>
                                                <ActivityIndicator size="small" color="#c62828" />
                                              </View>
                                            ) : (
                                              <View style={{ flexDirection: "row", gap: 10 }}>
                                                <TouchableOpacity
                                                  onPress={() => markAttendance(student, "present")}
                                                  style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 10,
                                                    alignItems: "center",
                                                    backgroundColor: mark === "present" ? "#2e7d32" : "#f9f9f9",
                                                    borderWidth: 2,
                                                    borderColor: mark === "present" ? "#2e7d32" : "#e0e0e0"
                                                  }}
                                                >
                                                  <Text style={{ color: mark === "present" ? "#fff" : "#2e7d32", fontWeight: "bold", fontSize: 14 }}>Present</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                  onPress={() => markAttendance(student, "absent")}
                                                  style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 10,
                                                    alignItems: "center",
                                                    backgroundColor: mark === "absent" ? "#c62828" : "#f9f9f9",
                                                    borderWidth: 2,
                                                    borderColor: mark === "absent" ? "#c62828" : "#e0e0e0"
                                                  }}
                                                >
                                                  <Text style={{ color: mark === "absent" ? "#fff" : "#c62828", fontWeight: "bold", fontSize: 14 }}>Absent</Text>
                                                </TouchableOpacity>
                                              </View>
                                            )}
                                          </View>
                                        );
                                      })
                                    )}

                                    {/* Save all button */}
                                    <TouchableOpacity
                                      style={[styles.primaryBtn, { marginTop: 4 }]}
                                      onPress={async () => {
                                        const unmarked = studentsInBatch.filter((s: any) => !offlineAttendanceMarks[s.id]);
                                        if (unmarked.length > 0) {
                                          Alert.alert("Incomplete", `${unmarked.length} student(s) not yet marked. Please mark all students before saving.`);
                                          return;
                                        }
                                        Alert.alert(
                                          "Save Attendance",
                                          `Save attendance for ${offlineAttendanceBatch} on ${offlineAttendanceDate}?`,
                                          [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                              text: "Save All",
                                              onPress: async () => {
                                                let saved = 0;
                                                let failed = 0;
                                                for (const student of studentsInBatch) {
                                                  const status = offlineAttendanceMarks[student.id];
                                                  if (!status) continue;
                                                  try {
                                                    const attended = Number(student.attendedDays || 0);
                                                    const newAttended = status === "present" ? attended + 1 : attended;
                                                    const updatedLog = { ...(student.attendanceLog || {}), [offlineAttendanceDate]: status };
                                                    await api.put(`/erp/student/${student.id}`, {
                                                      attendedDays: newAttended,
                                                      lastAttendanceDate: offlineAttendanceDate,
                                                      lastAttendanceStatus: status,
                                                      attendanceLog: updatedLog,
                                                    });
                                                    setStudents((prevList: any[]) => prevList.map((s: any) => s.id === student.id ? { ...s, attendedDays: newAttended, attendanceLog: updatedLog } : s));
                                                    saved++;
                                                  } catch {
                                                    failed++;
                                                  }
                                                }
                                                Alert.alert("Done", `Attendance saved for ${saved} student(s)${failed > 0 ? `, ${failed} failed.` : "."}`);
                                                setOfflineAttendanceBatch(null);
                                                setOfflineAttendanceMarks({});
                                              }
                                            }
                                          ]
                                        );
                                      }}
                                    >
                                      <Text style={styles.primaryBtnTxt}>Save Attendance</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            )}

                            {/* ==================== VIEW 2: MONTHLY REGISTER & HISTORY ==================== */}
                            {offlineAttendanceViewMode === "monthly" && (
                              <View style={{ gap: 14 }}>
                                {/* Filter Bar: Month Navigator & Batch Picker */}
                                <View style={[styles.card, { gap: 12, paddingVertical: 14 }]}>
                                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                                    {/* Month Selector */}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: darkMode ? "#2a2a2a" : "#f5f5f5", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }}>
                                      <TouchableOpacity
                                        onPress={() => changeMonthlyMonth(-1)}
                                        style={{ padding: 6, borderRadius: 6, backgroundColor: darkMode ? "#333" : "#fff" }}
                                      >
                                        <Ionicons name="chevron-back" size={16} color="#c62828" />
                                      </TouchableOpacity>
                                      <View style={{ paddingHorizontal: 8, alignItems: "center" }}>
                                        <Text style={{ fontWeight: "bold", fontSize: 14, color: "#212121" }}>
                                          {formatMonthTitle(offlineAttendanceMonth)}
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        onPress={() => changeMonthlyMonth(1)}
                                        style={{ padding: 6, borderRadius: 6, backgroundColor: darkMode ? "#333" : "#fff" }}
                                      >
                                        <Ionicons name="chevron-forward" size={16} color="#c62828" />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => setOfflineAttendanceMonth(new Date().toISOString().slice(0, 7))}
                                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#ffebee" }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: "bold", color: "#c62828" }}>Current</Text>
                                      </TouchableOpacity>
                                    </View>

                                    {/* Legend Indicators */}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: "#2e7d32" }} />
                                        <Text style={{ fontSize: 11, color: "#555" }}>P = Present</Text>
                                      </View>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: "#c62828" }} />
                                        <Text style={{ fontSize: 11, color: "#555" }}>A = Absent</Text>
                                      </View>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: "#eeeeee" }} />
                                        <Text style={{ fontSize: 11, color: "#555" }}>Sun = Weekend</Text>
                                      </View>
                                    </View>
                                  </View>

                                  {/* Batch Pills */}
                                  <View style={{ gap: 6 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "bold", color: "#757575" }}>SELECT OFFLINE BATCH:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                      {attendanceBatchNames.map(batchName => {
                                        const isSelected = activeMonthlyBatch === batchName;
                                        const count = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === batchName).length;
                                        return (
                                          <TouchableOpacity
                                            key={batchName}
                                            onPress={() => setOfflineAttendanceMonthlyBatch(batchName)}
                                            style={{
                                              paddingHorizontal: 14,
                                              paddingVertical: 7,
                                              borderRadius: 20,
                                              backgroundColor: isSelected ? "#c62828" : darkMode ? "#2a2a2a" : "#f1f3f4",
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 6
                                            }}
                                          >
                                            <Text style={{ fontSize: 12, fontWeight: isSelected ? "bold" : "600", color: isSelected ? "#fff" : "#424242" }}>
                                              {batchName}
                                            </Text>
                                            <View style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "#e0e0e0", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                                              <Text style={{ fontSize: 10, fontWeight: "bold", color: isSelected ? "#fff" : "#616161" }}>{count}</Text>
                                            </View>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  </View>
                                </View>

                                {/* KPI Metrics Cards */}
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                                  <View style={{ flex: 1, minWidth: 140, backgroundColor: "#e3f2fd", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#bbdefb" }}>
                                    <Text style={{ fontSize: 11, color: "#1565c0", fontWeight: "600" }}>Working Days Marked</Text>
                                    <Text style={{ fontSize: 22, fontWeight: "bold", color: "#0d47a1", marginTop: 4 }}>{totalWorkingDaysRecorded}</Text>
                                    <Text style={{ fontSize: 10, color: "#1976d2", marginTop: 2 }}>Days recorded this month</Text>
                                  </View>

                                  <View style={{ flex: 1, minWidth: 140, backgroundColor: "#e8f5e9", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#c8e6c9" }}>
                                    <Text style={{ fontSize: 11, color: "#2e7d32", fontWeight: "600" }}>Batch Average</Text>
                                    <Text style={{ fontSize: 22, fontWeight: "bold", color: "#1b5e20", marginTop: 4 }}>{batchAvgAttendanceRate}%</Text>
                                    <Text style={{ fontSize: 10, color: "#388e3c", marginTop: 2 }}>{monthlyStudents.length} enrolled students</Text>
                                  </View>

                                  <View style={{ flex: 1, minWidth: 140, backgroundColor: "#fff3e0", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#ffe0b2" }}>
                                    <Text style={{ fontSize: 11, color: "#e65100", fontWeight: "600" }}>Total Present Logs</Text>
                                    <Text style={{ fontSize: 22, fontWeight: "bold", color: "#bf360c", marginTop: 4 }}>{totalBatchMonthlyPresent}</Text>
                                    <Text style={{ fontSize: 10, color: "#f57c00", marginTop: 2 }}>Accumulated attendances</Text>
                                  </View>

                                  <View style={{ flex: 1, minWidth: 140, backgroundColor: monthlyDefaultersCount > 0 ? "#ffebee" : "#f5f5f5", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: monthlyDefaultersCount > 0 ? "#ffcdd2" : "#e0e0e0" }}>
                                    <Text style={{ fontSize: 11, color: monthlyDefaultersCount > 0 ? "#c62828" : "#757575", fontWeight: "600" }}>Below 75% Attendance</Text>
                                    <Text style={{ fontSize: 22, fontWeight: "bold", color: monthlyDefaultersCount > 0 ? "#b71c1c" : "#616161", marginTop: 4 }}>{monthlyDefaultersCount}</Text>
                                    <Text style={{ fontSize: 10, color: monthlyDefaultersCount > 0 ? "#c62828" : "#9e9e9e", marginTop: 2 }}>Require regular follow-up</Text>
                                  </View>
                                </View>

                                {/* Day-by-day Register Matrix Table */}
                                <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
                                  <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#eeeeee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <View>
                                      <Text style={{ fontWeight: "bold", fontSize: 14, color: "#212121" }}>
                                        {activeMonthlyBatch || "Batch"} · Monthly Attendance Sheet
                                      </Text>
                                      <Text style={{ fontSize: 11, color: "#757575", marginTop: 2 }}>
                                        Click any day cell to instantly toggle Present (P) / Absent (A) / Clear. Click student name for full calendar breakdown.
                                      </Text>
                                    </View>
                                  </View>

                                  {monthlyStudents.length === 0 ? (
                                    <View style={{ padding: 30, alignItems: "center", justifyContent: "center" }}>
                                      <Ionicons name="people-outline" size={40} color="#bdbdbd" />
                                      <Text style={{ color: "#757575", fontSize: 13, marginTop: 8 }}>No students enrolled in this batch.</Text>
                                    </View>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                      <View>
                                        {/* Table Header */}
                                        <View style={{ flexDirection: "row", backgroundColor: darkMode ? "#2a2a2a" : "#fafafa", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", alignItems: "center" }}>
                                          <View style={{ width: 45, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#616161" }}>#</Text>
                                          </View>
                                          <View style={{ width: 85, paddingVertical: 10, paddingHorizontal: 6 }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#616161" }}>Roll No</Text>
                                          </View>
                                          <View style={{ width: 170, paddingVertical: 10, paddingHorizontal: 8 }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#616161" }}>Student Name</Text>
                                          </View>

                                          {/* Day columns 1 to N */}
                                          {daysArray.map(dayNum => {
                                            const dayDate = new Date(currYear, currMonthNum - 1, dayNum);
                                            const dayOfWeek = dayDate.getDay(); // 0 = Sun
                                            const isSun = dayOfWeek === 0;
                                            const dowStr = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][dayOfWeek];
                                            return (
                                              <View
                                                key={dayNum}
                                                style={{
                                                  width: 36,
                                                  paddingVertical: 6,
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  backgroundColor: isSun ? (darkMode ? "#332222" : "#fdf2f2") : "transparent",
                                                  borderLeftWidth: 1,
                                                  borderLeftColor: "#eeeeee"
                                                }}
                                              >
                                                <Text style={{ fontSize: 11, fontWeight: "bold", color: isSun ? "#c62828" : "#424242" }}>{dayNum}</Text>
                                                <Text style={{ fontSize: 9, color: isSun ? "#c62828" : "#9e9e9e", marginTop: 1 }}>{dowStr}</Text>
                                              </View>
                                            );
                                          })}

                                          {/* Summary Columns */}
                                          <View style={{ width: 45, paddingVertical: 10, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0", backgroundColor: "#e8f5e9" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#2e7d32" }}>P</Text>
                                          </View>
                                          <View style={{ width: 45, paddingVertical: 10, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0", backgroundColor: "#ffebee" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#c62828" }}>A</Text>
                                          </View>
                                          <View style={{ width: 60, paddingVertical: 10, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#424242" }}>%</Text>
                                          </View>
                                          <View style={{ width: 50, paddingVertical: 10, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 11, color: "#616161" }}>View</Text>
                                          </View>
                                        </View>

                                        {/* Table Rows */}
                                        {monthlyStudents.map((st: any, idx: number) => {
                                          const roll = st.rollNumber || st.admissionNumber || st.id.substring(0, 6);
                                          const name = getStudentName(st);
                                          const log = st.attendanceLog || {};

                                          let studentPresentCount = 0;
                                          let studentAbsentCount = 0;

                                          daysArray.forEach(d => {
                                            const dateKey = `${offlineAttendanceMonth}-${String(d).padStart(2, "0")}`;
                                            const status = log[dateKey];
                                            if (status === "present") studentPresentCount++;
                                            else if (status === "absent") studentAbsentCount++;
                                          });

                                          const totalMarkedDays = studentPresentCount + studentAbsentCount;
                                          const studentMonthPct = totalMarkedDays > 0 ? Math.round((studentPresentCount / totalMarkedDays) * 100) : 0;

                                          return (
                                            <View
                                              key={st.id}
                                              style={{
                                                flexDirection: "row",
                                                borderBottomWidth: 1,
                                                borderBottomColor: "#eeeeee",
                                                alignItems: "center",
                                                backgroundColor: idx % 2 === 0 ? "transparent" : (darkMode ? "#1f1f1f" : "#fafafa")
                                              }}
                                            >
                                              {/* Index */}
                                              <View style={{ width: 45, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center" }}>
                                                <Text style={{ fontSize: 11, color: "#9e9e9e" }}>{idx + 1}</Text>
                                              </View>

                                              {/* Roll */}
                                              <View style={{ width: 85, paddingVertical: 8, paddingHorizontal: 6 }}>
                                                <Text style={{ fontSize: 12, fontWeight: "600", color: "#424242" }} numberOfLines={1}>{roll}</Text>
                                              </View>

                                              {/* Name */}
                                              <TouchableOpacity
                                                onPress={() => setSelectedMonthlyCalendarStudent(st)}
                                                style={{ width: 170, paddingVertical: 8, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                                              >
                                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffebee", alignItems: "center", justifyContent: "center" }}>
                                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: "#c62828" }}>
                                                    {name ? name.charAt(0).toUpperCase() : "?"}
                                                  </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121" }} numberOfLines={1}>
                                                    {name || "Unnamed"}
                                                  </Text>
                                                  <Text style={{ fontSize: 10, color: isStudentOnline(st) ? "#1976d2" : "#e64a19", fontWeight: "600" }}>
                                                    {isStudentOnline(st) ? "Online" : "Offline"}
                                                  </Text>
                                                </View>
                                              </TouchableOpacity>

                                              {/* Day Cells */}
                                              {daysArray.map(dayNum => {
                                                const dateKey = `${offlineAttendanceMonth}-${String(dayNum).padStart(2, "0")}`;
                                                const dayDate = new Date(currYear, currMonthNum - 1, dayNum);
                                                const dayOfWeek = dayDate.getDay();
                                                const isSun = dayOfWeek === 0;
                                                const status = log[dateKey];
                                                const isCellSaving = offlineAttendanceCellSaving[`${st.id}_${dateKey}`] || false;

                                                return (
                                                  <TouchableOpacity
                                                    key={dayNum}
                                                    onPress={() => toggleCellAttendance(st, dateKey, status)}
                                                    style={{
                                                      width: 36,
                                                      height: 38,
                                                      alignItems: "center",
                                                      justifyContent: "center",
                                                      borderLeftWidth: 1,
                                                      borderLeftColor: "#eeeeee",
                                                      backgroundColor: isSun ? (darkMode ? "#2f1f1f" : "#fff8f8") : "transparent"
                                                    }}
                                                  >
                                                    {isCellSaving ? (
                                                      <ActivityIndicator size="small" color="#c62828" style={{ transform: [{ scale: 0.6 }] }} />
                                                    ) : status === "present" ? (
                                                      <View style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: "#2e7d32", alignItems: "center", justifyContent: "center" }}>
                                                        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>P</Text>
                                                      </View>
                                                    ) : status === "absent" ? (
                                                      <View style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: "#c62828", alignItems: "center", justifyContent: "center" }}>
                                                        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>A</Text>
                                                      </View>
                                                    ) : isSun ? (
                                                      <Text style={{ fontSize: 9, color: "#bdbdbd", fontWeight: "600" }}>Sun</Text>
                                                    ) : (
                                                      <Text style={{ fontSize: 14, color: "#d6d6d6" }}>-</Text>
                                                    )}
                                                  </TouchableOpacity>
                                                );
                                              })}

                                              {/* Present Count */}
                                              <View style={{ width: 45, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#2e7d32" }}>{studentPresentCount}</Text>
                                              </View>

                                              {/* Absent Count */}
                                              <View style={{ width: 45, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                                <Text style={{ fontSize: 12, fontWeight: "bold", color: studentAbsentCount > 0 ? "#c62828" : "#9e9e9e" }}>{studentAbsentCount}</Text>
                                              </View>

                                              {/* Percentage Badge */}
                                              <View style={{ width: 60, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                                <View style={{
                                                  paddingHorizontal: 6,
                                                  paddingVertical: 2,
                                                  borderRadius: 4,
                                                  backgroundColor: studentMonthPct >= 75 ? "#e8f5e9" : studentMonthPct >= 50 ? "#fff3e0" : "#ffebee"
                                                }}>
                                                  <Text style={{
                                                    fontSize: 10,
                                                    fontWeight: "bold",
                                                    color: studentMonthPct >= 75 ? "#2e7d32" : studentMonthPct >= 50 ? "#e65100" : "#c62828"
                                                  }}>
                                                    {studentMonthPct}%
                                                  </Text>
                                                </View>
                                              </View>

                                              {/* View Student Modal Button */}
                                              <View style={{ width: 50, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: "#e0e0e0" }}>
                                                <TouchableOpacity
                                                  onPress={() => setSelectedMonthlyCalendarStudent(st)}
                                                  style={{ padding: 6, borderRadius: 6, backgroundColor: "#ffebee" }}
                                                >
                                                  <Ionicons name="calendar-outline" size={14} color="#c62828" />
                                                </TouchableOpacity>
                                              </View>
                                            </View>
                                          );
                                        })}
                                      </View>
                                    </ScrollView>
                                  )}
                                </View>
                              </View>
                            )}

                            {/* ==================== INDIVIDUAL STUDENT MONTHLY CALENDAR MODAL ==================== */}
                            {selectedMonthlyCalendarStudent && (() => {
                              const st = selectedMonthlyCalendarStudent;
                              const roll = st.rollNumber || st.admissionNumber || st.id.substring(0, 6);
                              const name = getStudentName(st);
                              const log = st.attendanceLog || {};

                              let pCount = 0;
                              let aCount = 0;
                              daysArray.forEach(d => {
                                const dateKey = `${offlineAttendanceMonth}-${String(d).padStart(2, "0")}`;
                                if (log[dateKey] === "present") pCount++;
                                else if (log[dateKey] === "absent") aCount++;
                              });
                              const totalMarked = pCount + aCount;
                              const pct = totalMarked > 0 ? Math.round((pCount / totalMarked) * 100) : 0;

                              const firstDayOfMonth = new Date(currYear, currMonthNum - 1, 1).getDay(); // 0 = Sun
                              const calendarSlots: (number | null)[] = [];
                              for (let i = 0; i < firstDayOfMonth; i++) {
                                calendarSlots.push(null);
                              }
                              daysArray.forEach(d => calendarSlots.push(d));

                              return (
                                <Modal
                                  visible={true}
                                  transparent={true}
                                  animationType="fade"
                                  onRequestClose={() => setSelectedMonthlyCalendarStudent(null)}
                                >
                                  <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 16 }}>
                                    <View style={{ width: "100%", maxWidth: 580, maxHeight: "90%", backgroundColor: darkMode ? "#1e1e1e" : "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }}>
                                      {/* Header */}
                                      <View style={{ backgroundColor: "#c62828", paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                                            <Text style={{ fontWeight: "bold", fontSize: 16, color: "#c62828" }}>
                                              {name ? name.charAt(0).toUpperCase() : "S"}
                                            </Text>
                                          </View>
                                          <View>
                                            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{name}</Text>
                                            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>Roll: {roll} · {st.batch || activeMonthlyBatch}</Text>
                                          </View>
                                        </View>
                                        <TouchableOpacity
                                          onPress={() => setSelectedMonthlyCalendarStudent(null)}
                                          style={{ padding: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}
                                        >
                                          <Ionicons name="close" size={20} color="#fff" />
                                        </TouchableOpacity>
                                      </View>

                                      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
                                        {/* Month Title & Navigation */}
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                          <Text style={{ fontWeight: "bold", fontSize: 15, color: "#212121" }}>
                                            Attendance Calendar · {formatMonthTitle(offlineAttendanceMonth)}
                                          </Text>
                                          <View style={{ flexDirection: "row", gap: 6 }}>
                                            <TouchableOpacity
                                              onPress={() => changeMonthlyMonth(-1)}
                                              style={{ padding: 6, borderRadius: 6, backgroundColor: "#f5f5f5" }}
                                            >
                                              <Ionicons name="chevron-back" size={16} color="#c62828" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              onPress={() => changeMonthlyMonth(1)}
                                              style={{ padding: 6, borderRadius: 6, backgroundColor: "#f5f5f5" }}
                                            >
                                              <Ionicons name="chevron-forward" size={16} color="#c62828" />
                                            </TouchableOpacity>
                                          </View>
                                        </View>

                                        {/* Monthly Metrics Summary */}
                                        <View style={{ flexDirection: "row", gap: 8 }}>
                                          <View style={{ flex: 1, backgroundColor: "#e8f5e9", borderRadius: 8, padding: 10, alignItems: "center" }}>
                                            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#2e7d32" }}>{pCount}</Text>
                                            <Text style={{ fontSize: 11, color: "#2e7d32", fontWeight: "600", marginTop: 2 }}>Present Days</Text>
                                          </View>
                                          <View style={{ flex: 1, backgroundColor: "#ffebee", borderRadius: 8, padding: 10, alignItems: "center" }}>
                                            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#c62828" }}>{aCount}</Text>
                                            <Text style={{ fontSize: 11, color: "#c62828", fontWeight: "600", marginTop: 2 }}>Absent Days</Text>
                                          </View>
                                          <View style={{ flex: 1, backgroundColor: pct >= 75 ? "#e8f5e9" : "#fff3e0", borderRadius: 8, padding: 10, alignItems: "center" }}>
                                            <Text style={{ fontSize: 18, fontWeight: "bold", color: pct >= 75 ? "#2e7d32" : "#e65100" }}>{pct}%</Text>
                                            <Text style={{ fontSize: 11, color: pct >= 75 ? "#2e7d32" : "#e65100", fontWeight: "600", marginTop: 2 }}>Monthly Rate</Text>
                                          </View>
                                        </View>

                                        {/* 7-Day Calendar Grid */}
                                        <View style={{ borderWidth: 1, borderColor: "#eeeeee", borderRadius: 10, overflow: "hidden" }}>
                                          {/* Weekday Headers */}
                                          <View style={{ flexDirection: "row", backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderBottomColor: "#eeeeee" }}>
                                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, dIdx) => (
                                              <View key={dayName} style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}>
                                                <Text style={{ fontSize: 11, fontWeight: "bold", color: dIdx === 0 ? "#c62828" : "#616161" }}>
                                                  {dayName}
                                                </Text>
                                              </View>
                                            ))}
                                          </View>

                                          {/* Days in Month */}
                                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                                            {calendarSlots.map((d, slotIdx) => {
                                              if (d === null) {
                                                return (
                                                  <View key={`empty_${slotIdx}`} style={{ width: "14.285%", height: 50, borderRightWidth: (slotIdx + 1) % 7 === 0 ? 0 : 1, borderBottomWidth: 1, borderColor: "#eeeeee", backgroundColor: "#fafafa" }} />
                                                );
                                              }
                                              const dateKey = `${offlineAttendanceMonth}-${String(d).padStart(2, "0")}`;
                                              const status = log[dateKey];
                                              const dayDate = new Date(currYear, currMonthNum - 1, d);
                                              const isSun = dayDate.getDay() === 0;

                                              return (
                                                <TouchableOpacity
                                                  key={`day_${d}`}
                                                  onPress={() => toggleCellAttendance(st, dateKey, status)}
                                                  style={{
                                                    width: "14.285%",
                                                    height: 50,
                                                    borderRightWidth: (slotIdx + 1) % 7 === 0 ? 0 : 1,
                                                    borderBottomWidth: 1,
                                                    borderColor: "#eeeeee",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    padding: 2,
                                                    backgroundColor: status === "present" ? "#e8f5e9" : status === "absent" ? "#ffebee" : isSun ? "#fafafa" : "transparent"
                                                  }}
                                                >
                                                  <Text style={{ fontSize: 11, fontWeight: "bold", color: isSun ? "#c62828" : "#424242" }}>{d}</Text>
                                                  {status === "present" ? (
                                                    <View style={{ backgroundColor: "#2e7d32", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}>
                                                      <Text style={{ fontSize: 9, fontWeight: "bold", color: "#fff" }}>Present</Text>
                                                    </View>
                                                  ) : status === "absent" ? (
                                                    <View style={{ backgroundColor: "#c62828", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}>
                                                      <Text style={{ fontSize: 9, fontWeight: "bold", color: "#fff" }}>Absent</Text>
                                                    </View>
                                                  ) : isSun ? (
                                                    <Text style={{ fontSize: 8, color: "#9e9e9e", marginTop: 2 }}>Sunday</Text>
                                                  ) : (
                                                    <Text style={{ fontSize: 8, color: "#bdbdbd", marginTop: 2 }}>-</Text>
                                                  )}
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        </View>

                                        {/* Cumulative Record info */}
                                        <View style={{ backgroundColor: "#f5f5f5", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                          <Text style={{ fontSize: 12, color: "#616161" }}>Overall Cumulative Record:</Text>
                                          <Text style={{ fontSize: 12, fontWeight: "bold", color: "#212121" }}>
                                            {st.attendedDays || 0} / {st.totalDays || 0} Days
                                          </Text>
                                        </View>

                                        {/* Close Button */}
                                        <TouchableOpacity
                                          onPress={() => setSelectedMonthlyCalendarStudent(null)}
                                          style={[styles.outlineBtn, { marginTop: 4, alignSelf: "center", paddingHorizontal: 24 }]}
                                        >
                                          <Text style={styles.outlineBtnTxt}>Close</Text>
                                        </TouchableOpacity>
                                      </ScrollView>
                                    </View>
                                  </View>
                                </Modal>
                              );
                            })()}
                          </View>
                        );
                      })()}

                      {/* ========== ACCESS CONTROL (SACS) PANEL ========== */}
                      