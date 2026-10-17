const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../friend/nermaiias-firebase-adminsdk-fbsvc-fac3f23397.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const snap = await db.collection('admin_alerts').where('isDismissed', '==', false).get();
  console.log('Total active alerts in admin_alerts:', snap.size);
  for (const d of snap.docs) {
    const data = d.data();
    console.log('ALERT_DOC_ID:', d.id);
    console.log('  TYPE:', data.type);
    console.log('  SOURCE_ID:', data.sourceDocId);
    console.log('  TITLE:', data.title);
    console.log('  SUBTITLE:', data.subtitle);
    if (data.sourceCollection && data.sourceDocId) {
      const src = await db.collection(data.sourceCollection).doc(data.sourceDocId).get();
      console.log('  SOURCE_DOC_EXISTS:', src.exists, 'STATUS:', src.exists ? src.data().status : 'NONE');
    }
  }
  process.exit(0);
}
check().catch(console.error);
