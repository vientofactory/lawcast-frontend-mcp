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
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((item) => item.name).sort(), [
      'get_component',
      'get_design_system',
      'get_style_rules',
      'review_svelte',
    ]);
    for (const tool of tools.tools) assert.equal(tool.annotations.readOnlyHint, true);
    const tokens = await client.callTool({
      name: 'get_design_system',
      arguments: { topic: 'tokens' },
    });
    assert.ok(!tokens.isError);
    assert.ok(tokens.structuredContent.tokens['--lc-text-primary']);
    const component = await client.callTool({
      name: 'get_component',
      arguments: { name: 'ModalShell.svelte' },
    });
    assert.ok(!component.isError);
    assert.match(component.structuredContent.source, /modalFocus/);
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
    assert.equal(invalid.structuredContent.verdict, 'fail');
    const valid = await client.callTool({
      name: 'review_svelte',
      arguments: {
        filename: 'src/routes/notices/[num]/+page.svelte',
        source:
          '<button type="button" data-testid="save" class="lc-button-primary min-h-11">저장</button>',
      },
    });
    assert.ok(!valid.isError);
    assert.equal(valid.structuredContent.verdict, 'pass');
    const oversized = await client.callTool({
      name: 'review_svelte',
      arguments: { source: 'x'.repeat(120001) },
    });
    assert.equal(oversized.isError, true);
    assert.equal((await client.listResources()).resources.length, 5);
    assert.match(
      (await client.readResource({ uri: 'lawcast://design/patterns' })).contents[0].text,
      /one divider owner/,
    );
    assert.equal((await client.listPrompts()).prompts.length, 1);
    assert.match(
      (await client.getPrompt({ name: 'lawcast_ui_change', arguments: { task: '검색 화면 개선' } }))
        .messages[0].content.text,
      /review_svelte/,
    );
  } finally {
    await client.close();
  }
});
