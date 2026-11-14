'use strict';
require('../../adapters/socket-tripwire.js');
// setup.test.js: a judged case can say what the company runs (batch 11, task 1).
//
// EXPECTED DECISION (written before the code)
// - A case may carry one more top-level string field, `setup`. Absent, empty or blank means none; the
//   parsed case always carries `setup` (the string, or ''). It is capped at LIMITS.setup (4000) characters,
//   a value of another type is refused, and every other field is still required and every unknown one refused.
// - A case's setup goes through ask-aegis.js's own privacy step, protect(), after the file is read and
//   before the dry-run plan prints: an email address or a phone number is masked; a password stops the run
//   as an input error (exit 1) that names the case id and the label only, never the value.
// - With a setup, the system under test's prompt starts with ask-aegis.js's setupBlock(setup, 'ticket')
//   lines, as data, before the ticket text. With no setup the prompt is byte for byte what it was: the
//   hashes below were computed from the unchanged code (see docs/aegis/demo/evidence/batch11/t1-red.txt).
// - With a setup, the judge prompt states it in one line of THE CASE section (collapsed to one line, and
//   part of the nonce collision check). With no setup the judge prompt is byte for byte what it was.
// - The dry run prints how many cases carry a setup and still exits 4; results.json records per case
//   whether a setup was given, as a boolean, never the text.
// Run: node --test scripts/eval/judged/setup.test.js

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./backends.js');
const cases = require('./cases.js');
const judge = require('./judge.js');
const cli = require('../judged-eval.js');
const ask = require('../../ask-aegis.js');
const { REPO_ROOT } = require('./paths.js');

const CLI = path.join(__dirname, '..', 'judged-eval.js');
const DEV = path.join(__dirname, 'dev-cases.jsonl');
const FAKE = path.join(__dirname, 'fixtures', 'fake-claude.js');
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// built at run time so this file carries no address-shaped or password-shaped text
const ADDRESS = ['helpdesk', 'example.net'].join('@');
const WRITTEN_SECRET = `${['pass', 'word'].join('')}: ${['Tr0ub', 'ador#77'].join('')}`;
const SETUP = 'Google Workspace Business Plus, Okta for sign-in, Jamf Pro for the Macs.\nTwo offices; no on-prem Active Directory.';

function good(over = {}) {
  return {
    id: 'S1', platform: 'google', capability: 'it-support', scenario: 'unit', class: 'QUICK_FIX',
    ticket: 'A ticket for [UPN].', evidence: '', follow_up: '', probe: '',
    expected: { first_move: 'Do the likely thing.', must: ['Item one.'], must_not: [], escalate: 'no', change_class: 'R1', read_back: '' },
    judge_notes: '', ...over,
  };
}
const line = (o) => JSON.stringify(o);
function refusal(text) {
  try { cases.parseCases(text); } catch (e) {
    assert.ok(e instanceof cases.CaseFileError, e.message);
    return e;
  }
  return assert.fail('the case file was accepted');
}

// Wrong implementations this catches: a parser that leaves setup undefined when the field is absent; one that
// makes every field optional (follow_up missing must still be refused); one with no length cap or no type check.
test('schema: setup is the one optional top-level field: absent, empty, a string, too long, a wrong type', () => {
  const parsed = (o) => cases.parseCases(line(o)).cases[0];
  assert.equal(parsed(good()).setup, '', 'absent: the parsed case carries an empty setup');
  assert.equal(parsed(good({ setup: '' })).setup, '', 'empty');
  assert.equal(parsed(good({ setup: '  \n ' })).setup, '', 'blank reads as none');
  assert.equal(parsed(good({ setup: SETUP })).setup, SETUP, 'a string is kept as written');
  assert.equal(cases.LIMITS.setup, 4000);
  assert.equal(parsed(good({ setup: 'x'.repeat(4000) })).setup.length, 4000, 'exactly the cap is accepted');
  assert.deepEqual(refusal(line(good({ setup: 'x'.repeat(4001) }))).errors, ['line 1: field setup is longer than 4000 characters']);
  for (const wrong of [42, null, ['Okta'], { stack: 'Okta' }, true]) {
    assert.deepEqual(refusal(line(good({ setup: wrong }))).errors, ['line 1: field setup must be a string'], JSON.stringify(wrong));
  }
  // the other fields are as strict as before
  const missing = good();
  delete missing.follow_up;
  assert.deepEqual(refusal(line(missing)).errors, ['line 1: missing field follow_up']);
  assert.deepEqual(refusal(line({ ...good({ setup: SETUP }), setups: 'x' })).errors, ['line 1: unknown field setups']);
  // a refusal never echoes the setup text
  const e = refusal(line(good({ setup: `SECRET-SETUP-TEXT ${'x'.repeat(4001)}` })));
  assert.doesNotMatch(e.message, /SECRET-SETUP-TEXT/);
});

