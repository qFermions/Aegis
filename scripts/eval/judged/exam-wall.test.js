'use strict';
require('../../adapters/socket-tripwire.js');
// exam-wall.test.js: the exam wall and the reading record of the judged runner (batch 11, task 7).
//
// EXPECTED DECISION (written before the code)
// - The folder a --cases file is read from is denied to every system-under-test turn, the way the results
//   folder is: in its given form and in its resolved form (and, for a case file that is itself a link, the
//   folder the file really sits in). The dry run's command preview lists the rule, and still exits 4.
// - A case folder that holds the repository (the home folder, the file system root) cannot be denied without
//   denying the runbooks, so the run is refused as an input error that says to put the case file in a folder
//   of its own. Nothing of the case file is echoed.
// - Every tool call a session makes is recorded per case in results.json, from the stream: the tool name and,
//   for Read, the file path; for Grep and Glob, the pattern and the path; for Agent, a short label (its
//   subagent type and description), never its prompt. A call made inside a subagent is recorded and marked.
//   A path, pattern or label longer than 300 characters is cut. A call the stream reports as refused or
//   failed is recorded with error true.
// - A case whose session read a path outside the repository is INCONCLUSIVE, with the path in its reasons: a
//   Read, or a Grep or Glob whose path argument is outside, in the path's given form or its real form;
//   relative paths resolve against the repository root. A read the stream reports as refused or failed read
//   nothing and does not count. A case that read only inside the repository keeps its verdict. report.md
//   has one line with the count of such cases.
// - Each case records its answer's Fix card word count, by the desk's own counter (fixCard(answer).words in
//   scripts/demo/answer.js), null when the answer has no card. It is a measure, never a pass or fail;
//   report.md shows the minimum, median and maximum.
// Run: node --test scripts/eval/judged/exam-wall.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./backends.js');
const cases = require('./cases.js');
const judge = require('./judge.js');
const paths = require('./paths.js');
const report = require('./report.js');
const cli = require('../judged-eval.js');
const { fixCard, words } = require('../../demo/answer.js');

const { REPO_ROOT } = paths;
const CLI = path.join(__dirname, '..', 'judged-eval.js');
const DEV = path.join(__dirname, 'dev-cases.jsonl');
const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
const DEV_CASES = cases.readCaseFile(DEV).cases;

// the CLI's absolute rule form, as backends.test.js writes it
const rule = (p) => `Read(//${p.split(path.sep).join('/').replace(/^\/+/, '').replace(/^([A-Za-z]):/, (m, d) => d.toLowerCase())}/**)`;
const denyOf = (args) => JSON.parse(args[args.indexOf('--settings') + 1]).permissions.deny;
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
function link(target, at) {
  try { fs.symlinkSync(target, at); return true; } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') return false; throw e; } // Windows needs a privilege
}

// ── The wall ────────────────────────────────────────────────────────────────────────────────────────────

// Wrong implementations this catches: the case folder denied in its given form only (the CLI may match the
// real one, and this Mac's temporary folder sits behind a link); a rule added for the first turn only; a
// rule that names the case file and not its folder.
test('the case folder joins the deny list in its given and resolved forms, after the pinned rules', (t) => {
  const real = fs.realpathSync(tmp(t, 'aegis-wall-'));
  const base = denyOf(backends.sutArgs({ prompt: 'P' }));
  assert.deepEqual(denyOf(backends.sutArgs({ prompt: 'P', caseDirs: [real] })), [...base, rule(real)], 'one form when the folder has no link in it');
  assert.deepEqual(backends.readDenyRules(null, [real]), [...backends.readDenyRules(), rule(real)]);
  // with a results folder too: the pinned rules, the results folder, then the case folder
  const results = path.join(real, 'results');
  assert.deepEqual(denyOf(backends.sutArgs({ prompt: 'P', runRoot: results, caseDirs: [real] })), [...base, rule(results), rule(real)]);
  // a resumed turn carries it too
  assert.ok(denyOf(backends.sutArgs({ prompt: 'F', resume: 'sess-1', caseDirs: [real] })).includes(rule(real)));
  // the judge has no tools and gets no case folder rule
  assert.deepEqual(denyOf(backends.judgeArgs({ prompt: 'J' })), base);
  const at = `${real}-link`;
  t.after(() => fs.rmSync(at, { force: true }));
  if (link(real, at)) {
    const rules = denyOf(backends.sutArgs({ prompt: 'P', caseDirs: [at] }));
    assert.ok(rules.includes(rule(at)), 'the given form');
    assert.ok(rules.includes(rule(real)), 'the resolved form');
  }
});

