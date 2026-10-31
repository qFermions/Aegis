#!/usr/bin/env node
'use strict';
// change-record.js: change records for R2 and R3 procedures (batch G3, task 3c).
// README.md beside this file.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). A change record joins, in the audit
// trail, three things about one R2 or R3 procedure: the procedure Aegis issued (its
// SHA-256), the approval reference the operator supplied (an issue key) for exactly that
// digest, and a verify-* read-back that proved the person's change after the approval. A
// change is reported done only when all three match, in that order, on an intact chain.
// The approval authorizes a person's procedure; it never triggers a write by Aegis: this
// module writes the local audit trail and nothing else.
//
//   node scripts/audit/change-record.js open --command C --gate G --r-class R2|R3 --target [UPN] --read-back CONNECTOR:verify-... --procedure-file FILE [--expected N]
//   node scripts/audit/change-record.js approve --change chg-... --ref IT-123 --procedure-sha256 H
//   node scripts/audit/change-record.js link --change chg-... --verify-seq N
//   node scripts/audit/change-record.js status --change chg-...
// Batch G3 close-out (owner decision 1): a read-back is bound to its change when it is
// recorded. The verify-* command takes --change chg-... and, before any read, refuses unless
// this trail holds the change opened for that connector and command with an approval of its
// procedure (bindRefusal below); its verify entry then carries the change id, and link accepts
// only a read-back recorded under this change.
// Batch G3 close-out 2 (owner decision 2): a gate whose required confirmation names a count of
// objects, each proved by its own read-back (COUNTED_GATES), is a counted batch change: open
// takes --expected N, the number written in the ticket, and status reports "verified k of N",
// lists each failed read-back, and is done only when exactly N bound read-backs passed after
// the approval and none failed (N distinct runs where the read-back records a run id); anything
// else is partial. A gate without a count keeps the one-read-back rule.
// Exit codes: 0 done (status) or recorded; 1 input error or refused; 2 not done, a digest
// that does not match, or a broken trail.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const audit = require('./audit-log.js');

const MAX_PROCEDURE_BYTES = 1024 * 1024;
// The read-back that proves the change, named at open: a connector and its verify-* command
// (okta:verify-factor-reset). Since the batch G3 close-out the read-back also carries the
// change id it was run under (--change), so link binds it to exactly one change; the audit
// entries hold no target value, only placeholders, so which object it read is still the
// operator's step. The form is the trail's own (audit-log.js READ_BACK).
// Since the batch G3 close-out 3 (owner decision H1) a read-back is named with the flags that
// change what its pass means (okta:verify-group-member --absent), and a verify entry counts for a
// change only when it ran with the same ones (audit-log.js readBackOf).
const { READ_BACK, readBackOf, parseReadBack } = audit;
const kindOf = (e) => `${e.connector}:${e.command}`;
const kindOfReadBack = (readBack) => String(readBack).split(' ')[0];
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// The read-back must be a verify-* command its connector really has. A connector is named
// as its verify entries name it (cli-support.js recordVerdict, jira-client.js), and its file
// names the command as a key. Read as text, never loaded, so this module opens no network
// module.
const ROOT = path.resolve(__dirname, '..', '..');
// The runbooks open reads its gates and their bound read-backs from. Only the connector tests'
// change helpers change it, in their own process, to a folder of test gates
// (useRunbooksForTests); the CLI never does (code review round 1 of the batch G3 close-out 3,
// finding 13: the helpers had opened their changes on a real gate that binds no read-back).
const REAL_RUNBOOKS = path.join(ROOT, '.claude', 'commands');
let RUNBOOKS = REAL_RUNBOOKS;
// dir: the test gates' folder, or null to read the real runbooks again (code review round 2,
// finding 7: the helpers now point it back when their test ends)
function useRunbooksForTests(dir) { RUNBOOKS = dir || REAL_RUNBOOKS; }
const CONNECTOR_FILES = Object.freeze({
  fleet: 'scripts/adapters/fleet-client.js', github: 'scripts/adapters/github-client.js',
  'google-workspace': 'scripts/adapters/gws-client.js', jamf: 'scripts/adapters/jamf-client.js',
  linear: 'scripts/adapters/linear-client.js', msgraph: 'scripts/adapters/msgraph-client.js',
  okta: 'scripts/adapters/okta-client.js', slack: 'scripts/adapters/slack-client.js', jira: 'scripts/jira-client.js',
});
// Gates whose required confirmation names a count of objects the change acts on, each object
// proved by its own verify-* read-back (batch G3 close-out 2, owner decision 2), with the
// placeholder that holds the count. Every other gate that names a number is listed with its
// reason in counted-gates.test.js, which holds this table equal to the runbooks.
const COUNTED_GATES = Object.freeze({
  'fleet-device-actions-batch-script-portal': '[HOST_COUNT]',
  'github-security-alerts-dependabot-bulk-dismiss-portal': '[ALERT_COUNT]',
  'okta-group-membership-bulk-add-portal': '[N]',
  'okta-group-membership-bulk-remove-portal': '[N]',
  // batch G3 close-out 3, owner decision H4: /offboard's MFA clear, each method proved by
  // msgraph verify-method-absent (H3)
  'offboard-clear-mfa-portal': '$methodCount',
});
const EXPECTED = /^[1-9][0-9]{0,4}$/;

