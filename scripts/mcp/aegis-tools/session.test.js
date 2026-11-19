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

// ── Batch 12d: the typed file ───────────────────────────────────────────────────────────────────────────────────────
// EXPECTED DECISIONS (written before the code)
// - mcpConfig({ auditFile, typedFile }) adds --typed <absolute file> after --audit; with no typedFile the text is as
//   before, byte for byte.
// - typedHooks(typedFile) is the "hooks" value of the chat's inline --settings: one UserPromptSubmit hook in exec form
//   (no shell): this Node binary running typed-hook.js by its absolute path with the typed file as its one argument.
// - writeTyped(file, text, { append }) writes the person's text and a newline: created 0600, never through a symbolic
//   link, truncated unless append is true.

// Wrong implementations it catches: a relative typed path (the server, started by the CLI from the repository root,
// would read another file); --typed before --audit or in the place of it; a typed file that changes the argv of a
// session that has none.
test('batch 12d: mcpConfig adds --typed <absolute file> when a typed file is given, and nothing when not', () => {
  const { mcpConfig } = session();
  const both = JSON.parse(mcpConfig({ auditFile: path.join('run', 'audit.jsonl'), typedFile: path.join('run', 'typed.txt') })).mcpServers['aegis-tools'];
  assert.deepEqual(both.args.slice(1), ['--audit', path.resolve('run', 'audit.jsonl'), '--typed', path.resolve('run', 'typed.txt')]);
  const typedOnly = JSON.parse(mcpConfig({ typedFile: path.join('run', 'typed.txt') })).mcpServers['aegis-tools'];
  assert.deepEqual(typedOnly.args.slice(1), ['--typed', path.resolve('run', 'typed.txt')]);
  assert.equal(mcpConfig({ auditFile: 'a.jsonl', typedFile: null }), mcpConfig({ auditFile: 'a.jsonl' }));
});

// Wrong implementations it catches: a hook in shell form (a home folder with a space or a quote breaks it, and a shell
// expands what it should not); "node" by name; the hook script by a relative path; a matcher (UserPromptSubmit takes
// none); a second event, such as PostToolUse, whose input carries tool results.
test('batch 12d: typedHooks is one UserPromptSubmit hook in exec form: this Node binary, typed-hook.js and the typed file', () => {
  const { typedHooks } = session();
  const file = path.join('home', 'aegis-asks', 'chat-1', 'typed.txt');
  const hook = path.join(__dirname, 'typed-hook.js');
  assert.deepEqual(typedHooks(file), { UserPromptSubmit: [{ hooks: [{ type: 'command', command: process.execPath, args: [hook, path.resolve(file)] }] }] });
  assert.ok(fs.existsSync(hook), 'the hook script exists');
});

// Wrong implementations it catches: a typed file other users can read (it holds the person's words); one written through
// a link planted at its path (the text would land elsewhere, or a file of the attacker's would become the typed set); a
// first write that appends to a stale file from an earlier run.
test('batch 12d: writeTyped creates the file 0600, truncates or appends, and never writes through a link', (t) => {
  const { writeTyped } = session();
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-typed-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'typed.txt');
  fs.writeFileSync(file, 'stale text from another run\n', { mode: 0o644 });
  writeTyped(file, 'the ticket');
  writeTyped(file, 'a later message', { append: true });
  assert.equal(fs.readFileSync(file, 'utf8'), 'the ticket\na later message\n');
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    const elsewhere = path.join(dir, 'elsewhere.txt');
    fs.writeFileSync(elsewhere, 'untouched\n');
    const link = path.join(dir, 'link.txt');
    fs.symlinkSync(elsewhere, link);
    assert.throws(() => writeTyped(link, 'x'), /ELOOP|EEXIST|symbolic|EMLINK/i);
    assert.throws(() => writeTyped(link, 'x', { append: true }), /ELOOP|EEXIST|symbolic|EMLINK/i);
    assert.equal(fs.readFileSync(elsewhere, 'utf8'), 'untouched\n');
  }
});
