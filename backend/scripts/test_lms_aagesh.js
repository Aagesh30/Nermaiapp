const { getMyLmsClasses } = require('../dist/modules/students/lms-service');

async function testLmsService() {
  const userId = '80cc9b89-fb4f-4772-bc35-e0c3b85b17f2';

  console.log('--- 2. Testing getMyLmsClasses with default_tenant ---');
  const classesDefault = await getMyLmsClasses(userId, 'default_tenant');
  console.log('Classes with default_tenant:', classesDefault.length);
  classesDefault.forEach(c => console.log(`- ${c.title} (allowed: ${c.access?.allowed})`));

  console.log('--- 3. Testing getMyLmsClasses with nermaiiasacademy-519c8 ---');
  const classesProd = await getMyLmsClasses(userId, 'nermaiiasacademy-519c8');
  console.log('Classes with nermaiiasacademy-519c8:', classesProd.length);
  classesProd.forEach(c => console.log(`- ${c.title} (allowed: ${c.access?.allowed})`));
}

testLmsService().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
