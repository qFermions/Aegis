'use strict';
require('./adapters/socket-tripwire.js');
// start-aegis.test.js: the double-click launcher for a person who does not use a terminal (batch 12, task 11).
//
// EXPECTED DECISION (written before the command)
// - First run on a terminal: one question, "What does your company run?", with one hint line under it. The answer goes
//   through ask-aegis's protect(): a password, key or tenant literal is refused with a plain message and the question
//   is asked again, at most 3 tries, then the chat starts with no setup; an email address or a phone number becomes a
//   placeholder. The protected answer is saved in ~/.aegis/company-setup.txt (folder 0700, file 0600), never inside
//   the repository. An empty answer saves nothing and starts with no setup.
// - Later runs: the saved answer in one line; Enter keeps it, c or change asks the question again, clear removes the file.
// - Then it starts scripts/aegis-chat.js with process.execPath, from the repository root, with the terminal handed
//   over, and with exactly `--setup <answer>` or nothing, and exits with the chat's code.
// - No terminal (stdin not interactive): it asks nothing and starts with the saved answer or none. A saved file it
//   cannot read: a plain line, no setup. A home folder it cannot write: a plain line, the chat still starts. Ctrl-C at
//   the question: exit 0, nothing saved, no chat.
// Every chat started here is a fake spawn that records its arguments; no test opens a socket or starts a real claude.
// Run: node --test scripts/start-aegis.test.js

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { REPO_ROOT } = require('./eval/judged/paths.js');
const start = require('./start-aegis.js');

const CHAT = path.join(REPO_ROOT, 'scripts', 'aegis-chat.js');
const POSIX = process.platform !== 'win32';

function tempHome(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'start-aegis-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A run of the launcher with a fake terminal (answers given in order; null is Ctrl-C) and a fake spawn.
async function run({ home, answers = [], tty = true, exit = 0, signal = null, fsImpl, spawnImpl }) {
  const asked = [];
  const spawned = [];
  const out = [];
  const err = [];
  const queue = [...answers];
  const deps = {
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    isTTY: tty,
    prompt: async (q) => {
      asked.push(q);
      if (!queue.length) throw new Error(`no answer left for prompt ${JSON.stringify(q)}`);
      return queue.shift();
    },
    spawn: spawnImpl || ((cmd, args, opts) => {
      spawned.push({ cmd, args, opts });
      const child = new EventEmitter();
      setImmediate(() => child.emit('exit', exit, signal));
      return child;
    }),
  };
  if (fsImpl) deps.fs = fsImpl;
  const env = { HOME: home, USERPROFILE: home };
  const code = await start.main([], env, deps);
  return { code, asked, spawned, out: out.join(''), err: err.join(''), file: start.savePath(env) };
}

// Built in pieces so the commit scanner does not read them as real personal data or a real credential.
const MAIL = ['it-admin', 'realcorp.example.org'].join('@');
const PHONE = ['+1', '415', '555', '0100'].join(' ');
const PASSWORD_ANSWER = `Okta, ${['pass', 'word'].join('')}: Hunter22!x`;

// Wrong implementations it catches: a launcher that asks a second question (a confirm, a name, an email), saves the
// raw answer instead of the protected one, runs `node` from PATH instead of process.execPath, starts the chat from
// another folder, pipes stdio instead of handing over the terminal, or adds any flag besides --setup (--reply-to,
// --model) to the chat.
test('first run asks the one question once, saves the answer and starts the chat with exactly --setup <answer>', async (t) => {
  const home = tempHome(t);
  const r = await run({ home, answers: ['Google Workspace, Okta, Slack, GitHub, AWS'] });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.asked.length, 1, 'one prompt');
  assert.equal(r.out.split(start.QUESTION).length - 1, 1, 'the question is shown once');
  assert.equal(start.QUESTION, 'What does your company run?');
  assert.match(start.HINT, /^For example: .*Press Enter to skip\.$/);
  assert.ok(r.out.includes(`${start.QUESTION}\n${start.HINT}\n`), 'the hint is the line under the question');
  assert.equal(start.parseSaved(fs.readFileSync(r.file, 'utf8')), 'Google Workspace, Okta, Slack, GitHub, AWS');
  assert.equal(r.spawned.length, 1);
  assert.equal(r.spawned[0].cmd, process.execPath);
  assert.deepEqual(r.spawned[0].args, [CHAT, '--setup', 'Google Workspace, Okta, Slack, GitHub, AWS']);
  assert.equal(r.spawned[0].opts.cwd, REPO_ROOT);
  assert.equal(r.spawned[0].opts.stdio, 'inherit');
  assert.equal(r.spawned[0].opts.shell, false);
  assert.ok(fs.existsSync(CHAT), 'the chat it starts is the real aegis-chat.js');
});