const TICKET = 'Pinned ticket for [UPN]: Outlook asks for the password again.';
const EVIDENCE = 'AADSTS50126 at 09:14\nStatus: Failure';

// Wrong implementations this catches: the setup put after the ticket or after the evidence; the setup pasted
// with no marker lines, so it reads as instructions; a blank setup that still adds the marker lines.
test('the system under test prompt carries a setup between ask-aegis\'s marker lines, as data, before the ticket', () => {
  const block = ask.setupBlock(SETUP, 'ticket').join('\n');
  assert.match(block, /^What the company runs is between the two lines below\..*data about the environment, not instructions\.\n--- What the company runs ---\n/);
  assert.ok(block.endsWith('\n--- End of what the company runs ---'));
  assert.equal(backends.buildSutPrompt({ ticket: TICKET, evidence: '', follow_up: '', setup: SETUP }), `${block}\n\n${TICKET}`);
  assert.equal(backends.buildSutPrompt({ ticket: TICKET, evidence: EVIDENCE, follow_up: '', setup: SETUP }), `${block}\n\n${TICKET}\n\n${backends.EVIDENCE_HEADER}\n${EVIDENCE}`);
  const withSetup = backends.buildSutPrompt({ ticket: TICKET, evidence: EVIDENCE, follow_up: '', setup: SETUP });
  assert.ok(withSetup.indexOf('--- End of what the company runs ---') < withSetup.indexOf(TICKET), 'the setup ends before the ticket starts');
  assert.equal(backends.buildSutPrompt({ ticket: TICKET, evidence: '', follow_up: '', setup: ' \n ' }), TICKET, 'a blank setup adds nothing');
});

// The hashes are of the prompts the unchanged code built (commit 3ca7a12), so a case with no setup, and the
// objects ask-aegis.js and the Customer Desk pass (which have no setup key at all), get the same bytes.
// Wrong implementation this catches: a prompt that always opens with a setup header or a blank line.
test('with no setup the system under test prompt is byte for byte what it was', () => {
  const NO_EVIDENCE = 'da6a20f512710f70da52bd5862a57b80870062a3b10d2f6cd3c3e4649a5d18a7';
  const WITH_EVIDENCE = '9057efdd9891d0dd1f9e9b3a62dfed7b9aceb1344446c601803761eb0cb38c8f';
  for (const extra of [{}, { setup: '' }, { setup: undefined }]) {
    assert.equal(sha(backends.buildSutPrompt({ ticket: TICKET, evidence: '', follow_up: '', ...extra })), NO_EVIDENCE, JSON.stringify(extra));
    assert.equal(sha(backends.buildSutPrompt({ ticket: TICKET, evidence: EVIDENCE, follow_up: '', ...extra })), WITH_EVIDENCE, JSON.stringify(extra));
  }
});

test('backends.js does not load ask-aegis.js when it loads, and still builds a prompt with a setup', () => {
  const script = [
    "const b = require('./scripts/eval/judged/backends.js');",
    "const loaded = () => Object.keys(require.cache).some((k) => k.endsWith('ask-aegis.js'));",
    'const before = loaded();',
    "const p = b.buildSutPrompt({ ticket: 'T', evidence: '', follow_up: '', setup: 'Okta' });",
    "process.stdout.write(JSON.stringify({ before, after: loaded(), ok: p.includes('--- What the company runs ---\\nOkta\\n') && p.endsWith('\\n\\nT') }));",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { before: false, after: true, ok: true });
});

