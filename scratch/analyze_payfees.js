const fs = require('fs');
const ts = require('typescript');

const filePath = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/lms/student/StudentPayFeesPage.tsx';
const code = fs.readFileSync(filePath, 'utf8');

const sourceFile = ts.createSourceFile(
  filePath,
  code,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

// Collect all globals / imported / declared identifiers
const inScope = new Set([
  'React', 'useState', 'useEffect', 'useRef', 'StudentApi', 'PageHeader', 'Card', 'CardContent',
  'Button', 'Dialog', 'useToast', 'QrCode', 'Clock', 'CheckCircle2', 'AlertCircle', 'Send',
  'Upload', 'Eye', 'ImageIcon', 'Platform', 'View', 'Text', 'ScrollView', 'StyleSheet',
  'TextInput', 'TouchableOpacity', 'Image', 'ActivityIndicator', 'Alert', 'Modal',
  'Ionicons', 'ImagePicker', 'RNContainerSkeleton', 'db', 'doc', 'onSnapshot', 'collection',
  'query', 'where', 'status', 'setStatus', 'loading', 'setLoading', 'isDialogOpen',
  'setIsDialogOpen', 'submitting', 'setSubmitting', 'timeLeft', 'setTimeLeft', 'timerRef',
  'transactionId', 'setTransactionId', 'screenshotUrl', 'setScreenshotUrl', 'submittingPayment',
  'setSubmittingPayment', 'paymentHistory', 'setPaymentHistory', 'expandedAckId', 'setExpandedAckId',
  'fetchQrStatus', 'fetchPaymentHistory', 'initData', 'handleRequestQr', 'handleScreenshotChange',
  'handleMobileScreenshotPick', 'handleSubmitAcknowledgement', 'formatTime', 'formatDate',
  'styles', 'darkMode', 'idx', 'item', 'isApproved', 'isRejected', 'e', 'err', 'file', 'reader',
  'event', 'img', 'canvas', 'width', 'height', 'MAX_DIM', 'ctx', 'quality', 'compressed', 'res',
  'data', 'msg', 'errMsg', 'storedUser', 'studentDocId', 'unsubStudent', 'unsubPayments', 'qPayments',
  'unsubSettings', 'base64Data', 'result', 'fileInput', 'window', 'document', 'FileReader',
  'Date', 'Math', 'Promise', 'console', 'JSON', 'localStorage', 'parseFloat', 'parseInt', 'String',
  'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Boolean', 'Array', 'Set'
]);

const undeclared = [];

function checkIdentifier(node) {
  if (ts.isIdentifier(node)) {
    const parent = node.parent;
    // skip property names in object literals, member access properties, import specifiers, type references, etc.
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return;
    if (ts.isTypeReferenceNode(parent) || ts.isTypeNode(node)) return;
    if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return;
    if (ts.isVariableDeclaration(parent) && parent.name === node) return;
    if (ts.isParameter(parent) && parent.name === node) return;
    if (ts.isFunctionDeclaration(parent) && parent.name === node) return;
    if (ts.isJsxAttribute(parent) && parent.name === node) return;

    const name = node.text;
    if (!inScope.has(name) && !name.startsWith('nermai_') && !name.startsWith('set')) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      undeclared.push({ name, line });
    }
  }
  ts.forEachChild(node, checkIdentifier);
}

checkIdentifier(sourceFile);

console.log('Potentially undeclared identifiers in StudentPayFeesPage:');
undeclared.forEach(u => console.log(`  Line ${u.line}: ${u.name}`));
