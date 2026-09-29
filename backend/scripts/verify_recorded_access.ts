/**
 * verify_recorded_access.ts
 *
 * Verifies the 7-case access matrix for LMS Recorded Classes after the 3-bug fix.
 * Sets up synthetic Firestore + Redis state, calls getMyLmsClasses(), and checks
 * that the `access.allowed` field matches the expected values.
 *
 * Expected matrix:
 *   1. offline student           → FALSE
 *   2. live/online student       → FALSE
 *   3. recorded batch            → TRUE
 *   4. offline + online          → FALSE
 *   5. offline + recorded        → TRUE
 *   6. online + recorded         → TRUE
 *   7. all three                 → TRUE
 */

import { db } from '../infrastructure/firebase';
import { redisClient } from '../infrastructure/redis';
import { getMyLmsClasses } from '../modules/students/lms-service';

const tenantId = 'nermaiiasacademy-519c8';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding test data...\n');

  // One shared class that all test users should see (batch-agnostic, recorded type)
  const classId = 'verify-class-recorded-001';
  await db.collection('classes').doc(classId).set({
    tenantId,
    title: 'Polity — Recorded Lecture 1',
    classType: 'recorded',
    isDeleted: false,
    accessLevel: 'premium',
    targetBatchIds: [],   // open to all enrolled students
    recordingUrl: 'https://www.youtube.com/watch?v=test',
  });

  // Batch UUIDs
  const recordedBatchUUID = 'verify-batch-uuid-recorded';
  const offlineBatchUUID  = 'verify-batch-uuid-offline';

  // Recorded batch capability (canAccessRecordedClasses: true)
  await db.collection('batch_capabilities').doc(recordedBatchUUID).set({
    tenantId,
    batchType: 'recorded',
    canAccessLiveClasses: false,
    canAccessRecordedClasses: true,
    canAccessNotes: true,
    canAccessAssignments: true,
    canAccessTests: true,
  });

  // Offline batch capability (canAccessRecordedClasses: false)
  await db.collection('batch_capabilities').doc(offlineBatchUUID).set({
    tenantId,
    batchType: 'offline',
    canAccessLiveClasses: false,
    canAccessRecordedClasses: false,
    canAccessNotes: true,
    canAccessAssignments: true,
    canAccessTests: true,
  });

  // Helper: build a user + student pair with specified batchModes
  async function seedUser(
    userId: string,
    label: string,
    batchUUID: string,
    batchModes: Record<string, string[]>,
    primaryType: string
  ) {
    const studentId = `${userId}-student`;
    await db.collection('users').doc(userId).set({
      tenantId,
      role: 'student',
      studentId,
    });
    await db.collection('students').doc(studentId).set({
      tenantId,
      type: primaryType,
      batches: [batchUUID],
      batchModes,
    });
    // Invalidate any stale AccessCache for this user
    await redisClient.del(`access:${userId}`);
    console.log(`  Seeded: ${label} (${userId})`);
  }

  // 1. Offline only (in offline batch, offline studentType)
  await seedUser('verify-user-1--offline-student',   'offline student',   offlineBatchUUID, { [offlineBatchUUID]: ['offline'] },           'offline');
  // 2. Online only (in offline batch, online studentType)
  await seedUser('verify-user-2--live-student',      'live student',      offlineBatchUUID, { [offlineBatchUUID]: ['online'] },            'online');
  // 3. Recorded only (in recorded batch, recorded studentType)
  await seedUser('verify-user-3--recorded-batch',    'recorded batch',    recordedBatchUUID,{ [recordedBatchUUID]: ['recorded'] },        'recorded');
  // 4. Offline + Online (in offline batch, offline+online studentType)
  await seedUser('verify-user-4--offline---online',  'offline + online',  offlineBatchUUID, { [offlineBatchUUID]: ['offline', 'online'] }, 'offline');
  // 5. Offline + Recorded (in offline batch, but offline+recorded studentType)
  await seedUser('verify-user-5--offline---recorded','offline + recorded',offlineBatchUUID, { [offlineBatchUUID]: ['offline', 'recorded'] },'offline');
  // 6. Online + Recorded (in offline batch, but online+recorded studentType)
  await seedUser('verify-user-6--online---recorded', 'online + recorded', offlineBatchUUID, { [offlineBatchUUID]: ['online', 'recorded'] }, 'online');
  // 7. All three (in offline batch, but all 3 studentTypes)
  await seedUser('verify-user-7--all-three',         'all three',         offlineBatchUUID, { [offlineBatchUUID]: ['offline', 'online', 'recorded'] }, 'offline');

  console.log('\nSeeding complete.\n');
}

