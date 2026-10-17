const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../web_portal/App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const isCrlf = content.includes('\r\n');
if (isCrlf) {
  content = content.replace(/\r\n/g, '\n');
}

console.log('Original content length:', content.length);

// =========================================================================
// FIX 5: Daily Content Date, Month, Year Filter Bar and Filtering Logic
// =========================================================================
const dailyTarget = `                        {/* Filter by Audience if Admin */}
                        {(() => {
                          const myStudent = getLoggedInStudent(user, students) || user;
                          const isPaid = (Number(myStudent?.feesPaid) > 0) || myStudent?.type === "paid" || user?.type === "paid" || myStudent?.status === "active" || myStudent?.status === "enrolled" || user?.status === "active" || user?.status === "enrolled" || (Number(myStudent?.totalFees) > 0 && Number(myStudent?.feesPaid) >= Number(myStudent?.totalFees)) || Boolean(myStudent?.batch || myStudent?.batchName || user?.batch || user?.batchName);

                          const studentBatchesList: string[] = [];
                          if (myStudent?.batch) studentBatchesList.push(myStudent.batch);
                          if (myStudent?.batchName) studentBatchesList.push(myStudent.batchName);
                          if (user?.batch) studentBatchesList.push(user.batch);
                          if (user?.batchName) studentBatchesList.push(user.batchName);
                          const arrBatches = myStudent?.batches || user?.batches;
                          if (Array.isArray(arrBatches)) {
                            arrBatches.forEach((b: any) => {
                              if (b) studentBatchesList.push(String(b));
                            });
                          }

                          const matchBatch = (targetBatch: string, sList: string[]) => {
                            if (!targetBatch || targetBatch === "all") return true;
                            if (sList.length === 0) return false;
                            const targets = targetBatch.split(",").map(b => b.trim().toLowerCase()).filter(Boolean);
                            return sList.some(sb => {
                              const s = sb.trim().toLowerCase();
                              return targets.some(t => t === s || t.includes(s) || s.includes(t));
                            });
                          };

                          const filteredContent = lmsDailyContent.filter((c: any) => {
                            if (isAdmin) return true;
                            const aud = c.targetAudience || "all";
                            if (aud === "all") return true;
                            if (aud === "paid") return isPaid;
                            if (aud === "batch") {
                              if (!c.targetBatch) return true;
                              return matchBatch(c.targetBatch, studentBatchesList);
                            }
                            return true;
                          });

                          const sortedFilteredContent = [...filteredContent].sort(sortDailyContentDesc);`;

