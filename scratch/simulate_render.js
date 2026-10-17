const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Mock browser globals
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '' },
};
global.document = {
  getElementById: () => null,
  createElement: () => ({ appendChild: () => {}, getContext: () => null }),
  head: { appendChild: () => {} },
};
global.localStorage = global.window.localStorage;

console.log('Testing QRCodePermissionsPage...');
try {
  // Transpile and load QRCodePermissionsPage
  const { QRCodePermissionsPage } = require('../web_portal/lms/admin/QRCodePermissionsPage');
  const html = ReactDOMServer.renderToString(
    React.createElement(QRCodePermissionsPage, { erpStudents: [], erpBatches: [], erpCourses: [] })
  );
  console.log('QRCodePermissionsPage rendered successfully! Length:', html.length);
} catch (err) {
  console.error('CRASH in QRCodePermissionsPage:', err);
}

console.log('\nTesting StudentPayFeesPage...');
try {
  const { LMSProvider } = require('../web_portal/lms/LMSProvider');
  const { StudentPayFeesPage } = require('../web_portal/lms/student/StudentPayFeesPage');
  
  const element = React.createElement(
    LMSProvider,
    null,
    React.createElement(StudentPayFeesPage, { darkMode: false })
  );
  const html = ReactDOMServer.renderToString(element);
  console.log('StudentPayFeesPage rendered successfully! Length:', html.length);
} catch (err) {
  console.error('CRASH in StudentPayFeesPage:', err);
}
