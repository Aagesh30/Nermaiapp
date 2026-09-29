const fs = require('fs');
const content = fs.readFileSync('d:/Users/User/Desktop/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const pagesToAudit = [
  { name: 'Dashboard (Student/Teacher/Admin)', keyword: 'activeTab === "dashboard"' },
  { name: 'Test Taking Portal (Live Exam)', keyword: 'activeTab === "test"' },
  { name: 'LMS (Courses & Study Materials)', keyword: 'activeTab === "lms"' },
  { name: 'CRM (Leads & Admissions)', keyword: 'activeTab === "crm"' },
  { name: 'ID Card & Hall Ticket', keyword: 'activeTab === "idcard"' },
  { name: 'ERP: Student Registry', keyword: 'erpSub === "students"' },
  { name: 'ERP: Batch Management', keyword: 'erpSub === "batch"' },
  { name: 'ERP: Staff & Faculty', keyword: 'erpSub === "staff"' },
  { name: 'ERP: Fees & Transactions', keyword: 'erpSub === "fees"' },
  { name: 'ERP: Notices & Announcements', keyword: 'erpSub === "announcements"' },
  { name: 'ERP: Analytics & Subject Reports', keyword: 'erpSub === "analytics"' },
  { name: 'ERP: Offline Attendance Scanner', keyword: 'erpSub === "offline-attendance"' }
];

console.log("=== COMPREHENSIVE PAGE RESPONSIVENESS & AUDIT ===");

pagesToAudit.forEach(p => {
  const pos = content.indexOf(p.keyword);
  if (pos === -1) {
    console.log(`[?] ${p.name}: Keyword not found directly`);
    return;
  }

  // extract 300 lines around pos
  const chunk = content.substring(pos, pos + 20000);
  
  const hasScrollView = chunk.includes('ScrollView');
  const hasHorizontalScroll = chunk.includes('horizontal={true}') || chunk.includes('horizontal ');
  const hasFlexWrap = chunk.includes('flexWrap');
  const hasFixedBigWidth = /width:\s*(6\d\d|7\d\d|8\d\d|9\d\d|1\d\d\d)/.test(chunk);
  const usesWindowDimensions = chunk.includes('useWindowDimensions') || chunk.includes('Dimensions.get');

  console.log(`\n📌 ${p.name}:`);
  console.log(`   - ScrollView (Vertical): ${hasScrollView ? '✅ Yes' : '⚠️ No'}`);
  console.log(`   - Horizontal Scroll (Tables/Tabs): ${hasHorizontalScroll ? '✅ Yes' : '⚠️ No'}`);
  console.log(`   - Flex Wrap (Grid cards): ${hasFlexWrap ? '✅ Yes' : '⚠️ No'}`);
  console.log(`   - Hardcoded Big Width (>600px): ${hasFixedBigWidth ? '⚠️ Found fixed px width' : '✅ Dynamic/Responsive'}`);
});
