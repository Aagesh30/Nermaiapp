const fs = require('fs');
const ts = require('typescript');

function checkFile(filePath) {
  console.log('--- Checking:', filePath);
  const code = fs.readFileSync(filePath, 'utf8');
  
  // Parse AST
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const importedIdentifiers = new Set();
  const declaredIdentifiers = new Set();
  const jsxElementNames = [];

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      if (node.importClause) {
        if (node.importClause.name) {
          importedIdentifiers.add(node.importClause.name.text);
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            node.importClause.namedBindings.elements.forEach(el => {
              importedIdentifiers.add(el.name.text);
            });
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            importedIdentifiers.add(node.importClause.namedBindings.name.text);
          }
        }
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      jsxElementNames.push({ tag: tagName, pos: node.getStart(sourceFile), line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  console.log('Total JSX Elements:', jsxElementNames.length);

  // Check JSX elements that start with uppercase (components)
  const missingComponents = [];
  jsxElementNames.forEach(item => {
    const firstChar = item.tag.charAt(0);
    if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      const rootName = item.tag.split('.')[0];
      // Check if rootName is declared in the file or imported
      if (!importedIdentifiers.has(rootName) && !code.includes(`const ${rootName}`) && !code.includes(`function ${rootName}`) && !code.includes(`let ${rootName}`) && !code.includes(`class ${rootName}`)) {
        missingComponents.push({ ...item, rootName });
      }
    }
  });

  if (missingComponents.length > 0) {
    console.error('MISSING/UNDEFINED JSX COMPONENTS in ' + filePath + ':');
    missingComponents.forEach(m => console.error(`  Line ${m.line}: <${m.tag}> (Identifier '${m.rootName}' is NOT imported or defined!)`));
  } else {
    console.log('No missing JSX component identifiers found.');
  }
}

checkFile('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/QRCodePermissionsPage.tsx');
checkFile('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/admin/MobileQRCodePermissions.tsx');
checkFile('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx');
