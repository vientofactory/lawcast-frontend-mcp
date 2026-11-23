import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const mode = process.argv[2];
if (!['baseline', 'modified', 'rollback'].includes(mode))
  throw new Error('Use baseline, modified or rollback.');
let path = `verification/${mode === 'baseline' ? 'ORIGINAL' : 'MODIFIED_FILE'}.svelte`;
if (mode === 'rollback') {
  path = 'verification/rollback-copy.svelte';
  copyFileSync('verification/MODIFIED_FILE.svelte', path);
  const rollback = spawnSync('verification/ROLLBACK.sh', [path], { encoding: 'utf8' });
  if (rollback.status !== 0) throw new Error(rollback.stderr);
  if (!readFileSync(path).equals(readFileSync('verification/ORIGINAL.svelte')))
    throw new Error('Rollback hash mismatch.');
}
const result = spawnSync(process.execPath, ['src/cli.js', path], { encoding: 'utf8' });
if (!result.stdout) throw new Error(result.stderr);
const report = JSON.parse(result.stdout).results[0];
const expected = mode === 'modified' ? 'pass' : 'fail';
if (report.verdict !== expected || result.status !== (mode === 'modified' ? 0 : 1))
  throw new Error(`Unexpected result: ${result.stdout}`);
const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
console.log(
  `${mode.toUpperCase()}: verdict=${report.verdict} errors=${report.errors} checker_exit=${result.status} sha256=${hash}`,
);
