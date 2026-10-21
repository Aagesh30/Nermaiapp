const fs = require('fs');
const { execSync } = require('child_process');

const envPath = 'backend/.env';
const tempEnvPath = 'backend/.env.temp';

let envExisted = false;

try {
  if (fs.existsSync(envPath)) {
    console.log(`- Temporarily renaming ${envPath} to ${tempEnvPath} to bypass Firebase CLI reserved key restrictions...`);
    fs.renameSync(envPath, tempEnvPath);
    envExisted = true;
  }

  console.log("- Running Firebase Cloud Functions deployment: firebase deploy --only functions --force ...");
  execSync('firebase deploy --only functions --force', { stdio: 'inherit' });
  console.log("✅ Firebase Cloud Functions deployment succeeded!");

} catch (err) {
  console.error("❌ Firebase deployment failed:", err.message);
  process.exitCode = 1;
} finally {
  if (envExisted && fs.existsSync(tempEnvPath)) {
    console.log(`- Restoring ${tempEnvPath} back to ${envPath}...`);
    fs.renameSync(tempEnvPath, envPath);
    console.log("- Restoration complete.");
  }
}
