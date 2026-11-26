import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');

test('keeps the MCP README focused on installation and tool usage', () => {
  for (const text of [
    'npm@11.13.0 ci',
    '[mcp_servers.lawcast_frontend]',
    'src/server.js',
    'get_design_system',
    'get_style_rules',
    'get_component',
    'review_svelte',
    'npm run check --',
    'npm run snapshot --',
  ]) {
    assert.ok(readme.includes(text), text);
  }
});

test('keeps design prescriptions and PR required-check policy out of README', () => {
  assert.doesNotMatch(
    readme,
    /\blc-[a-z-]+|```svelte|Required checks|PR 필수 체크|브랜치 보호|## 통합 목록|## 테스트 작성/,
  );
});

test('links to policy owners instead of copying their rules', () => {
  assert.ok(readme.includes('(design/policy.json)'));
  assert.ok(readme.includes('(design/analysis.md)'));
});
