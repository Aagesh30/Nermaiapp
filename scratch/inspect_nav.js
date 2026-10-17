const fs = require('fs');

const content = fs.readFileSync('web_portal/App.tsx', 'utf8');

// Let's find where tabs are rendered for student vs admin
// In student view:
console.log('--- STUDENT TABS ---');
const studentNavMatches = content.match(/role === ['"]student['"][\s\S]{1,500}?(?:sidebar|navbar|tabs)/gi);
console.log(studentNavMatches ? studentNavMatches.length : 0);

// Let's inspect testSub values more thoroughly in App.tsx
const allTestSubMatches = content.match(/testSub === ['"][^'"]+['"]/g) || [];
console.log('all testSub checks:', Array.from(new Set(allTestSubMatches)));

// Let's check handleNotificationNavigation role handling
const hnnIdx = content.indexOf('handleNotificationNavigation');
console.log(content.substring(hnnIdx, hnnIdx + 3000));