// Wrong implementations this catches: only the folder of the path as typed (a case file that is a link then
// leaves the folder the file really sits in readable); a refusal that only compares the typed form, so a
// link to the home folder gets through; a refusal that names the file.
test('caseFolders gives the folders to deny, and refuses a folder that holds the repository', (t) => {
  const root = fs.realpathSync(tmp(t, 'aegis-wall-home-'));
  const repo = path.join(root, 'home', 'code', 'repo');
  const own = path.join(root, 'home', 'cases');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(own);
  const file = path.join(own, 'secret-name.jsonl');
  fs.writeFileSync(file, '');
  assert.deepEqual(paths.caseFolders(file, file, { repoRoot: repo }), [own]);
  // a case file that is a link: the folder of the link and the folder of the file
  const elsewhere = path.join(root, 'elsewhere');
  fs.mkdirSync(elsewhere);
  const linked = path.join(elsewhere, 'cases.jsonl');
  if (link(file, linked)) assert.deepEqual(paths.caseFolders(linked, fs.realpathSync(linked), { repoRoot: repo }), [elsewhere, own]);
  // the home folder, and the root, hold the repository
  for (const dir of [path.join(root, 'home'), path.join(root, 'home', 'code'), root, path.parse(root).root]) {
    const inAncestor = path.join(dir, 'secret-name.jsonl');
    assert.throws(() => paths.caseFolders(inAncestor, inAncestor, { repoRoot: repo }), (e) => {
      assert.ok(e instanceof paths.PathRefused, e.message);
      assert.match(e.message, /folder of its own/);
      assert.ok(!e.message.includes('secret-name'), 'the file is not named');
      return true;
    }, dir);
  }
  // a link to the home folder is the home folder
  const alias = path.join(root, 'alias');
  if (link(path.join(root, 'home'), alias)) {
    const viaLink = path.join(alias, 'secret-name.jsonl');
    assert.throws(() => paths.caseFolders(viaLink, viaLink, { repoRoot: repo }), /folder of its own/);
  }
});

function setup(t, fakeConfig = {}) {
  const dir = tmp(t, 'aegis-judged-wall-');
  const copy = path.join(dir, 'dev-cases.jsonl');
  fs.copyFileSync(DEV, copy);
  const cfg = path.join(dir, 'fake.json');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(cfg, JSON.stringify({ log, ...fakeConfig }));
  const out = [];
  const err = [];
  const deps = { backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, env: { PATH: process.env.PATH }, graceMs: 200 };
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, copy, out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) }, deps, calls, results: path.join(dir, 'results') };
}