// A command is a key line of a command table: two spaces, the quoted name, a colon.
const hasCommandKey = (source, command) => new RegExp(`^  '${command}': `, 'm').test(source);

// The read-back named at open, with its pass flags in one form (batch G3 close-out 3, H1).
function checkReadBack(readBack) {
  const kind = kindOfReadBack(readBack);
  if (typeof readBack !== 'string' || !READ_BACK.test(kind)) throw new InputError('--read-back names the connector and its verify-* command, such as okta:verify-factor-reset, then the flags that change what its pass means, such as \'okta:verify-group-member --absent\'');
  const [connector, command] = kind.split(':');
  if (!Object.prototype.hasOwnProperty.call(CONNECTOR_FILES, connector)) throw new InputError(`--read-back: no connector named ${connector} (one of ${Object.keys(CONNECTOR_FILES).join(', ')})`);
  const source = fs.readFileSync(path.join(ROOT, CONNECTOR_FILES[connector]), 'utf8');
  if (!hasCommandKey(source, command)) throw new InputError(`--read-back: no such read-back, ${connector} has no ${command} command`);
  try {
    return parseReadBack(readBack);
  } catch (error) {
    if (error instanceof audit.AuditRefused) throw new InputError(`--read-back: ${error.message}`);
    throw error;
  }
}

