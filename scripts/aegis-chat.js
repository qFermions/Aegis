#!/usr/bin/env node
'use strict';
// aegis-chat.js: an interactive Claude Code session inside Aegis, for follow-up questions (batch 9, task 11).
//
// Usage: node scripts/aegis-chat.js [--setup "what the company runs"] [--reply-to asker] [--model <model>] [--no-tools]
//
// AEGIS ADVISES; HUMANS EXECUTE. The session has the Customer Desk's tool flags and isolation, taken from
// backends.sutArgs without its print-mode flags (-p, stream-json, --max-turns, --no-session-persistence):
// read-only tools, no Bash, no Edit or Write, no open web, this repository's settings and CLAUDE.md only, no
// user plugin, hook or MCP server but Aegis's own read-only tool server (batch 12, task 5: public lookups of vendor
// documentation on a fixed list and of DNS, web and certificate records; --no-tools leaves it out, and its calls are
// audited under ~/aegis-asks/chat-<run id>/), a scrubbed environment. --setup goes in as an appended system prompt
// marked as data about the environment. --reply-to asker (batch 11, task 6) adds, to the same appended prompt, the
// voice of the reply to the person who asked (docs/aegis/answer-format.md, section 8), so it holds across turns;
// the replies are text a person sends, and the chat sends nothing. The terminal is handed to claude; the exit code
// is claude's. The chat runs on backends.PINNED_MODEL (claude-opus-5-5) unless --model names another (batch 11 resumed).
// Batch 12d: with the tools on, what the person types (the setup, then each message, through a UserPromptSubmit hook)
// goes to typed.txt in the chat's folder for the tool server's scope, and the file is removed when the chat ends.

const childProcess = require('node:child_process');

const backends = require('./eval/judged/backends.js');
const path = require('node:path');

const { REPO_ROOT, ASKS_DIR, homeOf, sessionEnv, setupBlock, protect } = require('./ask-aegis.js');
const fs = require('node:fs');
const paths = require('./eval/judged/paths.js');
const { writeTyped } = require('./mcp/aegis-tools/session.js');

const NOTICE = 'This Aegis chat reads only: Aegis can read its runbooks and answer your questions, and it cannot run commands, change files or change anything in your systems; a person does every change.';
// With the read-only tool server on (batch 12, task 5), the chat can also make public lookups; the notice says so.
const NOTICE_TOOLS = 'This Aegis chat reads only: Aegis can read its runbooks and make public lookups (vendor documentation on a fixed list, and public DNS, web and certificate records), and it cannot run commands, change files or change anything in your systems; a person does every change.';
const USAGE = 'Usage: node scripts/aegis-chat.js [--setup "what the company runs"] [--reply-to asker] [--model <model>] [--no-tools]\nType your questions inside the chat.\n';
// The asker's voice for a whole chat: this command's own instruction, in the appended system prompt.
const ASKER_VOICE = [
  'Every answer in this chat is the reply to the person who asked, as docs/aegis/answer-format.md section 8 sets it out: work the ticket as Aegis works any ticket, then show only that reply.',
  'At most 3 short paragraphs and 150 words, in full sentences addressed to "you"; no headings, lists, bold, portal paths, gate ids, risk classes or bracketed placeholders.',
  'Never say a change is done, never tell the asker to take an admin action, never say Aegis changed anything, and name a time only when the ticket or the company setup sets one. For a ticket with nothing to go on, the reply is the one question.',
].join('\n');

// asksRoot, the saved asks (~/aegis-asks), is denied like a desk run's folder (review round 1, finding 2)
// replyTo: null, or 'asker' for the asker's voice on every turn; one appended prompt holds the setup and the voice
// model: the chat's model, backends.PINNED_MODEL when none is given (it is the last of sutArgs, after --tools)
// tools and auditFile: the read-only tool server (batch 12, task 5), on by default
// typedFile (batch 12d): what the person typed, for the server's scope: the setup, then each message the person sends,
// appended by the UserPromptSubmit hook the session's inline --settings carries (promptHook)
function chatArgs(setup, asksRoot, replyTo = null, model = null, { tools = true, auditFile = null, typedFile = null } = {}) {
  const desk = backends.sutArgs({ prompt: '', persist: false, runRoot: asksRoot, model, tools, auditFile, typedFile, promptHook: true });
  const args = desk.slice(desk.indexOf('--tools'));
  const appended = [...(setup && setup.trim() ? setupBlock(setup, 'session') : []), ...(replyTo === 'asker' ? [ASKER_VOICE] : [])];
  return appended.length ? [...args, '--append-system-prompt', appended.join('\n')] : args;
}