// Wrong implementation this catches: the rule built for the run only, so the dry run's preview shows a
// command the real run does not use; a dry run that no longer exits 4.
test('the dry run still exits 4 and its command preview lists the case folder rule, through main and the real CLI', async (t) => {
  const s = setup(t);
  assert.equal(await cli.main(['run', '--cases', s.copy], s.io, { ...s.deps, spawn: () => { throw new Error('spawn in a dry run'); } }), 4, s.err.join('\n'));
  const preview = s.out.find((l) => l.startsWith('system under test: claude '));
  assert.ok(preview.includes(rule(fs.realpathSync(s.dir))), 'the resolved form of the case folder is in the preview');
  assert.ok(s.out.some((l) => /^case folder: denied to the system under test/.test(l)), s.out.join('\n'));
  assert.ok(!s.out.find((l) => l.startsWith('judge: claude ')).includes(rule(fs.realpathSync(s.dir))), 'not in the judge command');
  const real = spawnSync(process.execPath, [CLI, 'run', '--cases', s.copy], { encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(real.status, 4, real.stderr);
  assert.ok(real.stdout.includes(rule(fs.realpathSync(s.dir))));
});

// Wrong implementation this catches: runSut passing the case folder to the first turn only, or judged-eval.js
// never passing it.
test('every system-under-test turn of a run denies the case folder, the follow-up included', async (t) => {
  const s = setup(t);
  assert.equal(await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results], s.io, s.deps), 3, `${s.out.join('\n')}\n${s.err.join('\n')}`);
  const sut = s.calls().filter((c) => c.role === 'sut');
  assert.equal(sut.length, 9);
  assert.equal(sut.filter((c) => c.resume).length, 1);
  for (const call of sut) assert.ok(denyOf(call.args).includes(rule(fs.realpathSync(s.dir))), `${call.resume ? 'the follow-up' : 'a first'} turn denies the case folder`);
});

test('a case file in a folder that holds the repository is refused (exit 1) before anything is read or started', async (t) => {
  const root = fs.realpathSync(tmp(t, 'aegis-wall-cli-'));
  const repo = path.join(root, 'home', 'code', 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const file = path.join(root, 'home', 'dev-cases.jsonl');
  fs.copyFileSync(DEV, file);
  const out = [];
  const err = [];
  const code = await cli.main(['run', '--cases', file], { out: (x) => out.push(x), err: (x) => err.push(x) }, { repoRoot: repo, spawn: () => { throw new Error('spawn'); } });
  assert.equal(code, 1);
  assert.equal(out.length, 0);
  assert.match(err.join('\n'), /^judged-eval: the case file sits in a folder that holds the repository/);
  assert.match(err.join('\n'), /folder of its own/);
  for (const c of DEV_CASES) assert.ok(!err.join('\n').includes(c.ticket.slice(0, 30)), 'no case text');
});

// ── The reading record ──────────────────────────────────────────────────────────────────────────────────

const ev = (o) => JSON.stringify(o);
const use = (id, name, input, parent = null) => ev({ type: 'assistant', parent_tool_use_id: parent, message: { content: [{ type: 'tool_use', id, name, input }] } });
const res = (id, isError, parent = null) => ev({ type: 'user', parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: 'RESULT-TEXT-MARKER' }] } });
const inRepo = (...p) => path.join(REPO_ROOT, ...p);

