import {mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const cli = (...args) => spawnSync(process.execPath, ['packages/cli/index.mjs', ...args], {encoding: 'utf8', timeout: 60000, env: {...process.env, INCIDENTSUTRA_TOKEN: ''}});
export async function withTmp(fn, prefix = 'is-') {
  const t = await mkdtemp(path.join(tmpdir(), prefix));
  try { return await fn(t); } finally { await rm(t, {recursive: true, force: true}); }
}
// Returns false when the host forbids symlinks (Windows without Developer Mode); tests then return early.
export async function trySymlink(target, link) {
  try { await symlink(target, link); return true; } catch (e) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(e.code)) return false; throw e; }
}
