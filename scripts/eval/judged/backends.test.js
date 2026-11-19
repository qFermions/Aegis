'use strict';
require('../../adapters/socket-tripwire.js');
// backends.test.js: the system-under-test and judge backends (capability row 26, B3).
//
// EXPECTED DECISION (written before the module)
// - The SUT command line is claude -p <prompt> --output-format stream-json --verbose
//   --max-turns N --tools Read Grep Glob Agent --allowedTools (same) --disallowedTools Bash
//   WebFetch WebSearch; --web moves WebFetch and WebSearch to the allowed set. The judge's is
//   one turn, --tools "", --no-session-persistence, plus --model when given.
// - Batch 6, task 9: both sessions load only this repository's settings: --setting-sources project
//   --strict-mcp-config (no user-level plugin, skill, hook or MCP server), plus --settings with
//   claudeMdExcludes and autoMemoryEnabled false. The first run of task 8 showed why: with project
//   settings alone the CLI still loads ~/.claude/CLAUDE.md, typed Project, because it walks up from
//   the repository (docs/aegis/demo/evidence/isolation-probe.txt). --bare is not used: it never reads
//   the stored login. Wrong implementations this catches: a session that drops a flag, for either
//   role; an exclusion that names only the home file and misses a folder between home and the
//   repository; one that excludes the repository's own CLAUDE.md.
// - The prompt is the ticket, plus the evidence after a header saying it is pasted evidence.
// - The child runs from the repository root, without a shell, with an environment that has
//   no .env.example name and no *_TOKEN, *_KEY, *_SECRET or *_PASSWORD name (PATH stays).
// - A follow_up is a second turn with --resume <session id of the first>.
// - A child past its timeout is stopped (SIGTERM, then SIGKILL) and its state is TIMEOUT;
//   output that is not stream-json, or an error result, is ERROR.
// All children here are the fake CLI in fixtures/; no test runs the real claude CLI.
// Run: node --test scripts/eval/judged/backends.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./backends.js');
const { REPO_ROOT, effectivePath } = require('./paths.js');
const { TOOL_NAMES, mcpConfig } = require('../../mcp/aegis-tools/session.js');

const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');

function fake(t, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-backend-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'calls.jsonl');
  const cfg = path.join(dir, 'fake.json');
  fs.writeFileSync(cfg, JSON.stringify({ log, ...config }));
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { opts: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg], repoRoot: REPO_ROOT, maxTurns: 24, timeoutMs: 20000, graceMs: 200 }, calls };
}

const kase = (over = {}) => ({ id: 'B1', ticket: 'Ticket text for [UPN].', evidence: '', follow_up: '', ...over });

