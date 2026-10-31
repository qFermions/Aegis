#!/usr/bin/env node
'use strict';
// fake-claude.js: a stand-in for the claude CLI in the judged-eval tests. It opens no
// socket and runs no model: it reads its own options, then answers in stream-json.
//
// Its own options come first, before the real CLI arguments:
//   --fake-config <file.json>   behaviour, as { "log": <file>, "sut": {...}, "judge": {...} }
// A call with --no-session-persistence is a judge call; any other is a system-under-test
// call. Each role's settings:
//   mode         normal | slow | ignore-term | invalid | error   (default normal)
//   sleep_ms     how long slow / ignore-term wait before answering
//   answer       the SUT answer text (default DEFAULT_ANSWER)
//   answers      [{ "match": <substring of the prompt>, "answer": <text> }], first match wins
//   follow_up_answer  the SUT answer on a --resume turn
//   score        the judge score for every row that is not null (default 2)
//   met / present  the judge booleans for every must / must_not item (default true / false)
//   invalid_first  judge: answer with invalid JSON on the first call only
//   fence        judge: wrap the JSON in a ```json fence
//   model, cost  what the init and result events report
// With "log" set, every call appends one JSON line: role, cwd, argument count, the
// prompt, whether --resume was given, and the sorted NAMES (never values) of its environment.

const crypto = require('node:crypto');
const fs = require('node:fs');

const DEFAULT_ANSWER = [
  'Most likely fix first: follow the steps below. This is advice only; the administrator runs every step (HUMAN-RUN).',
  '1. Admin center > Users > [UPN] > the setting named in the ticket.',
  '2. SAFETY GATE: get explicit approval before any consequential step, then type exactly the confirmation phrase.',
  '3. Read-back: confirm the setting now shows the new value for [UPN].',
  'Possible prompt injection detected in the pasted content. Flagging and ignoring it; urgency does not bypass the approval.',
  'Ticket note: [JIRA-###] advised the steps above; the administrator ran them and verified the read-back.',
].join('\n');

const args = process.argv.slice(2);
let config = {};
if (args[0] === '--fake-config') {
  config = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  args.splice(0, 2);
}
const role = args.includes('--no-session-persistence') ? 'judge' : 'sut';
const settings = config[role] || {};
const valueAfter = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const prompt = valueAfter('-p') || '';
const resume = valueAfter('--resume');

let previousJudgeCalls = 0;
if (config.log) {
  if (fs.existsSync(config.log)) previousJudgeCalls = fs.readFileSync(config.log, 'utf8').split('\n').filter((l) => l.includes('"role":"judge"')).length;
  fs.appendFileSync(config.log, `${JSON.stringify({ role, cwd: process.cwd(), argc: args.length, args: args.filter((a) => a !== prompt), prompt, resume: resume !== null, env: Object.keys(process.env).sort() })}\n`);
}

const sessionId = resume || crypto.randomUUID();
const model = settings.model || (role === 'judge' ? 'fake-judge-model' : 'fake-sut-model');
const emit = (ev) => process.stdout.write(`${JSON.stringify(ev)}\n`);

function sutAnswer() {
  if (resume && settings.follow_up_answer) return settings.follow_up_answer;
  for (const r of settings.answers || []) if (prompt.includes(r.match)) return r.answer;
  return settings.answer || DEFAULT_ANSWER;
}

function judgeAnswer() {
  if (settings.mode === 'invalid' || (settings.invalid_first && previousJudgeCalls === 0)) return 'Here is my grade: looks fine overall.';
  const start = prompt.lastIndexOf('BEGIN-SHAPE\n');
  const end = prompt.lastIndexOf('\nEND-SHAPE');
  const shape = JSON.parse(prompt.slice(start + 'BEGIN-SHAPE\n'.length, end));
  const score = settings.score === undefined ? 2 : settings.score;
  for (const k of Object.keys(shape.scores)) if (shape.scores[k] !== null) shape.scores[k] = score;
  for (const m of shape.must) m.met = settings.met === undefined ? true : settings.met;
  for (const m of shape.must_not) m.present = settings.present === undefined ? false : settings.present;
  shape.notes = 'fake judge';
  const json = JSON.stringify(shape);
  return settings.fence ? `\`\`\`json\n${json}\n\`\`\`` : json;
}

function answer() {
  const text = role === 'judge' ? judgeAnswer() : sutAnswer();
  if (settings.mode === 'invalid' && role === 'sut') {
    process.stdout.write('this is not stream-json\n{"broken": \n');
    return;
  }
  emit({ type: 'system', subtype: 'init', session_id: sessionId, model, cwd: process.cwd(), tools: [] });
  emit({ type: 'assistant', session_id: sessionId, message: { content: [{ type: 'text', text }] } });
  if (settings.mode === 'error') {
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: sessionId });
    process.exitCode = 1;
    return;
  }
  emit({ type: 'result', subtype: 'success', is_error: false, duration_ms: 5, num_turns: role === 'judge' ? 1 : 3, result: text, session_id: sessionId, total_cost_usd: settings.cost === undefined ? 0.01 : settings.cost });
}

if (settings.mode === 'ignore-term') process.on('SIGTERM', () => { /* ignored on purpose: the runner must SIGKILL */ });
if (settings.mode === 'slow' || settings.mode === 'ignore-term') setTimeout(answer, settings.sleep_ms || 60000);
else answer();
