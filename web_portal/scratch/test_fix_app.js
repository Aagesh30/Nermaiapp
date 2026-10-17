const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('App.tsx', 'utf8');

const target = "  useEffect(() => {\r\n    studentsRef.current = students;\r\n  const [batches, setBatches]";
const replacement = "  useEffect(() => {\r\n    studentsRef.current = students;\r\n  }, [students]);\r\n  const [batches, setBatches]";

if (!code.includes(target)) {
  console.log('Target not found!');
  process.exit(1);
}

const fixedCode = code.replace(target, replacement);
console.log('Successfully replaced target.');

const sourceFile = ts.createSourceFile('App.tsx', fixedCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
console.log('Fixed code diagnostics count:', sourceFile.parseDiagnostics.length);
sourceFile.parseDiagnostics.forEach(d => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Error: ${d.messageText} at line ${line + 1}, col ${character + 1}`);
});
