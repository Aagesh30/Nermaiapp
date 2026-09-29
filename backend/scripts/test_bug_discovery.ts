import { db } from '../infrastructure/firebase';
import { getAccessContext } from '../core/security/AccessCache';

async function testBothIds() {
  const userDocId = '80cc9b89-fb4f-4772-bc35-e0c3b85b17f2';
  const studentDocId = '56f7e585-cc8e-4b2e-87e2-a50645c09286';
  const tenantId = 'default_tenant';

  console.log('--- 1. Testing AccessContext with User Doc ID ---');
  const ctxUser = await getAccessContext(userDocId, tenantId);
  console.log('User ID ctx studentTypes:', ctxUser.studentTypes, 'batchIds:', ctxUser.batchIds);

  console.log('--- 2. Testing AccessContext with Student Doc ID ---');
  const ctxStudent = await getAccessContext(studentDocId, tenantId);
  console.log('Student ID ctx studentTypes:', ctxStudent.studentTypes, 'batchIds:', ctxStudent.batchIds);
}

testBothIds().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
