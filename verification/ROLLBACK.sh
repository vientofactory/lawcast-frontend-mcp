#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node --input-type=module - "$HERE" "${1:?Usage: ROLLBACK.sh TARGET_COPY.svelte}" <<'JS'
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const [directory, targetArgument] = process.argv.slice(2);
const target = resolve(targetArgument);
const modified = join(directory, 'MODIFIED_FILE.svelte');
if (target === modified || lstatSync(target).isSymbolicLink()) throw new Error('Use a separate regular copy.');
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
if (digest(target) !== digest(modified)) throw new Error('Target differs from the verified modified fixture.');
writeFileSync(target, readFileSync(join(directory, 'ORIGINAL.svelte')));
console.log('Restored original fixture.');
JS
