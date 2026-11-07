#!/usr/bin/env node
'use strict';
// ladder-audit.js: lightest fix first, as a lint over every runbook in .claude/commands (batch 9, task 8b).
//
//   node scripts/lint/ladder-audit.js           writes docs/aegis/ladder-audit.md (every runbook, pass or fail)
//   node scripts/lint/ladder-audit.js --check   exit 0 when that file equals a fresh run and no section in
//                                               the fixed scope (SCOPE) fails; exit 1 otherwise
//
// A section runs from a heading outside a code fence to the next one. It is audited when it holds a heavy
// gate: a SAFETY GATE whose R class is R3, or whose id or Effect line resets, wipes, erases, deletes or
// re-registers. It passes when a lighter step comes before its first heavy gate in the same section:
//   - a SAFETY GATE of R0 to R2 that is not heavy;
//   - a PREVIEW ONLY marker whose id is not heavy (a lighter admin action the runbook cannot yet authorize);
//   - a line written as a step for this ladder, opening with "**User check:**", "**Lighter step:**" or
//     "**Try first:**" (after a list marker, if any);
// or when the section holds a line "No lighter step: <reason>". A numbered line that only navigates to the
// heavy action is not a lighter step, so the ladder is explicit. Reads local files only.

const fs = require('node:fs');
const path = require('node:path');

const { gateFields } = require('../audit/change-record.js');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOKS = path.join(ROOT, '.claude', 'commands');
const AUDIT_FILE = path.join(ROOT, 'docs', 'aegis', 'ladder-audit.md');