// Batch 12 changed this test on purpose: the aegis-tools server is on by default, so the default argv gains the four
// tool names in --allowedTools (never in --tools, which lists built-in tools only) and --mcp-config right after
// --strict-mcp-config. tools: false is the argv this test pinned before batch 12, byte for byte.
test('the SUT and judge command lines match the spec; --web moves the web tools to the allowed set', () => {
  assert.deepEqual(backends.sutArgs({ prompt: 'P', maxTurns: 24 }), ['-p', 'P', '--output-format', 'stream-json', '--verbose', '--max-turns', '24', '--tools', 'Read', 'Grep', 'Glob', 'Agent', '--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', ...TOOL_NAMES, '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch', ...backends.isolationArgs({ mcpConfig: mcpConfig() }), '--model', 'claude-opus-5-5']);
  assert.deepEqual(backends.sutArgs({ prompt: 'P', maxTurns: 24, tools: false }), ['-p', 'P', '--output-format', 'stream-json', '--verbose', '--max-turns', '24', '--tools', 'Read', 'Grep', 'Glob', 'Agent', '--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch', ...backends.isolationArgs(), '--model', 'claude-opus-5-5']);
  const web = backends.sutArgs({ prompt: 'P', maxTurns: 5, web: true });
  assert.deepEqual(web.slice(web.indexOf('--allowedTools'), web.indexOf('--disallowedTools')), ['--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', 'WebFetch', 'WebSearch', ...TOOL_NAMES]);
  assert.deepEqual(web.slice(web.indexOf('--disallowedTools')), ['--disallowedTools', 'Bash', ...backends.isolationArgs({ mcpConfig: mcpConfig() }), '--model', 'claude-opus-5-5']);
  const webOff = backends.sutArgs({ prompt: 'P', maxTurns: 5, web: true, tools: false });
  assert.deepEqual(webOff.slice(webOff.indexOf('--allowedTools'), webOff.indexOf('--disallowedTools')), ['--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', 'WebFetch', 'WebSearch']);
  assert.deepEqual(webOff.slice(webOff.indexOf('--disallowedTools')), ['--disallowedTools', 'Bash', ...backends.isolationArgs(), '--model', 'claude-opus-5-5']);
  assert.deepEqual(backends.sutArgs({ prompt: 'F', resume: 'sess-1' }).slice(0, 4), ['-p', 'F', '--resume', 'sess-1']);
  // batch 11 resumed: both end with the pinned model (model-pin.test.js)
  assert.deepEqual(backends.judgeArgs({ prompt: 'J' }), ['-p', 'J', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', '', '--no-session-persistence', ...backends.isolationArgs({ judge: true }), '--model', 'claude-opus-5-5']);
  assert.deepEqual(backends.judgeArgs({ prompt: 'J', model: 'judge-x' }).slice(-2), ['--model', 'judge-x']);
  assert.equal(backends.sutArgs({ prompt: '--looks-like-a-flag' })[1], ' --looks-like-a-flag', 'a prompt never reads as an option');
});

test('both sessions load only the repository\'s own settings, also when resumed, on the web, or with a judge model (batch 6, task 9)', () => {
  // batch 12: the system under test gets one MCP server, aegis-tools, unless tools is false; the judge never does
  const isolated = (args, label, { judge = false, tools = !judge } = {}) => {
    const at = args.indexOf('--setting-sources');
    assert.ok(at > 0, `${label}: --setting-sources`);
    assert.equal(args[at + 1], 'project', `${label}: project settings only, so no user-level CLAUDE.md, plugin, skill or hook`);
    assert.ok(args.includes('--strict-mcp-config'), `${label}: --strict-mcp-config, so no MCP server but the one given here`);
    const mcpAt = args.indexOf('--mcp-config');
    if (!tools) assert.equal(mcpAt, -1, `${label}: no MCP file is given`);
    else {
      assert.equal(mcpAt, args.indexOf('--strict-mcp-config') + 1, `${label}: the one MCP file comes right after --strict-mcp-config`);
      assert.equal(args.filter((a) => a === '--mcp-config').length, 1, `${label}: one MCP file`);
      assert.deepEqual(Object.keys(JSON.parse(args[mcpAt + 1]).mcpServers), ['aegis-tools'], `${label}: the aegis-tools server and no other`);
    }
    assert.ok(!args.includes('--bare'), `${label}: --bare never reads the stored login`);
    const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
    assert.equal(settings.autoMemoryEnabled, false, `${label}: no auto memory`);
    const home = require('node:os').homedir();
    assert.ok(settings.claudeMdExcludes.includes(path.join(home, '.claude', 'CLAUDE.md')), `${label}: the owner's own rules file is excluded`);
    for (let d = path.dirname(REPO_ROOT); ; d = path.dirname(d)) {
      for (const name of ['CLAUDE.md', 'CLAUDE.local.md', path.join('.claude', 'CLAUDE.md')]) assert.ok(settings.claudeMdExcludes.includes(path.join(d, name)), `${label}: ${path.join(d, name)}`);
      if (d === path.dirname(d)) break;
    }
    if (judge) assert.ok(settings.claudeMdExcludes.includes(path.join(REPO_ROOT, 'CLAUDE.md')), `${label}: the judge loads no CLAUDE.md, even with a temporary folder below the checkout`);
    else assert.ok(!settings.claudeMdExcludes.some((p) => p === path.join(REPO_ROOT, 'CLAUDE.md') || p.startsWith(`${REPO_ROOT}${path.sep}`)), `${label}: the repository's own files still load`);
  };
  isolated(backends.sutArgs({ prompt: 'P' }), 'system under test');
  isolated(backends.sutArgs({ prompt: 'P', resume: 'sess-1' }), 'follow-up turn');
  isolated(backends.sutArgs({ prompt: 'P', web: true }), 'system under test with the web tools');
  isolated(backends.sutArgs({ prompt: 'P', tools: false }), 'system under test with the tool server off', { tools: false });
  isolated(backends.judgeArgs({ prompt: 'J' }), 'judge', { judge: true });
  isolated(backends.judgeArgs({ prompt: 'J', model: 'judge-x' }), 'judge with a model', { judge: true });
});

// Batch 12: the aegis-tools server. Wrong implementations it catches: the judge given the tool server (it would grade
// with network access) or isolationArgs that lets a caller hand it one; the tool names put in --tools, which lists
// built-in tools only; WebFetch or WebSearch allowed because the tools are on; an off switch that leaves a trace in the
// argv; an audit file that never reaches the server's arguments; runSut dropping the switch or the file.
test('the tool server is on by default for the system under test, never for the judge, and off leaves the old argv (batch 12)', async (t) => {
  const values = (args, flag) => { const out = []; for (let i = args.indexOf(flag) + 1; i > 0 && i < args.length && !args[i].startsWith('--'); i += 1) out.push(args[i]); return out; };
  const serverOf = (args) => JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers['aegis-tools'];
  const on = backends.sutArgs({ prompt: 'P' });
  assert.deepEqual(values(on, '--tools'), [...backends.SUT_TOOLS], 'built-in tools only');
  assert.deepEqual(values(on, '--allowedTools'), [...backends.SUT_TOOLS, ...TOOL_NAMES]);
  assert.deepEqual(values(on, '--disallowedTools'), ['Bash', ...backends.WEB_TOOLS], 'the web tools stay off');
  assert.deepEqual(serverOf(on).args, [path.join(REPO_ROOT, 'scripts', 'mcp', 'aegis-tools', 'server.js')], 'no audit file named: the server audits to stderr');
  const file = path.join(os.tmpdir(), 'aegis-tools-audit.jsonl');
  assert.deepEqual(serverOf(backends.sutArgs({ prompt: 'P', auditFile: file })).args.slice(1), ['--audit', file]);
  const off = backends.sutArgs({ prompt: 'P', tools: false, auditFile: file });
  assert.ok(!off.includes('--mcp-config') && !off.some((a) => a.startsWith('mcp__')), 'off: no server, no tool name, and the audit file is ignored');
  const web = backends.sutArgs({ prompt: 'P', web: true, resume: 'sess-1' });
  assert.deepEqual(values(web, '--allowedTools'), [...backends.SUT_TOOLS, ...backends.WEB_TOOLS, ...TOOL_NAMES], 'a follow-up turn with the web tools keeps the server');
  assert.deepEqual(values(web, '--disallowedTools'), ['Bash']);
  const judge = backends.judgeArgs({ prompt: 'J' });
  assert.ok(!judge.includes('--mcp-config') && !judge.some((a) => a.startsWith('mcp__')), 'the judge has no tool server');
  assert.throws(() => backends.isolationArgs({ judge: true, mcpConfig: mcpConfig() }), /judge/);
  // runSut passes the switch and the audit file to every turn
  const f = fake(t, { sut: { answer: 'a', follow_up_answer: 'b' } });
  await backends.runSut(kase({ follow_up: 'again' }), { ...f.opts, env: { PATH: process.env.PATH }, auditFile: file });
  await backends.runSut(kase(), { ...f.opts, env: { PATH: process.env.PATH }, tools: false });
  const [first, second, third] = f.calls();
  assert.deepEqual([serverOf(first.args).args.slice(1), serverOf(second.args).args.slice(1)], [['--audit', file], ['--audit', file]]);
  assert.ok(!third.args.includes('--mcp-config'));
});

// ── Batch 12d: the typed file ───────────────────────────────────────────────────────────────────────────────────────
// EXPECTED DECISIONS (written before the code)
// - sutArgs({ typedFile }) hands the tool server --typed <file> when the tools are on. promptHook: true (the chat only)
//   also puts session.typedHooks(typedFile) in the session's inline --settings as "hooks"; a print-mode session never
//   gets the hook, since its one prompt holds the runner's own words. With the tools off neither appears, and the judge
//   never takes a hook.
// - runSut with opts.typedFile writes what the person typed before the first turn starts: the case's setup, ticket and
//   evidence, one per line, none of the runner's framing; it appends the follow-up before the second turn.
const settingsOf = (args) => JSON.parse(args[args.indexOf('--settings') + 1]);
const typedServerArgs = (args) => JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers['aegis-tools'].args.slice(1);

// Wrong implementations it catches: a typed file that never reaches the server's arguments; a prompt hook on every
// session (a judged or ask session's -p prompt, with the runner's framing words, would join the typed set); a hook left in
// with the tools off; a judge that can be given a hook.
test('batch 12d: sutArgs hands the server the typed file, and the prompt hook only when asked; off and the judge get neither', () => {
  const { typedHooks } = require('../../mcp/aegis-tools/session.js');
  const audit = path.join(os.tmpdir(), 'b12d-audit.jsonl');
  const file = path.join(os.tmpdir(), 'b12d-typed.txt');
  const on = backends.sutArgs({ prompt: 'P', auditFile: audit, typedFile: file });
  assert.deepEqual(typedServerArgs(on), ['--audit', audit, '--typed', file]);
  assert.ok(!('hooks' in settingsOf(on)), 'a print-mode session gets no prompt hook');
  const chat = backends.sutArgs({ prompt: '', persist: false, typedFile: file, promptHook: true });
  assert.deepEqual(settingsOf(chat).hooks, typedHooks(file));
  assert.ok(!('hooks' in settingsOf(backends.sutArgs({ prompt: '', promptHook: true }))), 'no typed file: no hook');
  const off = backends.sutArgs({ prompt: 'P', tools: false, typedFile: file, promptHook: true });
  assert.deepEqual(off, backends.sutArgs({ prompt: 'P', tools: false }), 'off: the typed file and the hook leave no trace');
  assert.throws(() => backends.isolationArgs({ judge: true, hooks: typedHooks(file) }), /judge/);
  assert.ok(!('hooks' in settingsOf(backends.judgeArgs({ prompt: 'J' }))));
});

// Wrong implementations it catches: a typed file written after the session started (the server would read nothing); one
// that holds the built prompt (the evidence header and the setup's marker lines are the runner's words, and a file name
// in them would become a typed host); the follow-up typed before the first turn, or never; a file other users can read.
test('batch 12d: runSut writes the person\'s words to the typed file before the first turn, and the follow-up before the second', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-typed-sut-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const typedFile = path.join(dir, 'B1-typed.txt');
  const f = fake(t, { sut: { answer: 'a', follow_up_answer: 'b' } });
  const c = kase({ setup: 'Google Workspace; status page https://status.example.com/', ticket: 'Mail to mail.example.org bounces.', evidence: 'Log: 550 from mx.example.org', follow_up: 'Also check https://www.example.net/health' });
  await backends.runSut(c, { ...f.opts, env: { PATH: process.env.PATH }, typedFile });
  const [first, second] = f.calls();
  assert.equal(first.typed.file, typedFile);
  assert.equal(first.typed.text, 'Google Workspace; status page https://status.example.com/\nMail to mail.example.org bounces.\nLog: 550 from mx.example.org\n');
  assert.equal(second.typed.text, `${first.typed.text}Also check https://www.example.net/health\n`);
  if (process.platform !== 'win32') assert.equal(first.typed.mode, 0o600);
  for (const framing of [backends.EVIDENCE_HEADER, '--- What the company runs ---', 'It replaces the default environment']) assert.ok(!second.typed.text.includes(framing), framing);
  // with the tools off, no typed file is written and none is named
  const g = fake(t, { sut: { answer: 'a' } });
  const offFile = path.join(dir, 'off-typed.txt');
  await backends.runSut(kase(), { ...g.opts, env: { PATH: process.env.PATH }, typedFile: offFile, tools: false });
  assert.equal(fs.existsSync(offFile), false);
  assert.equal(g.calls()[0].typed, null);
});

// Code review 1 of batch 12d, findings 2 and 12. Wrong implementations it catches: a results folder used twice gives the
// second run the first run's tool calls, because the server appends to the case's audit file and nothing empties it; a
// typed file that cannot be written (a link left at its path, a full disk) throws out of runSut, which ends a paid run
// before its results are saved, where the session should start with no typed file and reach only the two lists.
test('batch 12d: runSut starts each case with an empty audit file, and a typed file that cannot be written does not stop the run', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-typed-reuse-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const auditFile = path.join(dir, 'B1-tool-audit.jsonl');
  fs.writeFileSync(auditFile, `${JSON.stringify({ time: '2026-11-18T00:00:00.000Z', tool: 'net_dns', input: { name: 'old.example.com', type: 'A' }, decision: 'refused_out_of_scope', reason: 'from an earlier run' })}\n`);
  const f = fake(t, { sut: { answer: 'a' } });
  await backends.runSut(kase(), { ...f.opts, env: { PATH: process.env.PATH }, auditFile, typedFile: path.join(dir, 'B1-typed.txt') });
  assert.deepEqual(backends.toolServerRecord(auditFile), { calls: 0, allowed: 0, refused: 0, other: 0, refused_calls: [] }, 'the earlier run\'s line is gone');
  // the typed file's path is a folder: writeTyped throws, the session still runs, and it names no typed file
  const blocked = path.join(dir, 'B2-typed.txt');
  fs.mkdirSync(blocked);
  const g = fake(t, { sut: { answer: 'a', follow_up_answer: 'b' } });
  const sut = await backends.runSut(kase({ follow_up: 'And now?' }), { ...g.opts, env: { PATH: process.env.PATH }, typedFile: blocked });
  assert.equal(sut.state, 'OK');
  assert.deepEqual(g.calls().map((c) => c.typed), [null, null], 'neither turn names a typed file');
});

