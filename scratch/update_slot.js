const fs = require('fs');
let file = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

file = file.replace('paddingTop: !isMobile ? 180 : 390', 'paddingTop: !isMobile ? 234 : 390');
file = file.replace('width: !isMobile ? 440 : "92%"', 'width: !isMobile ? 465 : "92%"');
file = file.replace('maxWidth: 440', 'maxWidth: 465');

fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', file, 'utf8');
console.log('App.tsx updated successfully');
