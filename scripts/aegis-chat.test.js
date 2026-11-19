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
const { TOOL_NAMES, mcpConfig, typedHooks } = require('./mcp/aegis-tools/session.js');

// What every chat session gets, written out from backends.js's exports rather than from the command. The
// whole ~/aegis-asks folder is denied (review round 1, finding 2), so a chat never reads saved answers. Since batch 11
// (resumed) it ends with the pinned model, so a chat never runs on the settings file's default model. Since batch 12
// backends.sutArgs loads the read-only aegis-tools server by default: its four tool names are allowed and its
// --mcp-config follows --strict-mcp-config, so the chat, which takes its flags from sutArgs, has them too.
// audit: the tool server's audit file; since batch 12, task 5 a chat started by main() audits to a folder of its own
// under the saved asks (auditOf reads it back from the argv the chat was started with), and chatArgs alone passes none
// typed (batch 12d, so this helper changed): the typed file a chat started by main() hands its tool server, and its prompt
// hook in the inline --settings; chatArgs alone passes none
const ISOLATED = (home, model = backends.PINNED_MODEL, audit = null, typed = null) => ['--tools', ...backends.SUT_TOOLS, '--allowedTools', ...backends.SUT_TOOLS, ...TOOL_NAMES, '--disallowedTools', 'Bash', ...backends.WEB_TOOLS, ...backends.isolationArgs({ runRoot: path.join(home, 'aegis-asks'), mcpConfig: mcpConfig({ auditFile: audit, typedFile: typed }), ...(typed ? { hooks: typedHooks(typed) } : {}) }), '--model', model];
function auditOf(argv) {
  const server = JSON.parse(argv[argv.indexOf('--mcp-config') + 1]).mcpServers['aegis-tools'];
  const audit = server.args[server.args.indexOf('--audit') + 1];
  return audit;
}
function typedOf(argv) {
  const server = JSON.parse(argv[argv.indexOf('--mcp-config') + 1]).mcpServers['aegis-tools'];
  return server.args.includes('--typed') ? server.args[server.args.indexOf('--typed') + 1] : null;
}

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
  assert.match(path.relative(path.join(home, 'aegis-asks'), auditOf(got.argv)), /^chat-[^/\\]+[/\\]tool-audit\.jsonl$/);
  assert.equal(path.dirname(typedOf(got.argv)), path.dirname(auditOf(got.argv)), 'batch 12d: the typed file sits beside the audit file');
  assert.deepEqual(got.argv, [...ISOLATED(home, backends.PINNED_MODEL, auditOf(got.argv), typedOf(got.argv)), '--append-system-prompt', appended]);
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

// Code review round 2 (batch 9), finding 14: the chat's --setup reached the session unprotected. Wrong
// implementation it catches: protection on ask-aegis only.
test('code review 2, finding 14: the chat protects its setup text as ask-aegis does', async () => {
  const { EventEmitter } = require('node:events');
  const seen = [];
  const child = new EventEmitter();
  const mail = ['jane.doe', 'realcorp.example.org'].join('@');
  const running = chat.main(['--setup', `Admin is ${mail}`], { HOME: os.tmpdir() }, { spawn: (cmd, args) => { seen.push(args); return child; }, out: () => {}, err: () => {} });
  child.emit('exit', 0);
  assert.equal(await running, 0);
  assert.ok(!seen[0].join(' ').includes(mail), 'no address reaches the session');
  const err = [];
  const token = ['ghp', '_', 'a'.repeat(30)].join('');
  assert.equal(await chat.main(['--setup', `token ${token}`], { HOME: os.tmpdir() }, { spawn: () => { throw new Error('no session may start'); }, out: () => {}, err: (s) => err.push(s) }), 1);
  assert.ok(!err.join('').includes(token));
});

// ── Batch 11, task 6: --reply-to asker keeps the asker's voice across the chat ──────────────────
// EXPECTED DECISION (written before the flag): `--reply-to asker` adds the voice to the one appended system prompt
// (with the setup block when --setup is given too), so every turn answers in it; any other value is refused before
// claude starts; without the flag the arguments are exactly today's.
// Wrong implementations it catches: a flag that drops the setup, one that passes the voice as a first message
// (an instruction in the conversation instead of the appended prompt), and one that changes a plain chat's argv.
const crypto = require('node:crypto');