// Wrong implementations it catches: protection on the shown text only (the saved file or the chat argument still
// holds the address), or a launcher that skips protect() and saves what was typed.
test('an email address and a phone number in the answer become placeholders before they are saved or passed on', async (t) => {
  const home = tempHome(t);
  const r = await run({ home, answers: [`Okta and Slack, admin ${MAIL}, help desk ${PHONE}`] });
  assert.equal(r.code, 0, r.err);
  const saved = fs.readFileSync(r.file, 'utf8');
  for (const text of [saved, r.spawned[0].args.join(' '), r.out]) {
    assert.ok(!text.includes(MAIL), 'no address');
    assert.ok(!text.includes(PHONE), 'no phone number');
  }
  assert.match(saved, /\[USER@DOMAIN\.COM\]/);
  assert.match(saved, /\[PHONE_NUMBER\]/);
});

// Wrong implementations it catches: one that saves the refused answer, echoes the password in its message, gives
// up after the first refusal, or keeps asking past three tries (a loop a non-technical person cannot leave).
test('a password in the answer is refused and nothing is saved; it asks again, and after 3 refusals starts with no setup', async (t) => {
  const home = tempHome(t);
  const again = await run({ home, answers: [PASSWORD_ANSWER, 'Okta, Slack'] });
  assert.equal(again.code, 0, again.err);
  assert.equal(again.asked.length, 2, 'asked again after the refusal');
  assert.match(again.err, /the text holds a value Aegis never keeps/);
  assert.match(again.err, /Nothing was saved/);
  assert.ok(!again.err.includes('Hunter22') && !again.out.includes('Hunter22'), 'the password is never echoed');
  assert.equal(start.parseSaved(fs.readFileSync(again.file, 'utf8')), 'Okta, Slack');
  assert.deepEqual(again.spawned[0].args, [CHAT, '--setup', 'Okta, Slack']);

  const home2 = tempHome(t);
  const refused = await run({ home: home2, answers: [PASSWORD_ANSWER, PASSWORD_ANSWER, PASSWORD_ANSWER] });
  assert.equal(refused.code, 0, refused.err);
  assert.equal(refused.asked.length, 3, 'three tries, no more');
  assert.ok(!fs.existsSync(refused.file), 'nothing saved');
  assert.deepEqual(refused.spawned[0].args, [CHAT], 'no setup');
  assert.ok(!refused.spawned[0].args.join(' ').includes('Hunter22'));
});

// Wrong implementations it catches: a save path inside the repository (where a commit could pick it up), a file left
// at the default 0644 or a folder at 0755 (readable by other accounts), or a launcher that writes into a "home" that
// sits inside the repository.
test('the saved file is outside the repository, mode 0600 in a 0700 folder; a home folder inside the repository saves nothing', async (t) => {
  const home = tempHome(t);
  const env = { HOME: home, USERPROFILE: home };
  assert.equal(start.savePath(env), path.join(home, '.aegis', 'company-setup.txt'));
  // outside: up and out of the repository, or on another drive, where Windows gives an absolute relative path (the
  // Windows CI runner keeps the repository on D: and the temporary folder on C:)
  const rel = path.relative(REPO_ROOT, start.savePath(env));
  assert.ok(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel), 'outside the repository');
  const r = await run({ home, answers: ['Okta'] });
  assert.equal(r.code, 0, r.err);
  if (POSIX) {
    assert.equal(fs.statSync(r.file).mode & 0o777, 0o600, 'file 0600');
    assert.equal(fs.statSync(path.dirname(r.file)).mode & 0o777, 0o700, 'folder 0700');
  }

  const inside = path.join(REPO_ROOT, 'no-such-home-start-aegis-test');
  assert.ok(!fs.existsSync(inside));
  // a wrong implementation that writes there fails below; the folder is removed either way
  t.after(() => fs.rmSync(inside, { recursive: true, force: true }));
  const refused = await run({ home: inside, answers: ['Okta'] });
  assert.equal(refused.code, 0, refused.err);
  assert.ok(!fs.existsSync(inside), 'nothing written inside the repository');
  assert.match(refused.err, /not saved/);
  assert.deepEqual(refused.spawned[0].args, [CHAT, '--setup', 'Okta'], 'the chat still starts with the answer');
});

