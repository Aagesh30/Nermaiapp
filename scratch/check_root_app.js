const fs = require('fs');
if (fs.existsSync('App.tsx')) {
  const content = fs.readFileSync('App.tsx', 'utf8');
  console.log('root App.tsx size bytes:', content.length);
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('Public Learning & Examination Portal') || l.includes('showAuthFlip')) {
      console.log(`Line ${i+1}: ${l.trim()}`);
    }
  });
}
