import { readFile, readdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = await realpath(resolve(process.argv[2] ?? resolve(root, '../frontend')));
const files = [];
async function collect(directory) {
  for (const entry of (await readdir(resolve(frontend, directory), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name, 'en'),
  )) {
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed: ${path}`);
    if (entry.isDirectory()) await collect(path);
    else if (path.endsWith('.svelte')) files.push(path);
  }
}
await collect('src/lib/components');
files.push(
  'src/app.css',
  'src/lib/styles/layout.css',
  'src/routes/+layout.svelte',
  'src/lib/theme.ts',
  ...[
    'modal-focus.ts',
    'modal-motion.ts',
    'disclosure-motion.ts',
    'notifications.ts',
    'request-failure.ts',
  ].map((name) => `src/lib/utils/${name}`),
);
const sources = {};
const classes = new Set();
const observedClasses = new Set();
const tokens = {};
const cssRules = [];
for (const path of files.sort()) {
  const resolved = await realpath(resolve(frontend, path));
  if (!resolved.startsWith(`${frontend}/`)) throw new Error(`Path escaped frontend: ${path}`);
  const source = await readFile(resolved, 'utf8');
  sources[path] = { sha256: createHash('sha256').update(source).digest('hex'), source };
  for (const match of source.matchAll(/\blc-[a-z][a-z0-9-]*\b/g)) observedClasses.add(match[0]);
  if (!path.endsWith('.css')) continue;
  const css = postcss.parse(source, { from: path });
  css.walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\.((?:lc-)[\w-]+)/g)) classes.add(match[1]);
    const declarations = [];
    rule.each((decl) => {
      if (decl.type !== 'decl') return;
      const item = {
        property: decl.prop,
        value: decl.value,
        important: Boolean(decl.important),
        line: decl.source.start.line,
      };
      declarations.push(item);
      if (decl.prop.startsWith('--lc-')) {
        (tokens[decl.prop] ??= []).push({
          selector: rule.selector,
          value: decl.value,
          path,
          line: item.line,
        });
      }
    });
    cssRules.push({
      selector: rule.selector,
      context: rule.parent.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}` : null,
      declarations,
      path,
      line: rule.source.start.line,
    });
  });
}
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', frontend, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  /* Source hashes remain authoritative without Git. */
}
const snapshot = {
  schemaVersion: 1,
  frontendVersion: JSON.parse(await readFile(resolve(frontend, 'package.json'), 'utf8')).version,
  commit,
  fingerprint: createHash('sha256')
    .update(JSON.stringify(Object.entries(sources).map(([path, entry]) => [path, entry.sha256])))
    .digest('hex'),
  tokens,
  classes: [...classes].sort(),
  observedClasses: [...observedClasses].sort(),
  cssRules,
  components: files.filter(
    (path) => path.startsWith('src/lib/components/') && path.endsWith('.svelte'),
  ),
  sources,
};
await writeFile(resolve(root, 'design/snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Snapshot: ${snapshot.components.length} components, ${Object.keys(tokens).length} tokens, ${classes.size} classes; ${snapshot.fingerprint}`,
);
