const fs = require('fs');
const path = require('path');

// 1. Update web_portal/App.tsx to add the top header bar for LMS on mobile
const appFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let appContent = fs.readFileSync(appFile, 'utf8');
const isAppCrlf = appContent.includes('\r\n');
let appNorm = appContent.replace(/\r\n/g, '\n');

const oldLmsHeader = `              {/* Show Sidebar Button */}
              {isMobile && lmsTabsCollapsed && (
                <TouchableOpacity
                  onPress={() => setLmsTabsCollapsed(false)}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: 10,
                    zIndex: 1000,
                    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: darkMode ? "#333" : "#e0e0e0",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2.5,
                    elevation: 4
                  }}
                >
                  <Ionicons name="menu" size={20} color="#c62828" />
                </TouchableOpacity>
              )}

              <ScrollView style={[styles.splitContent, { paddingTop: (isMobile && lmsTabsCollapsed) ? 50 : 15 }, darkMode && styles.splitContentDark]} contentContainerStyle={{ paddingBottom: 80, alignItems: "stretch" }}>`;

const newLmsHeader = `              {/* LMS Mobile Top Header Bar matching ERP / Image 2 */}
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

if (!appNorm.includes(oldLmsHeader)) {
  console.error("oldLmsHeader not found in App.tsx!");
  process.exit(1);
}
appNorm = appNorm.replace(oldLmsHeader, newLmsHeader);
fs.writeFileSync(appFile, isAppCrlf ? appNorm.replace(/\n/g, '\r\n') : appNorm, 'utf8');
console.log("Updated App.tsx with LMS mobile top header bar!");
