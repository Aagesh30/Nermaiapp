const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add attendanceModeFilter state if not present
if (!content.includes('attendanceModeFilter')) {
  const targetState = '  // Offline Attendance state\n  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);';
  const replState = `  // Attendance Registry state
  const [attendanceModeFilter, setAttendanceModeFilter] = useState<"all" | "online" | "offline">("all");
  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);`;

  if (content.includes(targetState)) {
    content = content.replace(targetState, replState);
    console.log('1. Added attendanceModeFilter state successfully.');
  } else {
    // Try \r\n
    const targetStateCrlf = '  // Offline Attendance state\r\n  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);';
    if (content.includes(targetStateCrlf)) {
      content = content.replace(targetStateCrlf, replState.replace(/\n/g, '\r\n'));
      console.log('1. Added attendanceModeFilter state (CRLF) successfully.');
    } else {
      console.error('1. Could not find offlineAttendanceBatch state definition!');
      process.exit(1);
    }
  }
} else {
  console.log('1. attendanceModeFilter state already exists.');
}

// 2. Update Sidebar label from "Offline Attendance" to "Attendance Registry"
const oldSidebar = 'renderSidebarItem("offline-attendance", erpSub, "Offline Attendance", "clipboard-outline", () => { changeErpSub("offline-attendance"); loadStudents(); loadBatches(); }';
const newSidebar = 'renderSidebarItem("offline-attendance", erpSub, "Attendance Registry", "clipboard-outline", () => { changeErpSub("offline-attendance"); loadStudents(); loadBatches(); }';

if (content.includes(oldSidebar)) {
  content = content.replace(oldSidebar, newSidebar);
  console.log('2. Updated Sidebar menu label to Attendance Registry.');
} else {
  console.log('2. Sidebar menu already updated or not found.');
}

// 3. Update the erpSub === "offline-attendance" rendering block with the recovered, verified code
const panelStartMarker = '{erpSub === "offline-attendance" && isAdmin && (() => {';
const panelEndMarker = '{/* ========== ACCESS CONTROL (SACS) PANEL ========== */}';

const startIdx = content.indexOf(panelStartMarker);
const endIdx = content.indexOf(panelEndMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('3. Could not locate Attendance Panel markers:', { startIdx, endIdx });
  process.exit(1);
}

// Read recovered panel implementation
const recoveredPanel = fs.readFileSync(path.resolve(__dirname, 'attendance_registry_recovered.tsx'), 'utf8');

// The replacement text
const replacementPanel = `                      ` + recoveredPanel.trim() + `\n\n                      `;

content = content.substring(0, startIdx) + replacementPanel + content.substring(endIdx);
console.log('3. Successfully replaced Attendance panel block with verified Attendance Registry.');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('DONE: App.tsx successfully updated!');
