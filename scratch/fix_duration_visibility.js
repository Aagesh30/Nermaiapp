const fs = require('fs');
const path = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Update Manual Test Form
const manualTarget = `                    {/* Individual Test Duration Input Box */}
                    <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? "#333" : "#e0e0e0" }}>`;

const manualReplacement = `                    {/* Individual Test Duration Input Box - Only for Flexible mode */}
                    {(newTest.schedulingMode || "fixed") === "flexible" && (
                      <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: darkMode ? "#333" : "#e0e0e0" }}>`;

// 2. Update PDF Test Form
const pdfTarget = `                                  {/* Individual Test Duration Input Box */}
                                  <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: darkMode ? "#333" : "#e0e0e0" }}>`;

const pdfReplacement = `                                  {/* Individual Test Duration Input Box - Only for Flexible mode */}
                                  {(newPdfTest.schedulingMode || "fixed") === "flexible" && (
                                    <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: darkMode ? "#333" : "#e0e0e0" }}>`;

// Also need to close the conditional block `)}` for both
content = content.replace(
  `onChangeText={(t) => setNewTest({ ...newTest, duration: t })}\n                      />\n                      <Text style={{ fontSize: 10, color: darkMode ? "#aaa" : "#777", marginTop: 4 }}>\n                        {(newTest.schedulingMode || "fixed") === "flexible"\n                          ? "For flexible tests, students get this exact duration (e.g. 120 mins) from the moment they click Start within the window."\n                          : "Duration in minutes (calculated automatically from window start/end time if left blank)."}\n                      </Text>\n                    </View>`,
  `onChangeText={(t) => setNewTest({ ...newTest, duration: t })}\n                      />\n                      <Text style={{ fontSize: 10, color: darkMode ? "#aaa" : "#777", marginTop: 4 }}>\n                        For flexible tests, students get this exact duration (e.g. 120 mins) from the moment they click Start within the availability window.\n                      </Text>\n                    </View>\n                  )}`
);

content = content.replace(
  `onChangeText={(t) => setNewPdfTest({ ...newPdfTest, duration: t })}\n                                    />\n                                    <Text style={{ fontSize: 9, color: darkMode ? "#aaa" : "#777", marginTop: 3 }}>\n                                      {(newPdfTest.schedulingMode || "fixed") === "flexible"\n                                        ? "For flexible tests, students get this exact duration (e.g. 120 mins) from the moment they click Start within the window."\n                                        : "Duration in minutes (calculated automatically from window start/end time if left blank)."}\n                                    </Text>\n                                  </View>`,
  `onChangeText={(t) => setNewPdfTest({ ...newPdfTest, duration: t })}\n                                    />\n                                    <Text style={{ fontSize: 9, color: darkMode ? "#aaa" : "#777", marginTop: 3 }}>\n                                      For flexible tests, students get this exact duration (e.g. 120 mins) from the moment they click Start within the availability window.\n                                    </Text>\n                                  </View>\n                                )}`
);

if (content.includes(manualTarget)) {
  content = content.replace(manualTarget, manualReplacement);
}

if (content.includes(pdfTarget)) {
  content = content.replace(pdfTarget, pdfReplacement);
}

fs.writeFileSync(path, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated App.tsx duration box visibility!');
