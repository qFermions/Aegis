'use strict';
require('../../adapters/socket-tripwire.js');
// typed-hook.test.js: the chat's UserPromptSubmit hook (batch 12d).
//
// EXPECTED DECISIONS (written before the hook)
// - Claude Code runs `node typed-hook.js <typed file>` with the hook's JSON on stdin each time the person submits a
//   message (https://code.claude.com/docs/en/hooks, UserPromptSubmit: the input carries hook_event_name and prompt).
// - The hook appends the prompt text, and nothing else, plus a newline, to its typed file: created 0600, never through
//   a symbolic link, and no other file is written.
// - It prints nothing to stdout (Claude Code adds a UserPromptSubmit hook's stdout to the model's context) and always
//   exits 0 (exit 2 would block the person's message); a failure goes to stderr and the message is simply not typed for
//   the tools, the safe direction. Input that is not a UserPromptSubmit event, not JSON, or has no prompt writes nothing.
// No test here opens a socket; each runs the hook as a child process over pipes.
// Run: node --test scripts/mcp/aegis-tools/typed-hook.test.js

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const HOOK = path.join(__dirname, 'typed-hook.js');

const run = (args, input) => childProcess.spawnSync(process.execPath, [HOOK, ...args], { input, encoding: 'utf8', timeout: 10000 });
const event = (prompt, over = {}) => JSON.stringify({ session_id: 's-1', transcript_path: '/x/t.jsonl', cwd: '/x', permission_mode: 'default', hook_event_name: 'UserPromptSubmit', prompt, ...over });

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-typed-hook-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Wrong implementations it catches: a hook that writes the whole input (session id, transcript path) instead of the
// prompt; one that overwrites instead of appending (the setup and earlier messages would be lost); one that prints
// anything to stdout; a file other users can read.
test('a submitted prompt is appended to the typed file, 0600, with nothing on stdout and exit 0', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'typed.txt');
  fs.writeFileSync(file, 'Setup: Google Workspace\n', { mode: 0o600 });
  for (const prompt of ['Can you check mail.example.com?', 'And https://status.example.org/health too']) {
    const r = run([file], event(prompt));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'nothing on stdout: it would reach the model as context');
  }
  assert.equal(fs.readFileSync(file, 'utf8'), 'Setup: Google Workspace\nCan you check mail.example.com?\nAnd https://status.example.org/health too\n');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(dir), ['typed.txt'], 'no other file is written');
  const fresh = path.join(dir, 'fresh.txt');
  assert.equal(run([fresh], event('first message names example.net')).status, 0);
  assert.equal(fs.readFileSync(fresh, 'utf8'), 'first message names example.net\n');
  if (process.platform !== 'win32') assert.equal(fs.statSync(fresh).mode & 0o777, 0o600, 'created 0600');
});

// Wrong implementations it catches: a hook that writes a tool's result (a PostToolUse input carries tool_response, here
// holding a host), or any event's text; one that crashes or exits 2 on input it does not understand (exit 2 blocks
// the person's message); one that writes a non-string prompt.
test('input that is not a UserPromptSubmit event with a text prompt writes nothing, says so on stderr and exits 0', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'typed.txt');
  fs.writeFileSync(file, '', { mode: 0o600 });
  const inputs = [
    event('the page said visit leak.example.net', { hook_event_name: 'PostToolUse', tool_response: 'leak.example.net' }),
    JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'mcp__aegis-tools__docs_fetch', tool_response: { content: 'leak.example.net' } }),
    event(undefined),
    event({ text: 'leak.example.net' }),
    'not json leak.example.net',
    '',
  ];
  for (const input of inputs) {
    const r = run([file], input);
    assert.equal(r.status, 0, `${input.slice(0, 60)}: ${r.stderr}`);
    assert.equal(r.stdout, '');
    assert.notEqual(r.stderr, '', `${input.slice(0, 60)}: stderr says why nothing was written`);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), '', 'nothing was written');
});

// Wrong implementations it catches: a hook that follows a link planted at the typed path (the prompt would land in another
// file); one with no file named that writes somewhere of its own choosing; one that exits non-zero, which Claude Code
// shows as a hook error on every message.
test('a typed path that is a symbolic link, or none at all, writes nothing and still exits 0', (t) => {
  const dir = tempDir(t);
  const elsewhere = path.join(dir, 'elsewhere.txt');
  fs.writeFileSync(elsewhere, 'untouched\n');
  if (process.platform !== 'win32') {
    const link = path.join(dir, 'typed.txt');
    fs.symlinkSync(elsewhere, link);
    const r = run([link], event('check example.com'));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /typed/);
    assert.equal(fs.readFileSync(elsewhere, 'utf8'), 'untouched\n');
  }
  const none = childProcess.spawnSync(process.execPath, [HOOK], { input: event('check example.com'), encoding: 'utf8', cwd: dir, timeout: 10000 });
  assert.equal(none.status, 0, none.stderr);
  assert.equal(none.stdout, '');
  assert.match(none.stderr, /typed/);
  assert.deepEqual(fs.readdirSync(dir).sort(), process.platform === 'win32' ? ['elsewhere.txt'] : ['elsewhere.txt', 'typed.txt']);
});