const dailyReplacement = `                        {/* Filter by Audience & Date (Year / Month / Date) */}
                        {(() => {
                          const myStudent = getLoggedInStudent(user, students) || user;
                          const isPaid = (Number(myStudent?.feesPaid) > 0) || myStudent?.type === "paid" || user?.type === "paid" || myStudent?.status === "active" || myStudent?.status === "enrolled" || user?.status === "active" || user?.status === "enrolled" || (Number(myStudent?.totalFees) > 0 && Number(myStudent?.feesPaid) >= Number(myStudent?.totalFees)) || Boolean(myStudent?.batch || myStudent?.batchName || user?.batch || user?.batchName);

                          const studentBatchesList: string[] = [];
                          if (myStudent?.batch) studentBatchesList.push(myStudent.batch);
                          if (myStudent?.batchName) studentBatchesList.push(myStudent.batchName);
                          if (user?.batch) studentBatchesList.push(user.batch);
                          if (user?.batchName) studentBatchesList.push(user.batchName);
                          const arrBatches = myStudent?.batches || user?.batches;
                          if (Array.isArray(arrBatches)) {
                            arrBatches.forEach((b: any) => {
                              if (b) studentBatchesList.push(String(b));
                            });
                          }

                          const matchBatch = (targetBatch: string, sList: string[]) => {
                            if (!targetBatch || targetBatch === "all") return true;
                            if (sList.length === 0) return false;
                            const targets = targetBatch.split(",").map(b => b.trim().toLowerCase()).filter(Boolean);
                            return sList.some(sb => {
                              const s = sb.trim().toLowerCase();
                              return targets.some(t => t === s || t.includes(s) || s.includes(t));
                            });
                          };

                          const getDailyDateStr = (c: any) => {
                            if (c.date) return String(c.date);
                            if (c.publishedAt) return String(c.publishedAt).split("T")[0];
                            if (c.createdAt) {
                              if (typeof c.createdAt === "object" && (c.createdAt.seconds || c.createdAt._seconds)) {
                                return new Date((c.createdAt.seconds || c.createdAt._seconds) * 1000).toISOString().split("T")[0];
                              }
                              if (typeof c.createdAt === "string") return c.createdAt.split("T")[0];
                            }
                            return "";
                          };

                          // Available years from existing daily content
                          const currentYear = new Date().getFullYear();
                          const yearsSet = new Set<string>([String(currentYear), String(currentYear - 1)]);
                          lmsDailyContent.forEach((c: any) => {
                            const d = getDailyDateStr(c);
                            if (d) {
                              const y = d.split("-")[0];
                              if (y && y.length === 4) yearsSet.add(y);
                            }
                          });
                          const dailyAvailableYears = Array.from(yearsSet).sort().reverse();

                          const filteredContent = lmsDailyContent.filter((c: any) => {
                            if (!isAdmin) {
                              const aud = c.targetAudience || "all";
                              if (aud === "paid" && !isPaid) return false;
                              if (aud === "batch") {
                                if (c.targetBatch && !matchBatch(c.targetBatch, studentBatchesList)) return false;
                              }
                            }

                            // Date filtering
                            const dStr = getDailyDateStr(c);
                            if (dailyFilterDate) {
                              if (dStr !== dailyFilterDate) return false;
                            }
                            if (dailyFilterYear) {
                              if (!dStr.startsWith(dailyFilterYear)) return false;
                            }
                            if (dailyFilterMonth) {
                              const parts = dStr.split("-");
                              if (parts.length < 2 || parts[1] !== dailyFilterMonth) return false;
                            }

                            return true;
                          });

                          const sortedFilteredContent = [...filteredContent].sort(sortDailyContentDesc);
                          const isDailyFiltered = Boolean(dailyFilterYear || dailyFilterMonth || dailyFilterDate);`;

if (!content.includes(dailyTarget)) {
  console.error('ERROR: dailyTarget not found!');
} else {
  content = content.replace(dailyTarget, dailyReplacement);
  console.log('SUCCESS: Fix 5 Daily Content filtering logic replaced.');
}

// Now replace empty / non-empty daily content rendering so the filter bar is ALWAYS displayed
const dailyRenderOld = `                          if (sortedFilteredContent.length === 0) {
                            return (
                              <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color={darkMode ? "#555" : "#bdbdbd"} />
                                <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No daily content published yet.</Text>
                                {isAdmin && (
                                  <Text style={{ fontSize: 12, color: darkMode ? "#777" : "#9e9e9e", textAlign: "center", marginTop: 6 }}>
                                    Click "Upload Daily Material" above to publish daily notes or PDFs.
                                  </Text>
                                )}
                              </View>
                            );
                          }

                          return (
                            <View style={{ gap: 12 }}>`;

