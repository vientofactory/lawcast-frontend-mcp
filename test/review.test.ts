import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { reviewSvelte } from '../src/review.js';
import { getComponent, getDesignSystem, snapshot } from '../src/design.js';

const valid =
  '<button type="button" data-testid="save" class="lc-button-primary min-h-11">저장</button>';
const rules = (source: string): string[] => reviewSvelte(source).findings.map((item) => item.rule);
test('accepts semantic source and preserves Korean UI text', () =>
  assert.equal(reviewSvelte(valid).verdict, 'pass'));
test('reports hard-coded palette with responsive variants', () =>
  assert.ok(
    rules(valid.replace('lc-button-primary', 'sm:hover:bg-blue-500')).includes('raw-color'),
  ));
test('rejects arbitrary colors', () =>
  assert.ok(rules(valid.replace('lc-button-primary', 'bg-[#123456]')).includes('raw-color')));
test('rejects gradients and shadows', () =>
  assert.ok(
    rules(valid.replace('lc-button-primary', 'bg-linear-to-r shadow-xl')).includes('decoration'),
  ));
test('allows shadow removal', () =>
  assert.equal(reviewSvelte(valid.replace('lc-button-primary', 'shadow-none')).verdict, 'pass'));
test('detects unknown classes', () =>
  assert.ok(rules(valid.replace('lc-button-primary', 'lc-invented')).includes('unknown-class')));
test('detects unknown token through nested arbitrary variant', () =>
  assert.ok(
    rules(valid.replace('lc-button-primary', '[&:hover]:text-[var(--lc-invented)]')).includes(
      'unknown-token',
    ),
  ));
test('accepts known semantic token utilities', () =>
  assert.equal(
    reviewSvelte(valid.replace('lc-button-primary', 'hover:text-[var(--lc-text-primary)]')).verdict,
    'pass',
  ));
test('requires test identifiers', () =>
  assert.ok(rules(valid.replace('data-testid="save"', '')).includes('missing-testid')));
test('rejects custom dialogs', () =>
  assert.ok(rules('<dialog open>내용</dialog>').includes('custom-modal')));
test('detects accessibility errors through compiler', () =>
  assert.ok(rules('<img src="/image.png">').includes('svelte')));
test('ignores comments and script strings as markup', () =>
  assert.equal(
    reviewSvelte(`<script>const example = 'bg-red-500';</script><!-- bg-red-500 -->${valid}`)
      .verdict,
    'pass',
  ));
test('detects colors inside local CSS', () =>
  assert.ok(rules(`${valid}<style>button { color: red }</style>`).includes('raw-color')));
test('detects local token redeclarations', () =>
  assert.ok(
    rules(`${valid}<style>button { --lc-text-primary: #fff }</style>`).includes('custom-style'),
  ));
test('allows locally defined classes but requires cascade review', () => {
  const result = reviewSvelte(
    `${valid.replace('lc-button-primary', 'lc-local')}<style>.lc-local {padding:1rem}</style>`,
  );
  assert.equal(result.verdict, 'review');
  assert.ok(!result.findings.some((item) => item.rule === 'unknown-class'));
});
test('detects colors in style directives', () =>
  assert.ok(rules(valid.replace('type="button"', 'style:color="red"')).includes('raw-color')));
test('detects literal violations inside dynamic classes without approving runtime values', () => {
  const result = reviewSvelte(
    `<script>let active = $state(true)</script>${valid.replace('class="lc-button-primary min-h-11"', 'class={active ? "bg-red-500" : "lc-button-primary"}')}`,
  );
  assert.ok(result.findings.some((item) => item.rule === 'raw-color'));
  assert.ok(result.findings.some((item) => item.rule === 'dynamic-style'));
});
test('requires review for spreads', () =>
  assert.ok(
    rules(`<script>let props = $props()</script><button {...props}>확인</button>`).includes(
      'dynamic-style',
    ),
  ));
test('rejects hidden focus', () =>
  assert.ok(
    rules(valid.replace('lc-button-primary', 'focus:outline-none')).includes('focus-hidden'),
  ));
test('rejects legacy props', () =>
  assert.ok(rules(`<script>export let title;</script>${valid}`).includes('legacy-svelte')));
