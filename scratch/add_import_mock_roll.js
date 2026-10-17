const fs = require('fs');
let s = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const target = "const DynamicApplicationModal = React.lazy(() => import('./lms/components/DynamicApplicationModal'));";
const addition = "const DynamicApplicationModal = React.lazy(() => import('./lms/components/DynamicApplicationModal'));\r\nconst SpecialMockRollNumberPage = React.lazy(() => import('./lms/admin/SpecialMockRollNumberPage').then(m => ({ default: m.SpecialMockRollNumberPage })));";

if (s.includes(target) && !s.includes('SpecialMockRollNumberPage =')) {
  s = s.replace(target, addition);
  fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', s, 'utf8');
  console.log('Successfully added SpecialMockRollNumberPage import to App.tsx!');
} else {
  console.log('Target not found or already imported:', s.includes('SpecialMockRollNumberPage ='));
}
