const fs = require('fs');
let s = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const targetNotice = '<Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>1. Mock Test Name & Starting Roll Number</Text>';
const replNotice = `<Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>1. Mock Test Name & Starting Roll Number</Text>
                                  <View style={{ marginBottom: 12, padding: 10, backgroundColor: darkMode ? "#1e293b" : "#eff6ff", borderRadius: 8, borderWidth: 1, borderColor: darkMode ? "#334155" : "#bfdbfe", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                    <View style={{ flex: 1, minWidth: 200 }}>
                                      <Text style={{ fontSize: 12, fontWeight: "bold", color: darkMode ? "#93c5fd" : "#1d4ed8" }}>📌 Constant Roll Numbers & Hall Tickets Active</Text>
                                      <Text style={{ fontSize: 11, color: darkMode ? "#cbd5e1" : "#475569", marginTop: 2 }}>Students will use their persistent, constant roll number and already have their Hall Tickets ready.</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => changeTestSub("mock-rolls")} style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#c62828", borderRadius: 6 }}>
                                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>Manage Constant Rolls →</Text>
                                    </TouchableOpacity>
                                  </View>`;

if (s.includes(targetNotice)) {
  s = s.replace(targetNotice, replNotice);
  fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', s, 'utf8');
  console.log('Successfully injected Notice banner in Special Mock creation tab');
} else {
  console.log('Target notice NOT found');
}
