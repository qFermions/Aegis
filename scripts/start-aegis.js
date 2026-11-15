#!/usr/bin/env node
'use strict';
// start-aegis.js: the launcher behind the Start Aegis double-click files (batch 12, task 11).
//
// Usage: node scripts/start-aegis.js
//        (or double-click "Start Aegis.command" on a Mac, "Start Aegis.cmd" on Windows; both run this from the
//        repository root). It takes no options.
//
// First run: one question, "What does your company run?", with one hint line. The answer passes ask-aegis's protect():
// a password, key or tenant literal is refused and the question asked again (3 tries, then no setup); email addresses
// and phone numbers become placeholders. The protected answer is saved in ~/.aegis/company-setup.txt (folder made 0700,
// file 0600), never inside the repository. An empty answer saves nothing.
// Later runs: the saved answer in one line; Enter keeps it, c or change asks again, clear removes the file.
// Then it starts scripts/aegis-chat.js with the same node binary, from the repository root, on this terminal, with
// `--setup <answer>` or with nothing, and exits with the chat's exit code. The chat is sealed as aegis-chat.js says.
// With no terminal (stdin not interactive) it asks nothing and uses the saved answer, or none. Ctrl-C at the question
// exits 0 with nothing saved. To reset it, delete ~/.aegis/company-setup.txt or type clear (docs/aegis/start-aegis.md).

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { protect, homeOf, insideRepo, REPO_ROOT } = require('./ask-aegis.js');

const CHAT = path.join(REPO_ROOT, 'scripts', 'aegis-chat.js');
const QUESTION = 'What does your company run?';
const HINT = 'For example: Google Workspace, Okta, Slack, GitHub, AWS and Macs with Jamf. Press Enter to skip.';
const MAX_TRIES = 3;
const STOP = Symbol('stop');
const USAGE = 'Usage: node scripts/start-aegis.js\nIt asks what your company runs (once), then starts the Aegis chat.\n';

const savePath = (env) => path.join(homeOf(env), '.aegis', 'company-setup.txt');
// the saved file, or a typed answer, as one line; null when it holds nothing
const parseSaved = (text) => String(text).replace(/\s+/g, ' ').trim() || null;

// One line from the terminal; null on Ctrl-C or the end of input.
function askLine(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on('SIGINT', () => rl.close());
    rl.on('close', () => { if (!answered) { process.stdout.write('\n'); resolve(null); } });
    rl.question(question, (answer) => { answered = true; rl.close(); resolve(answer); });
  });
}

function save(text, file, canSave, fsx, io) {
  if (!canSave) { io.err('start-aegis: your home folder is inside the Aegis folder, so your answer was not saved. Aegis uses it this time only.\n'); return; }
  try {
    fsx.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fsx.writeFileSync(file, `${text}\n`, { mode: 0o600 });
    // an older file keeps its mode on write, so it is set again
    fsx.chmodSync(file, 0o600);
    io.out(`Saved in ${file}. Next time you can keep it, change it or clear it.\n`);
  } catch (e) {
    io.err(`start-aegis: your answer was not saved (${e.code || 'error'}). Aegis uses it this time only.\n`);
  }
}

// The one question: the protected answer, null for none, or STOP on Ctrl-C.
async function askSetup(prompt, file, canSave, fsx, io) {
  io.out(`${QUESTION}\n${HINT}\n`);
  for (let tries = 1; tries <= MAX_TRIES; tries += 1) {
    const answer = await prompt('> ');
    if (answer === null) return STOP;
    const text = parseSaved(answer);
    if (text === null) return null;
    const safe = protect(text);
    if (!safe.blocked) { save(safe.text, file, canSave, fsx, io); return safe.text; }
    const next = tries < MAX_TRIES ? 'Take it out and type it again.' : 'Aegis starts with no company setup.';
    io.err(`start-aegis: the text holds a value Aegis never keeps (${safe.blocked.join('; ')}). Nothing was saved. ${next}\n`);
  }
  return null;
}

// aegis-chat.js on this terminal; resolves with its exit code.
function startChat(setup, env, deps, io) {
  const spawn = deps.spawn || childProcess.spawn;
  const args = [CHAT, ...(setup ? ['--setup', setup] : [])];
  return new Promise((resolve) => {
    let done = false;
    // Ctrl-C reaches the whole foreground group and the chat uses it to stop a reply, so it is ignored here while the
    // chat runs, as aegis-chat.js does for claude
    const ignoreInterrupt = () => {};
    const finish = (code) => { if (!done) { done = true; process.removeListener('SIGINT', ignoreInterrupt); resolve(code); } };
    process.on('SIGINT', ignoreInterrupt);
    const failed = (e) => { io.err(`start-aegis: could not start the Aegis chat (${e.code || 'error'}).\n`); finish(2); };
    let child;
    try {
      child = spawn(process.execPath, args, { cwd: REPO_ROOT, env, stdio: 'inherit', shell: false });
    } catch (e) { failed(e); return; }
    child.on('error', failed);
    child.on('exit', (code) => finish(code === null ? 2 : code));
  });
}

async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const io = { out: deps.out || ((s) => process.stdout.write(s)), err: deps.err || ((s) => process.stderr.write(s)) };
  if (argv.length) {
    if (argv[0] === '--help' || argv[0] === '-h') { io.out(USAGE); return 0; }
    io.err(`start-aegis: it takes no options.\n${USAGE}`);
    return 1;
  }
  const fsx = deps.fs || fs;
  const prompt = deps.prompt || askLine;
  const interactive = deps.isTTY === undefined ? Boolean(process.stdin.isTTY) : deps.isTTY;
  const file = savePath(env);
  const canSave = !insideRepo(path.dirname(file));

  let saved = null;
  let readFailed = false;
  if (canSave) {
    try { saved = parseSaved(fsx.readFileSync(file, 'utf8')); } catch (e) {
      if (e.code !== 'ENOENT') { readFailed = true; io.err(`start-aegis: Aegis could not read your saved answer (${e.code || 'error'}), so it starts with no company setup.\n`); }
    }
  }
  // a file edited by hand passes the same rules as a typed answer
  if (saved) {
    const safe = protect(saved);
    if (safe.blocked) { io.err(`start-aegis: your saved answer holds a value Aegis never keeps (${safe.blocked.join('; ')}), so it was not used.\n`); saved = null; } else saved = safe.text;
  }

  let setup = saved;
  if (interactive && !readFailed) {
    let answer = saved;
    if (saved) {
      io.out(`Your company setup: ${saved}\n`);
      const choice = await prompt('Press Enter to keep it, or type change or clear: ');
      const word = choice === null ? null : choice.trim().toLowerCase();
      if (word === null) answer = STOP;
      else if (word === 'c' || word === 'change') answer = await askSetup(prompt, file, canSave, fsx, io);
      else if (word === 'clear') {
        answer = null;
        try { fsx.rmSync(file, { force: true }); io.out('Your saved answer is removed.\n'); } catch (e) { io.err(`start-aegis: your saved answer could not be removed (${e.code || 'error'}).\n`); }
      } else if (word !== '') io.out('Kept your saved answer.\n');
    } else answer = await askSetup(prompt, file, canSave, fsx, io);
    if (answer === STOP) { io.out('Stopped. Nothing was saved.\n'); return 0; }
    setup = answer;
  }
  if (!setup) io.out('No company setup: each answer says what Aegis assumed. You can tell it what your company runs in the chat.\n');
  return startChat(setup, env, deps, io);
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}

module.exports = { main, parseSaved, savePath, QUESTION, HINT, CHAT };