function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const io = { out: deps.out || ((s) => process.stdout.write(s)), err: deps.err || ((s) => process.stderr.write(s)) };
  let setup = null;
  let replyTo = null;
  let model = backends.PINNED_MODEL;
  let tools = true;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--no-tools') tools = false;
    else if (argv[i] === '--model' && i + 1 < argv.length && backends.isModelName(argv[i + 1])) { model = argv[i + 1]; i += 1; } else if (argv[i] === '--setup' && i + 1 < argv.length) { setup = argv[i + 1]; i += 1; } else if (argv[i] === '--reply-to' && argv[i + 1] === 'asker') { replyTo = 'asker'; i += 1; } else if (argv[i] === '--help' || argv[i] === '-h') { io.out(USAGE); return Promise.resolve(0); } else {
      const why = argv[i] === '--setup' ? '--setup needs a value' : (argv[i] === '--reply-to' ? '--reply-to takes asker' : (argv[i] === '--model' ? '--model takes a model name, such as claude-opus-5-5' : `unexpected ${JSON.stringify(argv[i]).slice(0, 40)}`));
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
  // the chat's tool calls are audited to a folder of its own under the saved asks, which the session may not read
  let auditFile = null;
  let typedFile = null;
  if (tools) {
    const chatDir = path.join(homeOf(env), ASKS_DIR, `chat-${paths.newRunId()}`);
    try { fs.mkdirSync(chatDir, { recursive: true, mode: 0o700 }); auditFile = path.join(chatDir, 'tool-audit.jsonl'); } catch { /* the server then audits to its stderr */ }
    // what the person typed (batch 12d): the setup now, each later message through the prompt hook; a file that cannot
    // be written leaves the server with only its two allowlists, the safe direction
    if (auditFile) {
      try { writeTyped(path.join(chatDir, 'typed.txt'), setup || ''); typedFile = path.join(chatDir, 'typed.txt'); } catch (e) {
        io.err(`aegis-chat: the typed file could not be written (${e.code || 'error'}), so lookups reach only the listed hosts.\n`);
      }
    }
  }
  io.out(`${tools ? NOTICE_TOOLS : NOTICE}\n`);
  const backend = deps.backend || { command: 'claude', prefixArgs: [] };
  const spawn = deps.spawn || childProcess.spawn;
  return new Promise((resolve) => {
    let done = false;
    // Ctrl-C reaches the whole foreground group: claude uses it to stop a reply, so the parent ignores it
    // while claude runs, or it would exit and leave claude on the terminal (code review round 1, finding 1)
    const ignoreInterrupt = () => {};
    // a chat that made no lookup leaves no folder behind: its audit file is empty or was never written (code review 1
    // of batch 12, class D); one that made lookups keeps its audit file
    const tidy = () => {
      // the person's words leave the disk with the chat (batch 12d)
      if (typedFile) try { fs.unlinkSync(typedFile); } catch { /* gone already */ }
      if (!auditFile) return;
      let size = 0;
      try { size = fs.statSync(auditFile).size; } catch { /* never written */ }
      if (size !== 0) return;
      try { fs.unlinkSync(auditFile); } catch { /* never written */ }
      try { fs.rmdirSync(path.dirname(auditFile)); } catch { /* not empty or gone: left as it is */ }
    };
    let child;
    // a closed terminal window (SIGHUP) or a kill (SIGTERM) would end this launcher before claude's exit is seen, and
    // leave every message the person typed on disk: tidy at once, pass the signal on, and let claude's exit end the chat
    // shortcut: a SIGKILL or a power loss still leaves typed.txt (0600, outside the repository); sweep old chat folders
    // at start if that is ever seen
    const stop = (signal) => { tidy(); try { child.kill(signal); } catch { /* no child, or gone already */ } };
    const finish = (code) => { if (!done) { done = true; for (const [signal, handler] of [['SIGINT', ignoreInterrupt], ['SIGHUP', stop], ['SIGTERM', stop]]) process.removeListener(signal, handler); tidy(); resolve(code); } };
    process.on('SIGINT', ignoreInterrupt);
    process.on('SIGHUP', stop);
    process.on('SIGTERM', stop);
    const failed = (e) => { io.err(`aegis-chat: could not start claude (${e.code || 'error'}). Is Claude Code installed? Type claude once to install it and sign in.\n`); finish(2); };
    try {
      child = spawn(backend.command, [...(backend.prefixArgs || []), ...chatArgs(setup, path.join(homeOf(env), ASKS_DIR), replyTo, model, { tools, auditFile, typedFile })], { cwd: REPO_ROOT, env: sessionEnv(env), stdio: 'inherit', shell: false });
    } catch (e) { failed(e); return; }
    child.on('error', failed);
    child.on('exit', (code) => finish(code === null ? 2 : code));
  });
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}

module.exports = { main, chatArgs, NOTICE, NOTICE_TOOLS, ASKER_VOICE };
