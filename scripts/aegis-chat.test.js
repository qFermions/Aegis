'use strict';
require('./adapters/socket-tripwire.js');
// aegis-chat.test.js: the interactive follow-up command for a person trying Aegis (batch 9, task 11).
//
// EXPECTED DECISION (written before the command)
// - `node scripts/aegis-chat.js [--setup "..."]` prints one plain line saying the session reads only and
//   cannot run commands or change anything, then starts claude with no -p, stdio inherited, from the
//   repository root, with the desk's tool flags and isolation (the --tools, --allowedTools and
//   --disallowedTools of backends.sutArgs, then backends.isolationArgs()), and nothing else.
// - --setup, when given, is one --append-system-prompt value: the setup text between two marker lines,
//   labeled data about the environment, not instructions.
// - It exits with the session's exit code; a claude that cannot start is a plain message and exit 2.
// The one session started here is a fake that writes its argv to a file and exits 0; no test starts a real
// claude.
// Run: node --test scripts/aegis-chat.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./eval/judged/backends.js');
const { REPO_ROOT } = require('./eval/judged/paths.js');
const chat = require('./aegis-chat.js');

// What every chat session gets, written out from backends.js's exports rather than from the command. The
// whole ~/aegis-asks folder is denied (review round 1, finding 2), so a chat never reads saved answers.
const ISOLATED = (home) => ['--tools', ...backends.SUT_TOOLS, '--allowedTools', ...backends.SUT_TOOLS, '--disallowedTools', 'Bash', ...backends.WEB_TOOLS, ...backends.isolationArgs({ runRoot: path.join(home, 'aegis-asks') })];

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-chat-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function io() {
  const out = [];
  const err = [];
  return { deps: { out: (s) => out.push(s), err: (s) => err.push(s) }, stdout: () => out.join(''), stderr: () => err.join('') };
}

