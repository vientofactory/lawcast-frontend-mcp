import { getDesignSystem, getComponent } from '../src/design.js';
import type { ReviewResult } from '../src/types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('serves tools, resources and prompts over real MCP stdio', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['src/server.js'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'lawcast-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, '0.1.2');
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((item) => item.name).sort(), [
      'get_component',
      'get_design_system',
      'get_style_rules',
      'review_svelte',
    ]);
    for (const tool of tools.tools) assert.equal(tool.annotations?.readOnlyHint, true);
    const tokens = await client.callTool({
      name: 'get_design_system',
      arguments: { topic: 'tokens' },
    });
    assert.ok(!tokens.isError);
    assert.ok(
      (tokens.structuredContent as ReturnType<typeof getDesignSystem<'tokens'>>).tokens[
        '--lc-text-primary'
      ],
    );
    const component = await client.callTool({
      name: 'get_component',
      arguments: { name: 'ModalShell.svelte' },
    });
    assert.ok(!component.isError);
    assert.match(
      (component.structuredContent as ReturnType<typeof getComponent>).source,
      /modalFocus/,
    );
    const patterns = await client.callTool({
      name: 'get_design_system',
      arguments: { topic: 'patterns' },
    });
    const principles = (
      patterns.structuredContent as ReturnType<typeof getDesignSystem<'patterns'>>
    ).patterns;
    assert.ok(principles.some((item) => item.id === 'list-interaction'));
    assert.ok(principles.some((item) => item.id === 'icon-backplate'));
    assert.ok(
      principles.some(
        (item) =>
          item.id === 'playwright-commit-gate' && item.guidance.includes('npm run test:e2e:all'),
      ),
    );
    assert.ok(
      principles.some(
        (item) => item.id === 'test-authoring' && item.guidance.includes('TypeScript .ts'),
      ),
    );
    const styles = await client.callTool({
      name: 'get_style_rules',
      arguments: { query: '.lc-list-link' },
    });
    assert.match(JSON.stringify(styles.structuredContent), /--lc-text-primary/);
    const warningStyles = await client.callTool({
      name: 'get_style_rules',
      arguments: { query: '.lc-flat-list-row .lc-text-warning' },
    });
    assert.match(JSON.stringify(warningStyles.structuredContent), /color-mix/);
    assert.match(JSON.stringify(warningStyles.structuredContent), /--lc-status-warning/);
    const listViolation = await client.callTool({
      name: 'review_svelte',
      arguments: { source: '<h2 class="lc-list-title lc-link">Title</h2>' },
    });
    assert.ok(
      (listViolation.structuredContent as ReviewResult).findings.some(
        (finding) => finding.rule === 'list-interaction',
      ),
    );
    const bareIcons = await client.callTool({
      name: 'get_component',
      arguments: { name: 'RecentNotices.svelte' },
    });
    assert.ok(
      !(bareIcons.structuredContent as ReturnType<typeof getComponent>).source.includes(
        'lc-icon-accent-success',
      ),
    );
    const denied = await client.callTool({
      name: 'get_component',
      arguments: { name: '../../.env' },
    });
    assert.equal(denied.isError, true);
    const invalid = await client.callTool({
      name: 'review_svelte',
      arguments: { source: '<button class="bg-red-500">저장</button>' },
    });
    assert.ok(!invalid.isError);
    assert.equal((invalid.structuredContent as ReviewResult).verdict, 'fail');
    const valid = await client.callTool({
      name: 'review_svelte',
      arguments: {
        filename: 'src/routes/notices/[num]/+page.svelte',
        source:
          '<button type="button" data-testid="save" class="lc-button-primary min-h-11">저장</button>',
      },
    });
    assert.ok(!valid.isError);
    assert.equal((valid.structuredContent as ReviewResult).verdict, 'pass');
    const oversized = await client.callTool({
      name: 'review_svelte',
      arguments: { source: 'x'.repeat(120001) },
    });
    assert.equal(oversized.isError, true);
    assert.equal((await client.listResources()).resources.length, 5);
    const resource = (await client.readResource({ uri: 'lawcast://design/patterns' })).contents[0];
    assert.ok('text' in resource);
    assert.match(resource.text, /one divider owner/);
    assert.equal((await client.listPrompts()).prompts.length, 1);
    const prompt = (
      await client.getPrompt({ name: 'lawcast_ui_change', arguments: { task: '검색 화면 개선' } })
    ).messages[0].content;
    assert.equal(prompt.type, 'text');
    assert.ok('text' in prompt);
    assert.match(prompt.text, /review_svelte/);
    assert.match(client.getInstructions() ?? '', /npm run test:e2e:all/);
    assert.match(prompt.text, /npm run test:e2e:all/);
    assert.match(prompt.text, /PLAYWRIGHT_BACKEND_URL/);
    assert.match(prompt.text, /Do not commit/);
    assert.match(prompt.text, /rerun the entire/);
    assert.match(prompt.text, /--no-verify/);
    assert.match(prompt.text, /static pass does not authorize/);
  } finally {
    await client.close();
  }
});

test('legacy server launcher works outside the package directory', async () => {
  const { resolve } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const client = new Client({ name: 'lawcast-cwd-test', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('src/server.js')],
        cwd: tmpdir(),
        stderr: 'pipe',
      }),
    );
    assert.equal((await client.listTools()).tools.length, 4);
    const result = await client.callTool({
      name: 'get_component',
      arguments: { name: 'ModalShell.svelte' },
    });
    assert.ok(!result.isError);
  } finally {
    await client.close();
  }
});
