const fs = require('fs');
const content = fs.readFileSync('web_portal/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('--- QR PERMISSION CREATION ---');
lines.forEach((l, i) => {
  if (l.includes('qrCodeRequested: true') || l.includes('qrCodeRequested = true') || l.includes('requestQrPermission') || l.includes('/students/qr-permission') || l.includes('qr-permission')) {
    console.log(`Line ${i+1}: ${l}`);
    console.log(lines.slice(Math.max(0, i-5), Math.min(lines.length, i+15)).join('\n'));
    console.log('------------------------------');
  }
});