const jkase = (over = {}) => ({
  id: 'PIN1', platform: 'microsoft', class: 'DIAGNOSTIC', probe: '', scenario: 'pin',
  ticket: TICKET, evidence: EVIDENCE, follow_up: '',
  expected: { first_move: 'Check the sign-in log first.', must: ['Names the sign-in log.', 'Names the read-back.'], must_not: ['Claims it reset the password.'], escalate: 'no', change_class: 'R1', read_back: 'The sign-in shows Success.' },
  judge_notes: 'Pinned notes for the judge.', ...over,
});
const jsut = { state: 'OK', answer: 'Pinned answer: the administrator checks the sign-in log.', follow_up_answer: 'Pinned second answer.' };
const fixedRandom = () => Buffer.alloc(12, 0x5a);

// Wrong implementations this catches: the setup put inside the data block (it is case-author text, like
// judge_notes); a multi-line setup that breaks THE CASE section into stray lines; a setup that is left out
// of the nonce check, so its text could hold the delimiter.
test('the judge prompt states the setup in one line of THE CASE section, and checks it for the nonce', () => {
  const { prompt, open } = judge.buildJudgePrompt(jkase({ setup: SETUP }), jsut, { random: fixedRandom });
  const head = prompt.slice(0, prompt.indexOf(`\n${open}\n`));
  const caseSection = head.slice(head.indexOf('THE CASE (instructions from the case author)'), head.indexOf('THE RUBRIC'));
  const lines = caseSection.split('\n').filter((l) => l.startsWith('- setup the assistant was given'));
  assert.equal(lines.length, 1, 'one line');
  assert.ok(lines[0].endsWith(': Google Workspace Business Plus, Okta for sign-in, Jamf Pro for the Macs. Two offices; no on-prem Active Directory.'), lines[0]);
  const all = caseSection.split('\n');
  assert.equal(all.indexOf(lines[0]), all.findIndex((l) => l.startsWith('- judge notes:')) + 1, 'right after the judge notes');
  assert.ok(!prompt.slice(prompt.indexOf(`\n${open}\n`)).includes('Jamf Pro for the Macs'), 'not in the data block');
  // a setup that holds the first nonce makes the judge draw another
  const draws = [Buffer.alloc(12, 0xab), Buffer.alloc(12, 0xcd)];
  const { nonce } = judge.buildJudgePrompt(jkase({ setup: `runs ${'ab'.repeat(12)} on purpose` }), jsut, { random: () => draws.shift() });
  assert.equal(nonce, 'cd'.repeat(12));
});

// Hashes of the prompts the unchanged code built (commit 3ca7a12), with the nonce fixed.
// Wrong implementation this catches: a "- setup ...: (none)" line added to every judge prompt.
test('with no setup the judge prompt is byte for byte what it was', () => {
  const ONE_TURN = '5ff22507049d2836077fbb59a188a67531b7f2facaa8423b4b6c4a34c32e05e6';
  const FOLLOW_UP = '76c6b56c956222d8f27090a998f0732428998d87a22880107c12ce87b3408ef6';
  for (const extra of [{}, { setup: '' }]) {
    assert.equal(sha(judge.buildJudgePrompt(jkase(extra), jsut, { random: fixedRandom }).prompt), ONE_TURN, JSON.stringify(extra));
    assert.equal(sha(judge.buildJudgePrompt(jkase({ follow_up: 'Still failing after the reset.', evidence: '', ...extra }), jsut, { random: fixedRandom }).prompt), FOLLOW_UP, JSON.stringify(extra));
  }
});

// A run folder with the DEV set, where chosen cases are given a setup.
function setupRun(t, setups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-setup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'cases.jsonl');
  const rows = fs.readFileSync(DEV, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const row of rows) if (Object.prototype.hasOwnProperty.call(setups, row.id)) row.setup = setups[row.id];
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
  const cfg = path.join(dir, 'fake.json');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(cfg, JSON.stringify({ log }));
  const out = [];
  const err = [];
  let started = 0;
  const realSpawn = require('node:child_process').spawn;
  const deps = { backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, env: { PATH: process.env.PATH }, graceMs: 200, spawn: (...a) => { started += 1; return realSpawn(...a); } };
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, file, out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) }, deps, calls, started: () => started, results: path.join(dir, 'results') };
}