test('batch 11, task 6: chatArgs with the voice is one appended prompt; without it the arguments are today\'s', () => {
  const root = '/x/aegis-asks';
  const plain = chat.chatArgs(null, root);
  assert.ok(!plain.includes('--append-system-prompt'), 'no setup and no voice: nothing appended');
  assert.deepEqual(chat.chatArgs(null, root, null), plain);
  const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  // the setup-only tail of the unchanged code (computed at 6d836cc)
  assert.equal(sha(chat.chatArgs('Google Workspace, Chromebooks', root).slice(-2)), 'de98e7bdf3a9a1132ebf07c3e957ce82ead3d62f074e648533a891205f083cb4');
  const voiced = chat.chatArgs(null, root, 'asker');
  assert.deepEqual(voiced.slice(0, -2), plain);
  assert.equal(voiced[voiced.length - 2], '--append-system-prompt');
  assert.match(voiced[voiced.length - 1], /section 8/);
  assert.match(voiced[voiced.length - 1], /every answer in this chat/i);
  const both = chat.chatArgs('Google Workspace, Chromebooks', root, 'asker');
  assert.equal(both.filter((a) => a === '--append-system-prompt').length, 1, 'one appended prompt holds both');
  assert.match(both[both.length - 1], /--- What the company runs ---/);
  assert.match(both[both.length - 1], /section 8/);
});

test('batch 11, task 6: --reply-to asker starts the chat with the voice; another value is refused before claude starts', async (t) => {
  const dir = tempDir(t);
  const fake = path.join(dir, 'fake-claude-argv.js');
  const log = path.join(dir, 'argv.json');
  fs.writeFileSync(fake, "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ argv: process.argv.slice(3) }));\n");
  const home = path.join(dir, 'home');
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const c = io();
  const code = await chat.main(['--reply-to', 'asker'], env, { ...c.deps, backend: { command: process.execPath, prefixArgs: [fake, log] } });
  assert.equal(code, 0, c.stderr());
  const got = JSON.parse(fs.readFileSync(log, 'utf8'));
  // batch 12d: the chat's typed file and its prompt hook are part of the isolation now (this line changed for them)
  assert.deepEqual(got.argv.slice(0, -2), ISOLATED(home, backends.PINNED_MODEL, auditOf(got.argv), typedOf(got.argv)));
  assert.match(got.argv[got.argv.length - 1], /section 8/);

  const refused = io();
  let started = 0;
  const bad = await chat.main(['--reply-to', 'everyone'], env, { ...refused.deps, spawn: () => { started += 1; throw new Error('must not start'); } });
  assert.equal(bad, 1);
  assert.equal(started, 0);
  assert.match(refused.stderr(), /--reply-to takes asker/);
});

// Batch 11 resumed, task 8: the chat names its model. EXPECTED DECISION: --model claude-opus-5-5 by default and the
// value of --model otherwise, after --tools and before any appended prompt; a value that is not a model name, or
// --model with no value, exits 1 before claude starts. Wrong implementations it catches: a chat started with no
// --model (it would run on the settings file's default model), and a --model flag parsed and not passed on.
test('batch 11 resumed: the chat runs on claude-opus-5-5 unless --model names another; a bad value starts nothing', async (t) => {
  const dir = tempDir(t);
  const fake = path.join(dir, 'fake-claude-argv.js');
  const log = path.join(dir, 'argv.json');
  fs.writeFileSync(fake, "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ argv: process.argv.slice(3) }));\n");
  const home = path.join(dir, 'home');
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const c = io();
  assert.equal(await chat.main(['--model', 'claude-sonnet-5-5', '--reply-to', 'asker'], env, { ...c.deps, backend: { command: process.execPath, prefixArgs: [fake, log] } }), 0, c.stderr());
  const got = JSON.parse(fs.readFileSync(log, 'utf8'));
  // batch 12d: the chat's typed file and its prompt hook are part of the isolation now (this line changed for them)
  assert.deepEqual(got.argv.slice(0, -2), ISOLATED(home, 'claude-sonnet-5-5', auditOf(got.argv), typedOf(got.argv)));
  assert.deepEqual(chat.chatArgs(null, path.join('/h/me', 'aegis-asks')).slice(-2), ['--model', 'claude-opus-5-5']);
  for (const argv of [['--model', 'two words'], ['--model']]) {
    const refused = io();
    let started = 0;
    assert.equal(await chat.main(argv, env, { ...refused.deps, spawn: () => { started += 1; throw new Error('must not start'); } }), 1, argv.join(' '));
    assert.equal(started, 0);
    assert.match(refused.stderr(), /--model/);
  }
});

