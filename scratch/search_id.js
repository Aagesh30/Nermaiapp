const admin = require('../backend/node_modules/firebase-admin');
const dotenv = require('../backend/node_modules/dotenv');
dotenv.config({ path: './backend/.env' });

let key = process.env.DRIVE_PRIVATE_KEY || '';
if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
key = key.replace(/\\n/g, '\n');

const cert = {
  projectId: process.env.GCP_PROJECT_ID,
  clientEmail: process.env.GCP_CLIENT_EMAIL,
  privateKey: key
};
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cert) });
}
const db = admin.firestore();

async function lookup() {
  const targetId = 'b792db53-471a-4bfd-b9ea-643cc16db8fc';
  console.log('Searching for target ID:', targetId);

  // 1. Search in collections
  const collections = await db.listCollections();
  console.log('Total collections:', collections.map(c => c.id).join(', '));

  for (const col of collections) {
    const name = col.id;
    // Check direct doc
    const directDoc = await col.doc(targetId).get();
    if (directDoc.exists) {
      console.log(`\n>>> DIRECT MATCH DOC in [${name}]:`, JSON.stringify(directDoc.data(), null, 2));
    }

    // Check docs contents
    const snap = await col.get();
    snap.forEach(d => {
      const dataStr = JSON.stringify(d.data());
      if (dataStr.includes(targetId)) {
        console.log(`\n>>> CONTENT MATCH in [${name}] doc id [${d.id}]:`, JSON.stringify(d.data(), null, 2));
      }
    });
  }
}

lookup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
