const fs = require('fs');
let code = fs.readFileSync('web_portal/App.tsx', 'utf8');

// Normalize to LF for matching and replacement
const isCRLF = code.includes('\r\n');
if (isCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

const oldHeaderBlock = `              {/* LMS Mobile Top Header Bar matching ERP / Image 2 */}
              {isMobile && lmsTabsCollapsed && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: darkMode ? "#1a1a2e" : "#ffffff",
                    borderBottomWidth: 1,
                    borderBottomColor: darkMode ? "#2a2a2a" : "#eeeeee",
                    gap: 10,
                    zIndex: 100,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setLmsTabsCollapsed(false)}
                    style={{
                      backgroundColor: darkMode ? "#26263a" : "#f5f5f5",
                      borderRadius: 8,
                      width: 36,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: darkMode ? "#3e3e55" : "#e0e0e0",
                    }}
                  >
                    <Ionicons name="menu" size={20} color="#c62828" />
                  </TouchableOpacity>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "bold",
                      color: darkMode ? "#ffffff" : "#212121",
                      textTransform: "capitalize",
                    }}
                  >
                    {lmsSub === 'lms-access' ? 'Smart Access Control' : (lmsSub ? lmsSub.replace(/^(lms-|my-)/, '').replace(/-/g, ' ') : 'LMS Portal')}
                  </Text>
                </View>
              )}

              <ScrollView style={[styles.splitContent, { paddingTop: isMobile ? 12 : 15 }, darkMode && styles.splitContentDark]} contentContainerStyle={{ paddingBottom: 80, alignItems: "stretch" }}>`;

const newHeaderBlock = `              {/* Subpage Content on the right */}
              <View style={{ flex: 1, position: "relative" }}>
                {isMobile && lmsTabsCollapsed && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: darkMode ? "#1a1a2e" : "#ffffff",
                      borderBottomWidth: 1,
                      borderBottomColor: darkMode ? "#2a2a2a" : "#eeeeee",
                      gap: 10,
                      zIndex: 100,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setLmsTabsCollapsed(false)}
                      style={{
                        backgroundColor: darkMode ? "#26263a" : "#f5f5f5",
                        borderRadius: 8,
                        width: 36,
                        height: 36,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: darkMode ? "#3e3e55" : "#e0e0e0",
                      }}
                    >
                      <Ionicons name="menu" size={20} color="#c62828" />
                    </TouchableOpacity>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "bold",
                        color: darkMode ? "#ffffff" : "#212121",
                        textTransform: "capitalize",
                      }}
                    >
                      {lmsSub === 'lms-access' ? 'Smart Access Control' : (lmsSub ? lmsSub.replace(/^(lms-|my-)/, '').replace(/-/g, ' ') : 'LMS Portal')}
                    </Text>
                  </View>
                )}

                <ScrollView style={[styles.splitContent, { paddingTop: isMobile ? 12 : 15 }, darkMode && styles.splitContentDark]} contentContainerStyle={{ paddingBottom: isMobile ? 160 : 80, alignItems: "stretch" }}>`;

const oldEndBlock = `                        <MobileLMSPages
                          lmsSub={lmsSub}
                          isAdmin={isAdmin}
                          isTeacher={isTeacher}
                          darkMode={darkMode}
                          executeEditOrApproval={executeEditOrApproval}
                          getFeatureAccess={getFeatureAccess}
                          changeLmsSub={changeLmsSub}
                        />
                      </Suspense>
                    )}
                  </>
                )}
              </ScrollView>
            </View>`;

const newEndBlock = `                        <MobileLMSPages
                          lmsSub={lmsSub}
                          isAdmin={isAdmin}
                          isTeacher={isTeacher}
                          darkMode={darkMode}
                          executeEditOrApproval={executeEditOrApproval}
                          getFeatureAccess={getFeatureAccess}
                          changeLmsSub={changeLmsSub}
                        />
                      </Suspense>
                    )}
                  </>
                )}
                </ScrollView>
              </View>
            </View>`;

if (!code.includes(oldHeaderBlock)) {
  console.error('Could not find oldHeaderBlock in LF normalized code');
  process.exit(1);
}

if (!code.includes(oldEndBlock)) {
  console.error('Could not find oldEndBlock in LF normalized code');
  process.exit(1);
}

code = code.replace(oldHeaderBlock, newHeaderBlock);
code = code.replace(oldEndBlock, newEndBlock);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('web_portal/App.tsx', code, 'utf8');
console.log('Successfully wrapped LMS subpage content with <View style={{ flex: 1, position: "relative" }}>!');
