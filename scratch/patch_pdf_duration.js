const fs = require('fs');
const path = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

if (content.includes('value={newPdfTest.duration ? String(newPdfTest.duration) : ""}')) {
  console.log('PDF UI already patched!');
} else {
  const targetStr = 'onPress={() => setNewPdfTest({ ...newPdfTest, schedulingMode: opt.value })}';
  const idx = content.indexOf(targetStr);
  if (idx !== -1) {
    const endOptIdx = content.indexOf('</View>', idx);
    const containerCloseIdx = content.indexOf('</View>', endOptIdx + 7);
    
    const pdfDurationUI = `\n\n                                  {/* Individual Test Duration Input Box */}\n                                  <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: darkMode ? "#333" : "#e0e0e0" }}>\n                                    <Text style={{ fontSize: 10, fontWeight: "bold", color: darkMode ? "#9fa8da" : "#3949ab", marginBottom: 4 }}>\n                                      Test Duration (in Minutes):\n                                    </Text>\n                                    <TextInput\n                                      style={{\n                                        backgroundColor: darkMode ? "#2a2a2a" : "#fff",\n                                        borderColor: darkMode ? "#444" : "#ccc",\n                                        borderWidth: 1,\n                                        borderRadius: 6,\n                                        paddingHorizontal: 10,\n                                        paddingVertical: 6,\n                                        color: darkMode ? "#fff" : "#000",\n                                        fontSize: 12\n                                      }}\n                                      placeholder="e.g. 120 (for 2 hours)"\n                                      placeholderTextColor={darkMode ? "#888" : "#999"}\n                                      keyboardType="numeric"\n                                      value={newPdfTest.duration ? String(newPdfTest.duration) : ""}\n                                      onChangeText={(t) => setNewPdfTest({ ...newPdfTest, duration: t })}\n                                    />\n                                    <Text style={{ fontSize: 9, color: darkMode ? "#aaa" : "#777", marginTop: 3 }}>\n                                      {(newPdfTest.schedulingMode || "fixed") === "flexible"\n                                        ? "For flexible tests, students get this exact duration (e.g. 120 mins) from the moment they click Start within the window."\n                                        : "Duration in minutes (calculated automatically from window start/end time if left blank)."}\n                                    </Text>\n                                  </View>`;
    
    content = content.slice(0, containerCloseIdx) + pdfDurationUI + content.slice(containerCloseIdx);
    fs.writeFileSync(path, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log('SUCCESSFULLY PATCHED PDF TEST FORM UI!');
  } else {
    console.log('Target string not found');
  }
}
