const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

function inspectSection(name, startLine, endLine) {
  const sectionLines = lines.slice(startLine - 1, endLine);
  const text = sectionLines.join('\n');

  const hasScrollView = text.includes('<ScrollView');
  const hasHorizontalScroll = text.includes('horizontal={true}') || text.includes('horizontal ');
  const hasFlexWrap = text.includes('flexWrap: "wrap"') || text.includes("flexWrap: 'wrap'");
  const hasIsMobile = text.includes('isMobile');
  const hasWidth100 = text.includes('width: "100%"') || text.includes("width: '100%'");
  
  // Find fixed width > 500
  const fixedWidths = text.match(/width:\s*(\d{3,4})/g) || [];
  const minWidths = text.match(/minWidth:\s*(\d{3,4})/g) || [];

  return {
    name,
    startLine,
    endLine,
    totalLines: sectionLines.length,
    hasScrollView,
    hasHorizontalScroll,
    hasFlexWrap,
    hasIsMobile,
    hasWidth100,
    fixedWidths: [...new Set(fixedWidths)],
    minWidths: [...new Set(minWidths)]
  };
}

const sections = [
  { name: '1. Dashboard (Student/Teacher/Admin)', start: 19065, end: 19750 },
  { name: '2. Test Portal / Live Exam Taking', start: 19752, end: 22544 },
  { name: '3. ERP: Student Management & Table', start: 22733, end: 23940 },
  { name: '4. ERP: Notices & Announcements', start: 23940, end: 24403 },
  { name: '5. ERP: Batch Management', start: 24403, end: 24822 },
  { name: '6. ERP: Profile Requests', start: 24822, end: 25300 },
  { name: '7. ERP: Staff & Admin Management', start: 25300, end: 26000 },
  { name: '8. ERP: Fees & Financial Transactions', start: 26000, end: 27200 },
  { name: '9. ERP: Offline Attendance Scanner', start: 27200, end: 28000 },
  { name: '10. ERP: Marks & Leaderboards', start: 28000, end: 29500 },
  { name: '11. ERP: Analytics Dashboard', start: 29500, end: 30500 },
  { name: '12. LMS Module (Courses & Classes)', start: 30500, end: 32000 },
  { name: '13. CRM Module (Leads & Admissions)', start: 32000, end: 33500 },
  { name: '14. ID Card & Hall Ticket Generator', start: 33500, end: 35000 }
];

console.log("=== DETAILED PAGE LAYOUT & RESPONSIVENESS AUDIT ===");

sections.forEach(s => {
  const result = inspectSection(s.name, s.start, s.end);
  console.log(`\n📄 ${result.name} (Lines ${s.start}-${s.end})`);
  console.log(`   • Vertical ScrollView: ${result.hasScrollView ? '✅ Present' : '⚠️ Missing/Containers only'}`);
  console.log(`   • Table/Tab Horizontal Scroll: ${result.hasHorizontalScroll ? '✅ Present' : 'ℹ️ No horizontal scroll container'}`);
  console.log(`   • Adaptive Flex-Wrap: ${result.hasFlexWrap ? '✅ Present' : 'ℹ️ Column layout'}`);
  console.log(`   • Mobile Device Checks (isMobile): ${result.hasIsMobile ? '✅ Adaptive (Mobile specific styles)' : 'ℹ️ Universal layout'}`);
  if (result.fixedWidths.length > 0) {
    console.log(`   • Fixed Width Elements: ${result.fixedWidths.join(', ')}`);
  }
  if (result.minWidths.length > 0) {
    console.log(`   • Min-Width Elements: ${result.minWidths.join(', ')}`);
  }
});