// Wrong implementations this catches: only the top-level session's calls (a subagent's are dropped); the
// Agent prompt stored; no cap; a refused read recorded like a read that worked; the answer text lost when a
// message holds text and a tool call.
test('the stream gives one record per tool call: Read, Grep, Glob, Agent, a subagent call, a refused read, a long pattern', () => {
  const long = 'x'.repeat(500);
  const stream = backends.parseStream([
    ev({ type: 'system', subtype: 'init', session_id: 's1', model: 'm1' }),
    use('t1', 'Read', { file_path: inRepo('CLAUDE.md') }),
    res('t1', false),
    use('t2', 'Grep', { pattern: 'okta', path: inRepo('.claude', 'commands'), '-i': true, output_mode: 'count' }),
    res('t2', false),
    use('t3', 'Grep', { pattern: 'SAFETY GATE', output_mode: 'files_with_matches' }),
    use('t4', 'Glob', { pattern: '.claude/commands/*okta*', path: REPO_ROOT }),
    use('t5', 'Agent', { description: 'Fresh review of the work-up', subagent_type: 'evidence-reviewer', prompt: 'AGENT-PROMPT-MARKER review this draft in full' }),
    use('t6', 'Read', { file_path: inRepo('REVIEW.md') }, 't5'),
    res('t6', false, 't5'),
    use('t7', 'Read', { file_path: inRepo('progress.md') }),
    res('t7', true),
    use('t8', 'Grep', { pattern: long, path: long }),
    ev({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'the answer' }, { type: 'tool_use', id: 't9', name: 'WebFetch', input: { url: 'https://example.net/page', prompt: 'WEB-PROMPT-MARKER' } }] } }),
    ev({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id: 't10', name: 42, input: null }] } }),
    ev({ type: 'result', subtype: 'success', result: '', num_turns: 5, session_id: 's1' }),
  ].join('\n'));
  assert.equal(stream.lastAssistantText, 'the answer');
  const records = stream.toolCalls.map(backends.toolCallRecord);
  assert.deepEqual(records, [
    { tool: 'Read', path: inRepo('CLAUDE.md'), subagent: false, error: false },
    { tool: 'Grep', pattern: 'okta', path: inRepo('.claude', 'commands'), subagent: false, error: false },
    { tool: 'Grep', pattern: 'SAFETY GATE', subagent: false, error: false },
    { tool: 'Glob', pattern: '.claude/commands/*okta*', path: REPO_ROOT, subagent: false, error: false },
    { tool: 'Agent', label: 'evidence-reviewer: Fresh review of the work-up', subagent: false, error: false },
    { tool: 'Read', path: inRepo('REVIEW.md'), subagent: true, error: false },
    { tool: 'Read', path: inRepo('progress.md'), subagent: false, error: true },
    { tool: 'Grep', pattern: `${'x'.repeat(300)} [cut]`, path: `${'x'.repeat(300)} [cut]`, subagent: false, error: false },
    { tool: 'WebFetch', subagent: false, error: false },
    { tool: 'unknown', subagent: false, error: false },
  ]);
  const stored = JSON.stringify(records);
  for (const marker of ['AGENT-PROMPT-MARKER', 'WEB-PROMPT-MARKER', 'RESULT-TEXT-MARKER']) assert.ok(!stored.includes(marker), `${marker} is not stored`);
  // a long Agent description is cut too
  const agent = backends.parseStream(use('a1', 'Agent', { description: 'd'.repeat(400), subagent_type: 'general-purpose', prompt: 'p' })).toolCalls.map(backends.toolCallRecord);
  assert.equal(agent[0].label, `${`general-purpose: ${'d'.repeat(400)}`.slice(0, 300)} [cut]`);
});

// Wrong implementations this catches: only absolute paths checked (a relative ../ path escapes); only Read
// checked; only the typed form compared (a link inside the repository that leads out); a refused read
// counted as a read; a subagent's read not counted.
test('outsideReads names each path read outside the repository, in its given or its real form', (t) => {
  const root = fs.realpathSync(tmp(t, 'aegis-wall-reads-'));
  const repo = path.join(root, 'repo');
  const out = path.join(root, 'outside');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'answers.md'), 'x');
  const call = (tool, input, extra = {}) => ({ tool, ...input, subagent: false, error: false, ...extra });
  const inside = [
    call('Read', { path: path.join(repo, 'CLAUDE.md') }),
    call('Read', { path: 'docs/workflow.md' }),
    call('Read', { path: './docs/../CLAUDE.md' }),
    call('Grep', { pattern: 'okta', path: path.join(repo, 'docs') }),
    call('Grep', { pattern: '/etc/passwd' }),
    call('Glob', { pattern: '**/*.md' }),
    call('Glob', { pattern: '*.md', path: repo }),
    call('Agent', { label: 'reviewer: check' }),
    // a refused or failed read read nothing
    call('Read', { path: path.join(out, 'answers.md') }, { error: true }),
  ];
  assert.deepEqual(backends.outsideReads(inside, repo), []);
  const outsideFile = path.join(out, 'answers.md');
  assert.deepEqual(backends.outsideReads([...inside, call('Read', { path: outsideFile })], repo), [outsideFile]);
  assert.deepEqual(backends.outsideReads([call('Read', { path: '../outside/answers.md' })], repo), ['../outside/answers.md'], 'a relative path resolves against the repository root');
  assert.deepEqual(backends.outsideReads([call('Grep', { pattern: 'x', path: out })], repo), [out]);
  assert.deepEqual(backends.outsideReads([call('Glob', { pattern: '*.md', path: out })], repo), [out]);
  assert.deepEqual(backends.outsideReads([call('Read', { path: outsideFile }, { subagent: true })], repo), [outsideFile], 'a subagent read counts');
  assert.deepEqual(backends.outsideReads([call('Read', { path: outsideFile }), call('Read', { path: outsideFile })], repo), [outsideFile], 'each path once');
  // a folder next to the repository whose name starts with the repository's is outside
  assert.deepEqual(backends.outsideReads([call('Read', { path: `${repo}-copy/CLAUDE.md` })], repo), [`${repo}-copy/CLAUDE.md`]);
  // a link inside the repository that leads out: the typed form is inside, the real form is not
  const leak = path.join(repo, 'docs', 'leak');
  if (link(out, leak)) assert.deepEqual(backends.outsideReads([call('Read', { path: path.join(leak, 'answers.md') })], repo), [path.join(leak, 'answers.md')]);
  // a long path is named cut, like the record
  const longPath = path.join(out, 'y'.repeat(400));
  assert.deepEqual(backends.outsideReads([call('Read', { path: longPath })], repo), [`${longPath.slice(0, 300)} [cut]`]);
});

