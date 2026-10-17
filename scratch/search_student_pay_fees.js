const fs = require('fs');

function search(file, str) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes(str)) {
      console.log(`${file}:${i + 1}: ${l.trim().substring(0, 150)}`);
    }
  });
}

search('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'StudentPayFees');
search('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx', 'pay-fees');
search('d:/unistrix/NERMAI_IAS_ACADEMY/App.tsx', 'StudentPayFees');
search('d:/unistrix/NERMAI_IAS_ACADEMY/App.tsx', 'pay-fees');
search('d:/unistrix/NERMAI_IAS_ACADEMY/App.tsx', 'fees');