async function cleanup() {
  const classId = 'verify-class-recorded-001';
  const recordedBatchUUID = 'verify-batch-uuid-recorded';
  const offlineBatchUUID  = 'verify-batch-uuid-offline';

  await db.collection('classes').doc(classId).delete();
  await db.collection('batch_capabilities').doc(recordedBatchUUID).delete();
  await db.collection('batch_capabilities').doc(offlineBatchUUID).delete();

  for (let i = 1; i <= 7; i++) {
    const userId = `verify-user-${i}--${['offline-student','live-student','recorded-batch','offline---online','offline---recorded','online---recorded','all-three'][i-1]}`;
    const studentId = `${userId}-student`;
    await db.collection('users').doc(userId).delete();
    await db.collection('students').doc(studentId).delete();
    await redisClient.del(`access:${userId}`);
  }
  console.log('\nCleanup complete.');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=================================================');
  console.log(' VERIFYING LMS RECORDED PAGE ACCESS RULES MATRIX');
  console.log('=================================================');

  await seed();

  const cases: Array<{ userId: string; label: string; expected: boolean }> = [
    { userId: 'verify-user-1--offline-student',   label: 'offline student       ', expected: false },
    { userId: 'verify-user-2--live-student',      label: 'live student          ', expected: false },
    { userId: 'verify-user-3--recorded-batch',    label: 'recorded batch        ', expected: true  },
    { userId: 'verify-user-4--offline---online',  label: 'offline + online      ', expected: false },
    { userId: 'verify-user-5--offline---recorded',label: 'offline + recorded    ', expected: true  },
    { userId: 'verify-user-6--online---recorded', label: 'online + recorded     ', expected: true  },
    { userId: 'verify-user-7--all-three',         label: 'all three             ', expected: true  },
  ];

  let passed = 0;
  let failed = 0;

  console.log('--- 1. Testing getMyLmsClasses() (Recorded Page Listing) ---');
  for (let i = 0; i < cases.length; i++) {
    const { userId, label, expected } = cases[i];
    try {
      const classes = await getMyLmsClasses(userId, tenantId);
      const actual = classes.length > 0 && classes[0].access?.allowed === true;
      const ok = actual === expected;
      if (ok) {
        passed++;
        console.log(`[PASS ✅] ${i + 1}. ${label} -> Expected: ${expected ? 'TRUE ' : 'FALSE'} | Actual: ${actual ? 'TRUE ' : 'FALSE'}`);
      } else {
        failed++;
        console.log(`[FAIL ❌] ${i + 1}. ${label} -> Expected: ${expected ? 'TRUE ' : 'FALSE'} | Actual: ${actual ? 'TRUE ' : 'FALSE'}`);
      }
    } catch (e: any) {
      failed++;
      console.log(`[ERROR ❌] ${i + 1}. ${label} -> ${e.message}`);
    }
  }

  console.log('\n--- 2. Testing SACS evaluateEntityAccess() (Player Token Issue) ---');
  const { AccessRulesService } = require('../modules/access-rules/service');
  const sacs = new AccessRulesService();
  const classId = 'verify-class-recorded-001';

  for (let i = 0; i < cases.length; i++) {
    const { userId, label, expected } = cases[i];
    try {
      const decision = await sacs.evaluateEntityAccess(userId, classId, 'class', tenantId);
      const actual = decision.allowed;
      const ok = actual === expected;
      if (ok) {
        passed++;
        console.log(`[PASS ✅] ${i + 1}. ${label} -> Expected: ${expected ? 'TRUE ' : 'FALSE'} | Actual: ${actual ? 'TRUE ' : 'FALSE'}`);
      } else {
        failed++;
        console.log(`[FAIL ❌] ${i + 1}. ${label} -> Expected: ${expected ? 'TRUE ' : 'FALSE'} | Actual: ${actual ? 'TRUE ' : 'FALSE'} | Msg: ${decision.lockMessage}`);
      }
    } catch (e: any) {
      failed++;
      console.log(`[ERROR ❌] ${i + 1}. ${label} -> ${e.message}`);
    }
  }

  console.log('-------------------------------------------------');
  console.log(`RESULTS: ${passed} / ${cases.length * 2} PASSED`);
  console.log('=================================================');

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
