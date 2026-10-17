const fs = require('fs');
const ts = require('typescript');

console.log('=== TESTING CRASHES ===');

function transpileAndEval(filePath, mockEnv = 'web') {
  console.log(`\nTesting ${filePath} in ${mockEnv} mode...`);
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });

  // Setup globals
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => JSON.stringify({ studentId: 'stu123' }), setItem: () => {}, removeItem: () => {} },
    location: { href: '' },
    confirm: () => true,
    alert: () => {},
  };
  global.localStorage = global.window.localStorage;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ appendChild: () => {}, getContext: () => null }),
    head: { appendChild: () => {} },
  };

  const React = require('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/node_modules/react');
  const ReactDOMServer = require('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/node_modules/react-dom/server');

  function customRequire(name) {
    if (name === 'react-native') {
      const rn = require('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/node_modules/react-native-web');
      rn.Platform.OS = mockEnv === 'apk' ? 'android' : 'web';
      return rn;
    }
    if (name.includes('services')) {
      return {
        StudentApi: {
          getStudentQrStatus: async () => ({ data: { data: { qrCodeEnabled: false } } }),
          getStudentPaymentAcknowledgements: async () => ({ data: { data: [] } }),
          listPaymentAcknowledgements: async () => ({ data: { data: [] } }),
          updateQrSettings: async () => ({}),
          requestStudentQr: async () => ({}),
          submitPaymentAcknowledgement: async () => ({}),
        },
        BatchApi: { listBatches: async () => ({ data: { data: [] } }) },
        CourseApi: { listCourses: async () => ({ data: { data: [] } }) },
      };
    }
    if (name.includes('firebaseConfig')) return { db: {} };
    if (name.includes('firebase/firestore')) {
      return {
        collection: () => ({}),
        onSnapshot: () => () => {},
        query: () => ({}),
        where: () => ({}),
        doc: () => ({}),
      };
    }
    if (name.includes('ToastContext')) {
      return {
        useToast: () => ({ toast: () => {}, success: () => {}, error: () => {} }),
        ToastProvider: ({ children }) => children,
      };
    }
    if (name.includes('RNSkeleton')) return { RNContainerSkeleton: () => null, RNTableSkeleton: () => null };
    if (name.includes('admin-ui')) {
      return {
        AdminTable: () => null,
        AdminInput: () => null,
        AdminSelect: () => null,
        AdminButton: () => null,
        AdminModal: () => null,
      };
    }
    if (name.includes('expo-image-picker') || name.includes('expo-document-picker') || name.includes('expo-file-system')) {
      return {
        getDocumentAsync: async () => ({ canceled: true }),
        launchImageLibraryAsync: async () => ({ canceled: true }),
        MediaTypeOptions: { Images: 'Images' },
        requestMediaLibraryPermissionsAsync: async () => ({ status: 'granted' }),
      };
    }
    return require('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/node_modules/' + name);
  }

  try {
    const m = { exports: {} };
    const wrapper = new Function('require', 'module', 'exports', transpiled.outputText);
    wrapper(customRequire, m, m.exports);
    const Comp = m.exports.StudentPayFeesPage || m.exports.MobileQRCodePermissions || m.exports.QRCodePermissionsPage;
    if (!Comp) {
      console.error('Export not found in module! Keys:', Object.keys(m.exports));
      return;
    }
    console.log('Module evaluated successfully, now rendering component...');
    const html = ReactDOMServer.renderToString(React.createElement(Comp, {
      darkMode: false,
      erpStudents: [{ id: 'stu1', name: 'Student 1', qrCodeRequested: true }],
      erpBatches: [],
      erpCourses: []
    }));
    console.log(` Rendered successfully! (length: ${html.length})`);
  } catch (err) {
    console.error(` CRASH in ${filePath} (${mockEnv}):\n`, err.stack || err.message);
  }
}

transpileAndEval('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/QRCodePermissionsPage.tsx', 'web');
transpileAndEval('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/MobileQRCodePermissions.tsx', 'apk');
transpileAndEval('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/MobileQRCodePermissions.tsx', 'web');
transpileAndEval('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'web');
transpileAndEval('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'apk');
