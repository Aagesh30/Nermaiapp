const { spawnSync } = require('child_process');
const path = require('path');

process.env.NODE_OPTIONS = '--max-old-space-size=8192';
process.env.MAX_WORKERS = '2';

console.log('[Build] Starting Expo web export with 8GB heap and 2 max workers...');
const cliPath = path.resolve(__dirname, '../node_modules/expo/bin/cli');
const res = spawnSync(process.execPath, ['--max-old-space-size=8192', cliPath, 'export', '-p', 'web'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=8192',
    MAX_WORKERS: '2'
  },
  cwd: path.resolve(__dirname, '..')
});

if (res.status !== 0) {
  process.exit(res.status || 1);
}

console.log('[Build] Copying unhashed fonts...');
require('./copy-unhashed-fonts.js');
console.log('[Build] Web build completed successfully!');
