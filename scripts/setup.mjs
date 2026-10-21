import { readFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = readFileSync(join(root, 'game_platform.zip'));
const hash = createHash('sha256').update(archive).digest('hex');
const expected = readFileSync(join(root, 'platform.sha256'), 'utf8').trim();
if (hash !== expected) throw new Error('Platform archive checksum changed. Review and update platform.sha256 intentionally.');
const dest = join(root, '.platform');
if (!existsSync(join(dest, 'package.json'))) {
  const files = unzipSync(archive);
  for (const [name, data] of Object.entries(files)) {
    const relative = name.split('/').slice(1).join('/');
    if (!relative || name.endsWith('/')) continue;
    const path = resolve(dest, relative);
    if (!path.startsWith(dest + sep)) throw new Error('Unsafe archive entry');
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data);
    if (path.endsWith('.sh') || path.endsWith('/gradlew')) chmodSync(path, 0o755);
  }
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dest, stdio: 'inherit', shell: process.platform === 'win32' });
console.log('AUTO QUIZ: pinned game_platform ready. Run npm run dev.');
