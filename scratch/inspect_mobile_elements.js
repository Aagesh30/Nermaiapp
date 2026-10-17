const fs = require('fs');

const content = fs.readFileSync('web_portal/lms/admin/MergedLeadsAdmissionsPage.tsx', 'utf8');
const lines = content.split('\n');

console.log('=== Inspecting MergedLeadsAdmissionsPage Mobile Elements ===');

lines.forEach((line, idx) => {
  // Check for fixed widths, minWidths, flexWrap, scrollviews, headers
  if (idx >= 950 && idx <= 1300) {
    if (line.includes('style=') || line.includes('minWidth') || line.includes('width') || line.includes('flexDirection') || line.includes('ScrollView')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
