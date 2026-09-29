import { db } from '../infrastructure/firebase';
import { AccessRulesService } from '../modules/access-rules/service';
import { getAccessContext } from '../core/security/AccessCache';

async function testRequestFix() {
  const service = new AccessRulesService();
  const tenantId = 'default_tenant';

  // Seed an offline student who does NOT have recorded access
  const offlineUserId = 'test-offline-student-user-001';
  const offlineStudentId = 'test-offline-student-doc-001';
  const offlineBatch = 'test-offline-batch-43';

  await db.collection('users').doc(offlineUserId).set({
    tenantId,
    role: 'student',
    studentId: offlineStudentId,
  });

  await db.collection('students').doc(offlineStudentId).set({
    tenantId,
    type: 'offline',
    batches: [offlineBatch],
    batchModes: { [offlineBatch]: ['offline'] },
  });

  // Ensure no lingering cache
  const { redisClient } = require('../infrastructure/redis');
  await redisClient.del(`access:${offlineUserId}`);

  console.log('--- 1. Fetch AccessContext for Offline Student ---');
  const ctx = await getAccessContext(offlineUserId, tenantId);
  console.log('ctx.studentTypes:', ctx.studentTypes, 'ctx.batchIds:', ctx.batchIds);

  console.log('\n--- 2. Attempting submitAccessRequest for Offline Student ---');
  try {
    const requestId = await service.submitAccessRequest(
      offlineUserId,
      'verify-class-recorded-001',
      'class',
      'Polity Lecture 1',
      'other',
      'Requesting for study',
      tenantId
    );
    console.log('[SUCCESS ✅] Request created with ID:', requestId);
  } catch (e: any) {
    console.log('[FAIL ❌] Request failed:', e.message);
  }

  // Cleanup
  await db.collection('users').doc(offlineUserId).delete();
  await db.collection('students').doc(offlineStudentId).delete();
  await redisClient.del(`access:${offlineUserId}`);
}

testRequestFix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
