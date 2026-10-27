'use strict';
// slack-runbooks.test.js: structural checks on the six Slack runbooks (lane G2) that the
// shared safety-gate test (scripts/command-safety-gates.test.js) does not make. That test
// proves every portal gate has its six fields, an exact phrase that binds the target and
// an Effect whose verbs the phrase carries. This file adds the Slack-specific rules a
// fresh-context review found missing:
//
// 1. A PORTAL ACTION changes only what its gate names. No step and no "Before:" line
//    leaves a second setting to the operator's judgement ("decide whether ..."); a second
//    change gets its own gate.
// 2. The R-class follows the R0-R3 table in CLAUDE.md and SR-2: a change whose Scope
//    reaches the whole workspace, every member or every channel is R3; a re-add of
//    recorded members carries the member count in its phrase and is R2 for 2 to 10 and
//    R3 above 10; the public-channel export is R3 after the independent review (the T3
//    floor for "export messages" in docs/aegis/lanes/g2.md). The "N changes, N gates"
//    header, the phase headings and the fast path agree with the gates.
// 3. Each runbook names the token variable and every scope of the adapter commands it
//    runs (SCOPES in slack-client.js), and never asks for the admin scope in SLACK_TOKEN.
// 4. A phrase names its direction: an account-type change names its destination type,
//    one gate per destination, and no two gates share a phrase. Phase F of the user
//    lifecycle stops on an Owner or Admin: removing that role is a separate change.
// 5. A verify-* read-back proves the person the GUI step acted on: Phase A records the
//    member ID shown on the GUI record found by [USER@DOMAIN.COM], and every phase whose
//    GUI step acts on that email and whose proof is a verify-* user read stops when the
//    member ID is not [USER_ID] or the Phase A read already shows the end state.
// 6. Every rollback a Reversibility field points to exists: a pointer ("under its own
//    gate", "through Phase C", "a separately reviewed change" ...) names the gate's
//    PORTAL ACTION id or a PREVIEW ONLY id in brackets, and every such id resolves to a
//    marker in one of the six runbooks.
// 7. Read-backs check what they claim: incident comms stops on a channel pending a share
//    with another organization and says which --not-before formats verify-posted takes;
//    a declined Slack Connect invitation leaves is_ext_shared as Phase A read it; a
//    deleted channel's failed read counts only when Phase A read it with the same token.
//
// Reads the Markdown and the adapter's SCOPES table only: no credential, no network,
// no Slack call.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const slack = require('./slack-client.js');

const ROOT = path.resolve(__dirname, '..', '..');
const NAMES = Object.freeze([
  'slack-user-lifecycle', 'slack-security-settings', 'slack-incident-comms',
  'slack-guests-connect', 'slack-app-approval', 'slack-retention-export',
]);

function load(name) {
  const text = fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8').replace(/\r\n/g, '\n');
  return { name, text, lines: text.split('\n') };
}

const DOCS = new Map(NAMES.map((name) => [name, load(name)]));