const dailyRenderNew = `                          const renderDailyFilterBar = () => (
                            <View style={[styles.card, darkMode && styles.cardDark, { padding: 12, borderLeftWidth: 4, borderLeftColor: "#1565c0", marginBottom: 12 }]}>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Ionicons name="funnel-outline" size={16} color="#1565c0" />
                                  <Text style={{ fontSize: 13, fontWeight: "bold", color: darkMode ? "#fff" : "#212121" }}>
                                    Filter by Date, Month & Year
                                  </Text>
                                </View>
                                {isDailyFiltered ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setDailyFilterYear("");
                                      setDailyFilterMonth("");
                                      setDailyFilterDate("");
                                    }}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: darkMode ? "#3e1c1c" : "#ffebee" }}
                                  >
                                    <Ionicons name="close-circle" size={14} color="#c62828" />
                                    <Text style={{ fontSize: 11, fontWeight: "bold", color: "#c62828" }}>Reset Filters</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>

                              <View style={{ flexDirection: isMobile ? "column" : "row", gap: 8, alignItems: isMobile ? "stretch" : "center" }}>
                                {/* Filter by Year */}
                                <View style={{ flex: 1, minWidth: 100 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>YEAR</Text>
                                  {Platform.OS === "web" ? (
                                    <select
                                      value={dailyFilterYear}
                                      onChange={(e: any) => { setDailyFilterYear(e.target.value); setDailyFilterDate(""); }}
                                      style={{
                                        height: 38,
                                        borderRadius: 6,
                                        paddingLeft: 8,
                                        paddingRight: 8,
                                        fontSize: 12,
                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                                        color: darkMode ? "#fff" : "#212121",
                                        border: "1px solid " + (darkMode ? "#444" : "#ccc"),
                                        outline: "none",
                                        width: "100%"
                                      }}
                                    >
                                      <option value="">All Years</option>
                                      {dailyAvailableYears.map((y: string) => (
                                        <option key={y} value={y}>{y}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {["", ...dailyAvailableYears].map((y) => {
                                        const isSel = dailyFilterYear === y;
                                        return (
                                          <TouchableOpacity
                                            key={y || "all"}
                                            onPress={() => { setDailyFilterYear(y); setDailyFilterDate(""); }}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              borderRadius: 16,
                                              borderWidth: 1,
                                              borderColor: isSel ? "#1565c0" : (darkMode ? "#444" : "#ccc"),
                                              backgroundColor: isSel ? (darkMode ? "#0d47a1" : "#e3f2fd") : (darkMode ? "#2a2a2a" : "#fff")
                                            }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: isSel ? "bold" : "normal", color: isSel ? "#1565c0" : (darkMode ? "#ccc" : "#444") }}>
                                              {y || "All Years"}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>

                                {/* Filter by Month */}
                                <View style={{ flex: 1.2, minWidth: 120 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>MONTH</Text>
                                  {Platform.OS === "web" ? (
                                    <select
                                      value={dailyFilterMonth}
                                      onChange={(e: any) => { setDailyFilterMonth(e.target.value); setDailyFilterDate(""); }}
                                      style={{
                                        height: 38,
                                        borderRadius: 6,
                                        paddingLeft: 8,
                                        paddingRight: 8,
                                        fontSize: 12,
                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                                        color: darkMode ? "#fff" : "#212121",
                                        border: "1px solid " + (darkMode ? "#444" : "#ccc"),
                                        outline: "none",
                                        width: "100%"
                                      }}
                                    >
                                      <option value="">All Months</option>
                                      {[
                                        { val: "01", label: "January (01)" },
                                        { val: "02", label: "February (02)" },
                                        { val: "03", label: "March (03)" },
                                        { val: "04", label: "April (04)" },
                                        { val: "05", label: "May (05)" },
                                        { val: "06", label: "June (06)" },
                                        { val: "07", label: "July (07)" },
                                        { val: "08", label: "August (08)" },
                                        { val: "09", label: "September (09)" },
                                        { val: "10", label: "October (10)" },
                                        { val: "11", label: "November (11)" },
                                        { val: "12", label: "December (12)" }
                                      ].map(m => (
                                        <option key={m.val} value={m.val}>{m.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {[
                                        { val: "", label: "All" },
                                        { val: "01", label: "Jan" },
                                        { val: "02", label: "Feb" },
                                        { val: "03", label: "Mar" },
                                        { val: "04", label: "Apr" },
                                        { val: "05", label: "May" },
                                        { val: "06", label: "Jun" },
                                        { val: "07", label: "Jul" },
                                        { val: "08", label: "Aug" },
                                        { val: "09", label: "Sep" },
                                        { val: "10", label: "Oct" },
                                        { val: "11", label: "Nov" },
                                        { val: "12", label: "Dec" }
                                      ].map(m => {
                                        const isSel = dailyFilterMonth === m.val;
                                        return (
                                          <TouchableOpacity
                                            key={m.val || "all"}
                                            onPress={() => { setDailyFilterMonth(m.val); setDailyFilterDate(""); }}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              borderRadius: 16,
                                              borderWidth: 1,
                                              borderColor: isSel ? "#1565c0" : (darkMode ? "#444" : "#ccc"),
                                              backgroundColor: isSel ? (darkMode ? "#0d47a1" : "#e3f2fd") : (darkMode ? "#2a2a2a" : "#fff")
                                            }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: isSel ? "bold" : "normal", color: isSel ? "#1565c0" : (darkMode ? "#ccc" : "#444") }}>
                                              {m.label}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>

                                {/* Filter by Exact Date */}
                                <View style={{ flex: 1.4, minWidth: 140 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>SPECIFIC DATE</Text>
                                  <DatePickerField
                                    value={dailyFilterDate}
                                    onChange={(val: string) => {
                                      setDailyFilterDate(val);
                                      if (val) {
                                        const parts = val.split("-");
                                        if (parts[0]) setDailyFilterYear(parts[0]);
                                        if (parts[1]) setDailyFilterMonth(parts[1]);
                                      }
                                    }}
                                    placeholder="Pick date..."
                                    darkMode={darkMode}
                                    containerStyle={{ width: "100%" }}
                                  />
                                </View>
                              </View>
                            </View>
                          );

                          if (sortedFilteredContent.length === 0) {
                            return (
                              <View>
                                {renderDailyFilterBar()}
                                <View style={styles.emptyContainer}>
                                  <Ionicons name="calendar-outline" size={48} color={darkMode ? "#555" : "#bdbdbd"} />
                                  <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                                    {isDailyFiltered ? "No daily content matches the selected date filters." : "No daily content published yet."}
                                  </Text>
                                  {isDailyFiltered ? (
                                    <TouchableOpacity
                                      onPress={() => {
                                        setDailyFilterYear("");
                                        setDailyFilterMonth("");
                                        setDailyFilterDate("");
                                      }}
                                      style={[styles.outlineBtn, { marginTop: 10, borderColor: "#1565c0" }]}
                                    >
                                      <Text style={[styles.outlineBtnTxt, { color: "#1565c0" }]}>Clear Date Filters</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    isAdmin && (
                                      <Text style={{ fontSize: 12, color: darkMode ? "#777" : "#9e9e9e", textAlign: "center", marginTop: 6 }}>
                                        Click "Upload Daily Material" above to publish daily notes or PDFs.
                                      </Text>
                                    )
                                  )}
                                </View>
                              </View>
                            );
                          }

                          return (
                            <View style={{ gap: 12 }}>
                              {renderDailyFilterBar()}`;

