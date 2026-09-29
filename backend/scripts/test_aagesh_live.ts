import { db } from '../infrastructure/firebase';
import { getAccessContext } from '../core/security/AccessCache';
import { getMyLmsClasses } from '../modules/students/lms-service';

async function testAagesh() {
  const userId = '80cc9b89-fb4f-4772-bc35-e0c3b85b17f2';
  const tenantId = 'nermaiiasacademy-519c8';

  console.log('--- 1. Testing getAccessContext for User ID ---');
  const ctx = await getAccessContext(userId, tenantId);
  console.log('AccessContext:', JSON.stringify(ctx, null, 2));

  console.log('--- 2. Testing getMyLmsClasses for User ID ---');
  const classes = await getMyLmsClasses(userId, tenantId);
  console.log('Total classes returned:', classes.length);
  classes.forEach(c => {
    console.log(`Class "${c.title}" -> access.allowed = ${c.access?.allowed}`);
  });
}

testAagesh().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
