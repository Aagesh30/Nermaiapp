const fs = require('fs');
const ts = require('typescript');

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

function customRequire(moduleName) {
  if (moduleName.includes('services')) {
    return {
      StudentApi: {
        getStudentQrStatus: async () => ({ data: { data: { qrCodeEnabled: false } } }),
        getStudentPaymentAcknowledgements: async () => ({ data: { data: [] } }),
        listPaymentAcknowledgements: async () => ({ data: { data: [] } }),
      },
      BatchApi: { listBatches: async () => ({ data: { data: [] } }) },
      CourseApi: { listCourses: async () => ({ data: { data: [] } }) },
    };
  }
  if (moduleName.includes('firebaseConfig')) {
    return { db: {} };
  }
  if (moduleName.includes('firebase/firestore')) {
    return {
      collection: () => ({}),
      onSnapshot: () => () => {},
      query: () => ({}),
      where: () => ({}),
      doc: () => ({}),
    };
  }
  if (moduleName.includes('admin-ui')) {
    return {
      AdminTable: () => null,
      AdminInput: () => null,
      AdminSelect: () => null,
      AdminButton: () => null,
      AdminModal: () => null,
    };
  }
  if (moduleName.includes('ToastContext')) {
    return {
      useToast: () => ({ success: () => {}, error: () => {} }),
      ToastProvider: ({ children }) => children,
    };
  }
  if (moduleName.includes('RNSkeleton')) {
    return {
      RNContainerSkeleton: () => null,
    };
  }
  if (moduleName.includes('PageHeader') || moduleName.includes('Card') || moduleName.includes('Button') || moduleName.includes('Dialog')) {
    return {
      PageHeader: () => null,
      Card: () => null,
      CardContent: () => null,
      Button: () => null,
      Dialog: () => null,
    };
  }
  if (moduleName.includes('expo-image-picker') || moduleName.includes('expo-document-picker') || moduleName.includes('expo-file-system')) {
    return {};
  }
  return require(moduleName);
}

const React = require('react');
const ReactDOMServer = require('react-dom/server');

console.log('--- 1. Testing QRCodePermissionsPage ---');
try {
  const code = fs.readFileSync('D:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/QRCodePermissionsPage.tsx', 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  });
  const m = { exports: {} };
  const wrapper = new Function('require', 'module', 'exports', transpiled.outputText);
  wrapper(customRequire, m, m.exports);
  const { QRCodePermissionsPage } = m.exports;

  // Test rendering QRCodePermissionsPage with a pending student (triggers banner)
  const html = ReactDOMServer.renderToString(
    React.createElement(QRCodePermissionsPage, {
      erpStudents: [{ id: '1', displayName: 'Test', qrCodeRequested: true }],
      erpBatches: [],
      erpCourses: []
    })
  );
  console.log('Rendered QRCodePermissionsPage successfully!');
} catch (e) {
  console.error('EXACT CRASH in QRCodePermissionsPage:\n', e.name + ': ' + e.message);
}

console.log('\n--- 2. Testing StudentPayFeesPage ---');
try {
  const code = fs.readFileSync('D:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  });
  const m = { exports: {} };
  const wrapper = new Function('require', 'module', 'exports', transpiled.outputText);
  wrapper(customRequire, m, m.exports);
  const { StudentPayFeesPage } = m.exports;

  const html = ReactDOMServer.renderToString(
    React.createElement(StudentPayFeesPage, { darkMode: false })
  );
  console.log('Rendered StudentPayFeesPage successfully!');
} catch (e) {
  console.error('EXACT CRASH in StudentPayFeesPage:\n', e.name + ': ' + e.message);
}
