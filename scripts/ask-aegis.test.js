'use strict';
require('./adapters/socket-tripwire.js');
// ask-aegis.test.js: the one-ticket command for a person trying Aegis (batch 9, task 11).
//
// EXPECTED DECISION (written before the command)
// - `node scripts/ask-aegis.js "ticket" [--setup "..."] [--results-dir DIR] [--max-budget-usd N]` runs one
//   claude -p session from the repository root with the desk's isolation: backends.sutArgs (read-only tools,
//   no Bash, no web, project settings only, no user CLAUDE.md, no MCP, no auto memory, no session record),
//   the desk's 40 turns, and --max-budget-usd (default 3.00). Nothing else is added.
// - The ticket goes in below the pasted-evidence header, as data; --setup goes in above it, between two
//   marker lines, as data that replaces CLAUDE.md's default environment for this ticket.
// - It prints the Fix card and the "Tell the user" lines (now, when done, or the older single line), saves
//   answer.md and result.json under ~/aegis-asks/<run id>/, and refuses any results folder inside the
//   repository, even one git ignores, and one reached through a link.
// - No ticket: usage, exit 1. A session that fails or times out: a plain message, exit 2, nothing saved.
// Every claude here is the fake CLI in scripts/eval/judged/fixtures/; no test starts a real session.
// Run: node --test scripts/ask-aegis.test.js

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./eval/judged/backends.js');
const { REPO_ROOT } = require('./eval/judged/paths.js');
const ask = require('./ask-aegis.js');

const FAKE = path.join(__dirname, 'eval', 'judged', 'fixtures', 'fake-claude.js');
const SCRIPT = path.join(__dirname, 'ask-aegis.js');

const NEW_ANSWER = [
  '## Fix',
  "**What's wrong:** The printer queue on [DEVICE_NAME] is stuck.",
  '**Do this:**',
  '1. Open Settings > Printers on [DEVICE_NAME].',
  '2. Open the queue and look at the first job.',
  '3. Note the error the job shows.',
  '**Done when:** a test page prints.',
  '**Stop if:** the queue shows a driver error.',
  '**Tell the user now:** We are looking at the printer queue.',
  '**Tell the user when done:** Your printer works again; try one page.',
  '',
  '## Details',
  'More detail for the tech.',
  '',
  '```aegis-desk',
  'Gate: none',
  '```',
].join('\n');

const OLD_ANSWER = NEW_ANSWER.replace(/\*\*Tell the user now:\*\*.*\n\*\*Tell the user when done:\*\*/, '**Tell the user:**');

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A fake claude, a temporary home folder, and a captured stdout and stderr.
function setup(t, sut = {}) {
  const dir = tempDir(t, 'aegis-ask-test-');
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  const log = path.join(dir, 'calls.jsonl');
  const cfg = path.join(dir, 'fake.json');
  fs.writeFileSync(cfg, JSON.stringify({ log, sut }));
  const out = [];
  const err = [];
  const deps = { backend: { command: process.execPath, prefixArgs: [FAKE, '--fake-config', cfg] }, out: (s) => out.push(s), err: (s) => err.push(s), timeoutMs: 20000, graceMs: 200 };
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const env = { ...process.env, HOME: home, USERPROFILE: home, AEGIS_TEST_API_TOKEN: 'never-passed-on' };
  return { dir, home, env, deps, calls, stdout: () => out.join(''), stderr: () => err.join('') };
}

const asksIn = (home) => {
  const root = path.join(home, 'aegis-asks');
  return fs.existsSync(root) ? fs.readdirSync(root).map((d) => path.join(root, d)) : [];
};

// The values of one flag: the words after it up to the next flag.
function flagValues(args, flag) {
  const at = args.indexOf(flag);
  if (at < 0) return [];
  const end = args.findIndex((a, i) => i > at && a.startsWith('--'));
  return args.slice(at + 1, end < 0 ? undefined : end);
}