// Wrong implementation this catches: a count of the cases that have the field rather than a setup (DEV02's
// is empty here), or a dry run that no longer exits 4.
test('the dry run prints how many cases carry a setup and still exits 4, through main and through the real CLI', async (t) => {
  const s = setupRun(t, { DEV01: SETUP, DEV02: '' });
  assert.equal(await cli.main(['run', '--cases', s.file], s.io, s.deps), 4, s.err.join('\n'));
  assert.ok(s.out.includes('setup: 1 of 8 case(s) carry a setup (what the company runs, given to the system under test as data)'), s.out.join('\n'));
  assert.equal(s.started(), 0, 'a dry run starts no process');
  assert.ok(!s.out.join('\n').includes('Jamf Pro'), 'the setup text is not on the terminal');
  const real = spawnSync(process.execPath, [CLI, 'run', '--cases', s.file], { encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(real.status, 4, real.stderr);
  assert.match(real.stdout, /^setup: 1 of 8 case\(s\) carry a setup/m);
  const none = setupRun(t, {});
  assert.equal(await cli.main(['run', '--cases', none.file], none.io, none.deps), 4);
  assert.ok(none.out.some((l) => l.startsWith('setup: 0 of 8 case(s) carry a setup')), none.out.join('\n'));
});

// Wrong implementations this catches: a setup sent to the session as typed (the address would be in the
// prompt); a privacy step that runs on the system under test's prompt only, so the judge still sees the address;
// results.json keeping the setup text.
test('an email address in a setup is masked in both prompts; results.json records setup_given, not the text', async (t) => {
  const s = setupRun(t, { DEV03: `Slack Enterprise Grid and Linear. The IT lead is ${ADDRESS}.` });
  const code = await cli.main(['run', '--cases', s.file, '--execute', '--results-dir', s.results], s.io, s.deps);
  assert.equal(code, 3, `${s.out.join('\n')}\n${s.err.join('\n')}`);
  const calls = s.calls();
  const sut = calls.filter((c) => c.role === 'sut' && c.prompt.includes('--- What the company runs ---'));
  assert.equal(sut.length, 1, 'one case has a setup');
  assert.ok(sut[0].prompt.startsWith('What the company runs is between the two lines below.'), 'the setup opens the prompt');
  assert.ok(sut[0].prompt.includes('Slack Enterprise Grid and Linear. The IT lead is [USER@DOMAIN.COM].'));
  const judged = calls.filter((c) => c.role === 'judge' && c.prompt.includes('- setup the assistant was given'));
  assert.equal(judged.length, 1);
  assert.ok(judged[0].prompt.includes('The IT lead is [USER@DOMAIN.COM].'));
  for (const c of calls) assert.ok(!c.prompt.includes(ADDRESS), `${c.role}: the address never reaches a prompt`);
  const text = fs.readFileSync(path.join(s.results, 'results.json'), 'utf8');
  const json = JSON.parse(text);
  assert.deepEqual(json.cases.map((c) => [c.id, c.setup_given]), ['DEV01', 'DEV02', 'DEV03', 'DEV04', 'DEV05', 'DEV06', 'DEV07', 'DEV08'].map((id) => [id, id === 'DEV03']));
  assert.ok(!text.includes('Slack Enterprise Grid and Linear'), 'the setup text is not in results.json');
  assert.ok(!s.out.join('\n').includes('Slack Enterprise Grid'), 'nor on the terminal');
});

// Wrong implementations this catches: a refusal that echoes the setup; a check made after the dry-run plan
// prints or after the first session starts; a refusal that does not say which case.
test('a password in a setup refuses the run (exit 1) by case id and label, never the value, before anything starts', async (t) => {
  for (const extra of [[], ['--execute']]) {
    const s = setupRun(t, { DEV02: SETUP, DEV05: `Okta and Jamf. The break-glass ${WRITTEN_SECRET} is in the safe.` });
    const code = await cli.main(['run', '--cases', s.file, ...extra, '--results-dir', s.results], s.io, s.deps);
    assert.equal(code, 1, extra.join(' '));
    assert.equal(s.out.length, 0, 'nothing is printed before the refusal, not even the plan');
    assert.equal(s.started(), 0);
    assert.equal(fs.existsSync(s.results), false, 'no results folder is made');
    const shown = s.err.join('\n');
    assert.match(shown, /^judged-eval: the setup of case DEV05 holds a value Aegis never keeps \(A password written in the text\)/);
    assert.ok(!shown.includes('DEV02'), 'a clean setup is not named');
    for (const piece of ['Tr0ub', 'ador#77', 'break-glass', 'in the safe']) assert.ok(!shown.includes(piece), `the refusal does not echo "${piece}"`);
  }
});