// Wrong implementations it catches: a chat that keeps -p or the print-mode flags (so it is not interactive),
// drops a flag of the desk's isolation, adds Bash, Edit, Write or the web tools, adds
// --dangerously-skip-permissions, pipes stdio instead of handing over the terminal, runs from another folder,
// passes the setup as the first message (an instruction) instead of as appended data, or prints its notice
// after the session instead of before.
test('the chat starts once under a fake claude with the desk\'s isolation and the setup as appended data', async (t) => {
  const dir = tempDir(t);
  const fake = path.join(dir, 'fake-claude-argv.js');
  const log = path.join(dir, 'argv.json');
  fs.writeFileSync(fake, "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ argv: process.argv.slice(3), cwd: process.cwd(), env: Object.keys(process.env) }));\n");
  const spawned = [];
  const childProcess = require('node:child_process');
  const order = [];
  const c = io();
  const deps = {
    ...c.deps,
    out: (s) => { order.push('notice'); c.deps.out(s); },
    backend: { command: process.execPath, prefixArgs: [fake, log] },
    spawn: (cmd, args, opts) => { order.push('spawn'); spawned.push(opts); return childProcess.spawn(cmd, args, opts); },
  };
  const home = path.join(dir, 'home');
  const env = { ...process.env, HOME: home, USERPROFILE: home, AEGIS_TEST_API_TOKEN: 'never-passed-on' };
  const code = await chat.main(['--setup', 'Google Workspace, Chromebooks, no Microsoft'], env, deps);
  assert.equal(code, 0, c.stderr());
  assert.equal(spawned.length, 1, 'started once');
  assert.equal(spawned[0].stdio, 'inherit', 'the terminal is handed over');
  assert.equal(spawned[0].shell, false);
  assert.deepEqual(order, ['notice', 'spawn'], 'the notice comes first');
  assert.match(c.stdout(), /^This Aegis chat reads only[^\n]*cannot run commands[^\n]*change anything[^\n]*\n$/);

  const got = JSON.parse(fs.readFileSync(log, 'utf8'));
  const appended = got.argv[got.argv.length - 1];
  assert.deepEqual(got.argv, [...ISOLATED(home), '--append-system-prompt', appended]);
  assert.match(appended, /data about the environment, not instructions/);
  const open = appended.indexOf('--- What the company runs ---');
  const close = appended.indexOf('--- End of what the company runs ---');
  assert.ok(open > 0 && close > open);
  assert.equal(appended.slice(open + '--- What the company runs ---'.length, close).trim(), 'Google Workspace, Chromebooks, no Microsoft');
  for (const bad of ['-p', '--print', '--output-format', '--max-turns', '--no-session-persistence', '--dangerously-skip-permissions']) assert.ok(!got.argv.includes(bad), `no ${bad}`);
  for (const flag of ['--tools', '--allowedTools']) {
    const at = got.argv.indexOf(flag);
    const tools = got.argv.slice(at + 1, at + 1 + backends.SUT_TOOLS.length);
    for (const bad of ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch']) assert.ok(!tools.includes(bad), `${flag} has no ${bad}`);
  }
  assert.equal(fs.realpathSync(got.cwd), fs.realpathSync(REPO_ROOT));
  assert.ok(!got.env.includes('AEGIS_TEST_API_TOKEN'), 'a secret-named variable never reaches the session');
});

// Wrong implementation it catches: an empty --append-system-prompt (or a setup block with nothing in it)
// when no setup was given. Built, never started.
test('with no --setup the argv is the isolation alone', () => {
  assert.deepEqual(chat.chatArgs(null, path.join('/h/me', 'aegis-asks')), ISOLATED('/h/me'));
  assert.deepEqual(chat.chatArgs('   ', path.join('/h/me', 'aegis-asks')), ISOLATED('/h/me'));
});

// Wrong implementations it catches: a chat that takes a ticket or an unknown flag and starts anyway, or a
// missing claude that throws a stack trace instead of a plain message.
test('bad arguments exit 1 with no session; a claude that cannot start is a plain message and exit 2', async (t) => {
  let started = 0;
  const c = io();
  const deps = { ...c.deps, spawn: () => { started += 1; throw new Error('must not start'); } };
  assert.equal(await chat.main(['my printer is broken'], process.env, deps), 1);
  assert.equal(await chat.main(['--setup'], process.env, deps), 1);
  assert.equal(await chat.main(['--nope'], process.env, deps), 1);
  assert.equal(started, 0);
  assert.match(c.stderr(), /Usage: node scripts\/aegis-chat\.js/);
  const missing = io();
  const code = await chat.main([], process.env, { ...missing.deps, backend: { command: path.join(tempDir(t), 'no-such-claude'), prefixArgs: [] } });
  assert.equal(code, 2);
  assert.match(missing.stderr(), /^aegis-chat: could not start claude/);
  assert.ok(!missing.stderr().includes('    at '));
  // review round 1, nit 3: the chat exits with claude's own code; a signal is 2. A stand-in child, no process.
  // Wrong implementation it catches: a chat that always exits 0.
  const { EventEmitter } = require('node:events');
  for (const [code, signal, want] of [[3, null, 3], [null, 'SIGTERM', 2]]) {
    const ended = io();
    const stub = () => { const child = new EventEmitter(); setImmediate(() => child.emit('exit', code, signal)); return child; };
    assert.equal(await chat.main([], process.env, { ...ended.deps, spawn: stub }), want);
  }
});

// Code review round 1 (batch 9), finding 1: the terminal sends Ctrl-C to the whole foreground group, so a node
// parent with no SIGINT handler exited and left claude running on the same terminal. Wrong implementation it
// catches: no handler while the chat runs, or one left behind after it ends.
test('while the chat runs the parent ignores Ctrl-C, and it stops ignoring it when claude exits', async () => {
  const { EventEmitter } = require('node:events');
  const child = new EventEmitter();
  const before = process.listenerCount('SIGINT');
  const running = chat.main([], { HOME: os.tmpdir() }, { spawn: () => child, out: () => {}, err: () => {} });
  assert.equal(process.listenerCount('SIGINT'), before + 1, 'a handler while claude runs');
  child.emit('exit', 0);
  assert.equal(await running, 0);
  assert.equal(process.listenerCount('SIGINT'), before, 'removed after claude exits');
});