// Batch 12, task 5: the chat loads the read-only tool server by default, audits its calls to a file of its own under
// the saved asks folder (denied to the session, outside the repository), says so in its notice, and --no-tools turns
// it off. Wrong implementations: an audit file inside the repository; a notice that still says the chat has no
// lookups; a --no-tools that leaves the server in the argument list.
test('batch 12, task 5: the chat loads the tool server with its own audit file, says so, and --no-tools turns it off', async (t) => {
  const { EventEmitter } = require('node:events');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-chat-tools-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const seen = [];
  const said = [];
  const child = new EventEmitter();
  const running = chat.main([], { HOME: home }, { spawn: (cmd, args) => { seen.push(args); return child; }, out: (s) => said.push(s), err: () => {} });
  child.emit('exit', 0);
  assert.equal(await running, 0);
  const cfg = JSON.parse(seen[0][seen[0].indexOf('--mcp-config') + 1]);
  const server = cfg.mcpServers['aegis-tools'];
  const audit = server.args[server.args.indexOf('--audit') + 1];
  assert.equal(path.dirname(path.dirname(audit)), path.join(home, 'aegis-asks'));
  assert.match(path.basename(path.dirname(audit)), /^chat-/);
  assert.match(said.join(''), /public lookups/);
  const off = [];
  const other = new EventEmitter();
  const quiet = [];
  const r2 = chat.main(['--no-tools'], { HOME: home }, { spawn: (cmd, args) => { off.push(args); return other; }, out: (s) => quiet.push(s), err: () => {} });
  other.emit('exit', 0);
  assert.equal(await r2, 0);
  assert.ok(!off[0].includes('--mcp-config') && !off[0].some((a) => /mcp__aegis-tools__/.test(a)));
  assert.doesNotMatch(quiet.join(''), /public lookups/);
});

// Code review 1 of batch 12, class D: every call to main() made ~/aegis-asks/chat-<id>/ and left it behind, even when
// no lookup was made or claude never started (the tests alone left three in the real home folder each run). Now the
// folder goes when its audit file is empty, and stays when the chat made lookups. Wrong implementations: a folder
// left behind after a chat with no lookups; an audit file that holds calls deleted.
test('code review 1, class D: a chat with no lookups leaves no chat folder; one with lookups keeps its audit file', async (t) => {
  const { EventEmitter } = require('node:events');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-chat-folders-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const chats = () => (fs.existsSync(path.join(home, 'aegis-asks')) ? fs.readdirSync(path.join(home, 'aegis-asks')).filter((d) => d.startsWith('chat-')) : []);
  const quiet = new EventEmitter();
  const r1 = chat.main([], { HOME: home }, { spawn: () => quiet, out: () => {}, err: () => {} });
  quiet.emit('exit', 0);
  assert.equal(await r1, 0);
  assert.deepEqual(chats(), [], 'no lookups: no folder left');
  const failed = await chat.main([], { HOME: home }, { spawn: () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; }, out: () => {}, err: () => {} });
  assert.equal(failed, 2);
  assert.deepEqual(chats(), [], 'claude never started: no folder left');
  const busy = new EventEmitter();
  let seen;
  const r2 = chat.main([], { HOME: home }, { spawn: (cmd, args) => { seen = args; return busy; }, out: () => {}, err: () => {} });
  const server = JSON.parse(seen[seen.indexOf('--mcp-config') + 1]).mcpServers['aegis-tools'];
  fs.appendFileSync(server.args[server.args.indexOf('--audit') + 1], '{"tool":"net_dns"}\n');
  busy.emit('exit', 0);
  assert.equal(await r2, 0);
  assert.equal(chats().length, 1, 'lookups were made: the audit file stays');
});