if (!content.includes(dailyRenderOld)) {
  console.error('ERROR: dailyRenderOld not found!');
} else {
  content = content.replace(dailyRenderOld, dailyRenderNew);
  console.log('SUCCESS: Fix 5 Daily Content UI toolbar integrated.');
}

// =========================================================================
// FIX 6: Recorded Classes Cascading Filter (Subject, Topic, Subtopic)
// =========================================================================
const recHeaderOld = `                          <View>
                            <Text style={{ fontSize: 15, fontWeight: "bold", color: darkMode ? "#fff" : "#212121" }}>Recorded Video Library</Text>
                            <Text style={{ fontSize: 12, color: darkMode ? "#aaa" : "#757575", marginTop: 2 }}>
                              {lmsRecordedClasses.length} lecture{lmsRecordedClasses.length !== 1 ? "s" : ""} available
                            </Text>
                          </View>`;

const recHeaderNew = `                          <View>
                            <Text style={{ fontSize: 15, fontWeight: "bold", color: darkMode ? "#fff" : "#212121" }}>Recorded Video Library</Text>
                            <Text style={{ fontSize: 12, color: darkMode ? "#aaa" : "#757575", marginTop: 2 }}>
                              {(recFilterSubject !== "all" || recFilterTopic !== "all" || recFilterSubtopic !== "all")
                                ? \`Showing \${filteredRecordedClasses.length} of \${lmsRecordedClasses.length} lectures\`
                                : \`\${lmsRecordedClasses.length} lecture\${lmsRecordedClasses.length !== 1 ? "s" : ""} available\`}
                            </Text>
                          </View>`;