const kase = { id: 'W1', class: 'DIAGNOSTIC', probe: '', follow_up: '', expected: { must: ['One.'], must_not: [], change_class: 'none' } };
const okJudge = () => {
  const shape = judge.shapeFor(kase);
  for (const k of Object.keys(shape.scores)) if (shape.scores[k] !== null) shape.scores[k] = 2;
  shape.must.forEach((m) => { m.met = true; });
  return { state: 'OK', ...shape, notes: '' };
};

// Wrong implementations this catches: an outside read that only adds a reason to a PASS; a FAIL that stays a
// FAIL (it could then count against a pass rate it should be left out of); a reason with no path.
test('caseVerdict: reads inside the repository leave the verdict; a read outside makes it INCONCLUSIVE and names the path', () => {
  const pass = [{ check: 'boundary', verdict: 'pass', applies: true, span: null }];
  const sut = (outside) => ({ state: 'OK', answer: 'a', follow_up_answer: null, tool_calls: [], ...(outside === undefined ? {} : { outside_reads: outside }) });
  for (const s of [sut(undefined), sut([])]) {
    const v = judge.caseVerdict(kase, s, pass, okJudge());
    assert.deepEqual([v.verdict, v.reasons], ['PASS', []]);
  }
  const v = judge.caseVerdict(kase, sut(['/elsewhere/answers.md']), pass, okJudge());
  assert.equal(v.verdict, 'INCONCLUSIVE');
  assert.deepEqual(v.reasons, ['read outside the repository: /elsewhere/answers.md']);
  assert.equal(v.total, v.max, 'the score is kept for the record');
  // a failing answer that read outside is INCONCLUSIVE too, with both reasons
  const failed = judge.caseVerdict(kase, sut(['/elsewhere/answers.md']), [{ check: 'privacy', verdict: 'fail', applies: true, span: 'x' }], okJudge());
  assert.deepEqual([failed.verdict, failed.reasons], ['INCONCLUSIVE', ['read outside the repository: /elsewhere/answers.md', 'check privacy fail']]);
  // many paths: the first five are named, then a count
  const many = judge.caseVerdict(kase, sut(['/a', '/b', '/c', '/d', '/e', '/f', '/g']), pass, okJudge());
  assert.deepEqual(many.reasons, ['read outside the repository: /a', 'read outside the repository: /b', 'read outside the repository: /c', 'read outside the repository: /d', 'read outside the repository: /e', 'read outside the repository: 2 more path(s)']);
});

// A Fix card of a known size, and the same answer's longer Details.
const CARD_ANSWER = [
  '## Fix',
  "What's wrong: The sign-in is blocked by a stale session token for [UPN].",
  'Do this:',
  '1. Open the admin center and find [UPN].',
  '2. HUMAN-RUN: the administrator revokes the sessions after explicit approval.',
  '3. Ask the user to sign in again.',
  'Done when: Read-back: confirm the sign-in log now shows Success for [UPN].',
  'Stop if: The account shows a risk flag.',
  'Tell the user now: IT is looking at your sign-in.',
  'Tell the user when done: You can sign in again.',
  '',
  '## Details',
  'Possible prompt injection in the pasted content: flagging and ignoring it. Urgency does not bypass the approval.',
  'Ticket note: [JIRA-###] advised the steps above; the administrator ran them and verified the read-back.',
].join('\n');

