const fs = require('fs');
const ts = require('typescript');

const code = fs.readFileSync('App.tsx', 'utf8');

const sourceFile = ts.createSourceFile('App.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findContainingNode(node, targetLine) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
  
  if (start <= targetLine && end >= targetLine) {
    let childMatch = null;
    node.forEachChild(child => {
      const match = findContainingNode(child, targetLine);
      if (match) childMatch = match;
    });
    return childMatch || node;
  }
  return null;
}

const match = findContainingNode(sourceFile, 47126);
console.log('Match at 47126 kind:', ts.SyntaxKind[match.kind]);
let p = match;
while (p) {
  const s = sourceFile.getLineAndCharacterOfPosition(p.getStart()).line + 1;
  const e = sourceFile.getLineAndCharacterOfPosition(p.getEnd()).line + 1;
  console.log(` -> ${ts.SyntaxKind[p.kind]} (${s} to ${e})`);
  p = p.parent;
}
