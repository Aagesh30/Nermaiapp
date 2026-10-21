const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../web_portal/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `                                        <TouchableOpacity
                                          onPress={() => setCardSubTab("hallticket")}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            alignItems: "center",
                                            borderBottomWidth: 2,
                                            borderColor: cardSubTab === "hallticket" ? "#c62828" : "transparent"
                                          }}
                                        >
                                          <Text style={{ color: cardSubTab === "hallticket" ? "#c62828" : "#757575", fontWeight: "bold", fontSize: 14 }}>
                                            Hall Ticket Template
                                          </Text>
                                        </TouchableOpacity>`;

const replacement1 = `                                        <TouchableOpacity
                                          onPress={() => {
                                            if (getFeatureAccess("hall_ticket") === "none") {
                                              Alert.alert("Permission Denied", "You do not have permission to access Hall Ticket Generation.");
                                              return;
                                            }
                                            setCardSubTab("hallticket");
                                          }}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            alignItems: "center",
                                            borderBottomWidth: 2,
                                            borderColor: cardSubTab === "hallticket" ? "#c62828" : "transparent",
                                            opacity: getFeatureAccess("hall_ticket") === "none" ? 0.45 : 1
                                          }}
                                        >
                                          <Text style={{ color: cardSubTab === "hallticket" ? "#c62828" : "#757575", fontWeight: "bold", fontSize: 14 }}>
                                            🎫 Hall Ticket Template {getFeatureAccess("hall_ticket") === "none" ? "(No Access)" : getFeatureAccess("hall_ticket") === "edit_on_approval" ? "(Approval Req.)" : ""}
                                          </Text>
                                        </TouchableOpacity>`;

const target2 = `                                      {/* Hall Ticket Customizer */}
                                      {cardSubTab === "hallticket" && (
                                        <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 20 }}>`;

const replacement2 = `                                      {/* Hall Ticket Customizer */}
                                      {cardSubTab === "hallticket" && (
                                        getFeatureAccess("hall_ticket") === "none" ? (
                                          <View style={[styles.card, { alignItems: "center", padding: 30 }]}>
                                            <Ionicons name="lock-closed-outline" size={48} color="#c62828" />
                                            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#c62828", marginTop: 10 }}>Access Denied</Text>
                                            <Text style={{ fontSize: 13, color: "#757575", marginTop: 6, textAlign: "center" }}>
                                              Your role does not have permission to view or generate Hall Tickets.
                                            </Text>
                                          </View>
                                        ) : (
                                        <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 20 }}>`;

const target3 = `                                          </View>
                                        </View>
                                      )}`;

const replacement3 = `                                          </View>
                                        </View>
                                        )
                                      )}`;

// Normalize CRLF to LF for reliable matching
const isCRLF = content.includes('\r\n');
let normalizedContent = content.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(target1)) {
    console.error("Target 1 not found!");
    process.exit(1);
}
if (!normalizedContent.includes(target2)) {
    console.error("Target 2 not found!");
    process.exit(1);
}
if (!normalizedContent.includes(target3)) {
    console.error("Target 3 not found!");
    process.exit(1);
}

normalizedContent = normalizedContent.replace(target1, replacement1);
normalizedContent = normalizedContent.replace(target2, replacement2);
normalizedContent = normalizedContent.replace(target3, replacement3);

const finalContent = isCRLF ? normalizedContent.replace(/\n/g, '\r\n') : normalizedContent;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("✅ Successfully patched Hall Ticket permission gating in web_portal/App.tsx!");