// The read-back lines a gate's runbook runs under --change: in the gate's section, or named
// "read-back of [gate]" in the comment above (the change-binding pin test reads them the same
// way). A named read-back must be one of those lines' read-backs, in the form the line runs, so
// a removal gate whose line runs with --absent is never opened for a presence read, of its own
// command or of another connector's (batch G3 close-out 3, owner decision H1, and security review
// 1). A gate whose runbook binds no read-back takes no change record (code review round 1,
// finding 5).
const RUNBOOK_LINE = /node scripts\/(?:adapters\/)?([a-z]+)-client\.js (verify-[a-z0-9-]+)([^`\n]*)/;
const CLIENT_CONNECTOR = Object.freeze({ gws: 'google-workspace' });
// the gates a comment names a read-back for: "read-back of [a]", or of several, "[a], [b] or
// [c]" (code review round 1 of the batch G3 close-out 3, finding 1: only the first was read)
const NAMED_FOR = /^# [^\n]*\bread-back of (\[[a-z0-9-]+\](?:(?:,? or |,? and |, )\[[a-z0-9-]+\])*)/;
const namedGates = (comment) => {
  const m = String(comment || '').match(NAMED_FOR);
  return m ? [...m[1].matchAll(/\[([a-z0-9-]+)\]/g)].map((x) => x[1]) : null;
};
// every read-back line a runbook binds with --change, with the gates it proves: the gates its
// comment names, else the gate whose section it sits in (pass-flags.test.js reads them the same way)
function boundReadBacks(text) {
  const lines = text.split('\n');
  const found = [];
  let current = null;
  lines.forEach((l, i) => {
    if (/^## /.test(l)) current = null;
    const g = l.match(/<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/);
    if (g) current = g[1] || g[2];
    const m = l.match(RUNBOOK_LINE);
    if (!m || !/--change \[CHANGE_ID\]/.test(l)) return;
    const gates = namedGates(lines[i - 1]) || (current ? [current] : []);
    found.push({ line: i + 1, gates, kind: `${CLIENT_CONNECTOR[m[1]] || m[1]}:${m[2]}`, argv: [m[2], ...m[3].trim().split(/\s+/).filter(Boolean)] });
  });
  return found;
}
const gateReadBacks = (text, gate) => boundReadBacks(text).filter((b) => b.gates.includes(gate));
// a runbook line's pass flags: name to the value it writes (null for a switch)
function lineFlags(kind, argv) {
  const rules = audit.PASS_FLAGS[kind];
  const flags = new Map();
  for (let i = 1; i < argv.length; i += 1) {
    const name = argv[i].startsWith('--') ? argv[i].slice(2) : null;
    if (name && hasOwn(rules, name)) flags.set(name, rules[name] === audit.SWITCH ? null : argv[i + 1]);
  }
  return flags;
}
// whether a named read-back runs as a line does: the same pass flags, a placeholder value ([N])
// standing for any value its rule takes
function sameForm(parsed, line) {
  const want = lineFlags(parsed.kind, line.argv);
  // the named flags as parseReadBack read them (code review round 1 of the batch G3 close-out 3,
  // finding 11: they were split from the joined form again here)
  const named = parsed.values;
  if (named.size !== want.size) return false;
  for (const [name, value] of want) {
    if (!named.has(name)) return false;
    if (value !== null && !/^\[[^\]]+\]$/.test(value) && named.get(name) !== value) return false;
  }
  return true;
}
// a runbook line's read-back as open names it: the kind, then its pass flags sorted by name
const lineForm = (l) => (hasOwn(audit.PASS_FLAGS, l.kind)
  ? [l.kind, ...[...lineFlags(l.kind, l.argv)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([n, v]) => (v === null ? `--${n}` : `--${n} ${v}`))].join(' ')
  : l.kind);
// text: the runbook as checkGate read it, so open reads it once (code review round 1 of the batch
// G3 close-out 3, finding 15)
function checkGateReadBack(command, gate, parsed, text) {
  const bound = gateReadBacks(text, gate);
  // a gate whose runbook binds no read-back takes no change record: its proof is the read its
  // runbook names (code review round 1 of the batch G3 close-out 3, finding 5)
  if (!bound.length) throw new InputError(`gate ${gate} in .claude/commands/${command}.md binds no read-back: a change record is opened only for a gate whose runbook names its read-back with --change [CHANGE_ID]; this gate's proof is the read its runbook names`);
  const lines = bound.filter((l) => l.kind === parsed.kind);
  if (lines.length && (!hasOwn(audit.PASS_FLAGS, parsed.kind) || lines.some((l) => sameForm(parsed, l)))) return;
  const forms = [...new Set(bound.map(lineForm))];
  throw new InputError(`gate ${gate}'s read-back in .claude/commands/${command}.md runs as ${forms.join(' or ')}, not as ${parsed.readBack}; name the read-back its line runs, with the flags on it that change what its pass means`);
}

// A gate must be one the named runbook has (code review round 1 of the batch G3 close-out 2,
// finding 6), so a mistyped counted gate is refused instead of falling back to the
// one-read-back rule. The command must name a runbook that exists (round 2, finding 2), so a
// misspelled --command cannot skip the check; its shape is the trail's own (audit-log.js
// COMMAND), so it cannot leave .claude/commands/.
function checkGate(command, gate) {
  if (!audit.COMMAND.test(command)) throw new InputError('--command is a runbook name, such as fleet-device-actions');
  const file = path.join(RUNBOOKS, `${command}.md`);
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { throw new InputError(`no runbook .claude/commands/${command}.md`); }
  if (!text.includes(`<!-- SAFETY GATE [${gate}] -->`) && !text.split('\n').includes(`# SAFETY GATE [${gate}]`)) {
    throw new InputError(`.claude/commands/${command}.md has no gate ${gate}`);
  }
  return text;
}

// A counted gate's saved procedure carries its count on one line, Count: N, and open refuses an
// --expected that differs from it (batch G3 close-out 3, owner decision H2). The count is then
// part of the text the approver reviews and whose digest the approval names, so the approval
// covers N; folding N into the digest instead would cover a number the opener typed and no one
// read, and would change what the digest of the reviewed text means.
const COUNT_LINE = /^Count: ([1-9][0-9]{0,4})$/;
// A count line is any line where the word count meets a colon, after Unicode compatibility
// folding (a full-width colon is a colon) and with invisible characters removed, whatever wraps it
// (a bullet, a link, HTML, emphasis, a table cell), in any case; the saved text must hold exactly
// one, and it must be exactly Count: N. A script comment that says count: is refused too, the
// fail-safe side (code review round 1 of the batch G3 close-out 3, finding 12; round 2, finding 5;
// round 3, finding 4: a list of shapes to strip always missed one).
const COUNT_ANY = /(?<![a-z0-9])count(?![a-z0-9])[^a-z0-9\n]{0,8}:/i;
const visible = (l) => l.normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
function checkCount(text, expected) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).filter((l) => COUNT_ANY.test(visible(l)));
  if (lines.length !== 1 || !COUNT_LINE.test(lines[0])) {
    throw new InputError('the saved procedure of a counted gate carries one line Count: N, the number in the ticket, so the approval covers it');
  }
  const written = Number(lines[0].match(COUNT_LINE)[1]);
  if (written !== expected) throw new InputError(`--expected ${expected} is not the Count: ${written} the procedure carries; the approval covers the procedure's count, so open the change with that number`);
}