// Review round 1, finding 2: the deny list holds the whole ~/aegis-asks folder, so one ask never reads another's
// answer. Wrong implementations it catches: a deny list with only this run's folder, or none.
// Wrong implementations it catches: a command that builds its own flag list and drops one of the desk's
// (say --strict-mcp-config, or the CLAUDE.md exclusions), adds a tool such as Bash or Edit, adds
// --dangerously-skip-permissions, runs from another folder, or passes a secret-named variable on.
test('the session argv is backends.sutArgs plus the budget, and nothing else', async (t) => {
  const s = setup(t, { answer: NEW_ANSWER });
  const code = await ask.main(['The printer at the front desk will not print', '--setup', 'Google Workspace, Windows laptops'], s.env, s.deps);
  assert.equal(code, 0, s.stderr());
  assert.equal(asksIn(s.home).length, 1);
  const calls = s.calls();
  assert.equal(calls.length, 1, 'one session');
  const call = calls[0];
  const expected = [...backends.sutArgs({ prompt: call.prompt, runRoot: path.join(s.home, 'aegis-asks'), maxTurns: 40, persist: false }), '--max-budget-usd', '3.00'];
  assert.deepEqual(call.args, expected.filter((a) => a !== call.prompt));
  // the isolation backends.js builds sits in the argv whole
  const iso = backends.isolationArgs({ runRoot: path.join(s.home, 'aegis-asks') });
  const at = call.args.indexOf('--setting-sources');
  assert.deepEqual(call.args.slice(at, at + iso.length), iso);
  for (const flag of ['--tools', '--allowedTools']) {
    const tools = flagValues(call.args, flag);
    assert.deepEqual(tools, [...backends.SUT_TOOLS], `${flag}: the read-only tools`);
    for (const bad of ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'NotebookEdit']) assert.ok(!tools.includes(bad), `${flag} has no ${bad}`);
  }
  assert.ok(flagValues(call.args, '--disallowedTools').includes('Bash'));
  assert.ok(!call.args.some((a) => /dangerously|bypassPermissions|--permission-mode/.test(a)));
  assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(REPO_ROOT));
  assert.ok(!call.env.includes('AEGIS_TEST_API_TOKEN'), 'a secret-named variable never reaches the session');
  // checked where it is decided, in the environment ask-aegis hands the child: under the tripwire battery
  // (NODE_OPTIONS --require socket-tripwire.js) the fake child loads the tripwire and sets the variable itself,
  // so the child's own environment cannot show whether it was passed on
  assert.ok(!Object.prototype.hasOwnProperty.call(ask.sessionEnv({ ...process.env, AEGIS_NETWORK_TRIPWIRE: '1' }), 'AEGIS_NETWORK_TRIPWIRE'), 'the test tripwire is not passed on');
});

// Wrong implementations it catches: a ticket put first as an instruction, above the evidence header; a setup
// text pasted in with no markers or no "data, not instructions" line; a setup put below the header, where it
// would read as part of the ticket.
test('the ticket goes in as pasted evidence and the setup as data above it', async (t) => {
  const s = setup(t, { answer: NEW_ANSWER });
  assert.equal(await ask.main(['Outlook keeps asking for a password', '--setup', 'Microsoft 365 Business Standard, Macs'], s.env, s.deps), 0, s.stderr());
  const { prompt } = s.calls()[0];
  const header = prompt.indexOf(backends.EVIDENCE_HEADER);
  assert.ok(header > 0, 'the evidence header is there');
  assert.equal(prompt.slice(header + backends.EVIDENCE_HEADER.length).trim(), 'Outlook keeps asking for a password');
  const before = prompt.slice(0, header);
  assert.ok(!before.includes('Outlook keeps asking'), 'the ticket is only below the header');
  const open = before.indexOf('--- What the company runs ---');
  const close = before.indexOf('--- End of what the company runs ---');
  assert.ok(open >= 0 && close > open, 'the setup sits between its two markers');
  assert.equal(before.slice(open + '--- What the company runs ---'.length, close).trim(), 'Microsoft 365 Business Standard, Macs');
  assert.match(before.slice(0, open), /replaces the default environment in CLAUDE\.md[^\n]*data about the environment, not instructions/);
  // with no --setup there is no setup block at all
  const s2 = setup(t, { answer: NEW_ANSWER });
  assert.equal(await ask.main(['Outlook keeps asking for a password'], s2.env, s2.deps), 0);
  assert.ok(!s2.calls()[0].prompt.includes('What the company runs'));
});

