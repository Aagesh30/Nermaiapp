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
admin.initializeApp({ credential: admin.credential.cert(cert) });

const { getMyLmsResources } = require('../backend/modules/students/lms-service');

async function run() {
  const arunUserId = '0fcb650c-bec9-4fe0-a5dd-fd68326b3185';
  const tenantId = 'default_tenant';
  const res = await getMyLmsResources(arunUserId, tenantId);
  console.log('getMyLmsResources for Arun count:', res.length);
  res.forEach(r => console.log(' ->', r.title, { vis: r.visibility, targetBatchIds: r.targetBatchIds }));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