// Batch 12d. EXPECTED DECISION (written before the code): toolServerRecord(auditFile) reads the tool server's audit file
// and returns { calls, allowed, refused, other, refused_calls }: allowed is a call the server answered (decision ok),
// refused every decision that starts with refused_ (out of scope, a refused redirect, a private address, a refused name,
// port, scheme or user info, off the docs list), other the rest (bad input, the call cap, a timeout, a DNS, HTTP or TLS
// failure); refused_calls keeps each refused call's tool, its input as the audit keeps it, the decision and the reason,
// in order. No file, or none named: every count 0. Wrong implementations it catches: refused counted as out-of-scope
// alone (a refused redirect or a private address left out); the call cap or bad input counted as allowed; a record that
// drops the reason or the input; one that keeps what the audit has beyond those (addresses, bytes, timing).
test('batch 12d: toolServerRecord counts allowed, refused and other calls from the audit file and lists each refused call', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-tool-record-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'B1-tool-audit.jsonl');
  const entry = (tool, input, decision, reason) => ({ time: '2026-11-18T00:00:00.000Z', tool, input, decision, ...(reason ? { reason } : {}), addresses: ['93.184.215.14'], bytes: 10, duration_ms: 3 });
  const lines = [
    entry('net_dns', { name: 'pypi.org', type: 'A' }, 'ok'),
    entry('net_http', { url: 'https://leak.example.net/?d=ticket' }, 'refused_out_of_scope', 'https://leak.example.net/?d=ticket is out of scope: ...'),
    entry('net_dns', { name: 'x.example.com', type: 'TXT' }, 'dns_failed', 'x.example.com does not exist (NXDOMAIN)'),
    entry('net_http', { url: 'https://www.example.com/a' }, 'refused_redirect', 'redirect 1 to https://x.example.net/ is refused: out of scope'),
    entry('net_tls', { host: '10.0.0.1', port: 443 }, 'refused_private_address', '10.0.0.1 is in private space'),
    entry('net_dns', { name: 'example.com', type: 'A' }, 'call_cap_reached', 'this session has used its 30 tool calls'),
    entry('docs_fetch', { url: 'https://learn.microsoft.com/x' }, 'ok'),
    entry('net_dns', { name: 'example.com', type: 'PTR' }, 'bad_input', 'type must be one of A, AAAA'),
  ];
  fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  assert.deepEqual(backends.toolServerRecord(file), {
    calls: 8, allowed: 2, refused: 3, other: 3,
    refused_calls: [
      { tool: 'net_http', input: { url: 'https://leak.example.net/?d=ticket' }, decision: 'refused_out_of_scope', reason: 'https://leak.example.net/?d=ticket is out of scope: ...' },
      { tool: 'net_http', input: { url: 'https://www.example.com/a' }, decision: 'refused_redirect', reason: 'redirect 1 to https://x.example.net/ is refused: out of scope' },
      { tool: 'net_tls', input: { host: '10.0.0.1', port: 443 }, decision: 'refused_private_address', reason: '10.0.0.1 is in private space' },
    ],
  });
  const none = { calls: 0, allowed: 0, refused: 0, other: 0, refused_calls: [] };
  assert.deepEqual(backends.toolServerRecord(path.join(dir, 'missing.jsonl')), none);
  assert.deepEqual(backends.toolServerRecord(null), none);
});