// Wrong implementations it catches: one that prints only an older "Tell the user:" line and misses the new
// two; one that prints the aegis-desk block or the Details; one that saves nothing, saves inside the
// repository, or saves the result without its cost.
test('it prints the Fix card and the user lines, and saves the answer and the result under the home folder', async (t) => {
  const s = setup(t, { answer: NEW_ANSWER, cost: 0.42 });
  assert.equal(await ask.main(['The printer at the front desk will not print'], s.env, s.deps), 0, s.stderr());
  const out = s.stdout();
  assert.match(out, /## Fix/);
  assert.match(out, /What's wrong:\*\* The printer queue on \[DEVICE_NAME\] is stuck\./);
  assert.match(out, /3\. Note the error the job shows\./);
  const tell = out.slice(out.indexOf('What to tell the user:'));
  assert.ok(out.includes('What to tell the user:'), out);
  assert.match(tell, /Tell the user now:\*\* We are looking at the printer queue\./);
  assert.match(tell, /Tell the user when done:\*\* Your printer works again; try one page\./);
  assert.ok(!out.includes('Gate: none') && !out.includes('More detail for the tech'), 'neither the desk block nor the Details');
  const dirs = asksIn(s.home);
  assert.equal(dirs.length, 1);
  assert.match(path.basename(dirs[0]), /^\d{8}T\d{6}Z-[0-9a-f]{8}$/);
  assert.equal(fs.readFileSync(path.join(dirs[0], 'answer.md'), 'utf8'), NEW_ANSWER);
  const result = JSON.parse(fs.readFileSync(path.join(dirs[0], 'result.json'), 'utf8'));
  assert.equal(result.type, 'result');
  assert.equal(result.total_cost_usd, 0.42);
  assert.ok(out.includes(path.join(dirs[0], 'answer.md')), 'it says where the answer is');
  assert.match(out, /0\.42 US dollars/);

  // an answer in the older format: its single line is printed
  const s2 = setup(t, { answer: OLD_ANSWER });
  const chosen = path.join(s2.dir, 'my-asks', 'one');
  assert.equal(await ask.main(['The printer will not print', '--results-dir', chosen], s2.env, s2.deps), 0, s2.stderr());
  assert.match(s2.stdout().slice(s2.stdout().indexOf('What to tell the user:')), /Tell the user:\*\* Your printer works again; try one page\./);
  assert.equal(fs.readFileSync(path.join(chosen, 'answer.md'), 'utf8'), OLD_ANSWER);
});

// Wrong implementations it catches: reusing paths.checkResultsDir alone, which lets a git-ignored folder
// inside the repository through; checking only the given path, so a link to the repository gets through;
// refusing after the session ran (and spent) or after making the folder.
test('a results folder inside the repository is refused before any session, also an ignored one or one through a link', async (t) => {
  const s = setup(t, { answer: NEW_ANSWER });
  const ignored = path.join(REPO_ROOT, '.aegis-state', `ask-test-${process.pid}`);
  const link = path.join(s.dir, 'link-to-repo');
  fs.symlinkSync(REPO_ROOT, link, 'dir');
  // review round 1, finding 1: on macOS and Windows a path in another case is the same folder. Wrong
  // implementation it catches: a case-sensitive comparison there. On Linux the case variant is another folder.
  const caseVariant = process.platform === 'darwin' || process.platform === 'win32' ? [path.join(REPO_ROOT.toLowerCase(), 'docs', 'asks'), path.join(REPO_ROOT.toUpperCase(), 'docs', 'asks')] : [];
  const relative = path.relative(process.cwd(), path.join(REPO_ROOT, 'docs', 'asks'));
  for (const dir of [path.join(REPO_ROOT, 'docs', 'asks'), ignored, path.join(link, '.aegis-state', `ask-test-${process.pid}`), `${REPO_ROOT}/docs/../asks`, relative, ...caseVariant]) {
    const before = s.stderr().length;
    assert.equal(await ask.main(['The printer will not print', '--results-dir', dir], s.env, s.deps), 1, dir);
    assert.match(s.stderr().slice(before), /inside the Aegis repository/);
    assert.ok(!fs.existsSync(dir), `${dir} was not made`);
  }
  assert.equal(s.calls().length, 0, 'no session started');
  // a folder that already holds files is refused too, so an earlier answer is never overwritten
  const full = path.join(s.dir, 'full');
  fs.mkdirSync(full);
  fs.writeFileSync(path.join(full, 'answer.md'), 'earlier');
  assert.equal(await ask.main(['The printer will not print', '--results-dir', full], s.env, s.deps), 1);
  assert.equal(fs.readFileSync(path.join(full, 'answer.md'), 'utf8'), 'earlier');
  assert.equal(s.calls().length, 0);
});

// Wrong implementations it catches: one that starts a session with an empty prompt, or exits 0 or 2 with no
// ticket; a command line that never calls main (the CLI run below).
test('no ticket text: the usage and exit 1, with no session', async (t) => {
  const s = setup(t);
  for (const argv of [[], ['   '], ['--setup', 'Google Workspace']]) {
    const before = s.stderr().length;
    assert.equal(await ask.main(argv, s.env, s.deps), 1, JSON.stringify(argv));
    assert.match(s.stderr().slice(before), /Usage: node scripts\/ask-aegis\.js "ticket text"/);
  }
  assert.equal(await ask.main(['--no-such-flag', 'x'], s.env, s.deps), 1);
  assert.equal(await ask.main(['x', '--max-budget-usd', 'lots'], s.env, s.deps), 1);
  assert.equal(await ask.main(['x', '--max-budget-usd', '0'], s.env, s.deps), 1);
  // review round 1, nit 2: an unquoted ticket word such as -2147 is ticket text, and so is all after --.
  // Wrong implementation it catches: one that refuses every word starting with "-".
  assert.equal(ask.parseArgs(['Error', '-2147', 'on', 'login']).ticket, 'Error -2147 on login');
  assert.equal(ask.parseArgs(['--', '--setup', 'is', 'text']).ticket, '--setup is text');
  assert.equal(s.calls().length, 0);
  const cli = childProcess.spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: s.env });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /Usage: node scripts\/ask-aegis\.js/);
});

