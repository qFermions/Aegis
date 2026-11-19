#!/usr/bin/env node
'use strict';
// fake-claude.js: a stand-in for the claude CLI in the judged-eval tests. It opens no
// socket and runs no model: it reads its own options, then answers in stream-json.
//
// Its own options come first, before the real CLI arguments:
//   --fake-config <file.json>   behaviour, as { "log": <file>, "sut": {...}, "judge": {...} }
// A call with --tools "" is a judge call; any other is a system-under-test call (the Customer
// Desk's sessions also run with --no-session-persistence). Each role's settings:
//   mode         normal | slow | ignore-term | invalid | error   (default normal)
//   sleep_ms     how long slow / ignore-term wait before answering
//   answer       the SUT answer text (default DEFAULT_ANSWER)
//   answers      [{ "match": <substring of the prompt>, "answer": <text> }], first match wins
//   follow_up_answer  the SUT answer on a --resume turn
//   score        the judge score for every row that is not null (default 2)
//   met / present  the judge booleans for every must / must_not item (default true / false)
//   invalid_first  judge: answer with invalid JSON on the first call only
//   slow_first   judge: behave as mode slow on the first call only (a first attempt that times out, then a retry)
//   fence        judge: wrap the JSON in a ```json fence
//   model, cost  what the init and result events report; with no model, the init event reports the --model it was
//                given, as the real CLI does, else fake-sut-model or fake-judge-model
//   tool_calls   SUT: [{ "name", "input", "parent": bool, "error": bool, "match": <substring of the prompt> }];
//                each becomes a tool_use event and its tool_result before the answer, on every turn. parent
//                marks a call made inside a subagent, error a refused or failed call, and a call with match
//                is sent only when the prompt holds that text (batch 11, task 7)
//   audit_entries  SUT: audit lines (objects) appended to the --audit file named in --mcp-config (batch 12d)
// With "log" set, every call appends one JSON line: role, cwd, argument count, the
// prompt, whether --resume was given, the sorted NAMES (never values) of its environment, and typed: what the
// tool server's --typed file held at the start (batch 12d).

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
const role = args.includes('--tools') && args[args.indexOf('--tools') + 1] === '' ? 'judge' : 'sut';
const settings = config[role] || {};
const valueAfter = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const prompt = valueAfter('-p') || '';
const resume = valueAfter('--resume');

// batch 12d: what the tool server's --typed file held when the session started, and its mode, so a test can see what
// the launcher handed over before the session ran; null when no --typed file is named
let typed = null;
if (role === 'sut' && args.includes('--mcp-config')) {
  try {
    const server = JSON.parse(valueAfter('--mcp-config')).mcpServers['aegis-tools'];
    const at = server.args.indexOf('--typed');
    if (at >= 0) typed = { file: server.args[at + 1], text: fs.readFileSync(server.args[at + 1], 'utf8'), mode: fs.statSync(server.args[at + 1]).mode & 0o777 };
  } catch (e) { typed = { error: e.code || 'error' }; }
}

let previousJudgeCalls = 0;
if (config.log) {
  if (fs.existsSync(config.log)) previousJudgeCalls = fs.readFileSync(config.log, 'utf8').split('\n').filter((l) => l.includes('"role":"judge"')).length;
  fs.appendFileSync(config.log, `${JSON.stringify({ role, cwd: process.cwd(), argc: args.length, args: args.filter((a) => a !== prompt), prompt, resume: resume !== null, env: Object.keys(process.env).sort(), typed })}\n`);
}

// Like the real aegis-tools server, which opens its --audit file (create, append) when the session starts: the file
// exists, empty, even when no tool is called; audit_lines writes that many call lines into it (code review 1 of batch 12).
if (role === 'sut' && args.includes('--mcp-config')) {
  try {
    const server = JSON.parse(valueAfter('--mcp-config')).mcpServers['aegis-tools'];
    const at = server.args.indexOf('--audit');
    // audit_entries (batch 12d): whole audit lines, as the server writes them, after the audit_lines
    if (at >= 0) fs.appendFileSync(server.args[at + 1], '{"tool":"net_dns","decision":"ok"}\n'.repeat(settings.audit_lines || 0) + (settings.audit_entries || []).map((e) => `${JSON.stringify(e)}\n`).join(''), { mode: 0o600 });
  } catch { /* no audit file named: the server would audit to stderr */ }
}

const sessionId = resume || crypto.randomUUID();
const model = settings.model || valueAfter('--model') || (role === 'judge' ? 'fake-judge-model' : 'fake-sut-model');
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
  // init_tools: the tool names the init event lists (batch 12); an --mcp-config makes the server show as connected
  emit({ type: 'system', subtype: 'init', session_id: sessionId, model, cwd: process.cwd(), tools: settings.init_tools || [], mcp_servers: args.includes('--mcp-config') ? [{ name: 'aegis-tools', status: 'connected' }] : [] });
  (role === 'sut' ? settings.tool_calls || [] : []).filter((c) => !c.match || prompt.includes(c.match)).forEach((c, i) => {
    const id = `toolu_fake_${i + 1}`;
    const parent = c.parent ? 'toolu_fake_parent' : null;
    emit({ type: 'assistant', session_id: sessionId, parent_tool_use_id: parent, message: { content: [{ type: 'tool_use', id, name: c.name, input: c.input }] } });
    emit({ type: 'user', session_id: sessionId, parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: Boolean(c.error), content: c.error ? 'refused' : 'ok' }] } });
  });
  emit({ type: 'assistant', session_id: sessionId, message: { content: [{ type: 'text', text }] } });
  if (settings.mode === 'error') {
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: sessionId });
    process.exitCode = 1;
    return;
  }
  emit({ type: 'result', subtype: 'success', is_error: false, duration_ms: 5, num_turns: role === 'judge' ? 1 : 3, result: text, session_id: sessionId, total_cost_usd: settings.cost === undefined ? 0.01 : settings.cost });
}

if (settings.mode === 'ignore-term') process.on('SIGTERM', () => { /* ignored on purpose: the runner must SIGKILL */ });
const slowNow = settings.mode === 'slow' || settings.mode === 'ignore-term' || (settings.slow_first && role === 'judge' && previousJudgeCalls === 0);
if (slowNow) setTimeout(answer, settings.sleep_ms || 60000);
else answer();
