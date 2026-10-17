const fs = require('fs');
const ts = require('typescript');

const file = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx';
const content = fs.readFileSync(file, 'utf8');

const result = ts.transpileModule(content, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2020
  }
});

console.log('Transpilation succeeded. Output length:', result.outputText.length);

// Now let's scan result.outputText for any undefined variables used in React.createElement
const lines = result.outputText.split('\n');
lines.forEach((l, i) => {
  if (l.includes('React.createElement(')) {
    const match = l.match(/React\.createElement\(([^,]+)/);
    if (match) {
      const tag = match[1].trim();
      if (!tag.startsWith('"') && !tag.startsWith("'")) {
        // identifier
        // check if identifier is declared in the file
        // console.log(`Tag at line ${i+1}: ${tag}`);
      }
    }
  }
});
console.log('Checked React.createElement tags.');
