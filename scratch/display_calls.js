const fs = require('fs');
const calls = JSON.parse(fs.readFileSync('scratch/parsed_calls.json', 'utf8'));

calls.forEach(c => {
  console.log(`[#${c.num}] ${c.location}`);
  console.log(`  Title: ${c.title}`);
  console.log(`  Target: role=${c.targetRole || 'N/A'}, user=${c.targetUserId || 'N/A'}, batch=${c.targetBatch || 'N/A'}`);
  console.log(`  excludeUserId: ${c.excludeUserId}`);
  console.log(`  Navigation: targetTab=${c.targetTab}, targetSub=${c.targetSub}`);
  console.log('');
});