// The heading of the section a line sits in ("## Phase D: ...").
function sectionAt(doc, index) {
  for (let i = index; i >= 0; i -= 1) if (/^## /.test(doc.lines[i])) return doc.lines[i];
  return '';
}

function sectionLines(doc, heading) {
  const start = doc.lines.indexOf(heading);
  if (start < 0) return [];
  let end = start + 1;
  while (end < doc.lines.length && !/^## /.test(doc.lines[end])) end += 1;
  return doc.lines.slice(start, end);
}

// A gate runs from its SAFETY GATE marker to the next marker, PREVIEW ONLY marker,
// "Role needed" line or heading. Its steps are the numbered lines after its PORTAL
// ACTION label, up to the first fence or verification checkpoint.
function parseGates(doc) {
  const gates = [];
  doc.lines.forEach((line, index) => {
    const marker = line.match(/^<!-- SAFETY GATE \[([a-z0-9-]+)\] -->$/);
    if (!marker) return;
    const id = marker[1];
    let end = index + 1;
    while (end < doc.lines.length && !/^(?:<!-- SAFETY GATE |> \*\*PREVIEW ONLY |\*\*Role needed:\*\*|#{1,6} )/.test(doc.lines[end])) end += 1;
    const region = doc.lines.slice(index, end);
    const field = (name) => {
      const found = region.find((l) => l.startsWith(`- **${name}:** `));
      return found ? found.slice(`- **${name}:** `.length) : '';
    };
    const phrase = (field('Required confirmation').match(/type exactly `([^`]+)`/i) || [])[1] || '';
    const steps = [];
    const action = region.findIndex((l) => l.startsWith(`**PORTAL ACTION [${id}]:**`));
    if (action >= 0) {
      for (let k = action + 1; k < region.length; k += 1) {
        if (/^```|^\*\*Verification checkpoint:\*\*/.test(region[k])) break;
        if (/^\d+\. /.test(region[k])) steps.push(region[k]);
      }
    }
    gates.push({
      id, line: index + 1, section: sectionAt(doc, index), region: region.join('\n'), steps, phrase,
      target: field('Target'), effect: field('Effect'), scope: field('Scope'), reversibility: field('Reversibility'),
    });
  });
  return gates;
}

const GATES = new Map(NAMES.map((name) => [name, parseGates(DOCS.get(name))]));

test('the parser finds every gate in the six Slack runbooks, each with its fields and a PORTAL ACTION step', () => {
  for (const [name, gates] of GATES) {
    const markers = (DOCS.get(name).text.match(/^<!-- SAFETY GATE \[/gm) || []).length;
    assert.ok(markers > 0, name);
    assert.equal(gates.length, markers, name);
    for (const gate of gates) {
      for (const key of ['target', 'effect', 'scope', 'reversibility', 'phrase']) assert.ok(gate[key], `${gate.id}: no ${key}`);
      assert.ok(gate.steps.length > 0, `${gate.id}: no PORTAL ACTION step`);
    }
  }
});

// ── 1. A PORTAL ACTION changes only what its gate names ─────────────────────────────
test('no PORTAL ACTION step and no Before line of a gated phase leaves a second setting to the operator', () => {
  const failures = [];
  for (const [name, gates] of GATES) {
    const doc = DOCS.get(name);
    for (const gate of gates) {
      const before = sectionLines(doc, gate.section).filter((l) => l.startsWith('**Before:**'));
      for (const line of [...gate.steps, ...before]) {
        if (/\bdecide\b/i.test(line)) failures.push(`${name} ${gate.id}: a decision inside the action: ${line}`);
        if (/\bSMS\b/.test(line) && /\bblock/i.test(line) && !/\bSMS\b/.test(gate.effect)) failures.push(`${name} ${gate.id}: changes SMS without naming it: ${line}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('slack-app-approval: the require gate leaves the request policy and the request managers as recorded; granting request management has its own R2 gate and its R1 removal', () => {
  const gates = GATES.get('slack-app-approval');
  const require = gates.find((g) => /\bREQUIRE APPROVED APPS\b/.test(g.phrase));
  assert.ok(require, 'the require gate exists');
  assert.ok(require.steps.some((s) => /request policy|who manages requests|request managers/i.test(s) && /\b(?:recorded|changes neither)\b/i.test(s)), 'the require gate keeps the request policy and managers as Phase A recorded them');
  for (const step of require.steps) assert.doesNotMatch(step, /\b(?:grant|delegate|add)\b/i, `the require gate grants nothing: ${step}`);

  const grant = gates.find((g) => /\bAPP REQUEST MANAGEMENT\b/.test(g.phrase) && /\bGRANT\b/.test(g.phrase));
  assert.ok(grant, 'a gate of its own grants app request management');
  assert.match(grant.target, /\[USER_ID\]/);
  assert.ok(grant.phrase.includes('[USER_ID]'));
  assert.match(grant.reversibility, /^R2\b/);
  const remove = gates.find((g) => /\bAPP REQUEST MANAGERS\b/.test(g.phrase) && /\bREMOVE\b/.test(g.phrase));
  assert.ok(remove, 'taking request management back has its own gate');
  assert.ok(remove.phrase.includes('[USER_ID]'));
  assert.match(remove.reversibility, /^R1\b/);
});

test('slack-security-settings: blocking SMS is its own R3 gate with the Phase A value as rollback, and the two-factor requirement leaves the methods as recorded', () => {
  const doc = DOCS.get('slack-security-settings');
  const gates = GATES.get('slack-security-settings');
  const sms = gates.filter((g) => /\bSMS\b/.test(g.effect));
  assert.equal(sms.length, 1, 'exactly one gate changes SMS');
  assert.match(sms[0].phrase, /\bBLOCK SMS\b/);
  assert.match(sms[0].reversibility, /^R3\b/);
  assert.match(sms[0].reversibility, /Phase A/);
  const require = gates.find((g) => g.id === 'slack-security-settings-2fa-require-portal');
  assert.ok(require);
  assert.doesNotMatch(require.effect, /\bSMS\b/);
  assert.ok(require.steps.some((s) => /methods as Phase A recorded/i.test(s)), 'the requirement gate keeps the allowed methods');
  const phaseA = sectionLines(doc, doc.lines.find((l) => /^## Phase A:/.test(l))).join('\n');
  assert.match(phaseA, /\bSMS\b/, 'Phase A records whether SMS is allowed');
});

// ── 2. The R-class follows the R0-R3 table ─────────────────────────────────────────
// The classes a gate declares: every R-token before the first colon of its Reversibility
// ("R3 (security control): ..." gives R3; "R1 for one member, R2 for 2 to 10, R3 above 10
// (...): ..." gives all three).
function classesOf(gate) {
  const head = gate.reversibility.split(':')[0];
  return [...new Set(head.match(/\bR[0-3]\b/g) || [])];
}

const NUMBER_WORDS = Object.freeze({ two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 });
const WHOLE_WORKSPACE = /\b(?:the whole workspace|every member|every public channel|every channel|workspace-wide)\b/i;

test('a gate whose Scope reaches the whole workspace, every member or every channel is R3', () => {
  const failures = [];
  for (const gates of GATES.values()) {
    for (const gate of gates) {
      if (WHOLE_WORKSPACE.test(gate.scope) && !/^R3\b/.test(gate.reversibility)) failures.push(`${gate.id}: ${gate.reversibility.split(':')[0]} for "${gate.scope}"`);
    }
  }
  assert.deepEqual(failures, []);
});

test('unarchive and the re-add of recorded members are separate gates; the re-add phrase carries the member count and the class follows it', () => {
  const gates = GATES.get('slack-guests-connect');
  for (const gate of gates) {
    if (!/^unarchive\b/i.test(gate.effect)) continue;
    const clauses = gate.effect.split(/\s*;\s*|,\s*(?:and\s+)?|\s+and\s+/);
    assert.ok(!clauses.some((c) => /^add\b/i.test(c)), `${gate.id}: one Effect both unarchives and re-adds members`);
    assert.doesNotMatch(gate.phrase, /\bADD\b/, `${gate.id}: the unarchive phrase also adds members`);
  }
  const unarchive = gates.find((g) => /^unarchive\b/i.test(g.effect));
  assert.ok(unarchive);
  assert.deepEqual(classesOf(unarchive), ['R1']);
  const readd = gates.find((g) => /\$memberCount\b/.test(g.phrase));
  assert.ok(readd, 'a re-add gate whose phrase carries $memberCount');
  assert.match(readd.target, /\$memberCount\b/);
  assert.deepEqual(classesOf(readd), ['R1', 'R2', 'R3']);
  assert.match(readd.reversibility, /\bR2 for 2 to 10\b/);
  assert.match(readd.reversibility, /\bR3 above 10\b[^:]*\bindependent\b/);
  assert.match(readd.region, /\*\*PORTAL ACTION \[[a-z0-9-]+\]:\*\* [^\n]*independent out-of-session review/, 'the re-add action names the review above 10');
});

test('the public-channel export is R3 and runs only after the independent review', () => {
  const gate = GATES.get('slack-retention-export').find((g) => /\bEXPORT OF PUBLIC CHANNELS\b/.test(g.phrase));
  assert.ok(gate);
  assert.match(gate.reversibility, /^R3\b/);
  assert.match(gate.region, /\*\*PORTAL ACTION \[[a-z0-9-]+\]:\*\* Only after [^\n]*independent review/);
});

test('the "N changes, N gates, N phrases" header, the phase headings and the fast path name the classes the gates declare', () => {
  const failures = [];
  for (const [name, gates] of GATES) {
    const doc = DOCS.get(name);
    const header = doc.lines.find((l) => /^- \w+ changes, \w+ gates, \w+ phrases:/.test(l));
    if (header) {
      const word = header.match(/^- (\w+) changes/)[1].toLowerCase();
      if (NUMBER_WORDS[word] !== gates.length) failures.push(`${name}: header says ${word}, the runbook has ${gates.length} gates`);
      const listed = [...header.matchAll(/\((R[0-3])\b[^)]*\)/g)].map((m) => m[1]);
      const declared = gates.map((g) => classesOf(g)[0]);
      if (listed.join(' ') !== declared.join(' ')) failures.push(`${name}: header lists ${listed.join(' ')}, the gates declare ${declared.join(' ')}`);
    }
    for (const gate of gates) {
      const inHeading = gate.section.match(/\bR[0-3]\b/g) || [];
      for (const cls of classesOf(gate)) if (!inHeading.includes(cls)) failures.push(`${name} ${gate.id}: ${cls} is not in "${gate.section}"`);
    }
    for (const line of sectionLines(doc, '## Fast path')) {
      const phase = line.match(/^\d+\. Phase ([A-H])\b/);
      if (!phase) continue;
      const heading = doc.lines.find((l) => l.startsWith(`## Phase ${phase[1]}:`));
      const allowed = new Set(gates.filter((g) => g.section === heading).flatMap(classesOf));
      for (const cls of line.match(/\bR[1-3]\b/g) || []) if (!allowed.has(cls)) failures.push(`${name} fast path: ${cls} is not a class of Phase ${phase[1]}: ${line}`);
    }
  }
  assert.deepEqual(failures, []);
});

// ── 3. Token variables and scopes ──────────────────────────────────────────────────
test('each runbook names the token variable and every scope of the adapter commands it runs, and never puts the admin scope in SLACK_TOKEN', () => {
  const failures = [];
  for (const [name, doc] of DOCS) {
    const used = new Set([...doc.text.matchAll(/node scripts\/adapters\/slack-client\.js ([a-z-]+)/g)].map((m) => m[1]));
    assert.ok(used.size > 0, name);
    for (const command of used) {
      const entry = slack.SCOPES[command];
      if (!entry) { failures.push(`${name}: runs an unknown command ${command}`); continue; }
      if (entry.token && !doc.text.includes(`\`${entry.token}\``)) failures.push(`${name}: runs ${command} but never names \`${entry.token}\``);
      for (const scope of entry.scopes) if (!doc.text.includes(`\`${scope}\``)) failures.push(`${name}: runs ${command} but never names \`${scope}\``);
    }
    doc.lines.forEach((line, index) => {
      if (/\bSLACK_TOKEN\b/.test(line) && /\badmin[- ]scope\b|`admin`/i.test(line) && !/\bnever\b/i.test(line)) failures.push(`${name}:${index + 1}: SLACK_TOKEN paired with the admin scope`);
    });
  }
  assert.deepEqual(failures, []);
});

// ── 4. A phrase names its direction ───────────────────────────────────────────────
test('no two gates in a Slack runbook share a confirmation phrase', () => {
  for (const [name, gates] of GATES) {
    const phrases = gates.map((g) => g.phrase);
    assert.equal(new Set(phrases).size, phrases.length, `${name}: ${phrases.join(' | ')}`);
  }
});

test('slack-user-lifecycle: each account-type change has its own gate whose phrase names the destination, and Phase F stops on an Owner or Admin', () => {
  const doc = DOCS.get('slack-user-lifecycle');
  const converts = GATES.get('slack-user-lifecycle').filter((g) => /^convert\b/i.test(g.effect));
  const TYPES = { 'SINGLE-CHANNEL GUEST': /single-channel guest/i, 'MULTI-CHANNEL GUEST': /multi-channel guest/i, 'REGULAR MEMBER': /regular member/i };
  const destinations = converts.map((g) => (g.phrase.match(/^CONVERT SLACK ACCOUNT \[USER_ID\] TO (SINGLE-CHANNEL GUEST|MULTI-CHANNEL GUEST|REGULAR MEMBER)$/) || [])[1]);
  assert.deepEqual([...destinations].sort(), Object.keys(TYPES).sort(), 'one gate per destination type, each phrase naming it');
  converts.forEach((gate, i) => {
    const destination = destinations[i];
    assert.match(gate.effect, new RegExp(`\\bto an? ${TYPES[destination].source}`, 'i'), `${gate.id}: Effect names the destination`);
    for (const [other, pattern] of Object.entries(TYPES)) {
      if (other === destination) continue;
      for (const step of gate.steps) assert.ok(!new RegExp(`\\*\\*(?:Make )?${pattern.source}\\*\\*`, 'i').test(step), `${gate.id}: a step chooses ${other}: ${step}`);
    }
  });
  const phaseF = sectionLines(doc, doc.lines.find((l) => /^## Phase F:/.test(l))).join('\n');
  assert.match(phaseF, /\*\*Stop if:\*\*[^\n]*\bOwner(?:, | or )Admin\b[^\n]*\bseparate\b/, 'Phase F stops on an Owner or Admin');
  assert.doesNotMatch(phaseF, /must first be made regular members/, 'a role removal is not an unstated step of Phase F');
});

// ── 5. A read-back proves the person the GUI step acted on ──────────────────────────
test('slack-user-lifecycle: every phase proved by a verify-* user read binds [USER_ID] to the GUI record and stops when the account already had the end state', () => {
  const doc = DOCS.get('slack-user-lifecycle');
  const phaseA = sectionLines(doc, doc.lines.find((l) => /^## Phase A:/.test(l)));
  assert.ok(phaseA.some((l) => /^\d+\. /.test(l) && /\bmember ID\b/.test(l) && l.includes('`[USER@DOMAIN.COM]`') && /must equal `\[USER_ID\]`/.test(l)), 'Phase A records the member ID shown on the GUI record found by the email');
  const failures = [];
  const checked = new Set();
  for (const gate of GATES.get('slack-user-lifecycle')) {
    const lines = sectionLines(doc, gate.section);
    if (!/verify-(?:deactivated|reactivated|guest) --user \[USER_ID\]/.test(lines.join('\n'))) continue;
    if (!gate.steps.some((s) => s.includes('[USER@DOMAIN.COM]'))) continue;
    checked.add(gate.section);
    const stop = lines.find((l) => l.startsWith('**Stop if:**')) || '';
    if (!/\bmember ID\b[^\n]*\bis not `\[USER_ID\]`/.test(stop)) failures.push(`${gate.section}: no stop when the GUI record's member ID is not [USER_ID]`);
    if (!/Phase A `user` read[^\n]*\balready\b/.test(stop)) failures.push(`${gate.section}: no stop when the Phase A read already shows the end state`);
  }
  assert.deepEqual([...new Set(failures)], []);
  assert.deepEqual([...checked].map((h) => h.slice(0, 10)).sort(), ['## Phase D', '## Phase E', '## Phase F'], 'deactivate, reactivate and account type are the phases bound');
});

// ── 6. Every rollback points to something that exists ───────────────────────────────
const ROLLBACK_POINTER = /\bunder (?:its own|the(?: [a-z-]+){0,2}) (?:gate|phrase)\b|\bits own (?:gate|phrase|reviewed change)\b|\bseparately reviewed change\b|\bthrough (?:this same gate|Phase [A-H])\b/i;

test('every rollback a Reversibility field points to is a gate or a PREVIEW ONLY marker that exists, named by its id', () => {
  const known = new Set();
  for (const doc of DOCS.values()) {
    for (const m of doc.text.matchAll(/<!-- SAFETY GATE \[([a-z0-9-]+)\] -->|> \*\*PREVIEW ONLY \[([a-z0-9-]+)\]:\*\*/g)) known.add(m[1] || m[2]);
  }
  const failures = [];
  let pointers = 0;
  for (const gates of GATES.values()) {
    for (const gate of gates) {
      const ids = [...gate.reversibility.matchAll(/\[(slack-[a-z0-9-]+-(?:portal|preview))\]/g)].map((m) => m[1]);
      for (const id of ids) if (!known.has(id)) failures.push(`${gate.id}: points to ${id}, which does not exist`);
      if (ROLLBACK_POINTER.test(gate.reversibility)) {
        pointers += 1;
        if (!ids.length) failures.push(`${gate.id}: a rollback pointer names no gate or preview: ${gate.reversibility}`);
      }
      if (ids.includes(gate.id) && !/\bthrough this same gate\b/i.test(gate.reversibility)) failures.push(`${gate.id}: points to itself without saying so`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(pointers >= 10, `only ${pointers} rollback pointers found`);
});

test('the reviewed rollbacks exist: a channel-removal gate in the user lifecycle, and planning-only previews for turning Require approved apps off and public file sharing back on', () => {
  const remove = GATES.get('slack-user-lifecycle').find((g) => g.phrase === 'REMOVE SLACK MEMBER [USER_ID] FROM CHANNEL [CHANNEL_NAME]');
  assert.ok(remove, 'a channel-removal gate');
  assert.match(remove.reversibility, /^R1\b/);
  assert.ok(remove.steps.some((s) => /read-back/i.test(s)), 'a GUI read-back');
  const add = GATES.get('slack-user-lifecycle').find((g) => g.phrase === 'ADD SLACK MEMBER [USER_ID] TO CHANNEL [CHANNEL_NAME]');
  assert.ok(add.reversibility.includes(`[${remove.id}]`), 'the channel add points to the removal gate');
  const apps = DOCS.get('slack-app-approval').text;
  assert.match(apps, /> \*\*PREVIEW ONLY \[slack-app-approval-require-off-preview\]:\*\* Planning only;/);
  const settings = DOCS.get('slack-security-settings').text;
  assert.match(settings, /> \*\*PREVIEW ONLY \[slack-security-settings-file-sharing-on-preview\]:\*\* Planning only;/);
});

// ── 7. Read-backs check what they claim ────────────────────────────────────────────
test('slack-incident-comms: Phase A stops on a channel pending a share with another organization, and the not-before format is stated', () => {
  const doc = DOCS.get('slack-incident-comms');
  const phaseA = sectionLines(doc, doc.lines.find((l) => /^## Phase A:/.test(l)));
  const stop = phaseA.find((l) => l.startsWith('**Stop if:**')) || '';
  assert.match(stop, /is_pending_ext_shared/, 'the Stop-if line names is_pending_ext_shared');
  const readComment = phaseA.find((l, i) => /^# /.test(l) && /node scripts\/adapters\/slack-client\.js channel /.test(phaseA[i + 1] || ''));
  assert.match(readComment || '', /is_pending_ext_shared false/, 'the channel read comment names is_pending_ext_shared');
  const phaseB = sectionLines(doc, doc.lines.find((l) => /^## Phase B:/.test(l))).join('\n');
  assert.match(phaseB, /`not_before`/, 'use the not_before value digest printed');
  assert.match(phaseB, /ISO 8601 time with a zone/);
  assert.match(phaseB, /epoch milliseconds/);
});

test('slack-guests-connect: a declined invitation expects is_pending_ext_shared false and is_ext_shared unchanged from Phase A', () => {
  const decline = GATES.get('slack-guests-connect').find((g) => /^DECLINE SLACK CONNECT INVITATION\b/.test(g.phrase));
  assert.ok(decline);
  const text = decline.steps.join('\n');
  assert.match(text, /`is_pending_ext_shared` false/);
  assert.match(text, /`is_ext_shared` unchanged from the Phase A read/);
  assert.doesNotMatch(text, /`is_ext_shared` false/);
});

test('slack-retention-export: a deleted channel\'s failed read counts only when Phase A read the same channel with the same token', () => {
  const del = GATES.get('slack-retention-export').find((g) => /^DELETE SLACK CHANNEL\b/.test(g.phrase));
  assert.ok(del);
  const doc = DOCS.get('slack-retention-export');
  const phaseF = sectionLines(doc, del.section).join('\n');
  for (const line of phaseF.split('\n').filter((l) => /channel_not_found|channel error code/.test(l))) {
    assert.match(line, /Phase A `channel` read of the same `?\[CHANNEL_ID\]`? succeeded with the same token/, line);
  }
});