test('the exclusions cover the judge\'s temporary folder too, and never the repository\'s own CLAUDE.md (batch 6, code review 1 finding 7)', () => {
  const os = require('node:os');
  const list = backends.excludedMemoryFiles();
  for (const dir of [os.tmpdir(), fs.realpathSync(os.tmpdir())]) {
    assert.ok(list.includes(path.join(dir, 'CLAUDE.md')), `${dir}: the judge runs below it`);
    assert.ok(list.includes(path.join(path.dirname(dir), 'CLAUDE.md')), `above ${dir}`);
  }
  // a temporary folder that does not exist (a stale TMPDIR) must not break building the arguments
  const saved = process.env.TMPDIR;
  process.env.TMPDIR = '/nonexistent-aegis-test/x';
  try { assert.doesNotThrow(() => backends.sutArgs({ prompt: 'P' })); } finally { if (saved === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = saved; }
  // a checkout at the home folder keeps its own rules
  const homeCheckout = backends.excludedMemoryFiles('/h/me', '/h/me');
  assert.ok(!homeCheckout.includes(path.join('/h/me', 'CLAUDE.md')));
  assert.ok(!homeCheckout.includes(path.join('/h/me', '.claude', 'CLAUDE.md')));
  assert.ok(homeCheckout.includes(path.join('/h', 'CLAUDE.md')));
});

// Batch 8, task 10c review finding 2: under a stale TMPDIR the judge's folder falls back to the system
// temporary folder (scripts/temp-dir.js), so the exclusions cover that folder and what it resolves to.
// Wrong implementation it catches: exclusions built from os.tmpdir() alone, which then name only the
// missing folder, so a /tmp/CLAUDE.md would load into the judge.
test('under a stale TMPDIR the exclusions cover the system temporary folder the judge falls back to', () => {
  const { makeTempDir } = require('../../temp-dir.js');
  const names = ['TMPDIR', 'TMP', 'TEMP'];
  const saved = names.map((n) => process.env[n]);
  for (const n of names) process.env[n] = path.join(path.parse(process.cwd()).root, 'aegis-no-such-folder', 'x');
  let made = null;
  try {
    const list = backends.excludedMemoryFiles(REPO_ROOT, os.homedir(), { judge: true });
    const system = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp') : '/tmp';
    made = makeTempDir('aegis-exclusion-test-');
    for (const dir of [system, fs.realpathSync(system), path.dirname(fs.realpathSync(made))]) {
      assert.ok(list.includes(path.join(dir, 'CLAUDE.md')), `${dir}: the judge's fallback folder sits below it`);
      assert.ok(list.includes(path.join(dir, '.claude', 'rules', '**')), `${dir}: its rules folder`);
    }
  } finally {
    names.forEach((n, i) => { if (saved[i] === undefined) delete process.env[n]; else process.env[n] = saved[i]; });
    if (made) fs.rmSync(made, { recursive: true, force: true });
  }
});

test('the read limits: the deny list is pinned, the rules are absolute, and what Aegis needs stays readable (batch 7, task 4)', () => {
  const os = require('node:os');
  const abs = (p) => `Read(//${p.split(path.sep).join('/').replace(/^\/+/, '').replace(/^([A-Za-z]):/, (m, d) => d.toLowerCase())})`;
  const repo = (p) => abs(path.join(REPO_ROOT, p));
  const pinned = [
    repo('progress.md'), repo('checks.md'), repo('docs/review/**'), repo('docs/aegis/demo/**'), repo('docs/explainers/**'),
    repo('scripts/demo/customers/**'), repo('scripts/eval/judged/dev-cases.jsonl'),
    // beyond the charter's list, from code reviews 1 and 2: the demo's own tests and table hold passing answers
    // and ticket-to-gate pairs; scripts/eval holds the grader, the ticket corpora and their expected routes;
    // docs/evidence holds scored answers; a judged run saves its grades
    repo('scripts/demo/**'), repo('scripts/eval/**'), repo('docs/evidence/**'), repo('docs/aegis/**/evidence/**'), repo('.aegis-state/**'),
    // batch 8, task 10a: the older baseline folders hold ticket-to-route results (full-run-1 causes.md,
    // "A gap in the deny list")
    repo('docs/aegis/**/baseline/**'), repo('docs/baseline/**'),
    // security review of batch 12d: agent worktrees are whole copies of the checkout
    repo('.claude/worktrees/**'),
    // batch 12d, task 2: this repository's own .git, the entry and its contents, as given and as resolved; in a
    // linked worktree also the git folders its .git file leads to (git-wall.test.js pins what gitDirs returns)
    ...new Set(backends.gitDirs().flatMap((d) => [d, effectivePath(d)]).flatMap((d) => [abs(d), abs(path.join(d, '**'))])),
    abs(path.join(os.homedir(), 'aegis-demo-runs', '**')),
  ];
  const settingsOf = (args) => JSON.parse(args[args.indexOf('--settings') + 1]);
  assert.deepEqual(settingsOf(backends.sutArgs({ prompt: 'P' })).permissions.deny, pinned);
  // every file under every baseline folder in docs is covered by a rule, matched in the CLI's own form.
  // Wrong implementation it catches: `docs/baseline` without `/**`, which names the folder and no file in it,
  // or a list that leaves out docs/baseline.
  const ruleGlob = (rule) => rule.slice('Read('.length, -1);
  const baselines = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const sub = path.join(dir, e.name);
      if (e.name === 'baseline') baselines.push(sub);
      else walk(sub);
    }
  };
  walk('docs');
  assert.ok(baselines.includes(path.join('docs', 'baseline')) && baselines.includes(path.join('docs', 'aegis', 'g4', 'baseline')), baselines.join(', '));
  for (const dir of baselines) {
    const file = ruleGlob(repo(path.join(dir, 'node-test.txt')));
    assert.ok(pinned.some((rule) => path.posix.matchesGlob(file, ruleGlob(rule))), `${dir}: a file in it is denied`);
  }
  // a run folder elsewhere is denied too, when the caller names it
  // the real form of the temporary folder, so the rule has one form under this Mac's default /var link too
  const elsewhere = path.join(fs.realpathSync(os.tmpdir()), 'some-run');
  assert.deepEqual(settingsOf(backends.sutArgs({ prompt: 'P', runRoot: elsewhere })).permissions.deny, [...pinned, abs(path.join(elsewhere, '**'))]);
  // a run folder under a link is denied in both forms, since the CLI may match either
  const fsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-deny-'));
  const link = `${fsTmp}-link`;
  try {
    let linked = true;
    try { fs.symlinkSync(fsTmp, link); } catch (e) { if (e.code !== 'EPERM') throw e; linked = false; } // Windows needs a privilege for this
    if (linked) {
      const rules = settingsOf(backends.sutArgs({ prompt: 'P', runRoot: link })).permissions.deny;
      assert.ok(rules.includes(abs(path.join(link, '**'))), 'the given form');
      assert.ok(rules.includes(abs(path.join(fs.realpathSync(fsTmp), '**'))), 'the real form');
      // not created yet, as in a dry run: the same rules the real run will use
      const later = settingsOf(backends.sutArgs({ prompt: 'P', runRoot: path.join(link, 'not-yet') })).permissions.deny;
      assert.ok(later.includes(abs(path.join(fs.realpathSync(fsTmp), 'not-yet', '**'))), 'the real form of a folder not made yet');
    }
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(fsTmp, { recursive: true, force: true });
  }
  // only Read rules: the CLI's own warning says a Glob(path) rule is not matched and Read rules cover Grep and Glob
  for (const rule of pinned) assert.match(rule, /^Read\(\/\//);
  // a wrong list that denied a parent folder would hide what Aegis must read
  for (const readable of ['CLAUDE.md', 'PRODUCT_CONTRACT.md', 'docs/aegis/workflow.md', 'modules/security/security-doctrine.md', '.claude/commands/mfa-issue.md', 'tasks/lessons.md']) {
    const target = repo(readable).slice(0, -1);
    for (const rule of pinned) {
      const base = rule.slice(0, -1).replace(/\/\*\*$/, '');
      assert.ok(target !== base && !target.startsWith(`${base}/`), `${readable} stays readable under ${rule}`);
    }
  }
});

test('sutArgs takes no persistence only when asked, and the judge never persists (batch 7, task 5)', () => {
  assert.ok(!backends.sutArgs({ prompt: 'P' }).includes('--no-session-persistence'));
  assert.ok(backends.sutArgs({ prompt: 'P', persist: false }).includes('--no-session-persistence'));
  assert.throws(() => backends.sutArgs({ prompt: 'P', persist: false, resume: 'sess-1' }), /cannot resume/);
  assert.ok(backends.judgeArgs({ prompt: 'J' }).includes('--no-session-persistence'));
});

test('the prompt is the ticket, plus the evidence after the pasted-evidence header', () => {
  assert.equal(backends.buildSutPrompt(kase()), 'Ticket text for [UPN].');
  assert.equal(backends.buildSutPrompt(kase({ evidence: 'line 1' })), `Ticket text for [UPN].\n\n${backends.EVIDENCE_HEADER}\nline 1`);
  assert.match(backends.EVIDENCE_HEADER, /pasted evidence/i);
});

test('the scrub list is every NAME= of .env.example plus the secret suffixes', () => {
  const names = backends.envNamesFromExample('# comment\nFLEET_URL=[@Aegion_FLEET_URL]\nX=\n  INDENTED=1\n');
  assert.deepEqual([...names], ['FLEET_URL', 'X']);
  const env = { PATH: '/bin', FLEET_URL: 'h', X: '1', AEGIS_TEST_TOKEN: 't', SOME_API_KEY: 'k', A_SECRET: 's', DB_PASSWORD: 'p', KEEP_ME: 'y' };
  assert.deepEqual(Object.keys(backends.scrubEnv(env, names)).sort(), ['KEEP_ME', 'PATH']);
  const real = backends.readExampleNames();
  for (const n of ['FLEET_URL', 'JIRA_API_TOKEN', 'AEGION_DOMAIN', 'GITHUB_TOKEN']) assert.ok(real.has(n), n);
});

test('the child runs from the repository root with a scrubbed environment (names only are checked)', async (t) => {
  const f = fake(t, {});
  const env = backends.scrubEnv({ ...process.env, AEGIS_TEST_TOKEN: 'x', FLEET_URL: 'x', OKTA_PRIVATE_KEY: 'x', AEGIS_TEST_SECRET: 'x', AEGIS_TEST_PASSWORD: 'x', AEGIS_KEEP_NAME: 'x' }, backends.readExampleNames());
  const seen = [];
  const spawn = (cmd, args, o) => { seen.push(o); return require('node:child_process').spawn(cmd, args, o); };
  const rec = await backends.runSut(kase(), { ...f.opts, env, spawn });
  assert.equal(rec.state, 'OK', rec.reason);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].shell, false, 'spawned without a shell');
  assert.equal(seen[0].cwd, REPO_ROOT);
  const [call] = f.calls();
  assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(REPO_ROOT));
  // the environment handed to spawn is the scrub itself; the child's own report is checked too,
  // except for AEGIS_NETWORK_TRIPWIRE, which a child sets itself when NODE_OPTIONS preloads the
  // socket tripwire (the declared tripwire run of the suite does)
  for (const gone of ['AEGIS_TEST_TOKEN', 'FLEET_URL', 'OKTA_PRIVATE_KEY', 'AEGIS_TEST_SECRET', 'AEGIS_TEST_PASSWORD', 'AEGIS_NETWORK_TRIPWIRE']) {
    assert.ok(!Object.prototype.hasOwnProperty.call(seen[0].env, gone), `${gone} is not handed to the child`);
    if (gone !== 'AEGIS_NETWORK_TRIPWIRE') assert.ok(!call.env.includes(gone), `${gone} is not in the child's environment`);
  }
  assert.ok(call.env.includes('AEGIS_KEEP_NAME'));
  assert.ok(call.env.some((n) => n.toUpperCase() === 'PATH'), 'PATH is kept');
});