class InputError extends Error {}
class NotDone extends Error {}

// The digest of an issued procedure: CR LF to LF, trailing spaces and tabs removed from
// each line, trailing newlines removed, so a copy saved by another editor still matches.
function procedureDigest(text) {
  const normal = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');
  return crypto.createHash('sha256').update(normal, 'utf8').digest('hex');
}

function readProcedure(file) {
  if (typeof file !== 'string' || !file) throw new InputError('--procedure-file needs the saved procedure text');
  const base = path.basename(file).toLowerCase();
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) throw new InputError('a .env file is never opened');
  let stat;
  try { stat = fs.statSync(file); } catch { throw new InputError('--procedure-file could not be read'); }
  if (!stat.isFile()) throw new InputError('--procedure-file is not a regular file');
  if (stat.size > MAX_PROCEDURE_BYTES) throw new InputError('--procedure-file is larger than 1 MB');
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) throw new InputError('--procedure-file is empty');
  return text;
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!/^--[a-z][a-z0-9-]*$/.test(token)) throw new InputError(`unexpected argument ${JSON.stringify(token).slice(0, 40)}`);
    const name = token.slice(2);
    if (name in flags) throw new InputError(`--${name} may appear once`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new InputError(`--${name} needs a value`);
    flags[name] = argv[i + 1];
    i += 1;
  }
  return flags;
}

function need(flags, names, optional = []) {
  for (const key of Object.keys(flags)) if (!names.includes(key) && !optional.includes(key)) throw new InputError(`unknown flag --${key.slice(0, 40)}`);
  for (const name of names) if (flags[name] === undefined) throw new InputError(`--${name} is required`);
}

