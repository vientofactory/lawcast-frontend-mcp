#!/usr/bin/env node
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { reviewSvelte, MAX_SOURCE_LENGTH } from './review.js';

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('Usage: lawcast-design-check FILE.svelte [FILE_OR_DIRECTORY ...]');
  process.exit(2);
}
const files = new Set();
async function collect(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (
        entry.isSymbolicLink() ||
        ['node_modules', '.git', '.svelte-kit', 'build'].includes(entry.name)
      )
        continue;
      await collect(join(path, entry.name));
    }
  } else if (path.endsWith('.svelte')) files.add(path);
}
try {
  for (const path of paths) await collect(resolve(path));
  if (!files.size) throw new Error('No Svelte files selected.');
  const results = [];
  for (const file of [...files].sort()) {
    if ((await stat(file)).size > MAX_SOURCE_LENGTH * 4)
      throw new Error(`Source too large: ${file}`);
    results.push(reviewSvelte(await readFile(file, 'utf8'), file));
  }
  console.log(JSON.stringify({ results }, null, 2));
  process.exitCode = results.some((item) => item.verdict === 'fail')
    ? 1
    : results.some((item) => item.verdict === 'review')
      ? 2
      : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