// Wrong implementations it catches: a launcher that asks the question again on every run, shows the saved answer over
// several lines, a "change" that keeps the old answer, a "c" that is not read as change, and a "clear" that skips the
// setup this once but leaves the file for next time.
test('a later run shows the saved answer in one line; Enter keeps it, c or change asks again, clear removes the file', async (t) => {
  const home = tempHome(t);
  const env = { HOME: home, USERPROFILE: home };
  fs.mkdirSync(path.dirname(start.savePath(env)), { recursive: true });
  fs.writeFileSync(start.savePath(env), 'Google Workspace,\nOkta\n');

  const keep = await run({ home, answers: [''] });
  assert.equal(keep.code, 0, keep.err);
  assert.equal(keep.asked.length, 1, 'one prompt: keep, change or clear');
  assert.ok(!keep.out.includes(start.QUESTION), 'the question is not asked again');
  assert.match(keep.out, /^.*Google Workspace, Okta.*$/m, 'the saved answer in one line');
  assert.deepEqual(keep.spawned[0].args, [CHAT, '--setup', 'Google Workspace, Okta']);

  for (const word of ['change', 'c', ' CHANGE ']) {
    const changed = await run({ home, answers: [word, `Okta, Slack, ${word.trim()}`] });
    assert.equal(changed.code, 0, changed.err);
    assert.equal(changed.asked.length, 2, `${word}: asks the question`);
    assert.ok(changed.out.includes(start.QUESTION));
    assert.equal(start.parseSaved(fs.readFileSync(changed.file, 'utf8')), `Okta, Slack, ${word.trim()}`);
    assert.deepEqual(changed.spawned[0].args, [CHAT, '--setup', `Okta, Slack, ${word.trim()}`]);
  }

  const cleared = await run({ home, answers: ['clear'] });
  assert.equal(cleared.code, 0, cleared.err);
  assert.ok(!fs.existsSync(cleared.file), 'the saved file is removed');
  assert.deepEqual(cleared.spawned[0].args, [CHAT]);
  const after = await run({ home, answers: [''] });
  assert.ok(after.out.includes(start.QUESTION), 'the next run is a first run again');
});

// Wrong implementations it catches: a launcher that prompts when stdin is a pipe (it would hang, or read the end of
// input as an empty answer and start with none, or as "clear"), or one that drops the saved answer when it cannot ask.
test('with no terminal it asks nothing and starts with the saved answer, or with none', async (t) => {
  const home = tempHome(t);
  const none = await run({ home, tty: false });
  assert.equal(none.code, 0, none.err);
  assert.equal(none.asked.length, 0);
  assert.deepEqual(none.spawned[0].args, [CHAT]);

  fs.mkdirSync(path.dirname(none.file), { recursive: true });
  fs.writeFileSync(none.file, 'Okta, Slack\n');
  const saved = await run({ home, tty: false });
  assert.equal(saved.asked.length, 0);
  assert.deepEqual(saved.spawned[0].args, [CHAT, '--setup', 'Okta, Slack']);
});

// Wrong implementations it catches: a read error that crashes with a stack trace or stops the launcher, one that is
// read as "no saved answer" in silence, and a write error that blocks the chat or claims the answer was saved.
test('a saved file it cannot read starts with no setup and says so; a home folder it cannot write still starts', async (t) => {
  const home = tempHome(t);
  const env = { HOME: home, USERPROFILE: home };
  fs.mkdirSync(path.dirname(start.savePath(env)), { recursive: true });
  fs.writeFileSync(start.savePath(env), 'Okta\n');
  const denied = (name) => () => { const e = new Error(`${name} denied`); e.code = 'EACCES'; throw e; };
  const unreadable = await run({ home, answers: [], fsImpl: { ...fs, readFileSync: denied('read') } });
  assert.equal(unreadable.code, 0, unreadable.err);
  assert.equal(unreadable.asked.length, 0, 'asks nothing');
  assert.match(unreadable.err, /could not read/);
  assert.match(unreadable.err, /EACCES/);
  assert.ok(!unreadable.err.includes('    at '), 'no stack trace');
  assert.deepEqual(unreadable.spawned[0].args, [CHAT]);

  const home2 = tempHome(t);
  for (const name of ['mkdirSync', 'writeFileSync']) {
    const r = await run({ home: home2, answers: ['Okta'], fsImpl: { ...fs, [name]: denied(name) } });
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /was not saved/, name);
    assert.ok(!/\bsaved in\b/i.test(r.out), `${name}: no claim that it was saved`);
    assert.deepEqual(r.spawned[0].args, [CHAT, '--setup', 'Okta'], `${name}: the chat still starts`);
  }
});