const HEAVY = /\b(?:reset(?:s|ting)?|wip(?:e|es|ed|ing)|eras(?:e|es|ed|ing)|delet(?:e|es|ed|ing|ion)|re-?regist(?:er|ers|ered|ering|ration))\b/i;
const MARK = /^<!-- SAFETY GATE \[([^\]]+)\] -->$|^# SAFETY GATE \[([^\]]+)\]$/;
const PREVIEW = /PREVIEW ONLY \[([a-z0-9][a-z0-9-]*)\]/g;
const LIGHTER_LINE = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?\*\*(?:User check|Lighter step|Try first)\b[^*]*:\*\*\s*\S/i;
const NO_LIGHTER = /No lighter step:\s*\S/;
const FENCE = /^\s*```/;
const HEADING = /^#{1,6}\s+\S/;

// The identity, sign-in, MFA and device runbooks of Microsoft, Google, Okta, Jamf and Fleet whose failing
// sections this batch fixes; a failing section anywhere else stays listed in the audit for a later batch.
const SCOPE = Object.freeze([
  'password-reset', 'mfa-issue', 'conditional-access', 'device-wipe', 'intune-compliance', 'ad-connect', 'offboard',
  'gws-password-reset', 'gws-2sv-reset', 'gws-2sv-enforcement', 'gws-account-containment', 'gws-chromeos-device', 'gws-offboard',
  'okta-mfa-reset', 'okta-user-lifecycle',
  'jamf-lock-erase', 'jamf-enroll-mac', 'jamf-filevault',
  'fleet-device-actions',
]);

const PREFIX_VENDOR = [['gws-', 'Google'], ['okta-', 'Okta'], ['jamf-', 'Jamf'], ['fleet-', 'Fleet'], ['github-', 'GitHub'], ['slack-', 'Slack'], ['linear-', 'Linear'], ['jira-', 'Jira'], ['mac-', 'Apple'], ['meraki-', 'Meraki'], ['unite-', 'Unite']];
// Microsoft and Google are separate rows, never one: a runbook with no vendor prefix is a Microsoft one
// (the default environment's platform), apart from the general ones that name no platform.
const GENERAL = new Set(['aegis', 'aegis-update', 'ai-engineer-drill', 'board-report', 'cloud-lab', 'daily-start', 'daily-wrap', 'devops-drill', 'draft-email', 'escalation-note', 'field', 'incident-report', 'lan-wan', 'printer-issue', 'ps-error-decode', 'ps-script', 'runbook', 'sip-trunk-status', 'ticket-response', 'troubleshoot', 'vendor-email', 'vent', 'vpn-check', 'wifi-issue', 'write-sop', 'zoom-room-issue']);
function vendorOf(name) {
  const hit = PREFIX_VENDOR.find(([p]) => name.startsWith(p));
  if (hit) return hit[1];
  return GENERAL.has(name) ? 'General' : 'Microsoft';
}

// One field of a gate's block (portal "- **Effect:** ..." or fenced "# Effect: ...").
function fieldOf(lines, from, name) {
  for (let j = from; j < lines.length; j += 1) {
    const m = /^(?:- \*\*([A-Za-z -]+):\*\* (.*)|# ([A-Z][A-Za-z -]+): (.*))$/.exec(lines[j]);
    if (!m) break;
    if ((m[1] || m[3]) === name) return m[2] || m[4];
  }
  return '';
}

// Every section of one runbook with its ladder events in order: { title, line, escape, events: [{ kind:
// 'heavy'|'lighter'|'other', id, line, admin }] }. admin is false for a user check or lighter step line (not
// an admin change). The desk's "lightest step first" check reads this too (scripts/demo/step-ladder.js).
// runbook: the runbook's name; its own words in a gate id ("jamf-lock-erase-lock-portal") say nothing about
// the gate, so they are taken out before the heavy words are matched.
const ownWords = (id, runbook) => (runbook && id.startsWith(`${runbook}-`) ? id.slice(runbook.length + 1) : id);
function sectionEvents(text, runbook = '') {
  const lines = String(text).split('\n');
  const rClass = new Map(gateFields(text).map((g) => [g.line, g.rClass]));
  const sections = [];
  let current = { title: '(top of file)', line: 1, events: [], escape: false };
  let parent = null;
  let fenced = false;
  lines.forEach((l, i) => {
    if (FENCE.test(l)) { fenced = !fenced; return; }
    const mark = MARK.exec(l.trim());
    if (!fenced && !mark && HEADING.test(l)) {
      if (parent) { sections.push(parent); parent = null; }
      sections.push(current);
      current = { title: l.replace(/^#+\s+/, '').trim(), line: i + 1, events: [], escape: false };
      return;
    }
    // a <details> block's summary starts its own section, and the section it interrupts resumes after
    // </details>: the reference twins sit in such blocks, and the heading above them may name another phase
    // (code review round 1 of batch 9, finding 9)
    const summary = fenced ? null : /^\s*<summary>(.*?)<\/summary>\s*$/.exec(l);
    if (summary) {
      if (parent) sections.push(current); else parent = current;
      // the twin keeps the lighter steps its section listed before the block: they come first for it too
      // (code review round 2 of batch 9, findings 1 and 7)
      current = { title: summary[1].replace(/<[^>]+>/g, '').trim(), line: i + 1, events: [], escape: false, reference: true, within: parent };
      return;
    }
    if (!fenced && parent && /^\s*<\/details>\s*$/.test(l)) { sections.push(current); current = parent; parent = null; return; }
    if (mark) {
      const id = mark[1] || mark[2];
      const r = rClass.get(i + 1) || null;
      const heavy = r === 'R3' || HEAVY.test(ownWords(id, runbook)) || HEAVY.test(fieldOf(lines, i + 1, 'Effect'));
      current.events.push({ kind: heavy ? 'heavy' : (['R0', 'R1', 'R2'].includes(r) ? 'lighter' : 'other'), id, line: i + 1, admin: true, gate: true, rClass: r });
      return;
    }
    for (const m of l.matchAll(PREVIEW)) current.events.push({ kind: HEAVY.test(ownWords(m[1], runbook)) ? 'other' : 'lighter', id: m[1], line: i + 1, admin: true });
    // a User check is the user's own step; Try first and Lighter step name a lighter admin action, often a gate in
    // another phase (code review round 1 of batch 9, finding 8)
    // a Try first or Lighter step line is an admin step an answer can name only when it names a gate ([id]) or a
    // phase (code review round 2 of batch 9, finding 11: "keep the account suspended" names nothing to advise)
    if (LIGHTER_LINE.test(l)) current.events.push({ kind: 'lighter', id: /\*\*User check\b/i.test(l) ? 'a user check line' : 'a lighter step line', line: i + 1, admin: !/\*\*User check\b/i.test(l) && /\[[a-z0-9]+(?:-[a-z0-9]+)+\]|\bPhase [A-Z0-9]/.test(l) });
    if (NO_LIGHTER.test(l)) current.escape = true;
  });
  if (parent) sections.push(parent);
  sections.push(current);
  // A scripted twin in a <details> block keeps the lighter steps its portal twin's section lists before the portal
  // gate. Twins are the ids a runbook pairs on one read-back line ("read-back of [a] or [b]") and, by name, [x] or
  // [x-api] with [x-portal]; a twin in the same block does not count. Each heavy gate gets its own list (inherit),
  // so the gates of a scale block do not share the first one's, and nothing after a gate counts for it. With no
  // portal twin, a block that is its phase's only gate keeps the phase's written reason, never its previews (code
  // review round 2 of batch 9, findings 1 and 7; round 3, findings 4, 9, 10 and 13; round 1, finding 9).
  const where = new Map();
  for (const sec of sections) sec.events.forEach((e, k) => { if (!where.has(e.id)) where.set(e.id, { sec, k }); });
  const paired = new Map();
  for (const l of lines) {
    if (!/read-back of \[/.test(l)) continue;
    const ids = [...l.matchAll(/\[([a-z0-9]+(?:-[a-z0-9]+)+)\]/g)].map((m) => m[1]);
    for (const id of ids) paired.set(id, [...new Set([...(paired.get(id) || []), ...ids.filter((x) => x !== id)])]);
  }
  for (const sec of sections.filter((x) => x.reference)) {
    for (const heavy of sec.events.filter((e) => e.kind === 'heavy')) {
      const names = [...(paired.get(heavy.id) || []), `${heavy.id}-portal`, `${heavy.id.replace(/-(?:api|script|cli|ps)$/, '')}-portal`];
      const twin = names.filter((id) => id.endsWith('-portal')).map((id) => where.get(id)).find((t) => t && t.sec !== sec);
      if (twin) {
        // (only a twin heavy by its words: an R3 gate stays heavy whatever its portal twin is)
        if (twin.sec.events[twin.k].kind !== 'heavy' && heavy.rClass !== 'R3') heavy.kind = twin.sec.events[twin.k].kind;
        heavy.inherit = twin.sec.events.slice(0, twin.k).filter((e) => e.kind === 'lighter');
        heavy.inheritedEscape = twin.sec.escape;
      } else if (sec.within && !sec.within.events.some((e) => e.gate)) {
        heavy.inherit = [];
        heavy.inheritedEscape = sec.within.escape;
      }
    }
  }
  return sections;
}

// The lighter steps that come before the event at index k: its section's own, then what its twin inherits.
const lighterBefore = (sec, k) => [...sec.events.slice(0, k).filter((e) => e.kind === 'lighter'), ...(sec.events[k].inherit || [])];

// Every audited section of one runbook: { runbook, vendor, section, line, heavy, verdict, reason }.
function auditText(text, runbook) {
  const rows = [];
  for (const s of sectionEvents(text, runbook)) {
    const first = s.events.findIndex((e) => e.kind === 'heavy');
    if (first < 0) continue;
    const heavy = s.events[first];
    const before = lighterBefore(s, first)[0];
    let verdict = 'fail';
    let reason = `${heavy.id} (line ${heavy.line}) has no lighter step before it in this section`;
    if (before) { verdict = 'pass'; reason = `${before.id} (line ${before.line}) comes first`; } else if (s.escape || heavy.inheritedEscape) { verdict = 'pass'; reason = 'the section says why no lighter step applies'; }
    rows.push({ runbook, vendor: vendorOf(runbook), section: s.title, line: s.line, heavy: heavy.id, verdict, reason });
  }
  return rows;
}

function auditAll(dir = RUNBOOKS) {
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => f.slice(0, -3));
  return { names, rows: names.flatMap((n) => auditText(fs.readFileSync(path.join(dir, `${n}.md`), 'utf8'), n)) };
}

// a runbook heading may hold a long dash; the audit writes it as a hyphen (the repository's rule for new files)
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\u2014/g, '-');
function report({ names, rows }) {
  const count = (pred) => rows.filter(pred).length;
  const inScope = (r) => SCOPE.includes(r.runbook);
  const vendors = [...new Set(names.map(vendorOf))].sort();
  const out = [
    '# Lightest fix first: the ladder audit of every runbook',
    '',
    'Generated by `node scripts/lint/ladder-audit.js` (batch 9, task 8b); `--check` fails when this file is stale or a section in the fixed scope fails. The rule is in `docs/aegis/answer-format.md`, section 2, and the code header says what counts as heavy and as lighter. Do not edit by hand.',
    '',
    `Runbooks checked: ${names.length}. Runbooks with a heavy gate: ${new Set(rows.map((r) => r.runbook)).size}. Sections audited: ${rows.length}; pass ${count((r) => r.verdict === 'pass')}, fail ${count((r) => r.verdict === 'fail')}.`,
    `In the fixed scope (the identity, sign-in, MFA and device runbooks of Microsoft, Google, Okta, Jamf and Fleet; ${SCOPE.length} runbooks): sections ${count(inScope)}; pass ${count((r) => inScope(r) && r.verdict === 'pass')}, fail ${count((r) => inScope(r) && r.verdict === 'fail')}. Failing sections outside it stay listed here for a later batch.`,
    '',
    '## By vendor',
    '',
    '| Vendor | Runbooks | Sections audited | Pass | Fail |',
    '|---|---|---|---|---|',
    ...vendors.map((v) => `| ${v} | ${names.filter((n) => vendorOf(n) === v).length} | ${count((r) => r.vendor === v)} | ${count((r) => r.vendor === v && r.verdict === 'pass')} | ${count((r) => r.vendor === v && r.verdict === 'fail')} |`),
    '',
    '## Every audited section',
    '',
    '| Vendor | Runbook | In scope | Section (line) | First heavy gate | Verdict | Reason |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.vendor} | ${r.runbook} | ${inScope(r) ? 'yes' : 'no'} | ${cell(r.section)} (${r.line}) | ${r.heavy} | ${r.verdict} | ${cell(r.reason)} |`),
    '',
    '## Runbooks with no heavy gate',
    '',
    names.filter((n) => !rows.some((r) => r.runbook === n)).join(', '),
    '',
  ];
  return out.join('\n');
}

