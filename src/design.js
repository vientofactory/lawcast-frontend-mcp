import { readFile } from 'node:fs/promises';
export const snapshot = JSON.parse(
  await readFile(new URL('../design/snapshot.json', import.meta.url), 'utf8'),
);
export const policy = JSON.parse(
  await readFile(new URL('../design/policy.json', import.meta.url), 'utf8'),
);
export function getDesignSystem(topic = 'all') {
  const metadata = {
    frontendVersion: snapshot.frontendVersion,
    commit: snapshot.commit,
    fingerprint: snapshot.fingerprint,
    basis: 'Bundled source snapshot; refresh explicitly after frontend changes.',
    limitations:
      'Static checks are not visual/accessibility certification. MCP advice alone does not block writes; use the CLI gate.',
  };
  const sections = {
    tokens: snapshot.tokens,
    classes: {
      defined: snapshot.classes,
      observed: snapshot.observedClasses,
      note: 'Observed classes include styling hooks, not necessarily CSS definitions.',
    },
    components: snapshot.components,
    patterns: policy.principles,
    rules: { rules: policy.rules, manualChecks: policy.manualChecks },
  };
  return { metadata, ...(topic === 'all' ? sections : { [topic]: sections[topic] }) };
}
export function getComponent(name) {
  const path = snapshot.components.find(
    (path) => path === name || path.slice('src/lib/components/'.length) === name,
  );
  if (!path)
    throw new Error(
      'Unknown component. Use the exact relative name from get_design_system(components).',
    );
  return {
    path,
    ...snapshot.sources[path],
    note: 'Reference source, not standalone code. Resolve its #lib/component dependencies in the frontend. Existing legacy exceptions are not permission to introduce new violations.',
  };
}

export function getStyleRules(query) {
  const matches = snapshot.cssRules.filter((rule) => rule.selector.includes(query));
  return {
    query,
    total: matches.length,
    rules: matches.slice(0, 30),
    fingerprint: snapshot.fingerprint,
    note: 'Source order retained per file. layout.css is imported after app.css. This is not a computed cascade; inspect context, specificity and important.',
  };
}
