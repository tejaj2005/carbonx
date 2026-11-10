import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(
    'CarbonX requires Node.js 22.13 or newer. Install Node.js LTS, then run this launcher again.',
  );
  process.exit(1);
}
if (!fs.existsSync('node_modules')) {
  console.log('Installing CarbonX dependencies…');
  const p = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (p.status) process.exit(p.status || 1);
}
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '',
  port = Number(env.match(/^PORT\s*=\s*(\d+)/m)?.[1] || 8765),
  url = 'http://127.0.0.1:' + port;
async function healthy() {
  try {
    const r = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1500) });
    const b = await r.json();
    return b.app === 'carbonx';
  } catch {
    return false;
  }
}
if (!(await healthy())) {
  console.log('Building CarbonX…');
  const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (build.status) process.exit(build.status || 1);
  fs.mkdirSync('.local', { recursive: true });
  const log = fs.openSync('.local/server.log', 'a');
  const child = spawn(
    process.execPath,
    ['--env-file-if-exists=.env', 'server/index.mjs', '--production'],
    { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] },
  );
  fs.writeFileSync('.local/server.pid', String(child.pid));
  child.unref();
  fs.closeSync(log);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (await healthy()) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    console.error(
      'CarbonX could not start. Inspect .local/server.log. Another application may be using port ' +
        port +
        '.',
    );
    process.exit(1);
  }
}
console.log('CarbonX is available at ' + url);
if (process.platform === 'win32')
  spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }).unref();
else console.log('Open ' + url + ' in your browser.');