test('rejects malformed Svelte', () => assert.equal(reviewSvelte('<button').verdict, 'fail'));
test('enforces source length limit', () => assert.throws(() => reviewSvelte('x'.repeat(120001))));
test('returns real source hashes and catalogs', () => {
  assert.ok(Object.keys(getDesignSystem('tokens').tokens).length >= 40);
  assert.match(getComponent('ModalShell.svelte').source, /modalFocus/);
  assert.match(snapshot.fingerprint, /^[a-f0-9]{64}$/);
});
test('denies traversal and unknown components', () => {
  for (const name of ['../../.env', '/etc/passwd', 'constructor', 'missing.svelte'])
    assert.throws(() => getComponent(name));
});
test('CLI fails closed with no selected files', () => {
  const result = spawnSync(process.execPath, ['src/cli.js'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});

test('bundled source hashes and fingerprint reproduce exactly', async () => {
  const { createHash } = await import('node:crypto');
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  for (const entry of Object.values(snapshot.sources))
    assert.equal(hash(entry.source), entry.sha256);
  assert.equal(
    hash(
      JSON.stringify(Object.entries(snapshot.sources).map(([path, entry]) => [path, entry.sha256])),
    ),
    snapshot.fingerprint,
  );
});
test('CLI returns one for a violating baseline and zero for semantic source', () => {
  for (const [path, status] of [
    ['verification/ORIGINAL.svelte', 1],
    ['verification/MODIFIED_FILE.svelte', 0],
  ] as const) {
    const result = spawnSync(process.execPath, ['src/cli.js', path], { encoding: 'utf8' });
    assert.equal(result.status, status);
    assert.ok(JSON.parse(result.stdout).results.length === 1);
  }
});
test('style lookup retains real typography declarations', async () => {
  const { getStyleRules } = await import('../src/design.js');
  const result = getStyleRules('.lc-page-title');
  assert.ok(
    result.rules.some((rule) =>
      rule.declarations.some(
        (decl) => decl.property === 'font-size' && decl.value.includes('clamp'),
      ),
    ),
  );
});

test('marks runtime style as review rather than a false literal color error', () => {
  const result = reviewSvelte(
    `<script>let color = $state('red')</script>${valid.replace('type="button"', 'style:color={color}')}`,
  );
  assert.equal(result.verdict, 'review');
  assert.equal(result.errors, 0);
});
test('CLI returns two for runtime review and leaves input unchanged', async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = mkdtempSync(join(tmpdir(), 'lawcast-mcp-'));
  const path = join(directory, 'Dynamic.svelte');
  const source = `<script>let css = $state('lc-button-primary')</script>${valid.replace('class="lc-button-primary min-h-11"', 'class={css}')}`;
  try {
    writeFileSync(path, source);
    const result = spawnSync(process.execPath, ['src/cli.js', path], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).results[0].verdict, 'review');
    assert.equal(readFileSync(path, 'utf8'), source);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('rejects colored or underlined list titles and descendants', () => {
  for (const source of [
    '<a href="/notices/1" data-testid="row" class="lc-list-link hover:text-[var(--lc-text-accent)]">Title</a>',
    '<h2 class="lc-list-title lc-link">Title</h2>',
    '<h2 class="lc-list-title"><a href="/notices/1" data-testid="title" class="lc-link">Title</a></h2>',
    '<h2 class="lc-list-title underline">Title</h2>',
    '<a href="/notices/1" data-testid="row" class="lc-list-link"><span class="group-hover:translate-x-0.5">Arrow</span></a>',
    '<a href="/notices/1" data-testid="row" class="lc-card-list-link">Title</a>',
  ])
    assert.ok(rules(source).includes('list-interaction'), source);
});
test('accepts neutral list links and leaves ordinary prose links distinct', () => {
  const source =
    '<a href="/notices/1" data-testid="row" class="lc-list-link"><h2 class="lc-list-title">Title</h2></a>';
  assert.equal(reviewSvelte(source).verdict, 'pass');
  assert.ok(
    !rules('<a href="/about" data-testid="about" class="lc-link">About</a>').includes(
      'list-interaction',
    ),
  );
});
test('rejects static and dynamic decorative icon backplates', () => {
  for (const classes of [
    'lc-chip-warning rounded-lg p-2',
    'bg-[var(--lc-surface-hover)]',
    '{active ? "lc-chip-blue" : "lc-text-primary"}',
  ]) {
    const value = classes.startsWith('{') ? classes : `"${classes}"`;
    const source = `<script>import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; let active = $state(true)</script><span class=${value}><FontAwesomeIcon icon="bell" /></span>`;
    assert.ok(rules(source).includes('icon-backplate'), classes);
  }
});
test('preserves status labels and icon button hit areas', () => {
  const source = `<script>import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';</script><span class="lc-chip-warning"><FontAwesomeIcon icon="bell" />보존</span><button data-testid="close" aria-label="Close" class="lc-button-neutral min-h-11"><FontAwesomeIcon icon="xmark" /></button>`;
  assert.ok(!rules(source).includes('icon-backplate'));
});
test('bundles current neutral list and unboxed icon guidance', async () => {
  const patterns = getDesignSystem('patterns').patterns;
  assert.ok(patterns.some((item) => item.id === 'list-interaction'));
  assert.ok(patterns.some((item) => item.id === 'icon-backplate'));
  assert.ok(snapshot.classes.includes('lc-list-link'));
  assert.ok(!snapshot.classes.includes('lc-icon-accent-success'));
  assert.ok(snapshot.sources['src/routes/notices/changes/+page.svelte']);
  assert.ok(!getComponent('RecentNotices.svelte').source.includes('lc-icon-accent-success'));
});

test('list rows have no pointer-hover rules and preserve button hover and keyboard focus', () => {
  const listRules = snapshot.cssRules.filter((rule) => /\.lc-flat-list-row/.test(rule.selector));
  assert.deepEqual(
    listRules.filter((rule) => rule.selector.includes(':hover')),
    [],
  );
  assert.ok(
    snapshot.cssRules.some(
      (rule) =>
        rule.selector.includes('.lc-result-action-secondary:hover') &&
        rule.declarations.some((decl) => decl.property === 'background'),
    ),
  );
  assert.ok(
    listRules.some(
      (rule) =>
        rule.selector.includes(':focus-visible') &&
        rule.declarations.some((decl) => decl.property === 'background'),
    ),
  );
  assert.ok(
    snapshot.cssRules.some(
      (rule) =>
        rule.selector.includes('.lc-list-link:focus-visible') &&
        rule.declarations.some((decl) => decl.property === 'outline'),
    ),
  );
});
