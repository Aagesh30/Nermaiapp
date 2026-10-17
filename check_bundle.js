const fs = require('fs');
const path = 'web_portal/dist/_expo/static/js/web/index-0537a8da857e79fdc2c6690a78466127.js';
if (fs.existsSync(path)) {
  const c = fs.readFileSync(path, 'utf8');
  console.log('Bundle length:', c.length);
  console.log('Includes type="time":', c.includes('type="time"'));
  console.log('Includes UniversalTime12Picker:', c.includes('UniversalTime12Picker'));
  console.log('Includes AM and PM:', c.includes('"AM"') && c.includes('"PM"'));
  console.log('Includes 12-Hour:', c.includes('12-Hour'));
  console.log('Includes numbers-and-punctuation:', c.includes('numbers-and-punctuation'));
} else {
  console.log('File does not exist');
}