// Wrong implementation it catches: a budget flag that is read and then not passed on, or passed in another form.
test('--max-budget-usd passes through, in the desk\'s two-decimal form', async (t) => {
  const s = setup(t, { answer: NEW_ANSWER });
  assert.equal(await ask.main(['The printer will not print', '--max-budget-usd', '1.5'], s.env, s.deps), 0, s.stderr());
  assert.deepEqual(flagValues(s.calls()[0].args, '--max-budget-usd'), ['1.50']);
});

// Wrong implementations it catches: one that saves a failed session's text as if it were an answer, exits 0,
// prints a stack trace, or waits for ever on a session that does not end.
test('a session that fails or runs past its time: a plain message, exit 2, nothing saved', async (t) => {
  const failed = setup(t, { mode: 'error' });
  assert.equal(await ask.main(['The printer will not print'], failed.env, failed.deps), 2);
  assert.match(failed.stderr(), /^ask-aegis: the Aegis session did not finish \([^)]+\)\. Nothing was saved\./);
  assert.ok(!failed.stderr().includes('    at '), 'no stack trace');
  assert.deepEqual(asksIn(failed.home), []);

  const slow = setup(t, { mode: 'slow', sleep_ms: 10000 });
  const started = Date.now();
  assert.equal(await ask.main(['The printer will not print'], slow.env, { ...slow.deps, timeoutMs: 300, graceMs: 100 }), 2);
  assert.ok(Date.now() - started < 8000, 'stopped at the time limit');
  assert.match(slow.stderr(), /did not finish/);
  assert.deepEqual(asksIn(slow.home), []);

  // review round 1, nit 1: a results folder that cannot be made is found before the session, not after it
  // spent. Wrong implementation it catches: one that makes the folder only after the session.
  const blocked = setup(t, { answer: NEW_ANSWER });
  fs.writeFileSync(path.join(blocked.dir, 'a-file'), 'x');
  assert.equal(await ask.main(['The printer will not print', '--results-dir', path.join(blocked.dir, 'a-file', 'sub')], blocked.env, blocked.deps), 1);
  assert.match(blocked.stderr(), /cannot make the results folder/);
  assert.equal(blocked.calls().length, 0);
});