// Wrong implementations this catches: a word count of the whole answer; 0 for an answer with no card read as
// a real count in the minimum; a mean in place of the median; a case that timed out counted as "no card".
test('the Fix card word count: per case by the desk\'s counter, null with no card, and min, median and max in the summary', () => {
  const r = (id, n, state = 'OK') => ({ id, platform: 'p', scenario: 's', change_class: 'none', verdict: 'INCONCLUSIVE', sut: { state, duration_ms: 1, cost_usd: null }, checks: [], judge: null, rows: null, total: null, max: null, reasons: [], fix_card_words: n });
  const m = (list) => report.summarize(list).measures.fix_card_words;
  assert.deepEqual(m([r('a', 120), r('b', 40), r('c', 60), r('d', null), r('e', null, 'TIMEOUT')]), { min: 40, median: 60, max: 120, over: 3, no_card: 1 });
  assert.deepEqual(m([r('a', 60), r('b', 40)]), { min: 40, median: 50, max: 60, over: 2, no_card: 0 }, 'an even count: the mean of the two middle values');
  assert.deepEqual(m([r('a', null)]), { min: null, median: null, max: null, over: 0, no_card: 1 });
  // results written before this task have no such field: nothing is counted
  const old = r('a', 1);
  delete old.fix_card_words;
  assert.deepEqual(m([old]), { min: null, median: null, max: null, over: 0, no_card: 1 });
  const expected = fixCard(CARD_ANSWER).words;
  assert.ok(expected > 40 && expected < words(CARD_ANSWER), `the card has ${expected} words, fewer than the whole answer`);
});