function main(argv = process.argv.slice(2), io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }) {
  const result = auditAll();
  const text = report(result);
  if (argv[0] === '--check') {
    const saved = fs.existsSync(AUDIT_FILE) ? fs.readFileSync(AUDIT_FILE, 'utf8') : '';
    const failing = result.rows.filter((r) => SCOPE.includes(r.runbook) && r.verdict === 'fail');
    if (saved !== text) { io.err('ladder-audit: docs/aegis/ladder-audit.md is stale; run node scripts/lint/ladder-audit.js\n'); return 1; }
    if (failing.length) { io.err(`ladder-audit: ${failing.length} section(s) in the fixed scope fail:\n${failing.map((r) => `  ${r.runbook}: ${r.section}: ${r.reason}`).join('\n')}\n`); return 1; }
    io.out(`ladder-audit: ${result.rows.length} sections audited, the fixed scope passes\n`);
    return 0;
  }
  if (argv.length) { io.err('usage: node scripts/lint/ladder-audit.js [--check]\n'); return 1; }
  fs.writeFileSync(AUDIT_FILE, text);
  io.out(`ladder-audit: wrote docs/aegis/ladder-audit.md (${result.rows.length} sections audited)\n`);
  return 0;
}

module.exports = { sectionEvents, lighterBefore, auditText, auditAll, report, vendorOf, SCOPE, HEAVY, main };

if (require.main === module) process.exitCode = main();
