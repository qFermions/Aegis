'use strict';
require('../../adapters/socket-tripwire.js');
// session.test.js: the helper the entrypoints use to load the aegis-tools server into a sealed session (batch 12).
//
// EXPECTED DECISION (written before the helper)
// - SERVER_NAME is 'aegis-tools'; TOOL_NAMES are the four names the claude CLI shows for its tools,
//   mcp__aegis-tools__<tool>, the same four the server lists.
// - mcpConfig({ auditFile }) is the JSON text for --mcp-config: one stdio server, this Node binary running the
//   server file by its absolute path, with --audit <absolute file> when a file is given and no --audit when not.
//   No env block: no environment value is copied into the command line.
// Run: node --test scripts/mcp/aegis-tools/session.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const session = () => require('./session.js');

// Wrong implementations it catches: names that drift from what the server lists (the CLI would allow a tool that
// does not exist and block the real one), a name with the wrong separator (mcp__aegis_tools__...), a fifth name.
test('TOOL_NAMES are the four mcp__aegis-tools__ names, the same four the server lists', async () => {
  const { SERVER_NAME, TOOL_NAMES } = session();
  assert.equal(SERVER_NAME, 'aegis-tools');
  assert.deepEqual([...TOOL_NAMES], ['mcp__aegis-tools__docs_fetch', 'mcp__aegis-tools__net_dns', 'mcp__aegis-tools__net_http', 'mcp__aegis-tools__net_tls']);
  assert.ok(Object.isFrozen(TOOL_NAMES));
  const { createServer } = require('./server.js');
  const listed = await createServer({ resolver: {}, request: () => { throw new Error('no network'); }, tlsConnect: () => { throw new Error('no network'); }, audit: () => {} })
    .handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  assert.deepEqual(listed.result.tools.map((t) => `mcp__${SERVER_NAME}__${t.name}`).sort(), [...TOOL_NAMES].sort());
});

// Wrong implementations it catches: a relative server path (it breaks when the CLI starts from another folder),
// "node" by name instead of this binary (another Node on PATH, or none), an env block that copies a value in,
// --audit with an empty value, a second server.
test('mcpConfig is one stdio server: this Node binary, the server file by absolute path, and --audit only when given', () => {
  const { mcpConfig } = session();
  const withFile = JSON.parse(mcpConfig({ auditFile: path.join('some', 'audit.jsonl') }));
  assert.deepEqual(Object.keys(withFile), ['mcpServers']);
  assert.deepEqual(Object.keys(withFile.mcpServers), ['aegis-tools']);
  const s = withFile.mcpServers['aegis-tools'];
  assert.deepEqual(Object.keys(s).sort(), ['args', 'command', 'type']);
  assert.equal(s.type, 'stdio');
  assert.equal(s.command, process.execPath);
  assert.equal(s.args[0], path.join(__dirname, 'server.js'));
  assert.ok(path.isAbsolute(s.args[0]) && fs.existsSync(s.args[0]));
  assert.deepEqual(s.args.slice(1), ['--audit', path.resolve('some', 'audit.jsonl')]);
  const bare = JSON.parse(mcpConfig({})).mcpServers['aegis-tools'];
  assert.deepEqual(bare.args, [path.join(__dirname, 'server.js')], 'no audit file: the server audits to stderr');
  assert.deepEqual(JSON.parse(mcpConfig()).mcpServers['aegis-tools'].args, bare.args);
  assert.equal(mcpConfig({ auditFile: null }), mcpConfig(), 'the same text every time, so a pinned argv stays pinned');
});