// Everything the trail says about one change, read from an intact chain only.
// entries: the trail already read by the caller, so a command reads it once (plus verify)
function changeView(log, change, entries = null) {
  const check = log.verify();
  const view = { change, done: false, chain: check.ok ? 'intact' : 'broken', procedure: null, approval: null, readBack: null, stale: null, missing: [] };
  if (!check.ok) {
    view.missing.push(`the audit trail is broken at line ${check.firstBroken.line} (${check.firstBroken.reason}); run node scripts/audit/audit-log.js verify`);
    return view;
  }
  const all = entries || log.entries();
  // below, all is the trail
  const bySeq = new Map(all.map((e) => [e.seq, e]));
  const procedure = all.find((e) => e.kind === 'procedure' && e.change === change);
  if (!procedure) {
    view.missing.push('no procedure was issued under this change id');
    return view;
  }
  view.procedure = { seq: procedure.seq, command: procedure.command, gate: procedure.gate, r_class: procedure.r_class, target: procedure.target, read_back: procedure.read_back, procedure_sha256: procedure.procedure_sha256 };
  view.stale = staleReadBack(change, procedure);
  if (view.stale) view.missing.push(view.stale);
  const approvals = all.filter((e) => e.kind === 'approval' && e.change === change && e.seq > procedure.seq);
  const approval = approvals.find((e) => e.procedure_sha256 === procedure.procedure_sha256);
  if (approval) view.approval = { seq: approval.seq, ref: approval.ref, matches: true };
  else if (approvals.length) {
    view.approval = { seq: approvals[0].seq, ref: approvals[0].ref, matches: false };
    view.missing.push('the approved digest does not match the procedure Aegis issued, so the approval does not cover it');
  } else view.missing.push('no approval reference was recorded for this change');
  // a counted batch change counts bound read-backs and needs no link (batch G3 close-out 2)
  if (Number.isInteger(procedure.expected)) return countedView(view, all, change, procedure, approval);
  // one verify-* result proves one change: the first link of a read-back owns it
  const owner = new Map();
  for (const e of all) if (e.kind === 'change-link' && !owner.has(e.verify_seq)) owner.set(e.verify_seq, e.change);
  const links = all.filter((e) => e.kind === 'change-link' && e.change === change);
  const taken = links.filter((l) => owner.get(l.verify_seq) !== change);
  const linked = links.filter((l) => owner.get(l.verify_seq) === change).map((l) => bySeq.get(l.verify_seq)).filter((e) => e && e.kind === 'verify');
  // only a read-back recorded under this change counts (batch G3 close-out), so one linked
  // around the CLI, unbound or bound to another change, never makes the change done
  // the same read-back run with the same pass flags (batch G3 close-out 3, owner decision H1)
  const ofKind = linked.filter((e) => readBackOf(e) === procedure.read_back);
  const readBacks = ofKind.filter((e) => e.change === change);
  const proving = readBacks.find((e) => e.verified === true && approval && e.seq > approval.seq);
  if (proving) view.readBack = { seq: proving.seq, connector: proving.connector, command: proving.command, verified: true };
  else if (!readBacks.length && !linked.length && taken.length) view.missing.push(`the linked read-back already proves ${owner.get(taken[0].verify_seq)}; one read-back proves one change`);
  else if (!readBacks.length && ofKind.length) view.missing.push(`the linked read-back was not run with --change ${change}, so it is not bound to this change`);
  else if (!readBacks.length && linked.length) view.missing.push(`the linked read-back is not the one this change names (${procedure.read_back})`);
  else if (!readBacks.length) view.missing.push(`no ${procedure.read_back} read-back is linked to this change`);
  else if (!readBacks.some((e) => e.verified === true)) view.missing.push('the linked read-back did not verify the change');
  else if (approval) view.missing.push('the linked read-back ran before the approval, so it does not prove the approved change');
  // with no matching approval, the missing approval above is the reason; no read-back reason
  view.done = view.missing.length === 0;
  return view;
}

