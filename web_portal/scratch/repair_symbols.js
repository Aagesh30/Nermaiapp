const fs = require('fs');

const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The corrupted symbols are:
// "â‚¹" -> "₹"
// "ðŸŸ¢" -> "🟢"
// "ðŸš«" -> "🚫"

const countRupee = (content.match(/â‚¹/g) || []).length;
const countGreenCircle = (content.match(/ðŸŸ¢/g) || []).length;
const countProhibited = (content.match(/ðŸš«/g) || []).length;

console.log(`Found:`);
console.log(`- â‚¹ (Rupee): ${countRupee}`);
console.log(`- ðŸŸ¢ (Green circle): ${countGreenCircle}`);
console.log(`- ðŸš« (Prohibited/block): ${countProhibited}`);

// Perform clean, exact replacements
content = content.split('â‚¹').join('₹');
content = content.split('ðŸŸ¢').join('🟢');
content = content.split('ðŸš«').join('🚫');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated App.tsx with exact UTF-8 symbols.');
