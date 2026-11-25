/**
 * Nermai IAS Academy — Local-Only Firestore Security Rules Verification Harness
 *
 * SAFETY GUARANTEES:
 * 1. Runs exclusively against the local Firebase Firestore Emulator at 127.0.0.1:8080.
 * 2. Uses a 'demo-' project ID ('demo-nermai-rules-audit') to force offline emulator mode.
 * 3. Ingests the local 'firestore.rules' file directly into memory.
 * 4. Explicitly strips all production and cloud credential environment variables.
 * 5. Pre-flight health probe to http://127.0.0.1:8080/ immediately aborts if emulator is offline.
 * 6. Never invokes the Firebase Admin SDK or contacts live production Firebase.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

// ─── 1. Environment & Credential Cleansing ─────────────────────────────────────
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.FIREBASE_CONFIG;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.JWT_SECRET;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const PROJECT_ID = 'demo-nermai-rules-audit';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

// ─── 2. Pre-Flight Local Emulator Health Probe ─────────────────────────────────
function verifyLocalEmulatorOnline() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:8080/', { timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('error', (err) => {
      reject(new Error(
        `Local Firestore emulator probe failed on 127.0.0.1:8080 (${err.message}). ` +
        `Execution aborted to prevent any remote or fallback connection.`
      ));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Local Firestore emulator probe timed out on 127.0.0.1:8080.'));
    });
  });
}

// ─── 3. Test Harness Implementation ───────────────────────────────────────────
async function runRulesAudit() {
  console.log('=================================================================');
  console.log('NERMAI IAS ACADEMY — LOCAL FIRESTORE RULES AUDIT');
  console.log('Host: 127.0.0.1:8080 | Project: ' + PROJECT_ID);
  console.log('=================================================================\n');

  // Verify emulator loopback connection
  try {
    await verifyLocalEmulatorOnline();
    console.log('✓ Pre-flight probe passed: Local emulator is active at 127.0.0.1:8080\n');
  } catch (err) {
    console.error('FATAL PRE-FLIGHT ERROR: ' + err.message);
    process.exit(1);
  }

  // Ingest local firestore.rules
  if (!fs.existsSync(RULES_PATH)) {
    console.error(`FATAL: firestore.rules not found at ${RULES_PATH}`);
    process.exit(1);
  }
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  console.log(`✓ Loaded local rules from: ${RULES_PATH} (${rules.length} bytes)\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const unauthed = () => testEnv.unauthenticatedContext().firestore();
  const studentA = () => testEnv.authenticatedContext('stu_alpha', { role: 'student' }).firestore();
  const studentB = () => testEnv.authenticatedContext('stu_beta', { role: 'student' }).firestore();
  const adminUser = () => testEnv.authenticatedContext('admin_omega', { role: 'admin' }).firestore();

  const results = [];

  async function checkScenario(id, collection, scenarioName, expectedSecurityPolicy, operationFn) {
    let actualAllowed = false;
    let errorMsg = null;
    try {
      await operationFn();
      actualAllowed = true;
    } catch (e) {
      actualAllowed = false;
      errorMsg = e.message;
    }

    const actualOutcome = actualAllowed ? 'ALLOW' : 'DENY';
    let assessment = 'UNKNOWN';

    if (expectedSecurityPolicy === 'DENY') {
      if (actualOutcome === 'DENY') {
        assessment = 'SECURE (Access Denied as Expected)';
      } else {
        assessment = 'VULNERABILITY CONFIRMED (Access Incorrectly Granted)';
      }
    } else if (expectedSecurityPolicy === 'ALLOW') {
      if (actualOutcome === 'ALLOW') {
        assessment = 'FUNCTIONAL (Access Permitted as Expected)';
      } else {
        assessment = 'BROKEN WORKFLOW (Legitimate Access Blocked)';
      }
    }

    results.push({
      id,
      collection,
      scenarioName,
      expected: expectedSecurityPolicy,
      actual: actualOutcome,
      assessment,
    });

    const mark = actualOutcome === expectedSecurityPolicy ? '✓' : '✗';
    console.log(`  [${mark}] ${id} [${collection}] ${scenarioName}: Expected=${expectedSecurityPolicy}, Actual=${actualOutcome} -> ${assessment}`);
  }

  try {
    // ─── COLLECTION 1: /results ────────────────────────────────────────────────
    console.log('\n--- 1. Testing /results ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('results').doc('res_alpha').set({
        studentId: 'stu_alpha',
        testId: 'test_101',
        obtainedMarks: 85,
        totalMarks: 100,
        questionDetails: [{ qId: 'q1', correctAnswer: 'C' }],
      });
    });

    await checkScenario('RES-01', 'results', 'Unauthenticated public read of test results', 'DENY', async () => {
      await unauthed().collection('results').doc('res_alpha').get();
    });

    await checkScenario('RES-02', 'results', 'Student B reading Student A results/answers', 'DENY', async () => {
      await studentB().collection('results').doc('res_alpha').get();
    });

    await checkScenario('RES-03', 'results', 'Student A modifying marks/score', 'DENY', async () => {
      await studentA().collection('results').doc('res_alpha').update({ obtainedMarks: 100 });
    });

    await checkScenario('RES-04', 'results', 'Admin read of test results', 'ALLOW', async () => {
      await adminUser().collection('results').doc('res_alpha').get();
    });

    // ─── COLLECTION 2: /student_attempts ───────────────────────────────────────
    console.log('\n--- 2. Testing /student_attempts ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('student_attempts').doc('att_alpha').set({
        studentId: 'stu_alpha',
        testId: 'test_101',
        answers: { q1: 'A', q2: 'B' },
        status: 'in_progress',
      });
    });

    await checkScenario('ATT-01', 'student_attempts', 'Unauthenticated read of in-progress attempt', 'DENY', async () => {
      await unauthed().collection('student_attempts').doc('att_alpha').get();
    });

    await checkScenario('ATT-02', 'student_attempts', 'Student B reading Student A attempt', 'DENY', async () => {
      await studentB().collection('student_attempts').doc('att_alpha').get();
    });

    await checkScenario('ATT-03', 'student_attempts', 'Student B overwriting Student A answers (Tampering)', 'DENY', async () => {
      await studentB().collection('student_attempts').doc('att_alpha').update({ 'answers.q1': 'D' });
    });

    await checkScenario('ATT-04', 'student_attempts', 'Student B deleting Student A attempt', 'DENY', async () => {
      await studentB().collection('student_attempts').doc('att_alpha').delete();
    });

    await checkScenario('ATT-05', 'student_attempts', 'Student A creating own attempt', 'ALLOW', async () => {
      await studentA().collection('student_attempts').doc('att_alpha_new').set({
        studentId: 'stu_alpha',
        testId: 'test_101',
        answers: {},
      });
    });

    // ─── COLLECTION 3: /feePayments ────────────────────────────────────────────
    console.log('\n--- 3. Testing /feePayments ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('feePayments').doc('pay_alpha').set({
        studentId: 'stu_alpha',
        amount: 25000,
        bankRef: 'HDFC_REF_998877',
        isDeleted: false,
      });
    });

    await checkScenario('FEE-01', 'feePayments', 'Unauthenticated public read of payment records', 'DENY', async () => {
      await unauthed().collection('feePayments').doc('pay_alpha').get();
    });

    await checkScenario('FEE-02', 'feePayments', 'Student B reading Student A payment record', 'DENY', async () => {
      await studentB().collection('feePayments').doc('pay_alpha').get();
    });

    await checkScenario('FEE-03', 'feePayments', 'Student A creating fake payment receipt', 'DENY', async () => {
      await studentA().collection('feePayments').doc('pay_fraud').set({
        studentId: 'stu_alpha',
        amount: 50000,
      });
    });

    await checkScenario('FEE-04', 'feePayments', 'Admin read of payment records', 'ALLOW', async () => {
      await adminUser().collection('feePayments').doc('pay_alpha').get();
    });

    // ─── COLLECTION 4: /leads & /admissions ─────────────────────────────────────
    console.log('\n--- 4. Testing /leads and /admissions ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('leads').doc('lead_alpha').set({
        name: 'Prospective Candidate',
        phone: '9876543210',
        email: 'prospect@example.com',
      });
      await ctx.firestore().collection('admissions').doc('adm_alpha').set({
        studentName: 'Applicant One',
        phone: '9123456780',
        address: '123 Chennai St',
      });
    });

    await checkScenario('CRM-01', 'leads', 'Unauthenticated public read of CRM leads', 'DENY', async () => {
      await unauthed().collection('leads').doc('lead_alpha').get();
    });

    await checkScenario('CRM-02', 'admissions', 'Unauthenticated public read of admission forms', 'DENY', async () => {
      await unauthed().collection('admissions').doc('adm_alpha').get();
    });

    await checkScenario('CRM-03', 'leads', 'Unauthenticated write to leads', 'DENY', async () => {
      await unauthed().collection('leads').doc('lead_new').set({ name: 'Spam' });
    });

    await checkScenario('CRM-04', 'admissions', 'Authenticated student creating admission application', 'ALLOW', async () => {
      await studentA().collection('admissions').doc('adm_stu_a').set({
        studentId: 'stu_alpha',
        course: 'UPSC Prelims',
      });
    });

    // ─── COLLECTION 5: /inquiries ──────────────────────────────────────────────
    console.log('\n--- 5. Testing /inquiries ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('inquiries').doc('inq_alpha').set({
        name: 'Visitor A',
        email: 'visitor@example.com',
        query: 'What is fee structure?',
      });
    });

    await checkScenario('INQ-01', 'inquiries', 'Unauthenticated visitor creating inquiry (Contact Form)', 'ALLOW', async () => {
      await unauthed().collection('inquiries').doc('inq_new').set({
        name: 'New Visitor',
        query: 'Demo session timing',
      });
    });

    await checkScenario('INQ-02', 'inquiries', 'Unauthenticated public read of visitor inquiries', 'DENY', async () => {
      await unauthed().collection('inquiries').doc('inq_alpha').get();
    });

    await checkScenario('INQ-03', 'inquiries', 'Student reading other visitors inquiries', 'DENY', async () => {
      await studentA().collection('inquiries').doc('inq_alpha').get();
    });

    // ─── COLLECTION 6: /system_activity_logs ───────────────────────────────────
    console.log('\n--- 6. Testing /system_activity_logs ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('system_activity_logs').doc('log_admin_01').set({
        action: 'admin_login',
        actor: 'admin_omega',
      });
    });

    await checkScenario('LOG-01', 'system_activity_logs', 'Student creating forged audit log entry', 'DENY', async () => {
      await studentA().collection('system_activity_logs').doc('log_forged').set({
        action: 'fee_exemption_granted',
        targetStudent: 'stu_alpha',
        approvedBy: 'super_admin',
      });
    });

    await checkScenario('LOG-02', 'system_activity_logs', 'Student reading system audit logs', 'DENY', async () => {
      await studentA().collection('system_activity_logs').doc('log_admin_01').get();
    });

    // ─── COLLECTION 7: /profile_requests ───────────────────────────────────────
    console.log('\n--- 7. Testing /profile_requests ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('profile_requests').doc('req_alpha').set({
        userId: 'stu_alpha',
        studentId: 'stu_alpha',
        status: 'pending',
        requestedChanges: { phone: '9999999999' },
      });
    });

    await checkScenario('PRF-01', 'profile_requests', 'Student A creating request with own userId', 'ALLOW', async () => {
      await studentA().collection('profile_requests').doc('req_alpha_new').set({
        userId: 'stu_alpha',
        studentId: 'stu_alpha',
        status: 'pending',
      });
    });

    await checkScenario('PRF-02', 'profile_requests', 'Student A creating request with Student B userId (Spoofing)', 'DENY', async () => {
      await studentA().collection('profile_requests').doc('req_spoof').set({
        userId: 'stu_beta',
        studentId: 'stu_beta',
        status: 'pending',
      });
    });

    await checkScenario('PRF-03', 'profile_requests', 'Student B reading Student A profile request', 'DENY', async () => {
      await studentB().collection('profile_requests').doc('req_alpha').get();
    });

    await checkScenario('PRF-04', 'profile_requests', 'Student A self-approving profile request', 'DENY', async () => {
      await studentA().collection('profile_requests').doc('req_alpha').update({ status: 'approved' });
    });

    await checkScenario('PRF-05', 'profile_requests', 'Student A deleting own profile request', 'DENY', async () => {
      await studentA().collection('profile_requests').doc('req_alpha').delete();
    });

    // ─── COLLECTION 8: /admin_alerts ───────────────────────────────────────────
    console.log('\n--- 8. Testing /admin_alerts ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('admin_alerts').doc('alt_existing').set({
        type: 'profile_submission',
        message: 'Student Alpha submitted profile changes',
      });
    });

    await checkScenario('ALT-01', 'admin_alerts', 'Unauthenticated creation of admin alerts', 'DENY', async () => {
      await unauthed().collection('admin_alerts').doc('alt_spam').set({
        type: 'crm_inquiry',
        message: 'Spam alert',
      });
    });

    await checkScenario('ALT-02', 'admin_alerts', 'Student creating alert with whitelisted type', 'ALLOW', async () => {
      await studentA().collection('admin_alerts').doc('alt_valid').set({
        type: 'offline_test',
        message: 'Request offline test permission',
      });
    });

    await checkScenario('ALT-03', 'admin_alerts', 'Student creating alert with unauthorized arbitrary type', 'DENY', async () => {
      await studentA().collection('admin_alerts').doc('alt_invalid_type').set({
        type: 'root_privilege_override',
        message: 'Malicious alert',
      });
    });

    await checkScenario('ALT-04', 'admin_alerts', 'Student creating whitelisted alert with spoofed admin fields', 'DENY', async () => {
      // Current rules check only 'type in [...]', testing if field spoofing is blocked or permitted
      await studentA().collection('admin_alerts').doc('alt_spoofed').set({
        type: 'profile_submission',
        userId: 'admin_omega',
        status: 'resolved',
        severity: 'critical',
        createdAt: '2020-01-01T00:00:00Z',
        message: 'FORGED: Admin approved without review',
      });
    });

    await checkScenario('ALT-05', 'admin_alerts', 'Student reading admin alert feed', 'DENY', async () => {
      await studentA().collection('admin_alerts').doc('alt_existing').get();
    });

    // ─── COLLECTION 9: /guest_recordings ───────────────────────────────────────
    console.log('\n--- 9. Testing /guest_recordings ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('guest_recordings').doc('rec_demo').set({
        title: 'Demo Class 1',
        url: 'https://example.com/demo.mp4',
      });
    });

    await checkScenario('REC-01', 'guest_recordings', 'Unauthenticated public read of guest recordings', 'ALLOW', async () => {
      await unauthed().collection('guest_recordings').doc('rec_demo').get();
    });

    await checkScenario('REC-02', 'guest_recordings', 'Student deleting guest recording', 'DENY', async () => {
      await studentA().collection('guest_recordings').doc('rec_demo').delete();
    });

    // ─── COLLECTION 10: /questions ─────────────────────────────────────────────
    console.log('\n--- 10. Testing /questions ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('questions').doc('q_secret').set({
        question: 'What is Article 21?',
        correctAnswer: 'Protection of life and personal liberty',
      });
    });

    await checkScenario('QUE-01', 'questions', 'Unauthenticated read of question bank', 'DENY', async () => {
      await unauthed().collection('questions').doc('q_secret').get();
    });

    await checkScenario('QUE-02', 'questions', 'Student read of question bank', 'DENY', async () => {
      await studentA().collection('questions').doc('q_secret').get();
    });

    // ─── COLLECTION 11 & 12: Public Read Overlaps ──────────────────────────────
    console.log('\n--- 11. Testing Overlapping Matches (/access_requests & /offlineTestPermissionRequests) ---');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('access_requests').doc('req_overlap_01').set({
        studentId: 'stu_alpha',
        targetCourse: 'Prelims 2026',
      });
      await ctx.firestore().collection('offlineTestPermissionRequests').doc('off_overlap_01').set({
        studentId: 'stu_alpha',
        testId: 'test_offline_01',
      });
    });

    await checkScenario('OVL-01', 'access_requests', 'Unauthenticated public read of access requests (L71 vs L379 overlap)', 'DENY', async () => {
      await unauthed().collection('access_requests').doc('req_overlap_01').get();
    });

    await checkScenario('OVL-02', 'offlineTestPermissionRequests', 'Unauthenticated public read of offline test requests (L310 vs L385 overlap)', 'DENY', async () => {
      await unauthed().collection('offlineTestPermissionRequests').doc('off_overlap_01').get();
    });

  } finally {
    await testEnv.cleanup();
  }

  // ─── Summary Table ─────────────────────────────────────────────────────────
  console.log('\n=================================================================');
  console.log('AUDIT EXECUTION SUMMARY');
  console.log('=================================================================');
  console.table(results.map(r => ({
    ID: r.id,
    Collection: r.collection,
    Scenario: r.scenarioName.slice(0, 40),
    Expected: r.expected,
    Actual: r.actual,
    Assessment: r.assessment.slice(0, 32),
  })));

  const vulns = results.filter(r => r.assessment.includes('VULNERABILITY'));
  console.log(`\nTotal Scenarios Tested: ${results.length}`);
  console.log(`Vulnerabilities Confirmed by Emulator: ${vulns.length}`);
  if (vulns.length > 0) {
    console.log('\nCONFIRMED VULNERABILITIES:');
    vulns.forEach(v => console.log(`  - [${v.id}] ${v.collection}: ${v.scenarioName}`));
  }
}

if (require.main === module) {
  runRulesAudit().catch(err => {
    console.error('Test Harness Exception:', err);
    process.exit(1);
  });
}

module.exports = { runRulesAudit };