// A counted batch change (batch G3 close-out 2, owner decision 2): N objects, each proved by its
// own read-back. Only bound read-backs of the named kind recorded after the approval count (a
// bound read-back carries this change id, so it needs no link).
// - A read-back that records a run id (audit-log.js RUN_IDS, a job id): each run counts once, a
//   run that failed and later passed counts as passed, and a run that only failed keeps the
//   change not done. A pass with no run id cannot be told apart from a re-read, and a read that
//   got no answer (a state other than OK) proves nothing about any object: both are listed as
//   uncounted and neither counts nor blocks (code review round 1 of the batch G3 close-out 2,
//   findings 1 and 2). A failure that got an answer but no run id is a failed object and blocks
//   (round 2, finding 4). Done only when exactly N runs passed and nothing failed.
// - A read-back that records none: each bound read-back that passed counts once and a repeated
//   read of the same object is not detected. A failed read that got an answer cannot be matched
//   to a later pass of the same object, so it keeps the change not done (code review round 2,
//   finding 1: letting it pass made a batch with a known failed object read done); a read that
//   got no answer is uncounted, as with run ids (round 3, finding 1). Done when exactly N passed
//   and none failed; more than N reads partial, as with run ids (round 2, finding 5).
function countedView(view, all, change, procedure, approval) {
  const expected = procedure.expected;
  const kind = kindOfReadBack(procedure.read_back);
  const runKind = audit.recordsRunId(kind);
  const ofKind = approval
    ? all.filter((e) => e.kind === 'verify' && e.change === change && kindOf(e) === kind && e.seq > approval.seq)
    : [];
  // only a read run with the pass flags this change names counts (batch G3 close-out 3, owner
  // decision H1); one with other flags is listed as uncounted, so a presence read never counts
  // toward a removal
  const bound = ofKind.filter((e) => readBackOf(e) === procedure.read_back);
  const brief = (e) => ({ seq: e.seq, run: typeof e.run === 'string' ? e.run : null, state: e.state });
  let passed;
  let failed;
  const uncounted = ofKind.filter((e) => readBackOf(e) !== procedure.read_back).map((e) => ({ ...brief(e),
    reason: `it ran as ${readBackOf(e) || `${kind} with its pass flags not recorded`}; this change is proved by ${procedure.read_back}, so a read with other flags does not count` }));
  const answeredFailures = [];
  // a read that got no answer (a state other than OK: a timeout, a rate limit, a 404 from a
  // mistyped id) proves nothing about any object, whatever the kind, so it neither counts nor
  // blocks (code review round 3 of the batch G3 close-out 2, finding 1)
  const answered = [];
  for (const e of bound) {
    if (e.verified !== true && e.state !== 'OK') uncounted.push({ ...brief(e), reason: 'the read got no answer, so it proves nothing about any object' });
    else answered.push(e);
  }
  if (runKind) {
    const runs = new Map();
    for (const e of answered) {
      if (typeof e.run !== 'string') {
        // an answered failure with no run id is a failed object, not a read with no answer
        // (code review round 2, finding 4)
        if (e.verified !== true) { answeredFailures.push(e); continue; }
        uncounted.push({ ...brief(e), reason: 'the answer named no run id, so this pass cannot be told apart from a re-read' });
        continue;
      }
      const r = runs.get(e.run) || { passed: false, failed: [] };
      if (e.verified === true) r.passed = true; else r.failed.push(e);
      runs.set(e.run, r);
    }
    passed = [...runs.values()].filter((r) => r.passed).length;
    failed = [...[...runs.values()].filter((r) => !r.passed).flatMap((r) => r.failed), ...answeredFailures];
  } else {
    passed = answered.filter((e) => e.verified === true).length;
    failed = answered.filter((e) => e.verified !== true);
  }
  uncounted.sort((a, b) => a.seq - b.seq);
  failed.sort((a, b) => a.seq - b.seq);
  view.expected = expected;
  view.verified = passed;
  view.summary = `verified ${passed} of ${expected}`;
  view.failed = failed.map(brief);
  view.uncounted = uncounted;
  if (!runKind) view.note = `${procedure.read_back} records no run id, so each bound read-back that passed counts once, a repeated read of the same object is not detected, and a failed read that got an answer keeps the change not done, since it cannot be matched to a later pass of the same object; a read that got no answer is uncounted`;
  if (approval) {
    // a failure with no run id cannot be matched to a later pass, so it names the way forward
    // (code review round 3 of the batch G3 close-out 2, finding 2)
    for (const f of view.failed) view.missing.push(runKind && f.run
      ? `the read-back at audit seq ${f.seq} (run ${f.run}) did not verify (${f.state}) and that run never passed; that object is not proven`
      : runKind
        ? `the read-back at audit seq ${f.seq} got an answer that did not verify (${f.state}) and recorded no run id, so it cannot be matched to a later pass of the same host; open a new change for the hosts left`
        : `the read-back at audit seq ${f.seq} did not verify (${f.state}); with no run id it cannot be matched to a later pass of the same object, so open a new change for the objects left`);
    if (passed < expected) view.missing.push(`verified ${passed} of ${expected}: ${expected - passed} more bound ${procedure.read_back} read-back(s) must pass`);
    if (passed > expected) view.missing.push(`verified ${passed} of ${expected}: more than the ${expected} the ticket names; check the batch against the ticket`);
  }
  view.done = view.missing.length === 0;
  view.result = view.done ? 'done' : 'partial';
  return view;
}

// Why a read-back may not be run under this change id, or null when it may (batch G3
// close-out, owner decision 1): the trail is intact and holds the change record open wrote for
// this id, its read-back is exactly readBack (connector:verify-command), and an approval of
// its procedure was recorded after it. The verify-* CLIs call this before any read.
// open checks a change's read-back against its gate's runbook and marks the entry
// (gate_checked). An entry without the mark (written before the batch G3 close-out 3, when a
// removal could be named bare and a gate could name any read-back, or written around the CLI) gets
// that whole check now, failing closed; a marked entry is never re-judged, so a change stays valid
// when its runbook is edited later (code review round 1 of that batch, finding 2; round 2, finding
// 2; round 3, findings 1 and 2).
function staleReadBack(change, procedure) {
  if (procedure.gate_checked === true) return null;
  try {
    const runbook = checkGate(procedure.command, procedure.gate);
    checkGateReadBack(procedure.command, procedure.gate, audit.parseReadBack(procedure.read_back), runbook);
    return null;
  } catch (error) {
    const why = error instanceof InputError || error instanceof audit.AuditRefused ? error.message : 'its runbook could not be read';
    return `change ${change} was not opened by change-record.js open as it now checks (an entry from before the batch G3 close-out 3, or one written around the CLI), and its read-back ${procedure.read_back} fails that check: ${why}; nothing proves it, so open a new change`;
  }
}
function bindRefusal(log, change, readBack) {
  const view = changeView(log, change);
  if (view.chain !== 'intact') return view.missing[0];
  if (!view.procedure) return `the audit trail holds no change ${change}; open it with node scripts/audit/change-record.js open before the change`;
  if (view.stale) return view.stale;
  if (view.procedure.read_back !== readBack) return `change ${change} is proved by ${view.procedure.read_back}, not by ${readBack}`;
  if (!view.approval || !view.approval.matches) return `change ${change} has no approval of its procedure yet; record it with node scripts/audit/change-record.js approve first`;
  return null;
}

