const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../web_portal/App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const isCrlf = content.includes('\r\n');
if (isCrlf) {
  content = content.replace(/\r\n/g, '\n');
}

// 1. State variables
const stateTarget = `  const [profileRequests, setProfileRequests] = useState<any[]>([]);`;
const stateReplacement = `  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [profileBatchFilter, setProfileBatchFilter] = useState<string>("all");
  const [profileDisplayLimit, setProfileDisplayLimit] = useState<number>(20);
  const [editPermBatchFilter, setEditPermBatchFilter] = useState<string>("all");
  const [editPermDisplayLimit, setEditPermDisplayLimit] = useState<number>(20);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Scrollable Role Dropdown in APK
content = content.split('<ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>').join(
  '<ScrollView nestedScrollEnabled={true} style={{ maxHeight: 220 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">'
);

// 3. AI Prompt text overflowing on phones
const aiPromptTarget = `<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                      <Text style={{ fontSize: 18 }}>🤖</Text>
                                      <View>
                                        <Text style={{ fontWeight: "bold", color: darkMode ? "#81c784" : "#2e7d32", fontSize: 13 }}>AI Prompt Generator</Text>
                                        <Text style={{ fontSize: 10, color: darkMode ? "#66bb6a" : "#388e3c" }}>Generate with ChatGPT · Gemini · Claude · Groq · DeepSeek · Perplexity</Text>
                                      </View>
                                    </View>`;

const aiPromptReplacement = `<View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 6 }}>
                                      <Text style={{ fontSize: 18 }}>🤖</Text>
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: "bold", color: darkMode ? "#81c784" : "#2e7d32", fontSize: 13 }}>AI Prompt Generator</Text>
                                        <Text style={{ fontSize: 10, color: darkMode ? "#66bb6a" : "#388e3c", flexWrap: "wrap", lineHeight: 14 }}>Generate with ChatGPT · Gemini · Claude · Groq · DeepSeek · Perplexity</Text>
                                      </View>
                                    </View>`;
content = content.replace(aiPromptTarget, aiPromptReplacement);

// 4. Subject Name selector in APK (Native dropdown picker instead of horizontal pills)
const subjectPickerTarget = `                    {Platform.OS === "web" ? (
                      <select
                        value={isCustom ? "__NEW_CUSTOM__" : sec.subject}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__NEW_CUSTOM__") {
                            updateSection(idx, { isCustom: true, subject: sec.customSubject || "" });
                          } else {
                            updateSection(idx, { isCustom: false, subject: val, customSubject: "" });
                          }
                        }}
                        style={{
                          width: "100%",
                          height: 36,
                          borderRadius: 6,
                          paddingLeft: 8,
                          paddingRight: 8,
                          fontSize: 13,
                          backgroundColor: darkMode ? "#2d2d2d" : "#f8fafc",
                          color: darkMode ? "#f1f5f9" : "#1e293b",
                          border: "1px solid " + (darkMode ? "#4b5563" : "#cbd5e1"),
                          outline: "none"
                        }}
                      >
                        <option value="">-- Select Subject --</option>
                        {uniqueSubjects.map((sName) => (
                          <option key={sName} value={sName}>{sName}</option>
                        ))}
                        <option value="__NEW_CUSTOM__">➕ Add New / Custom Subject...</option>
                      </select>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {(uniqueSubjects.length > 0 ? uniqueSubjects : ["History", "Geography", "Polity", "Economy", "Current Affairs", "General Science", "Aptitude & CSAT"]).map((sName) => {
                          const isSelected = !isCustom && sec.subject === sName;
                          return (
                            <TouchableOpacity
                              key={sName}
                              onPress={() => updateSection(idx, { isCustom: false, subject: sName, customSubject: "" })}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 7,
                                borderRadius: 20,
                                borderWidth: 1.5,
                                borderColor: isSelected ? "#c62828" : (darkMode ? "#475569" : "#cbd5e1"),
                                backgroundColor: isSelected ? (darkMode ? "#3e2723" : "#fff5f5") : (darkMode ? "#242424" : "#ffffff")
                              }}
                            >
                              <Text style={{
                                fontSize: 12,
                                fontWeight: "bold",
                                color: isSelected ? "#c62828" : (darkMode ? "#cbd5e1" : "#475569")
                              }}>
                                {sName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          onPress={() => updateSection(idx, { isCustom: true, subject: sec.customSubject || "" })}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: isCustom ? "#c62828" : (darkMode ? "#475569" : "#cbd5e1"),
                            backgroundColor: isCustom ? (darkMode ? "#3e2723" : "#fff5f5") : (darkMode ? "#242424" : "#ffffff")
                          }}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontWeight: "bold",
                            color: isCustom ? "#c62828" : (darkMode ? "#cbd5e1" : "#475569")
                          }}>
                            + Custom
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    )}`;

const subjectPickerReplacement = `                    {Platform.OS === "web" ? (
                      <select
                        value={isCustom ? "__NEW_CUSTOM__" : sec.subject}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__NEW_CUSTOM__") {
                            updateSection(idx, { isCustom: true, subject: sec.customSubject || "" });
                          } else {
                            updateSection(idx, { isCustom: false, subject: val, customSubject: "" });
                          }
                        }}
                        style={{
                          width: "100%",
                          height: 36,
                          borderRadius: 6,
                          paddingLeft: 8,
                          paddingRight: 8,
                          fontSize: 13,
                          backgroundColor: darkMode ? "#2d2d2d" : "#f8fafc",
                          color: darkMode ? "#f1f5f9" : "#1e293b",
                          border: "1px solid " + (darkMode ? "#4b5563" : "#cbd5e1"),
                          outline: "none"
                        }}
                      >
                        <option value="">-- Select Subject --</option>
                        {uniqueSubjects.map((sName) => (
                          <option key={sName} value={sName}>{sName}</option>
                        ))}
                        <option value="__NEW_CUSTOM__">➕ Add New / Custom Subject...</option>
                      </select>
                    ) : (
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            const available = uniqueSubjects.length > 0 ? uniqueSubjects : ["History", "Geography", "Polity", "Economy", "Current Affairs", "General Science", "Aptitude & CSAT"];
                            Alert.alert(
                              "Select Subject",
                              "Choose a subject or add a custom name:",
                              [
                                ...available.map((sName) => ({
                                  text: sName,
                                  onPress: () => updateSection(idx, { isCustom: false, subject: sName, customSubject: "" })
                                })),
                                {
                                  text: "➕ Add Custom Subject...",
                                  onPress: () => updateSection(idx, { isCustom: true, subject: sec.customSubject || "" })
                                },
                                { text: "Cancel", style: "cancel" }
                              ]
                            );
                          }}
                          style={{
                            height: 40,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            borderWidth: 1.5,
                            borderColor: darkMode ? "#475569" : "#cbd5e1",
                            backgroundColor: darkMode ? "#2d2d2d" : "#f8fafc",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "600", color: sec.subject ? (darkMode ? "#f1f5f9" : "#1e293b") : "#999" }}>
                            {isCustom ? (sec.subject ? sec.subject + " (Custom)" : "+ Custom Subject...") : (sec.subject || "-- Tap to Choose Subject --")}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={darkMode ? "#aaa" : "#64748b"} />
                        </TouchableOpacity>
                      </View>
                    )}`;
content = content.replace(subjectPickerTarget, subjectPickerReplacement);

// 5. Results Log (Images 1-4) doesn't fit on phone screen
const resultsLogCardTarget = `<View key={t.id} style={{ backgroundColor: darkMode ? "#18181b" : "#fafafa", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: "#c62828", borderWidth: 1, borderColor: darkMode ? "#27272a" : "#e2e8f0" }}>`;
const resultsLogCardReplacement = `<View key={t.id} style={{ backgroundColor: darkMode ? "#18181b" : "#fafafa", borderRadius: 10, padding: (isMobile || Platform.OS !== "web") ? 8 : 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: "#c62828", borderWidth: 1, borderColor: darkMode ? "#27272a" : "#e2e8f0", overflow: "hidden", maxWidth: "100%" }}>`;
content = content.replace(resultsLogCardTarget, resultsLogCardReplacement);

const diagPanelTarget = `      <View style={{
        margin: isMobilePanel ? 4 : 10,
        padding: isMobilePanel ? 10 : 16,
        borderRadius: 12,
        backgroundColor: darkMode ? "#141414" : "#ffffff",
        borderWidth: 1,
        borderColor: darkMode ? "#2a2a2a" : "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2
      }}>`;
const diagPanelReplacement = `      <View style={{
        margin: isMobilePanel ? 0 : 10,
        padding: isMobilePanel ? 8 : 16,
        borderRadius: 12,
        backgroundColor: darkMode ? "#141414" : "#ffffff",
        borderWidth: 1,
        borderColor: darkMode ? "#2a2a2a" : "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        overflow: "hidden",
        width: "100%"
      }}>`;
content = content.replace(diagPanelTarget, diagPanelReplacement);

const questionCardTarget = `                        <View
                          key={qKey}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: darkMode ? "#18181b" : "#ffffff",
                            borderWidth: 1,
                            borderColor: darkMode ? "#3f3f46" : "#e4e4e7"
                          }}
                        >`;
const questionCardReplacement = `                        <View
                          key={qKey}
                          style={{
                            padding: (isMobile || Platform.OS !== "web") ? 8 : 12,
                            borderRadius: 8,
                            backgroundColor: darkMode ? "#18181b" : "#ffffff",
                            borderWidth: 1,
                            borderColor: darkMode ? "#3f3f46" : "#e4e4e7",
                            overflow: "hidden",
                            width: "100%"
                          }}
                        >`;
content = content.split(questionCardTarget).join(questionCardReplacement);

// 6. Profile Requests (Tab 1: Pending Initial Profile Completions)
// Replace the whole block starting from line 33947
const profileSectionTarget = `                            {/* TAB 1: PENDING INITIAL PROFILE COMPLETIONS */}
                            {profileRequestsTab === "incomplete" && (
                              <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#e65100" }}>
                                  Students who have NOT submitted their initial profile details:
                                </Text>
                                {incompleteStudents.length === 0 ? (
                                  <View style={[styles.card, { alignItems: "center", padding: 30 }]}>
                                    <Ionicons name="checkmark-circle-outline" size={40} color="#4caf50" />
                                    <Text style={{ color: "#4caf50", fontWeight: "bold", marginTop: 10 }}>All Registered Students Have Submitted Their Profiles!</Text>
                                  </View>
                                ) : (
                                  <View style={styles.card}>
                                    {incompleteStudents.map((s: any, idx: number) => {`;

const profileSectionReplacement = `                            {/* TAB 1: PENDING INITIAL PROFILE COMPLETIONS */}
                            {profileRequestsTab === "incomplete" && (() => {
                              const batchFilteredIncomplete = profileBatchFilter === "all"
                                ? incompleteStudents
                                : incompleteStudents.filter((s: any) => String(s.batch || "").trim().toLowerCase() === String(profileBatchFilter).trim().toLowerCase());
                              const displayedIncomplete = batchFilteredIncomplete.slice(0, profileDisplayLimit);
                              const availableBatches = [...new Set(incompleteStudents.map((s: any) => s.batch).filter(Boolean))];

                              return (
                              <View style={{ gap: 10 }}>
                                {/* Batch Filter & Pagination Bar */}
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, backgroundColor: "#fff8e1", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ffe082" }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
                                    <Ionicons name="filter" size={16} color="#e65100" />
                                    <Text style={{ fontSize: 12, fontWeight: "bold", color: "#e65100" }}>Filter Batch:</Text>
                                    <select
                                      value={profileBatchFilter}
                                      onChange={(e) => {
                                        setProfileBatchFilter(e.target.value);
                                        setProfileDisplayLimit(20);
                                      }}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        border: "1px solid #ffb74d",
                                        backgroundColor: "#fff",
                                        fontSize: 12,
                                        fontWeight: "600",
                                        color: "#e65100",
                                        outline: "none"
                                      }}
                                    >
                                      <option value="all">All Batches ({incompleteStudents.length})</option>
                                      {availableBatches.map((bName) => {
                                        const count = incompleteStudents.filter((s: any) => s.batch === bName).length;
                                        return (
                                          <option key={bName} value={bName}>{bName} ({count})</option>
                                        );
                                      })}
                                    </select>
                                  </View>
                                  <Text style={{ fontSize: 11, color: "#757575", fontWeight: "600" }}>
                                    Showing {displayedIncomplete.length} of {batchFilteredIncomplete.length}
                                  </Text>
                                </View>

                                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#e65100" }}>
                                  Students who have NOT submitted their initial profile details:
                                </Text>
                                {batchFilteredIncomplete.length === 0 ? (
                                  <View style={[styles.card, { alignItems: "center", padding: 30 }]}>
                                    <Ionicons name="checkmark-circle-outline" size={40} color="#4caf50" />
                                    <Text style={{ color: "#4caf50", fontWeight: "bold", marginTop: 10 }}>No incomplete profiles found for this batch!</Text>
                                  </View>
                                ) : (
                                  <View style={styles.card}>
                                    {displayedIncomplete.map((s: any, idx: number) => {`;

content = content.replace(profileSectionTarget, profileSectionReplacement);

const profileSectionEndTarget = `                                            <TouchableOpacity
                                              onPress={() => toggleProfileEditPermission(s.id, hasPermission)}
                                              style={{ backgroundColor: hasPermission ? "#4caf50" : "#1976d2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                            >
                                              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>
                                                {hasPermission ? "Permission Granted" : "Grant Edit"}
                                              </Text>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            )}`;

const profileSectionEndReplacement = `                                            <TouchableOpacity
                                              onPress={() => toggleProfileEditPermission(s.id, hasPermission)}
                                              style={{ backgroundColor: hasPermission ? "#4caf50" : "#1976d2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                            >
                                              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>
                                                {hasPermission ? "Permission Granted" : "Grant Edit"}
                                              </Text>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                                {batchFilteredIncomplete.length > profileDisplayLimit && (
                                  <TouchableOpacity
                                    onPress={() => setProfileDisplayLimit(prev => prev + 20)}
                                    style={{
                                      backgroundColor: "#fff3e0",
                                      borderWidth: 1,
                                      borderColor: "#ffb74d",
                                      paddingVertical: 10,
                                      borderRadius: 8,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexDirection: "row",
                                      gap: 6
                                    }}
                                  >
                                    <Ionicons name="arrow-down-circle-outline" size={16} color="#e65100" />
                                    <Text style={{ fontSize: 12, fontWeight: "bold", color: "#e65100" }}>
                                      Load More ({batchFilteredIncomplete.length - profileDisplayLimit} remaining)
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                              );
                            })()}`;

content = content.replace(profileSectionEndTarget, profileSectionEndReplacement);

// 7. Profile Edit Permissions
const editPermTarget = `                      {/* PROFILE EDIT PERMISSIONS PANEL (Admin) */}
                      {erpSub === "edit-permissions" && isAdmin && (
                        <View style={{ gap: 12 }}>
                          <Text style={styles.sectionTitle}> Profile Edit Permissions</Text>
                          <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
                            <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderColor: "#e0e0e0" }}>
                              <Text style={{ flex: 1, fontWeight: "bold", fontSize: 12, color: "#555" }}>Roll No</Text>
                              <Text style={{ flex: 2, fontWeight: "bold", fontSize: 12, color: "#555" }}>Student Name</Text>
                              <Text style={{ flex: 1, fontWeight: "bold", fontSize: 12, color: "#555", textAlign: "center" }}>Edit Permission</Text>
                            </View>
                            {(() => {
                              const submittedStudents = students.filter((s: any) => s.isProfileSubmitted === true || (typeof s.profileSubmitCount === "number" && s.profileSubmitCount > 0) || s.status === "completed");
                              if (submittedStudents.length === 0) {
                                return (
                                  <View style={{ padding: 25, alignItems: "center" }}>
                                    <Ionicons name="lock-closed-outline" size={32} color="#bdbdbd" />
                                    <Text style={{ color: "#757575", marginTop: 8, fontSize: 13 }}>No submitted profiles yet.</Text>
                                    <Text style={{ color: "#aaa", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                                      Students will appear here after they fill out and submit their profile form on the student portal.
                                    </Text>
                                  </View>
                                );
                              }
                              return submittedStudents.map((s: any, idx: number) => {`;

const editPermReplacement = `                      {/* PROFILE EDIT PERMISSIONS PANEL (Admin) */}
                      {erpSub === "edit-permissions" && isAdmin && (() => {
                        const submittedStudents = students.filter((s: any) => s.isProfileSubmitted === true || (typeof s.profileSubmitCount === "number" && s.profileSubmitCount > 0) || s.status === "completed");
                        const batchFilteredSubmitted = editPermBatchFilter === "all"
                          ? submittedStudents
                          : submittedStudents.filter((s: any) => String(s.batch || "").trim().toLowerCase() === String(editPermBatchFilter).trim().toLowerCase());
                        const displayedSubmitted = batchFilteredSubmitted.slice(0, editPermDisplayLimit);
                        const availableBatches = [...new Set(submittedStudents.map((s: any) => s.batch).filter(Boolean))];

                        return (
                        <View style={{ gap: 12 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <Text style={styles.sectionTitle}> Profile Edit Permissions</Text>
                            {/* Batch Filter dropdown */}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f5f5f5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0" }}>
                              <Ionicons name="filter" size={14} color="#555" />
                              <Text style={{ fontSize: 11, fontWeight: "bold", color: "#555" }}>Batch:</Text>
                              <select
                                value={editPermBatchFilter}
                                onChange={(e) => {
                                  setEditPermBatchFilter(e.target.value);
                                  setEditPermDisplayLimit(20);
                                }}
                                style={{
                                  padding: "3px 6px",
                                  borderRadius: 4,
                                  border: "1px solid #ccc",
                                  backgroundColor: "#fff",
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: "#333",
                                  outline: "none"
                                }}
                              >
                                <option value="all">All Batches ({submittedStudents.length})</option>
                                {availableBatches.map((bName) => {
                                  const count = submittedStudents.filter((s: any) => s.batch === bName).length;
                                  return (
                                    <option key={bName} value={bName}>{bName} ({count})</option>
                                  );
                                })}
                              </select>
                            </View>
                          </View>

                          <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
                            <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderColor: "#e0e0e0" }}>
                              <Text style={{ flex: 1, fontWeight: "bold", fontSize: 12, color: "#555" }}>Roll No</Text>
                              <Text style={{ flex: 2, fontWeight: "bold", fontSize: 12, color: "#555" }}>Student Name</Text>
                              <Text style={{ flex: 1, fontWeight: "bold", fontSize: 12, color: "#555", textAlign: "center" }}>Edit Permission</Text>
                            </View>
                            {(() => {
                              if (batchFilteredSubmitted.length === 0) {
                                return (
                                  <View style={{ padding: 25, alignItems: "center" }}>
                                    <Ionicons name="lock-closed-outline" size={32} color="#bdbdbd" />
                                    <Text style={{ color: "#757575", marginTop: 8, fontSize: 13 }}>No submitted profiles found for this batch.</Text>
                                    <Text style={{ color: "#aaa", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                                      Students will appear here after they fill out and submit their profile form on the student portal.
                                    </Text>
                                  </View>
                                );
                              }
                              return displayedSubmitted.map((s: any, idx: number) => {`;

content = content.replace(editPermTarget, editPermReplacement);

const editPermEndTarget = `                          <Text style={{ color: "#999", fontSize: 11, textAlign: "center" }}>
                            Tap a button to toggle. Students with Enabled status can submit/re-submit their profile once.
                          </Text>
                        </View>
                      )}`;

const editPermEndReplacement = `                          {batchFilteredSubmitted.length > editPermDisplayLimit && (
                            <TouchableOpacity
                              onPress={() => setEditPermDisplayLimit(prev => prev + 20)}
                              style={{
                                backgroundColor: "#e3f2fd",
                                borderWidth: 1,
                                borderColor: "#90caf9",
                                paddingVertical: 10,
                                borderRadius: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                flexDirection: "row",
                                gap: 6
                              }}
                            >
                              <Ionicons name="arrow-down-circle-outline" size={16} color="#1976d2" />
                              <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1976d2" }}>
                                Load More ({batchFilteredSubmitted.length - editPermDisplayLimit} remaining)
                              </Text>
                            </TouchableOpacity>
                          )}
                          <Text style={{ color: "#999", fontSize: 11, textAlign: "center" }}>
                            Showing {'{' + 'displayedSubmitted.length' + '}'} of {'{' + 'batchFilteredSubmitted.length' + '}'} students. Tap a button to toggle.
                          </Text>
                        </View>
                        );
                      })()}`;

content = content.replace(editPermEndTarget, editPermEndReplacement);

if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('App.tsx updated successfully without JSX braces escaping errors!');