// Wrong implementations it catches: Ctrl-C read as an empty answer (the chat starts with no setup), as the text "null"
// (saved and passed on), or a launcher that exits non-zero so the window waits for Enter after the person chose to stop.
test('Ctrl-C at the question exits cleanly: nothing saved and no chat', async (t) => {
  const home = tempHome(t);
  const r = await run({ home, answers: [null] });
  assert.equal(r.code, 0);
  assert.equal(r.spawned.length, 0, 'no chat');
  assert.ok(!fs.existsSync(r.file), 'nothing saved');
  assert.ok(!fs.existsSync(path.dirname(r.file)), 'no folder made');
});

// Wrong implementations it catches: a launcher that always exits 0 (the window closes on an error), one that exits
// before the chat ends, one with no Ctrl-C handler while the chat runs (the terminal sends Ctrl-C to the whole group,
// so the launcher would die and leave the chat on the terminal), one that leaves its handler behind, and a chat that
// cannot start shown as a stack trace.
test('the chat\'s exit code is the launcher\'s; Ctrl-C is ignored only while the chat runs; a chat that cannot start is exit 2', async (t) => {
  const home = tempHome(t);
  assert.equal((await run({ home, tty: false, exit: 3 })).code, 3);
  assert.equal((await run({ home, tty: false, exit: null, signal: 'SIGTERM' })).code, 2);

  const child = new EventEmitter();
  const before = process.listenerCount('SIGINT');
  let started = 0;
  const running = run({ home, tty: false, spawnImpl: () => { started += 1; return child; } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, 1);
  assert.equal(process.listenerCount('SIGINT'), before + 1, 'a handler while the chat runs');
  child.emit('exit', 0, null);
  assert.equal((await running).code, 0);
  assert.equal(process.listenerCount('SIGINT'), before, 'removed after the chat ends');

  const failed = await run({ home, tty: false, spawnImpl: () => { const e = new Error('spawn failed'); e.code = 'ENOENT'; throw e; } });
  assert.equal(failed.code, 2);
  assert.match(failed.err, /could not start the Aegis chat \(ENOENT\)/);
  assert.ok(!failed.err.includes('    at '));
  const emitted = await run({ home, tty: false, spawnImpl: () => { const c = new EventEmitter(); setImmediate(() => c.emit('error', Object.assign(new Error('x'), { code: 'EACCES' }))); return c; } });
  assert.equal(emitted.code, 2);
  assert.equal(process.listenerCount('SIGINT'), before, 'removed after a failed start too');
});

// Wrong implementations it catches: a parser that returns '' for an empty file (the chat would get `--setup ''`, which
// is not "nothing"), keeps the line breaks of a file edited by hand (the saved answer would not show in one line), or
// keeps the spaces around it.
test('parseSaved reads the saved file as one line, or null when it holds nothing', () => {
  assert.equal(start.parseSaved('  Google Workspace,\n Okta \r\n'), 'Google Workspace, Okta');
  assert.equal(start.parseSaved(''), null);
  assert.equal(start.parseSaved(' \n\t\n'), null);
});

// Wrong implementations it catches: a saved file edited by hand to hold a password, passed on to the chat (which
// would refuse it and stop on every start), or a hand-typed address passed on as typed.
test('a saved answer that holds a password is not used, and a saved address is masked', async (t) => {
  const home = tempHome(t);
  const env = { HOME: home, USERPROFILE: home };
  fs.mkdirSync(path.dirname(start.savePath(env)), { recursive: true });
  fs.writeFileSync(start.savePath(env), `${PASSWORD_ANSWER}\n`);
  const r = await run({ home, tty: false });
  assert.match(r.err, /holds a value Aegis never keeps/);
  assert.ok(!r.err.includes('Hunter22'));
  assert.deepEqual(r.spawned[0].args, [CHAT]);

  fs.writeFileSync(start.savePath(env), `Okta, admin ${MAIL}\n`);
  const masked = await run({ home, tty: false });
  assert.deepEqual(masked.spawned[0].args, [CHAT, '--setup', 'Okta, admin [USER@DOMAIN.COM]']);
});
