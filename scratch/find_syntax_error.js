const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('D:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx', 'utf8');
const transpiled = ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
});

try {
  const wrapper = new Function('require', 'module', 'exports', transpiled.outputText);
} catch (e) {
  console.error('Stack:', e.stack);
  // find which line of transpiled output caused syntax error
  const lines = transpiled.outputText.split('\n');
  for (let i = 1; i <= lines.length; i++) {
    try {
      new Function(lines.slice(0, i).join('\n') + '\n}');
    } catch (err) {
      // ignore
    }
  }
}