function main(argv = process.argv.slice(2), env = process.env, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));
  const [command, ...rest] = argv;
  const log = audit.openAuditLog({ dir: audit.defaultAuditDir(env) });
  try {
    const flags = parseFlags(rest);
    if (command === 'open') {
      need(flags, ['command', 'gate', 'r-class', 'target', 'read-back', 'procedure-file'], ['expected']);
      if (flags['r-class'] !== 'R2' && flags['r-class'] !== 'R3') throw new InputError('a change record is for an R2 or R3 procedure; R0 and R1 need none');
      // the gate first, so a misspelled counted gate is told it is missing, not that it takes
      // no count (code review round 2 of the batch G3 close-out 2, finding 3)
      const runbook = checkGate(flags.command, flags.gate);
      const count = Object.prototype.hasOwnProperty.call(COUNTED_GATES, flags.gate) ? COUNTED_GATES[flags.gate] : null;
      if (flags.expected !== undefined && !EXPECTED.test(flags.expected)) throw new InputError('--expected is the number of objects written in the ticket, a whole number from 1 to 99999');
      if (count && flags.expected === undefined) throw new InputError(`gate ${flags.gate} names a count (${count}): open it with --expected N, the number written in the ticket`);
      if (!count && flags.expected !== undefined) throw new InputError(`gate ${flags.gate} names no count; a change without a count is proved by one read-back, so --expected is not taken`);
      const expected = count ? Number(flags.expected) : null;
      const named = checkReadBack(flags['read-back']);
      checkGateReadBack(flags.command, flags.gate, named, runbook);
      const text = readProcedure(flags['procedure-file']);
      if (count) checkCount(text, expected);
      const digest = procedureDigest(text);
      const change = `chg-${crypto.createHash('sha256').update(`${flags.gate}\n${digest}\n${Date.now()}\n${crypto.randomBytes(8).toString('hex')}`).digest('hex').slice(0, 12)}`;
      const r = log.append({ kind: 'procedure', command: flags.command, gate: flags.gate, r_class: flags['r-class'], target: flags.target, read_back: named.readBack, procedure_sha256: digest, change, expected, gate_checked: true });
      out(`${JSON.stringify({ ok: true, change, procedure_sha256: digest, audit_seq: r.seq, next: [
        'A person approves this exact procedure in the ticket; record the reference with: approve --change <id> --ref <ISSUE-KEY> --procedure-sha256 <digest>',
        'A person runs the procedure (Aegis does not)',
        // with no run id a re-read is not detected, so the step says so and never "distinct"
        // (code review round 2 of the batch G3 close-out 2, finding 9)
        expected && audit.recordsRunId(named.kind)
          ? `Run the ${named.readBack} read-back with --change ${change} once for each of the ${expected} objects (it refuses to read until this change is approved); status --change ${change} reports "verified k of ${expected}" and is done only when ${expected} distinct runs passed after the approval and none still failed`
          : expected
            ? `Run the ${named.readBack} read-back with --change ${change} (it refuses to read until this change is approved) and read each of the ${expected} objects once: a re-read of the same object is not detected. status --change ${change} reports "verified k of ${expected}" and is done only when exactly ${expected} read-backs passed after the approval and none failed`
            : `Run the ${named.readBack} read-back with --change ${change} (it refuses to read until this change is approved), then: link --change ${change} --verify-seq <the audit_seq it prints, or N from Jira's "Recorded as audit entry N" line>; status --change ${change} reports done only when all three match`,
      ] }, null, 2)}\n`);
      return 0;
    }
    if (command === 'approve') {
      need(flags, ['change', 'ref', 'procedure-sha256']);
      const view = changeView(log, flags.change);
      if (view.chain !== 'intact') throw new NotDone(view.missing[0]);
      if (!view.procedure) throw new NotDone('no procedure was issued under this change id');
      // an approval for a change nothing can prove is never recorded (code review round 2, finding 9)
      if (view.stale) throw new NotDone(`${view.stale}. Nothing was recorded`);
      if (flags['procedure-sha256'] !== view.procedure.procedure_sha256) {
        throw new NotDone('the approved digest does not match the procedure Aegis issued; nothing was recorded. Approve the issued procedure, or open a new change for the new text');
      }
      const r = log.append({ kind: 'approval', ref: flags.ref, gate: view.procedure.gate, procedure_sha256: flags['procedure-sha256'], change: flags.change });
      out(`${JSON.stringify({ ok: true, change: flags.change, ref: flags.ref, audit_seq: r.seq, note: 'The approval authorizes a person\'s procedure. Aegis makes no change: a person runs it, then the verify-* read-back proves it.' }, null, 2)}\n`);
      return 0;
    }
    if (command === 'link') {
      need(flags, ['change', 'verify-seq']);
      if (!/^[1-9][0-9]{0,15}$/.test(flags['verify-seq'])) throw new InputError('--verify-seq is the audit seq of a verify-* result');
      const seq = Number(flags['verify-seq']);
      const all = log.entries();
      const view = changeView(log, flags.change, all);
      if (view.chain !== 'intact') throw new NotDone(view.missing[0]);
      if (!view.procedure) throw new NotDone('no procedure was issued under this change id');
      if (view.stale) throw new NotDone(`${view.stale}. Nothing was recorded`);
      const target = all.find((e) => e.seq === seq);
      if (!target || target.kind !== 'verify') throw new NotDone('only a verify-* result can be linked; that audit seq is not one');
      // the same read-back with the same pass flags (batch G3 close-out 3, owner decision H1)
      if (readBackOf(target) !== view.procedure.read_back) throw new NotDone(`that read-back is ${readBackOf(target) || `${kindOf(target)} with its pass flags not recorded`}; this change is proved only by ${view.procedure.read_back}. Nothing was recorded`);
      // one read-back proves one change, so only one that can prove this change is linked
      if (!view.approval || !view.approval.matches) throw new NotDone('this change has no approval of its procedure yet; record the approval first. Nothing was recorded');
      if (target.seq < view.approval.seq) throw new NotDone('that read-back ran before the approval, so it cannot prove the approved change. Nothing was recorded');
      if (target.verified !== true) throw new NotDone('that read-back did not verify the change. Nothing was recorded');
      // batch G3 close-out (owner decision 1): only a read-back run with --change <this id>
      if (target.change === null) throw new NotDone(`that read-back was run without --change, so it is not bound to any change; run it again with --change ${flags.change}. Nothing was recorded`);
      if (target.change !== flags.change) throw new NotDone(`that read-back was recorded for ${target.change}. Nothing was recorded`);
      // checked under the write lock, so two links of one read-back cannot both succeed
      const r = log.append({ kind: 'change-link', change: flags.change, verify_seq: seq }, { guard: (all) => {
        const earlier = all.find((e) => e.kind === 'change-link' && e.verify_seq === seq);
        if (earlier && earlier.change !== flags.change) throw new NotDone(`that read-back already proves ${earlier.change}; one read-back proves one change. Nothing was recorded`);
      } });
      out(`${JSON.stringify({ ok: true, change: flags.change, verify_seq: seq, audit_seq: r.seq }, null, 2)}\n`);
      return 0;
    }
    if (command === 'status') {
      need(flags, ['change']);
      const view = changeView(log, flags.change);
      out(`${JSON.stringify(view, null, 2)}\n`);
      return view.done ? 0 : 2;
    }
    throw new InputError('usage: change-record.js open | approve | link | status (see the header of this file)');
  } catch (error) {
    if (error instanceof InputError || error instanceof audit.AuditRefused) { err(`change-record: ${error.message}\n`); return 1; }
    if (error instanceof NotDone || error instanceof audit.AuditBroken) { err(`change-record: ${error.message}\n`); return 2; }
    err('change-record: the audit trail could not be read or written (details withheld)\n');
    return 2;
  }
}

module.exports = { procedureDigest, changeView, bindRefusal, hasCommandKey, boundReadBacks, namedGates, useRunbooksForTests, main, COUNTED_GATES };

if (require.main === module) process.exitCode = main();
