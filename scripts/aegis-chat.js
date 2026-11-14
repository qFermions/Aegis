#!/usr/bin/env node
'use strict';
// aegis-chat.js: an interactive Claude Code session inside Aegis, for follow-up questions (batch 9, task 11).
//
// Usage: node scripts/aegis-chat.js [--setup "what the company runs"] [--reply-to asker]
//
// AEGIS ADVISES; HUMANS EXECUTE. The session has the Customer Desk's tool flags and isolation, taken from
// backends.sutArgs without its print-mode flags (-p, stream-json, --max-turns, --no-session-persistence):
// read-only tools, no Bash, no Edit or Write, no web, this repository's settings and CLAUDE.md only, no
// user plugin, hook or MCP server, a scrubbed environment. --setup goes in as an appended system prompt
// marked as data about the environment. --reply-to asker (batch 11, task 6) adds, to the same appended prompt, the
// voice of the reply to the person who asked (docs/aegis/answer-format.md, section 8), so it holds across turns;
// the replies are text a person sends, and the chat sends nothing. The terminal is handed to claude; the exit code
// is claude's.

const childProcess = require('node:child_process');

const backends = require('./eval/judged/backends.js');
const path = require('node:path');

const { REPO_ROOT, ASKS_DIR, homeOf, sessionEnv, setupBlock, protect } = require('./ask-aegis.js');

const NOTICE = 'This Aegis chat reads only: Aegis can read its runbooks and answer your questions, and it cannot run commands, change files or change anything in your systems; a person does every change.';
const USAGE = 'Usage: node scripts/aegis-chat.js [--setup "what the company runs"] [--reply-to asker]\nType your questions inside the chat.\n';
// The asker's voice for a whole chat: this command's own instruction, in the appended system prompt.
const ASKER_VOICE = [
  'Every answer in this chat is the reply to the person who asked, as docs/aegis/answer-format.md section 8 sets it out: work the ticket as Aegis works any ticket, then show only that reply.',
  'At most 3 short paragraphs and 150 words, in full sentences addressed to "you"; no headings, lists, bold, portal paths, gate ids, risk classes or bracketed placeholders.',
  'Never say a change is done, never tell the asker to take an admin action, never say Aegis changed anything, and name a time only when the ticket or the company setup sets one. For a ticket with nothing to go on, the reply is the one question.',
].join('\n');

// asksRoot, the saved asks (~/aegis-asks), is denied like a desk run's folder (review round 1, finding 2)
// replyTo: null, or 'asker' for the asker's voice on every turn; one appended prompt holds the setup and the voice
function chatArgs(setup, asksRoot, replyTo = null) {
  const desk = backends.sutArgs({ prompt: '', persist: false, runRoot: asksRoot });
  const args = desk.slice(desk.indexOf('--tools'));
  const appended = [...(setup && setup.trim() ? setupBlock(setup, 'session') : []), ...(replyTo === 'asker' ? [ASKER_VOICE] : [])];
  return appended.length ? [...args, '--append-system-prompt', appended.join('\n')] : args;
}

function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const io = { out: deps.out || ((s) => process.stdout.write(s)), err: deps.err || ((s) => process.stderr.write(s)) };
  let setup = null;
  let replyTo = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--setup' && i + 1 < argv.length) { setup = argv[i + 1]; i += 1; } else if (argv[i] === '--reply-to' && argv[i + 1] === 'asker') { replyTo = 'asker'; i += 1; } else if (argv[i] === '--help' || argv[i] === '-h') { io.out(USAGE); return Promise.resolve(0); } else {
      const why = argv[i] === '--setup' ? '--setup needs a value' : (argv[i] === '--reply-to' ? '--reply-to takes asker' : `unexpected ${JSON.stringify(argv[i]).slice(0, 40)}`);
      io.err(`aegis-chat: ${why}\n${USAGE}`);
      return Promise.resolve(1);
    }
  }
  // the setup text passes the same privacy rules as ask-aegis's (code review round 2 of batch 9, finding 14)
  if (setup !== null) {
    const safe = protect(setup);
    if (safe.blocked) { io.err(`aegis-chat: the setup text holds a value Aegis never keeps (${safe.blocked.join('; ')}). Nothing was sent. Take it out and start again.\n`); return Promise.resolve(1); }
    setup = safe.text;
  }
  io.out(`${NOTICE}\n`);
  const backend = deps.backend || { command: 'claude', prefixArgs: [] };
  const spawn = deps.spawn || childProcess.spawn;
  return new Promise((resolve) => {
    let done = false;
    // Ctrl-C reaches the whole foreground group: claude uses it to stop a reply, so the parent ignores it
    // while claude runs, or it would exit and leave claude on the terminal (code review round 1, finding 1)
    const ignoreInterrupt = () => {};
    const finish = (code) => { if (!done) { done = true; process.removeListener('SIGINT', ignoreInterrupt); resolve(code); } };
    process.on('SIGINT', ignoreInterrupt);
    const failed = (e) => { io.err(`aegis-chat: could not start claude (${e.code || 'error'}). Is Claude Code installed? Type claude once to install it and sign in.\n`); finish(2); };
    let child;
    try {
      child = spawn(backend.command, [...(backend.prefixArgs || []), ...chatArgs(setup, path.join(homeOf(env), ASKS_DIR), replyTo)], { cwd: REPO_ROOT, env: sessionEnv(env), stdio: 'inherit', shell: false });
    } catch (e) { failed(e); return; }
    child.on('error', failed);
    child.on('exit', (code) => finish(code === null ? 2 : code));
  });
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}

module.exports = { main, chatArgs, NOTICE, ASKER_VOICE };