const recLoopOld = `                            {(() => {
                              const coursesMap = new Map();
                              const unassigned: any[] = [];

                              lmsRecordedClasses.forEach(cls => {`;

const recLoopNew = `                            {(() => {
                              // Filter recorded classes by cascading Subject, Topic, Subtopic
                              const filteredRecordedClasses = lmsRecordedClasses.filter((cls: any) => {
                                const cSubjId = typeof cls.subjectId === "object" ? (cls.subjectId?.id || cls.subjectId?._id) : cls.subjectId;
                                const cTopicId = typeof cls.topicId === "object" ? (cls.topicId?.id || cls.topicId?._id) : cls.topicId;
                                const cSubtopicId = typeof cls.subtopicId === "object" ? (cls.subtopicId?.id || cls.subtopicId?._id) : cls.subtopicId;

                                if (recFilterSubject !== "all") {
                                  const subjObj = lmsSubjects.find((s: any) => (s.id || s._id) === recFilterSubject);
                                  const subjName = subjObj?.name || subjObj?.title || "";
                                  if (cSubjId !== recFilterSubject && cls.subjectName !== subjName && cls.subject !== subjName) {
                                    return false;
                                  }
                                }

                                if (recFilterTopic !== "all") {
                                  const topicObj = lmsTopics.find((t: any) => (t.id || t._id) === recFilterTopic);
                                  const topicName = topicObj?.name || topicObj?.title || "";
                                  if (cTopicId !== recFilterTopic && cls.topicName !== topicName) {
                                    return false;
                                  }
                                }

                                if (recFilterSubtopic !== "all") {
                                  const subtopicObj = lmsSubtopics.find((st: any) => (st.id || st._id) === recFilterSubtopic);
                                  const subtopicName = subtopicObj?.name || subtopicObj?.title || "";
                                  if (cSubtopicId !== recFilterSubtopic && cls.subtopicName !== subtopicName) {
                                    return false;
                                  }
                                }

                                return true;
                              });

                              if (filteredRecordedClasses.length === 0 && lmsRecordedClasses.length > 0) {
                                return (
                                  <View style={styles.emptyContainer}>
                                    <Ionicons name="filter-circle-outline" size={48} color={darkMode ? "#555" : "#bdbdbd"} />
                                    <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                                      No recorded lectures match the selected filter criteria.
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setRecFilterSubject("all");
                                        setRecFilterTopic("all");
                                        setRecFilterSubtopic("all");
                                      }}
                                      style={[styles.outlineBtn, { marginTop: 10, borderColor: "#2e7d32" }]}
                                    >
                                      <Text style={[styles.outlineBtnTxt, { color: "#2e7d32" }]}>Reset Filters</Text>
                                    </TouchableOpacity>
                                  </View>
                                );
                              }

                              const coursesMap = new Map();
                              const unassigned: any[] = [];

                              filteredRecordedClasses.forEach(cls => {`;

if (!content.includes(recHeaderOld)) {
  console.error('ERROR: recHeaderOld not found!');
} else {
  content = content.replace(recHeaderOld, recHeaderNew);
  console.log('SUCCESS: Fix 6 Recorded Video header counter updated.');
}

if (!content.includes(recLoopOld)) {
  console.error('ERROR: recLoopOld not found!');
} else {
  content = content.replace(recLoopOld, recLoopNew);
  console.log('SUCCESS: Fix 6 Recorded Video filtering loop updated.');
}

// Add the Cascading Filter Toolbar right above recorded classes list / loading container
const recToolbarPlacementOld = `                        {recordedClassesLoading ? (`;

