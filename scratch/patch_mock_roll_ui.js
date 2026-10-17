const fs = require('fs');
let s = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

// 1. Add to Panel items
const targetPanels = '    { key: "test-special-mock", label: "Test - Special Mock Tests", icon: "medal-outline", type: "panel" },';
const replPanels = '    { key: "test-mock-rolls", label: "Test - Mock Roll No & Tickets", icon: "id-card-outline", type: "panel" },\r\n    { key: "test-special-mock", label: "Test - Special Mock Tests", icon: "medal-outline", type: "panel" },';
if (s.includes(targetPanels)) {
  s = s.replace(targetPanels, replPanels);
  console.log('1. Panels updated');
} else {
  console.log('1. Panels target NOT found');
}

// 2. Add to getTestFeatureKey
const targetFeatureKey = '      case "special-mock": return "test_creation";';
const replFeatureKey = '      case "mock-rolls": return "test_creation";\r\n      case "special-mock": return "test_creation";';
if (s.includes(targetFeatureKey)) {
  s = s.replace(targetFeatureKey, replFeatureKey);
  console.log('2. getTestFeatureKey updated');
} else {
  console.log('2. getTestFeatureKey target NOT found');
}

// 3. Add to Test Sidebar Navigation
const targetSidebar = '{renderSidebarItem("special-mock", testSub, "Special Mock", "medal-outline", () => changeTestSub("special-mock"), "test-special-mock", undefined, testSidebarCollapsed && !isMobile, "test_creation")}';
const replSidebar = '{renderSidebarItem("mock-rolls", testSub, "Mock Roll Numbers", "id-card-outline", () => changeTestSub("mock-rolls"), "test-mock-rolls", undefined, testSidebarCollapsed && !isMobile, "test_creation")}\r\n                        {renderSidebarItem("special-mock", testSub, "Special Mock", "medal-outline", () => changeTestSub("special-mock"), "test-special-mock", undefined, testSidebarCollapsed && !isMobile, "test_creation")}';
if (s.includes(targetSidebar)) {
  s = s.replace(targetSidebar, replSidebar);
  console.log('3. Sidebar updated');
} else {
  console.log('3. Sidebar target NOT found');
}

// 4. Update Header Title & Subtitle
const targetHeader = '{testSub === "available" ? "Available Exams" : testSub === "pdf-create" ? "AI Test Creation" : testSub === "special-mock" ? "Special Mock Tests" : testSub === "feedback" ? "Exams Feedback" : testSub === "results" ? "Results Log" : "Test Portal"}';
const replHeader = '{testSub === "available" ? "Available Exams" : testSub === "pdf-create" ? "AI Test Creation" : testSub === "mock-rolls" ? "Mock Roll No & Hall Tickets" : testSub === "special-mock" ? "Special Mock Tests" : testSub === "feedback" ? "Exams Feedback" : testSub === "results" ? "Results Log" : "Test Portal"}';
if (s.includes(targetHeader)) {
  s = s.replace(targetHeader, replHeader);
  console.log('4. Header Title updated');
} else {
  console.log('4. Header Title target NOT found');
}

const targetSubHeader = '{testSub === "available" ? "Active Mock Tests" : testSub === "pdf-create" ? "Authoring & AI" : testSub === "special-mock" ? "Special Roll No & Batches" : testSub === "feedback" ? "Student Feedback" : "Rankings & Scores"}';
const replSubHeader = '{testSub === "available" ? "Active Mock Tests" : testSub === "pdf-create" ? "Authoring & AI" : testSub === "mock-rolls" ? "Constant Rolls & Auto Tickets" : testSub === "special-mock" ? "Special Roll No & Batches" : testSub === "feedback" ? "Student Feedback" : "Rankings & Scores"}';
if (s.includes(targetSubHeader)) {
  s = s.replace(targetSubHeader, replSubHeader);
  console.log('5. SubHeader updated');
} else {
  console.log('5. SubHeader target NOT found');
}

// 6. Add render for testSub === "mock-rolls"
const targetRender = '{testSub === "special-mock" && isAdmin && (() => {';
const replRender = `{testSub === "mock-rolls" && isAdmin && (
                        <React.Suspense fallback={<View style={{ padding: 30, alignItems: "center" }}><ActivityIndicator size="large" color="#c62828" /></View>}>
                          <SpecialMockRollNumberPage
                            api={api}
                            user={user}
                            darkMode={darkMode}
                            batches={batches}
                            students={students}
                            loadStudents={loadStudents}
                            onNavigateToMocks={() => changeTestSub("special-mock")}
                          />
                        </React.Suspense>
                      )}

                      {testSub === "special-mock" && isAdmin && (() => {`;

if (s.includes(targetRender)) {
  s = s.replace(targetRender, replRender);
  console.log('6. Render view updated');
} else {
  console.log('6. Render view target NOT found');
}

fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', s, 'utf8');
console.log('Successfully completed script updates to web_portal/App.tsx');