// Batch 12d. EXPECTED DECISION (written before the code): with the tools on, the chat writes the setup, after protect(),
// to typed.txt in its own folder before claude starts, names it to the tool server by --typed, and puts the prompt hook
// (session.typedHooks) in the session's inline --settings, so each message the person sends is appended to it. The file
// goes when the chat ends; a folder with lookups keeps only its audit file. --no-tools writes no file and no hook. Wrong
// implementations it catches: the raw setup typed; a typed file inside the repository or shared between chats; a chat
// with no hook (later messages would never count); a hook with the tools off; the person's words left on disk after the
// chat.
test('batch 12d: the chat types the setup in its own folder, hands it to the server and the prompt hook, and removes it at the end', async (t) => {
  const { EventEmitter } = require('node:events');
  const home = tempDir(t);
  const at = '@';
  const setupText = `Google Workspace; NOC at noc${at}example.com; status https://status.example.com/`;
  let seen = null;
  let atStart = null;
  const child = new EventEmitter();
  const running = chat.main(['--setup', setupText], { HOME: home }, {
    spawn: (cmd, args) => {
      seen = args;
      const file = typedOf(args);
      atStart = { file, text: fs.readFileSync(file, 'utf8'), mode: fs.statSync(file).mode & 0o777 };
      return child;
    },
    out: () => {}, err: () => {},
  });
  // a lookup was made, so the folder stays with its audit file
  fs.appendFileSync(auditOf(seen), '{"tool":"net_dns","decision":"ok"}\n');
  child.emit('exit', 0);
  assert.equal(await running, 0);
  assert.equal(path.basename(atStart.file), 'typed.txt');
  assert.equal(path.dirname(atStart.file), path.dirname(auditOf(seen)), 'in the chat\'s own folder under the saved asks');
  assert.equal(atStart.text, `${require('./ask-aegis.js').protect(setupText).text}\n`);
  assert.ok(!atStart.text.includes(`noc${at}example.com`));
  if (process.platform !== 'win32') assert.equal(atStart.mode, 0o600);
  assert.deepEqual(JSON.parse(seen[seen.indexOf('--settings') + 1]).hooks, typedHooks(atStart.file));
  assert.equal(fs.existsSync(atStart.file), false, 'removed when the chat ends');
  assert.deepEqual(fs.readdirSync(path.dirname(atStart.file)), ['tool-audit.jsonl']);
  // no setup: the typed file starts empty
  let empty = null;
  const quiet = new EventEmitter();
  const r2 = chat.main([], { HOME: home }, { spawn: (cmd, args) => { empty = fs.readFileSync(typedOf(args), 'utf8'); return quiet; }, out: () => {}, err: () => {} });
  quiet.emit('exit', 0);
  assert.equal(await r2, 0);
  assert.equal(empty, '');
  // --no-tools: no typed file and no hook
  let offArgs = null;
  const off = new EventEmitter();
  const r3 = chat.main(['--no-tools', '--setup', setupText], { HOME: home }, { spawn: (cmd, args) => { offArgs = args; return off; }, out: () => {}, err: () => {} });
  off.emit('exit', 0);
  assert.equal(await r3, 0);
  assert.ok(!('hooks' in JSON.parse(offArgs[offArgs.indexOf('--settings') + 1])));
});

// Code review 1 of batch 12d, finding 4. Wrong implementations it catches: the typed file removed only when claude
// exits, so a closed terminal window (SIGHUP) or a kill (SIGTERM) ends the launcher first and leaves every message the
// person typed on disk; a handler that tidies and never passes the signal on, which would leave claude running; handlers
// left behind after the chat.
test('batch 12d: a closed terminal or a kill removes the typed file at once and passes the signal to claude', async (t) => {
  const { EventEmitter } = require('node:events');
  for (const signal of ['SIGHUP', 'SIGTERM']) {
    const home = tempDir(t);
    const child = new EventEmitter();
    const killed = [];
    child.kill = (s) => { killed.push(s); return true; };
    const before = process.listeners(signal);
    let typedFile = null;
    const running = chat.main(['--setup', 'Google Workspace'], { HOME: home }, { spawn: (cmd, args) => { typedFile = typedOf(args); return child; }, out: () => {}, err: () => {} });
    fs.appendFileSync(typedFile, 'a later message the person typed\n');
    const added = process.listeners(signal).filter((l) => !before.includes(l));
    assert.equal(added.length, 1, `${signal}: one handler while claude runs`);
    added[0](signal);
    assert.equal(fs.existsSync(typedFile), false, `${signal}: the person's words are off the disk before claude has exited`);
    assert.deepEqual(killed, [signal], `${signal}: passed on to claude`);
    child.emit('exit', null);
    assert.equal(await running, 2);
    assert.deepEqual(process.listeners(signal), before, `${signal}: the handler is removed after the chat`);
  }
});