test('a run records the tool calls, the outside reads and the card words in results.json and report.md', async (t) => {
  const outsideFile = path.join(fs.realpathSync(os.tmpdir()), 'aegis-wall-elsewhere', 'notes.md');
  const dev02 = DEV_CASES[1].ticket.slice(0, 40);
  const toolCalls = [
    { name: 'Read', input: { file_path: inRepo('CLAUDE.md') } },
    { name: 'Grep', input: { pattern: 'SAFETY GATE', path: inRepo('.claude', 'commands') } },
    { name: 'Agent', input: { description: 'Fresh review', subagent_type: 'evidence-reviewer', prompt: 'AGENT-PROMPT-MARKER' } },
    { name: 'Read', input: { file_path: inRepo('REVIEW.md') }, parent: true },
    { name: 'Read', input: { file_path: inRepo('progress.md') }, error: true },
  ];
  const control = setup(t, { sut: { answer: CARD_ANSWER, tool_calls: toolCalls } });
  assert.equal(await cli.main(['run', '--cases', control.copy, '--execute', '--results-dir', control.results], control.io, control.deps), 3, `${control.out.join('\n')}\n${control.err.join('\n')}`);
  const before = JSON.parse(fs.readFileSync(path.join(control.results, 'results.json'), 'utf8'));
  assert.ok(before.cases.every((c) => c.verdict !== 'INCONCLUSIVE'), 'reads inside the repository leave every verdict as judged');
  assert.deepEqual(before.summary.outside_reads, { count: 0, ids: [] });
  const expectedCalls = [
    { turn: 1, tool: 'Read', path: inRepo('CLAUDE.md'), subagent: false, error: false },
    { turn: 1, tool: 'Grep', pattern: 'SAFETY GATE', path: inRepo('.claude', 'commands'), subagent: false, error: false },
    { turn: 1, tool: 'Agent', label: 'evidence-reviewer: Fresh review', subagent: false, error: false },
    { turn: 1, tool: 'Read', path: inRepo('REVIEW.md'), subagent: true, error: false },
    { turn: 1, tool: 'Read', path: inRepo('progress.md'), subagent: false, error: true },
  ];
  assert.deepEqual(before.cases[0].sut.tool_calls, expectedCalls);
  assert.deepEqual(before.cases[0].sut.outside_reads, []);
  // the case with a follow-up records both turns
  const followUp = before.cases.find((c) => DEV_CASES.find((d) => d.id === c.id).follow_up !== '');
  assert.deepEqual(followUp.sut.tool_calls, [...expectedCalls, ...expectedCalls.map((c) => ({ ...c, turn: 2 }))]);
  assert.ok(!fs.readFileSync(path.join(control.results, 'results.json'), 'utf8').includes('AGENT-PROMPT-MARKER'));
  // the card words: the desk's counter on each answer, and the three figures in the report
  const n = fixCard(CARD_ANSWER).words;
  assert.ok(before.cases.every((c) => c.fix_card_words === n), `each case records ${n}`);
  assert.deepEqual(before.summary.measures.fix_card_words, { min: n, median: n, max: n, over: 8, no_card: 0 });
  const md = fs.readFileSync(path.join(control.results, 'report.md'), 'utf8');
  assert.ok(md.includes(`| Fix card words, min / median / max (over 8 answers with a card, 0 without; a measure, not a pass or fail) | ${n} / ${n} / ${n} |`), md);
  assert.ok(md.includes('| Cases that read a path outside the repository (each is INCONCLUSIVE) | 0 |'), md);

  // the same run, where one case's session also reads a file outside the repository
  const s = setup(t, { sut: { answer: CARD_ANSWER, tool_calls: [...toolCalls, { match: dev02, name: 'Read', input: { file_path: outsideFile } }] } });
  const code = await cli.main(['run', '--cases', s.copy, '--execute', '--results-dir', s.results, '--pass-threshold', '0'], s.io, s.deps);
  const after = JSON.parse(fs.readFileSync(path.join(s.results, 'results.json'), 'utf8'));
  const verdicts = (json) => json.cases.filter((c) => c.id !== 'DEV02').map((c) => [c.id, c.verdict]);
  assert.deepEqual(verdicts(after), verdicts(before), 'the other cases keep their verdicts');
  const hit = after.cases.find((c) => c.id === 'DEV02');
  assert.equal(hit.verdict, 'INCONCLUSIVE');
  assert.equal(hit.reasons[0], `read outside the repository: ${outsideFile}`);
  assert.deepEqual(hit.sut.outside_reads, [outsideFile]);
  assert.deepEqual(after.summary.outside_reads, { count: 1, ids: ['DEV02'] });
  assert.equal(after.summary.inconclusive, 1);
  assert.equal(code, 2, 'an inconclusive case never lets the run pass');
  assert.ok(s.out.includes(`DEV02 INCONCLUSIVE ${hit.total}/${hit.max}`), s.out.join('\n'));
  assert.ok(!s.out.join('\n').includes(outsideFile), 'the path is in the files, not on the terminal');
  const md2 = fs.readFileSync(path.join(s.results, 'report.md'), 'utf8');
  assert.ok(md2.includes('| Cases that read a path outside the repository (each is INCONCLUSIVE) | 1 (DEV02) |'), md2);
  assert.ok(md2.includes(`read outside the repository: ${outsideFile}`), 'the case row names the path');

  // an answer with no card: null per case, and the report says so
  const plain = setup(t);
  assert.equal(await cli.main(['run', '--cases', plain.copy, '--execute', '--results-dir', plain.results], plain.io, plain.deps), 3);
  const none = JSON.parse(fs.readFileSync(path.join(plain.results, 'results.json'), 'utf8'));
  assert.ok(none.cases.every((c) => c.fix_card_words === null && Array.isArray(c.sut.tool_calls) && c.sut.tool_calls.length === 0));
  assert.ok(fs.readFileSync(path.join(plain.results, 'report.md'), 'utf8').includes('| Fix card words, min / median / max (over 0 answers with a card, 8 without; a measure, not a pass or fail) | n/a |'));
});
