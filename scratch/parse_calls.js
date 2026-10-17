const fs = require('fs');

const raw = fs.readFileSync('scratch/all_push_calls.txt', 'utf8');
const blocks = raw.split('=================== CALL #');

const analyzed = [];

blocks.slice(1).forEach((b) => {
  const lines = b.trim().split('\n');
  const header = lines[0].split(' ')[0]; // number
  const loc = lines[1].replace('Location: ', '');
  const code = lines.slice(2).join('\n');

  // parse properties
  const titleMatch = code.match(/title:\s*([^\n,]+)/);
  const bodyMatch = code.match(/body:\s*([^\n,]+)/);
  const targetRoleMatch = code.match(/targetRole:\s*([^\n,]+)/);
  const targetUserIdMatch = code.match(/targetUserId:\s*([^\n,]+)/);
  const targetBatchMatch = code.match(/targetBatch:\s*([^\n,]+)/);
  const excludeUserIdMatch = code.match(/excludeUserId:\s*([^\n,]+)/);
  const targetTabMatch = code.match(/targetTab:\s*([^\n,]+)/);
  const targetSubMatch = code.match(/targetSub:\s*([^\n,]+)/);

  analyzed.push({
    num: header,
    location: loc,
    title: titleMatch ? titleMatch[1].trim() : '',
    targetRole: targetRoleMatch ? targetRoleMatch[1].trim() : '',
    targetUserId: targetUserIdMatch ? targetUserIdMatch[1].trim() : '',
    targetBatch: targetBatchMatch ? targetBatchMatch[1].trim() : '',
    excludeUserId: excludeUserIdMatch ? excludeUserIdMatch[1].trim() : 'NONE',
    targetTab: targetTabMatch ? targetTabMatch[1].trim() : '',
    targetSub: targetSubMatch ? targetSubMatch[1].trim() : '',
    code
  });
});

console.log(JSON.stringify(analyzed, null, 2));
