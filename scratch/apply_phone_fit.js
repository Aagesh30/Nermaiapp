const fs = require('fs');
let file = fs.readFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'utf8');

// 1. Update ScrollView paddingTop and scrollEnabled
file = file.replace(
  'paddingTop: !isMobile ? 234 : 390,',
  'paddingTop: !isMobile ? 234 : Math.min(270, Math.max(240, (typeof screenHeight !== "undefined" ? screenHeight : 800) * 0.32)),'
);

file = file.replace(
  'scrollEnabled={isMobile || showAuthFlip}',
  'scrollEnabled={showAuthFlip}'
);

// 2. Adjust card padding on mobile to be compact so it fits perfectly on screen
file = file.replace(
  'paddingVertical: !isMobile ? 20 : 24,',
  'paddingVertical: !isMobile ? 20 : 16,'
);

file = file.replace(
  'paddingHorizontal: 22,',
  'paddingHorizontal: !isMobile ? 22 : 18,'
);

fs.writeFileSync('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', file, 'utf8');
console.log('App.tsx updated for phone and APK view');