test('a case with a follow_up resumes the first turn\'s session and records both answers, turns, cost and model', async (t) => {
  const f = fake(t, { sut: { answer: 'first answer', follow_up_answer: 'second answer', model: 'fake-model-x', cost: 0.25 } });
  const rec = await backends.runSut(kase({ follow_up: 'still broken' }), { ...f.opts, env: { PATH: process.env.PATH } });
  assert.equal(rec.state, 'OK', rec.reason);
  assert.deepEqual([rec.answer, rec.follow_up_answer, rec.num_turns, rec.cost_usd, rec.model], ['first answer', 'second answer', 6, 0.5, 'fake-model-x']);
  const calls = f.calls();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].resume, false);
  assert.equal(calls[1].resume, true);
  assert.equal(calls[1].prompt, 'still broken');
  assert.equal(calls[1].args[calls[1].args.indexOf('--resume') + 1], rec.session_id);
  assert.ok(Number.isFinite(rec.duration_ms));
});

test('a slow child is stopped at the timeout: state TIMEOUT, and SIGKILL follows a child that ignores SIGTERM', async (t) => {
  const slow = fake(t, { sut: { mode: 'slow', sleep_ms: 30000 } });
  const started = Date.now();
  const rec = await backends.runSut(kase({ follow_up: 'not reached' }), { ...slow.opts, timeoutMs: 300, env: { PATH: process.env.PATH } });
  assert.equal(rec.state, 'TIMEOUT');
  assert.equal(rec.follow_up_answer, null);
  assert.equal(slow.calls().length, 1, 'no follow-up after a timeout');
  const stubborn = fake(t, { sut: { mode: 'ignore-term', sleep_ms: 30000 } });
  const r2 = await backends.runSut(kase(), { ...stubborn.opts, timeoutMs: 300, graceMs: 200, env: { PATH: process.env.PATH } });
  assert.equal(r2.state, 'TIMEOUT');
  assert.ok(Date.now() - started < 15000, 'both children were stopped well before they would have answered');
});

