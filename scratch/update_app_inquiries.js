const fs = require('fs');
const path = require('path');

// 1. Update App.tsx General Inquiries Header
const appFile = path.resolve(__dirname, '../web_portal/App.tsx');
let appContent = fs.readFileSync(appFile, 'utf8');
const isAppCrlf = appContent.includes('\r\n');
if (isAppCrlf) {
  appContent = appContent.replace(/\r\n/g, '\n');
}

const inquiriesHeaderTarget = `<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <Text style={styles.sectionTitle}>General Inquiries</Text>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                  <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginBottom: 0, height: 36, fontSize: 12 }]} placeholder="From date" placeholderTextColor="#999" value={enquiryDateFilter} onChangeText={setEnquiryDateFilter} />
                                  <TouchableOpacity onPress={() => loadEnquiries(enquiryDateFilter)} style={[styles.primaryBtn, { paddingVertical: 0, paddingHorizontal: 12, height: 36, justifyContent: "center" }]}>
                                    <Text style={[styles.primaryBtnTxt, { fontSize: 12 }]}>Filter</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => { setEnquiryDateFilter(""); loadEnquiries(); }} style={[styles.outlineBtn, { paddingVertical: 0, paddingHorizontal: 10, height: 36, justifyContent: "center" }]}>
                                    <Text style={[styles.outlineBtnTxt, { fontSize: 12 }]}>Clear</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>`;

const inquiriesHeaderReplacement = `<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                                <Text style={styles.sectionTitle}>General Inquiries</Text>
                                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 1 }}>
                                  <TextInput style={[styles.input, { width: 110, marginBottom: 0, height: 36, fontSize: 12 }]} placeholder="From date" placeholderTextColor="#999" value={enquiryDateFilter} onChangeText={setEnquiryDateFilter} />
                                  <TouchableOpacity onPress={() => loadEnquiries(enquiryDateFilter)} style={[styles.primaryBtn, { paddingVertical: 0, paddingHorizontal: 12, height: 36, justifyContent: "center" }]}>
                                    <Text style={[styles.primaryBtnTxt, { fontSize: 12 }]}>Filter</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => { setEnquiryDateFilter(""); loadEnquiries(); }} style={[styles.outlineBtn, { paddingVertical: 0, paddingHorizontal: 10, height: 36, justifyContent: "center" }]}>
                                    <Text style={[styles.outlineBtnTxt, { fontSize: 12 }]}>Clear</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>`;

if (appContent.includes(inquiriesHeaderTarget)) {
  appContent = appContent.replace(inquiriesHeaderTarget, inquiriesHeaderReplacement);
  if (isAppCrlf) {
    appContent = appContent.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(appFile, appContent, 'utf8');
  console.log('Successfully updated General Inquiries header in App.tsx');
} else {
  console.log('Target not found in App.tsx');
}