const recToolbarPlacementNew = `                        {/* Fix 6: Cascading Filter Bar by Subject, Topic (optional), Subtopic (optional) */}
                        {(() => {
                          const availableLmsTopics = lmsTopics.filter((t: any) => {
                            if (recFilterSubject === "all") return true;
                            const sId = typeof t.subjectId === "object" ? (t.subjectId?.id || t.subjectId?._id) : t.subjectId;
                            return sId === recFilterSubject;
                          });

                          const availableLmsSubtopics = lmsSubtopics.filter((st: any) => {
                            if (recFilterTopic === "all") {
                              if (recFilterSubject === "all") return true;
                              const top = lmsTopics.find((t: any) => (t.id || t._id) === (typeof st.topicId === "object" ? (st.topicId?.id || st.topicId?._id) : st.topicId));
                              if (!top) return true;
                              const topSubjId = typeof top.subjectId === "object" ? (top.subjectId?.id || top.subjectId?._id) : top.subjectId;
                              return topSubjId === recFilterSubject;
                            }
                            const tId = typeof st.topicId === "object" ? (st.topicId?.id || st.topicId?._id) : st.topicId;
                            return tId === recFilterTopic;
                          });

                          const isRecFiltered = recFilterSubject !== "all" || recFilterTopic !== "all" || recFilterSubtopic !== "all";

                          return (
                            <View style={[styles.card, darkMode && styles.cardDark, { padding: 12, borderLeftWidth: 4, borderLeftColor: "#2e7d32", marginBottom: 4 }]}>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Ionicons name="funnel-outline" size={16} color="#2e7d32" />
                                  <Text style={{ fontSize: 13, fontWeight: "bold", color: darkMode ? "#fff" : "#212121" }}>
                                    Filter by Subject, Topic & Subtopic
                                  </Text>
                                </View>
                                {isRecFiltered ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setRecFilterSubject("all");
                                      setRecFilterTopic("all");
                                      setRecFilterSubtopic("all");
                                    }}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: darkMode ? "#3e1c1c" : "#ffebee" }}
                                  >
                                    <Ionicons name="close-circle" size={14} color="#c62828" />
                                    <Text style={{ fontSize: 11, fontWeight: "bold", color: "#c62828" }}>Reset Filters</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>

                              <View style={{ flexDirection: isMobile ? "column" : "row", gap: 8, alignItems: isMobile ? "stretch" : "center" }}>
                                {/* Subject Filter */}
                                <View style={{ flex: 1, minWidth: 120 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>SUBJECT</Text>
                                  {Platform.OS === "web" ? (
                                    <select
                                      value={recFilterSubject}
                                      onChange={(e: any) => {
                                        setRecFilterSubject(e.target.value);
                                        setRecFilterTopic("all");
                                        setRecFilterSubtopic("all");
                                      }}
                                      style={{
                                        height: 38,
                                        borderRadius: 6,
                                        paddingLeft: 8,
                                        paddingRight: 8,
                                        fontSize: 12,
                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                                        color: darkMode ? "#fff" : "#212121",
                                        border: "1px solid " + (darkMode ? "#444" : "#ccc"),
                                        outline: "none",
                                        width: "100%"
                                      }}
                                    >
                                      <option value="all">All Subjects</option>
                                      {lmsSubjects.map((s: any) => (
                                        <option key={s.id || s._id} value={s.id || s._id}>{s.name || s.title}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {[{ id: "all", name: "All Subjects" }, ...lmsSubjects].map((s: any) => {
                                        const sid = s.id || s._id;
                                        const isSel = recFilterSubject === sid;
                                        return (
                                          <TouchableOpacity
                                            key={sid}
                                            onPress={() => {
                                              setRecFilterSubject(sid);
                                              setRecFilterTopic("all");
                                              setRecFilterSubtopic("all");
                                            }}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              borderRadius: 16,
                                              borderWidth: 1,
                                              borderColor: isSel ? "#2e7d32" : (darkMode ? "#444" : "#ccc"),
                                              backgroundColor: isSel ? (darkMode ? "#1b5e20" : "#e8f5e9") : (darkMode ? "#2a2a2a" : "#fff")
                                            }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: isSel ? "bold" : "normal", color: isSel ? (darkMode ? "#81c784" : "#2e7d32") : (darkMode ? "#ccc" : "#444") }}>
                                              {s.name || s.title}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>

                                {/* Topic Filter (Optional) */}
                                <View style={{ flex: 1, minWidth: 120 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>TOPIC (OPTIONAL)</Text>
                                  {Platform.OS === "web" ? (
                                    <select
                                      value={recFilterTopic}
                                      onChange={(e: any) => {
                                        setRecFilterTopic(e.target.value);
                                        setRecFilterSubtopic("all");
                                      }}
                                      style={{
                                        height: 38,
                                        borderRadius: 6,
                                        paddingLeft: 8,
                                        paddingRight: 8,
                                        fontSize: 12,
                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                                        color: darkMode ? "#fff" : "#212121",
                                        border: "1px solid " + (darkMode ? "#444" : "#ccc"),
                                        outline: "none",
                                        width: "100%"
                                      }}
                                    >
                                      <option value="all">All Topics</option>
                                      {availableLmsTopics.map((t: any) => (
                                        <option key={t.id || t._id} value={t.id || t._id}>{t.name || t.title}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {[{ id: "all", name: "All Topics" }, ...availableLmsTopics].map((t: any) => {
                                        const tid = t.id || t._id;
                                        const isSel = recFilterTopic === tid;
                                        return (
                                          <TouchableOpacity
                                            key={tid}
                                            onPress={() => {
                                              setRecFilterTopic(tid);
                                              setRecFilterSubtopic("all");
                                            }}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              borderRadius: 16,
                                              borderWidth: 1,
                                              borderColor: isSel ? "#2e7d32" : (darkMode ? "#444" : "#ccc"),
                                              backgroundColor: isSel ? (darkMode ? "#1b5e20" : "#e8f5e9") : (darkMode ? "#2a2a2a" : "#fff")
                                            }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: isSel ? "bold" : "normal", color: isSel ? (darkMode ? "#81c784" : "#2e7d32") : (darkMode ? "#ccc" : "#444") }}>
                                              {t.name || t.title}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>

                                {/* Subtopic Filter (Optional) */}
                                <View style={{ flex: 1, minWidth: 120 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#aaa" : "#666", marginBottom: 4 }}>SUBTOPIC (OPTIONAL)</Text>
                                  {Platform.OS === "web" ? (
                                    <select
                                      value={recFilterSubtopic}
                                      onChange={(e: any) => setRecFilterSubtopic(e.target.value)}
                                      style={{
                                        height: 38,
                                        borderRadius: 6,
                                        paddingLeft: 8,
                                        paddingRight: 8,
                                        fontSize: 12,
                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                                        color: darkMode ? "#fff" : "#212121",
                                        border: "1px solid " + (darkMode ? "#444" : "#ccc"),
                                        outline: "none",
                                        width: "100%"
                                      }}
                                    >
                                      <option value="all">All Subtopics</option>
                                      {availableLmsSubtopics.map((st: any) => (
                                        <option key={st.id || st._id} value={st.id || st._id}>{st.name || st.title}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {[{ id: "all", name: "All Subtopics" }, ...availableLmsSubtopics].map((st: any) => {
                                        const stid = st.id || st._id;
                                        const isSel = recFilterSubtopic === stid;
                                        return (
                                          <TouchableOpacity
                                            key={stid}
                                            onPress={() => setRecFilterSubtopic(stid)}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              borderRadius: 16,
                                              borderWidth: 1,
                                              borderColor: isSel ? "#2e7d32" : (darkMode ? "#444" : "#ccc"),
                                              backgroundColor: isSel ? (darkMode ? "#1b5e20" : "#e8f5e9") : (darkMode ? "#2a2a2a" : "#fff")
                                            }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: isSel ? "bold" : "normal", color: isSel ? (darkMode ? "#81c784" : "#2e7d32") : (darkMode ? "#ccc" : "#444") }}>
                                              {st.name || st.title}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })()}

                        {recordedClassesLoading ? (`;

if (!content.includes(recToolbarPlacementOld)) {
  console.error('ERROR: recToolbarPlacementOld not found!');
} else {
  content = content.replace(recToolbarPlacementOld, recToolbarPlacementNew);
  console.log('SUCCESS: Fix 6 Recorded Video toolbar added.');
}

// Convert back to original CRLF
if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully saved Fix 5 and Fix 6 to web_portal/App.tsx!');
