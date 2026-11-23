import { parse, compile } from 'svelte/compiler';
import postcss from 'postcss';
import { snapshot, policy } from './design.js';

export const MAX_SOURCE_LENGTH = 120_000;
function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'loc' && value && typeof value === 'object') stack.push(value);
    }
  }
}
function strings(value) {
  const result = [];
  walk(value, (node) => {
    if (node.type === 'Text') result.push(node.data);
    if (node.type === 'Literal' && typeof node.value === 'string') result.push(node.value);
    if (node.type === 'TemplateElement') result.push(node.value.cooked ?? node.value.raw);
  });
  return result.join(' ');
}
function isDynamic(value) {
  let dynamic = false;
  walk(value, (node) => {
    if (node.type === 'ExpressionTag') dynamic = true;
  });
  return dynamic;
}
function baseUtility(value) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '[' || value[i] === '(') depth++;
    if (value[i] === ']' || value[i] === ')') depth--;
    if (value[i] === ':' && depth === 0) start = i + 1;
  }
  return value.slice(start).replace(/^!|!$/g, '');
}
export function reviewSvelte(source, filename = 'Component.svelte') {
  if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH)
    throw new Error(`Source must be a string of at most ${MAX_SOURCE_LENGTH} characters.`);
  const findings = [];
  const seen = new Set();
  const add = (rule, message, offset = 0) => {
    const definition = policy.rules.find((item) => item.id === rule);
    const line = source.slice(0, offset).split('\n').length;
    const key = `${rule}:${line}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ rule, severity: definition.severity, line, message, fix: definition.fix });
  };
  let ast;
  try {
    ast = parse(source, { modern: true });
  } catch (error) {
    add('svelte', `${error.code ?? 'parse'}: ${error.message}`, error.position?.[0] ?? 0);
  }
  if (ast) {
    const localClasses = new Set();
    const checkCss = (text, offset, inline = false) => {
      try {
        const css = postcss.parse(inline ? `x{${text}}` : text);
        css.walkRules((rule) => {
          for (const match of rule.selector.matchAll(/\.(lc-[\w-]+)/g)) localClasses.add(match[1]);
        });
        css.walkDecls((decl) => {
          const position = offset + Math.max(0, decl.source.start.offset - (inline ? 2 : 0));
          if (/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i.test(decl.value))
            add('raw-color', `Hard-coded color in ${decl.prop}: ${decl.value}`, position);
          else if (
            /^(?:color|background(?:-color)?|(?:border|outline)(?:-(?:top|right|bottom|left))?-color|fill|stroke)$/.test(
              decl.prop,
            ) &&
            !/^(?:var\(--lc-[\w-]+\)|transparent|currentColor|inherit|initial|unset|none|revert)$/i.test(
              decl.value,
            )
          )
            add('raw-color', `Non-semantic ${decl.prop}: ${decl.value}`, position);
          if (
            /(?:gradient|blur)\(/i.test(decl.value) ||
            (/^(?:box-shadow|text-shadow)$/.test(decl.prop) && decl.value !== 'none')
          )
            add('decoration', `Decorative ${decl.prop}: ${decl.value}`, position);
          if (
            (decl.prop === 'outline' ||
              decl.prop === 'outline-style' ||
              decl.prop === 'outline-width') &&
            /^(none|0(?:px)?)$/.test(decl.value)
          )
            add('focus-hidden', 'Focus outline suppressed.', position);
          for (const match of decl.value.matchAll(/var\(\s*(--lc-[\w-]+)/g))
            if (!Object.hasOwn(snapshot.tokens, match[1]))
              add('unknown-token', `Unknown token ${match[1]}.`, position);
          if (decl.prop.startsWith('--lc-'))
            add(
              'custom-style',
              `Token declaration ${decl.prop} needs design-owner review.`,
              position,
            );
        });
      } catch (error) {
        add('svelte', `CSS: ${error.reason ?? error.message}`, offset);
      }
    };
    if (ast.css) {
      checkCss(source.slice(ast.css.content.start, ast.css.content.end), ast.css.content.start);
      add(
        'custom-style',
        'Component-local CSS requires cascade, layout and theme review.',
        ast.css.start,
      );
    }
    const checkClasses = (text, offset) => {
      for (const value of text.split(/\s+/).filter(Boolean)) {
        const utility = baseUtility(value);
        if (
          utility.startsWith('lc-') &&
          !snapshot.observedClasses.includes(utility) &&
          !localClasses.has(utility)
        )
          add('unknown-class', `Unknown class ${utility}.`, offset);
        if (
          /^(?:(?:text|bg|border|ring|outline|fill|stroke|decoration|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|\/|$)|(?:text|bg|border|ring|outline|fill|stroke)-(?:white|black)(?:\/|$))/.test(
            utility,
          ) ||
          /#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)\(/i.test(utility)
        )
          add('raw-color', `Hard-coded palette utility ${value}.`, offset);
        if (
          /^(?:(?:shadow|drop-shadow|backdrop-blur|blur)(?:-|$)|(?:bg-)?(?:gradient|linear|radial|conic)-)/.test(
            utility,
          ) &&
          !/^(shadow|drop-shadow|backdrop-blur|blur)-none$/.test(utility)
        )
          add('decoration', `Decorative utility ${value}.`, offset);
        if (/^outline-(?:none|hidden|0)$/.test(utility))
          add('focus-hidden', `Focus-suppressing utility ${value}.`, offset);
        if (/^text-(?:xs|\[(?:[0-9]|1[0-3])px\])$/.test(utility))
          add('custom-style', `Small text utility ${value} needs readability review.`, offset);
        if (utility.includes('[') && !utility.includes('var(--lc-'))
          add('custom-style', `Arbitrary utility ${value} needs review.`, offset);
        for (const match of utility.matchAll(/var\(\s*(--lc-[\w-]+)/g))
          if (!Object.hasOwn(snapshot.tokens, match[1]))
            add('unknown-token', `Unknown token ${match[1]}.`, offset);
      }
    };
    walk(ast.fragment, (node) => {
      if (node.type === 'HtmlTag')
        add('dynamic-style', 'Raw HTML requires content and design review.', node.start);
      if (!node.attributes) return;
      if (node.type === 'SvelteElement')
        add('dynamic-style', 'Dynamic element requires runtime review.', node.start);
      for (const attr of node.attributes) {
        if (attr.type === 'SpreadAttribute')
          add(
            'dynamic-style',
            'Spread attributes may override classes, style or semantics.',
            attr.start,
          );
        if (attr.type === 'ClassDirective') checkClasses(attr.name, attr.start);
        if (attr.name === 'class' || attr.type === 'ClassDirective') {
          checkClasses(strings(attr.value), attr.start);
          if (isDynamic(attr.value))
            add('dynamic-style', 'Dynamic class expression requires runtime review.', attr.start);
        }
        if (attr.name === 'style' || attr.type === 'StyleDirective') {
          const text = strings(attr.value);
          if (!isDynamic(attr.value)) {
            checkCss(
              attr.type === 'StyleDirective' ? `${attr.name}:${text}` : text,
              attr.start,
              true,
            );
          }
          if (isDynamic(attr.value))
            add('dynamic-style', 'Dynamic style requires runtime review.', attr.start);
        }
      }
      if (node.type !== 'RegularElement') return;
      const attrs = new Map(node.attributes.map((attr) => [attr.name, attr]));
      if (node.name === 'dialog' || strings(attrs.get('role')?.value) === 'dialog')
        add('custom-modal', 'Custom dialog detected.', node.start);
      if (
        ['button', 'a', 'input', 'select', 'textarea', 'summary', 'main', 'nav', 'form'].includes(
          node.name,
        ) &&
        !attrs.has('data-testid')
      )
        add('missing-testid', `<${node.name}> has no data-testid.`, node.start);
    });
    for (const script of [ast.instance, ast.module].filter(Boolean)) {
      walk(script.content, (node) => {
        if (
          (node.type === 'LabeledStatement' && node.label.name === '$') ||
          (node.type === 'ExportNamedDeclaration' && node.declaration?.kind === 'let')
        )
          add('legacy-svelte', 'Legacy reactive/props syntax detected.', node.start);
      });
    }
    if (source.includes('svelte-ignore'))
      add(
        'custom-style',
        'Compiler suppression requires independent accessibility review.',
        source.indexOf('svelte-ignore'),
      );
    try {
      const result = compile(source, { filename, generate: 'server', modernAst: true });
      for (const warning of result.warnings)
        if (warning.code.startsWith('a11y_'))
          add('svelte', `${warning.code}: ${warning.message}`, warning.start?.character ?? 0);
    } catch (error) {
      add('svelte', `${error.code ?? 'compile'}: ${error.message}`, error.position?.[0] ?? 0);
    }
  }
  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  const errors = findings.filter((item) => item.severity === 'error').length;
  const reviews = findings.filter((item) => item.severity === 'review').length;
  return {
    filename,
    verdict: errors ? 'fail' : reviews ? 'review' : 'pass',
    errors,
    reviews,
    findings,
    fingerprint: snapshot.fingerprint,
    manualChecks: policy.manualChecks,
    scope:
      'Static Svelte source checks only; pass does not certify rendered UX or all Tailwind/custom component behavior.',
  };
}
