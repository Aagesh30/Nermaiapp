const fs = require('fs');

function inspectExam(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log('=== Checking', filePath, '===');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    // Check if line contains exam or attempt or question
    if (/examination|activeattempt|attemptquestions|startexam|testportal|infobtn|instruction/i.test(line)) {
      if (/modal|button|touchableopacity|icon|info|close|header|timer|alert|duration/i.test(line)) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    }
  });
}

inspectExam('App.tsx');
inspectExam('web_portal/App.tsx');
