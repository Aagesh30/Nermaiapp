const fs = require('fs');
let s = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

const target1 = '{offlineBatchNames.map(batchName => {';
const repl1 = '{attendanceBatchNames.map(batchName => {';

const target2 = 'const count = offlineStudents.filter((s: any) => s.batch === batchName).length;';
const repl2 = 'const count = attendanceStudents.filter((s: any) => (s.batch || "General / Unassigned") === batchName).length;';

if (s.includes(target1) && s.includes(target2)) {
  s = s.replace(target1, repl1);
  s = s.replace(target2, repl2);
  fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', s, 'utf8');
  console.log('Successfully fixed offlineBatchNames reference error!');
} else {
  console.log('Target not found:', { t1: s.includes(target1), t2: s.includes(target2) });
}
