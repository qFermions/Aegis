#!/usr/bin/env node
'use strict';
// typed-hook.js: the Aegis chat's UserPromptSubmit hook (batch 12d).
//
// Usage (by Claude Code, from the inline --settings that scripts/aegis-chat.js passes; never by hand):
//   node scripts/mcp/aegis-tools/typed-hook.js <typed file>   with the hook's JSON on stdin
//
// Each time the person submits a message, Claude Code runs this with the event's JSON on stdin (hook_event_name
// "UserPromptSubmit" and prompt, the text submitted: https://code.claude.com/docs/en/hooks). It appends the prompt, and
// nothing else, to the typed file the aegis-tools server reads at each call (scope rule c), through session.writeTyped:
// created 0600, never through a symbolic link. Any other event, input that is not JSON, or no text prompt writes nothing.
// It prints nothing to stdout (Claude Code adds a UserPromptSubmit hook's stdout to the model's context) and always
// exits 0 (exit 2 would block the person's message): a failure goes to stderr, and that message then opens no host for
// the tools, the safe direction.

const { writeTyped } = require('./session.js');

function record(file, input) {
  if (!file) return 'no typed file named';
  let event;
  try { event = JSON.parse(input); } catch { return 'the hook input is not JSON'; }
  if (!event || event.hook_event_name !== 'UserPromptSubmit') return 'not a UserPromptSubmit event';
  if (typeof event.prompt !== 'string') return 'the event has no text prompt';
  try { writeTyped(file, event.prompt, { append: true }); } catch (e) { return `the typed file cannot be written (${e.code || 'error'})`; }
  return null;
}

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const problem = record(process.argv[2], Buffer.concat(chunks).toString('utf8'));
  if (problem) process.stderr.write(`aegis typed-hook: ${problem}; this message is not added to the typed file\n`);
  process.exitCode = 0;
});
