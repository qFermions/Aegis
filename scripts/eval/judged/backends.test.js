'use strict';
require('../../adapters/socket-tripwire.js');
// backends.test.js: the system-under-test and judge backends (capability row 26, B3).
//
// EXPECTED DECISION (written before the module)
// - The SUT command line is claude -p <prompt> --output-format stream-json --verbose
//   --max-turns N --tools Read Grep Glob Agent --allowedTools (same) --disallowedTools Bash
//   WebFetch WebSearch; --web moves WebFetch and WebSearch to the allowed set. The judge's is
//   one turn, --tools "", --no-session-persistence, plus --model when given.
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
const { REPO_ROOT } = require('./paths.js');

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

test('the SUT and judge command lines match the spec; --web moves the web tools to the allowed set', () => {
  assert.deepEqual(backends.sutArgs({ prompt: 'P', maxTurns: 24 }), ['-p', 'P', '--output-format', 'stream-json', '--verbose', '--max-turns', '24', '--tools', 'Read', 'Grep', 'Glob', 'Agent', '--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch']);
  const web = backends.sutArgs({ prompt: 'P', maxTurns: 5, web: true });
  assert.deepEqual(web.slice(web.indexOf('--allowedTools'), web.indexOf('--disallowedTools')), ['--allowedTools', 'Read', 'Grep', 'Glob', 'Agent', 'WebFetch', 'WebSearch']);
  assert.deepEqual(web.slice(web.indexOf('--disallowedTools')), ['--disallowedTools', 'Bash']);
  assert.deepEqual(backends.sutArgs({ prompt: 'F', resume: 'sess-1' }).slice(0, 4), ['-p', 'F', '--resume', 'sess-1']);
  assert.deepEqual(backends.judgeArgs({ prompt: 'J' }), ['-p', 'J', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', '', '--no-session-persistence']);
  assert.deepEqual(backends.judgeArgs({ prompt: 'J', model: 'judge-x' }).slice(-2), ['--model', 'judge-x']);
  assert.equal(backends.sutArgs({ prompt: '--looks-like-a-flag' })[1], ' --looks-like-a-flag', 'a prompt never reads as an option');
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
