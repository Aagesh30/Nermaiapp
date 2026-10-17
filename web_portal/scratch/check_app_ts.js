const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('App.tsx', 'utf8');
const lines = code.split('\n');

const sourceFile = ts.createSourceFile(
  'App.tsx',
  code,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const diagnostics = [];
function report(node, message) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  console.log(`TS Diagnostic: ${message} at line ${line + 1}, col ${character + 1}`);
}

// Find syntactic errors
const syntacticDiagnostics = sourceFile.parseDiagnostics;
console.log('Total parse diagnostics:', syntacticDiagnostics.length);
syntacticDiagnostics.slice(0, 10).forEach(d => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Error: ${d.messageText} at line ${line + 1}, col ${character + 1}`);
  for (let l = Math.max(1, line - 5); l <= Math.min(lines.length, line + 5); l++) {
    console.log(`${l}: ${lines[l - 1]}`);
  }
});