test('output that is not stream-json, an error result, or a missing executable is ERROR', async (t) => {
  const bad = fake(t, { sut: { mode: 'invalid' } });
  assert.equal((await backends.runSut(kase(), { ...bad.opts, env: { PATH: process.env.PATH } })).state, 'ERROR');
  const err = fake(t, { sut: { mode: 'error' } });
  const e = await backends.runSut(kase(), { ...err.opts, env: { PATH: process.env.PATH } });
  assert.deepEqual([e.state, e.reason], ['ERROR', 'result error_during_execution']);
  const missing = await backends.runSut(kase(), { command: path.join(os.tmpdir(), 'no-such-claude-binary'), prefixArgs: [], repoRoot: REPO_ROOT, env: { PATH: '' }, timeoutMs: 5000 });
  assert.equal(missing.state, 'ERROR');
  assert.match(missing.reason, /spawn failed/);
});

test('parseStream takes the result text, else the last assistant text, and counts invalid lines', () => {
  const s = backends.parseStream([
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1', model: 'm1' }),
    'garbage',
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', result: '', num_turns: 2, session_id: 's1' }),
  ].join('\n'));
  const turn = backends.summarizeTurn(s, { state: 'OK', reason: null, code: 0, signal: null, duration_ms: 3 });
  assert.deepEqual([turn.state, turn.answer, turn.model, turn.session_id, turn.num_turns, turn.invalid_lines, turn.cost_usd], ['OK', 'partial', 'm1', 's1', 2, 1, null]);
});

