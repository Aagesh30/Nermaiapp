                                            {/* ========== ATTENDANCE REGISTRY PANEL (ONLINE & OFFLINE) ========== */}
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

                            const headers = ["Roll / Reg No", "Student Name", "Mode", "Batch"];
                            for (let d = 1; d <= daysCount; d++) {
                              headers.push(String(d));
                            }
                            headers.push("Total Present (P)", "Total Absent (A)", "Attendance %");

                            const dataRows = monthlyStudents.map((st: any, idx: number) => {
                              const roll = st.rollNumber || st.admissionNumber || `S${idx + 1}`;
                              const name = getStudentName(st);
                              const mode = isStudentOnline(st) ? "Online" : "Offline";
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

                              return [roll, name, mode, st.batch || activeMonthlyBatch, ...dayValues, pCount, aCount, pct];
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
                            <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: "#c62828", gap: 12 }]}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                <View>
                                  <Text style={styles.sectionTitle}>Attendance Registry</Text>
                                  <Text style={{ color: "#757575", fontSize: 13, marginTop: 2 }}>
                                    Track attendance for Online and Offline students. Live class attendance marks automatically.
                                  </Text>
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
