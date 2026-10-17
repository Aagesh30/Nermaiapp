const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'web_portal', 'App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure attendanceModeFilter state is present
if (!content.includes('attendanceModeFilter')) {
  const targetState = '  // Offline Attendance state\n  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);';
  const replState = `  // Attendance Registry state
  const [attendanceModeFilter, setAttendanceModeFilter] = useState<"all" | "online" | "offline">("all");
  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);`;

  if (content.includes(targetState)) {
    content = content.replace(targetState, replState);
    console.log('1. Added attendanceModeFilter state.');
  } else {
    const targetStateCrlf = '  // Offline Attendance state\r\n  const [offlineAttendanceBatch, setOfflineAttendanceBatch] = useState<string | null>(null);';
    if (content.includes(targetStateCrlf)) {
      content = content.replace(targetStateCrlf, replState.replace(/\n/g, '\r\n'));
      console.log('1. Added attendanceModeFilter state (CRLF).');
    }
  }
}

// 2. Ensure Sidebar item is Attendance Registry
const oldSidebar = 'renderSidebarItem("offline-attendance", erpSub, "Offline Attendance", "clipboard-outline", () => { changeErpSub("offline-attendance"); loadStudents(); loadBatches(); }';
const newSidebar = 'renderSidebarItem("offline-attendance", erpSub, "Attendance Registry", "clipboard-outline", () => { changeErpSub("offline-attendance"); loadStudents(); loadBatches(); }';
if (content.includes(oldSidebar)) {
  content = content.replace(oldSidebar, newSidebar);
  console.log('2. Updated Sidebar menu label.');
}

// 3. Locate the Attendance block and replace it completely with complete_attendance_registry_block.tsx
const startMarker = '{erpSub === "offline-attendance" && isAdmin && (() => {';
const endMarker = '{/* ========== ACCESS CONTROL (SACS) PANEL ========== */}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate block markers!', { startIdx, endIdx });
  process.exit(1);
}

const completeBlock = fs.readFileSync(path.resolve(__dirname, 'complete_attendance_registry_block.tsx'), 'utf8');
const replacement = `                      ` + completeBlock.trim() + `\n\n                      `;

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
console.log('3. Successfully replaced complete Attendance Registry panel.');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('DONE: App.tsx successfully patched with 100% complete Attendance Registry!');