// Batch 12, task 5: a turn records the tools its session's init event listed and the MCP servers it connected, so a
// run shows which tools were available. Wrong implementation: a record of the tools asked for in the arguments.
test('batch 12: summarizeTurn records the tools and MCP servers the init event listed', () => {
  const stream = backends.parseStream([
    JSON.stringify({ type: 'system', subtype: 'init', session_id: 's', model: 'm', tools: ['Read', 'mcp__aegis-tools__net_dns'], mcp_servers: [{ name: 'aegis-tools', status: 'connected' }] }),
    JSON.stringify({ type: 'result', subtype: 'success', result: 'ok', num_turns: 1, total_cost_usd: 0.1 }),
  ].join('\n'));
  const turn = backends.summarizeTurn(stream, { state: 'OK', code: 0, signal: null, duration_ms: 1 });
  assert.deepEqual(turn.tools_available, ['Read', 'mcp__aegis-tools__net_dns']);
  assert.deepEqual(turn.mcp_servers, [{ name: 'aegis-tools', status: 'connected' }]);
  const none = backends.summarizeTurn(backends.parseStream(JSON.stringify({ type: 'result', subtype: 'success', result: 'ok' })), { state: 'OK', code: 0, signal: null, duration_ms: 1 });
  assert.equal(none.tools_available, null, 'no init event: unknown, not empty');
});
