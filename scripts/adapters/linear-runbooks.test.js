'use strict';
// linear-runbooks.test.js: the four Linear runbooks (.claude/commands/linear-*.md) against
// the R0 to R3 ladder (CLAUDE.md) and against the read-only Linear adapter they call.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// gate grammar in docs/security/COMMAND_RISK_METADATA.md (checked for every runbook by
// scripts/command-safety-gates.test.js) and the Linear section of docs/aegis/lanes/g2.md.
// This file adds the Linear-specific rules that the shared grammar does not state.
//
// EXPECTED DECISION
// 1. Every delete is R3. A gate whose Effect deletes something is classed R3 and names
//    its written rollback path, and its PORTAL ACTION waits for that path to be in the
//    ticket. No heading or fast-path line labels a delete with a lower class.
// 2. Every phrase names what changes. A gate's Target and its exact phrase bind the
//    same placeholders; a gate that sets a priority names [PRIORITY_LEVEL], a snooze
//    names [DATE_TIME], and a gate that edits or deletes one comment names
//    [COMMENT_ID]. A priority-only correction (triage Phase E) goes through a gate whose
//    Effect changes the priority and nothing else.
// 3. Every adapter line in the runbooks is one the adapter accepts. Each
//    `node scripts/adapters/linear-client.js ...` line, with its placeholders filled by
//    sample values, runs as a dry run (no --execute, no environment, no transport)
//    and exits 0; a placeholder with no sample value fails the test. The snooze gate
//    is followed by a verify-snoozed read-back.
// 4. The workspace-admin role check is about the person. Phase A stops when the person
//    who will make the change is not a workspace Admin (Owner for export), whatever
//    the key's role, and a key that is not that person's is itself a stop; the two
//    role checks are never joined so that an Admin's key lets a Member through.
// 5. A replace that does not fix the digest ends. After one replace, a digest that
//    still differs is a stop: no second edit, the stored digest goes next to
//    [NOTE_SHA256], and the partial-state note names the editor's change and a next
//    owner; the checklist and the "not done until" line accept that ending.
// 6. Wording matches the sources: no runbook says a GraphQL POST is itself a write
//    (that is this repo's scanner rule, said as such); the userUnsuspend role is the
//    schema's, not "unverified"; the comments read is said to cover 50 comments; the
//    ticket-note read-back names the poster with --author; and the adapter's usage
//    text uses the dictionary's team token, not [TEAM_KEY].
// 8. A reversal over more than 10 issues is its own R3 change. Each gate whose Scope
//    covers more than 10 issues names its reversal as its own reviewed or R3 change;
//    the bulk delete's written rollback path is a bulk restore with [FILE_NAME] as its
//    pre-state, the independent review, a per-issue restore phrase and read-back, a
//    count check and the last restore day, never N single R1 restores; the R1 restore
//    gate says so too.
// 9. Review nits, round 2. Every Linear-ready note read-back proves the poster: intake,
//    triage and ticket-note pass --author [USER_ID] (the poster's viewer id); the
//    workspace-admin line, where [USER_ID] is the member, never passes it and sends the
//    reader to observed.match.userId and /linear-ticket-note Phase E. ticket-note stops
//    when the comment it needs is past the 50-comment page or the 20-entry list. The
//    snooze time is compared in UTC. Every token a runbook uses that the placeholder
//    dictionary lacks is marked "not yet in the placeholder dictionary".
// 7. The note guard is described as it holds. ticket-note says `note` reads a file only
//    from this repo's tasks/ folder or the system temporary folder, says a plain-text
//    password inside them is still printed, and never promises that a mistyped path
//    cannot print a key.
//
// Nothing here reads a credential or opens a socket: the runbooks are files on disk.

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const linear = require('./linear-client.js');
const { changeTrail } = require('../audit/trail-helper.js');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOKS = ['linear-intake', 'linear-ticket-note', 'linear-triage', 'linear-workspace-admin'];
const text = Object.fromEntries(RUNBOOKS.map((name) => [name, fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8')]));

// Each SAFETY GATE with its fields and the region it owns: up to the next gate, preview
// marker or Markdown heading (a "# comment" inside a code fence is not a heading, so
// the read-back fence after a gate belongs to it).
function gates(name) {
  const lines = text[name].split('\n');
  const out = [];
  lines.forEach((line, index) => {
    const marker = line.match(/^<!-- SAFETY GATE \[([\w-]+)\] -->$/);
    if (!marker) return;
    let end = index + 1;
    let inFence = false;
    for (; end < lines.length; end += 1) {
      if (/^```/.test(lines[end])) inFence = !inFence;
      if (!inFence && /^(?:<!-- SAFETY GATE|>\s*\*\*PREVIEW ONLY|#{1,6}\s)/.test(lines[end])) break;
    }
    const region = lines.slice(index, end).join('\n');
    const field = (label) => (region.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '';
    out.push({
      file: name, id: marker[1], line: index + 1, region,
      target: field('Target'), effect: field('Effect'), scope: field('Scope'), reversibility: field('Reversibility'),
      phrase: (field('Required confirmation').match(/Type exactly `([^`]+)`/) || [])[1] || '',
      action: (region.match(new RegExp(`^\\*\\*PORTAL ACTION \\[${marker[1]}\\]:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '',
    });
  });
  return out;
}
const ALL_GATES = RUNBOOKS.flatMap(gates);

test('the four runbooks carry the gates this file judges', () => {
  assert.ok(ALL_GATES.length >= 14, `found ${ALL_GATES.length} gates`);
  for (const g of ALL_GATES) {
    assert.ok(g.target && g.effect && g.reversibility && g.phrase && g.action, `${g.id}: every field and the PORTAL ACTION are present`);
  }
});

test('every delete is R3: its gate names the written rollback path, the action waits for it, and no line labels a delete lower', () => {
  const deletes = ALL_GATES.filter((g) => /^delete\b/i.test(g.effect));
  assert.deepEqual(deletes.map((g) => g.id).sort(), [
    'linear-ticket-note-delete-portal', 'linear-workspace-admin-bulk-delete-portal', 'linear-workspace-admin-delete-portal',
  ]);
  for (const g of deletes) {
    assert.match(g.reversibility, /^R3\b/, `${g.id}: a delete is R3 (CLAUDE.md: wipe, delete, disable)`);
    assert.match(g.region, /written rollback path/i, `${g.id}: names its written rollback path`);
    assert.match(g.action, /written rollback path[^:]*in the ticket/i, `${g.id}: the action waits for the rollback path to be in the ticket`);
  }
  const lower = [];
  for (const name of RUNBOOKS) {
    text[name].split('\n').forEach((line, index) => {
      for (const m of line.matchAll(/\bdelet\w*\b[^()\n]*\((R[0-3])\b/gi)) {
        if (m[1] !== 'R3') lower.push(`${name}.md:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(lower, [], 'a heading or fast-path line labels a delete below R3');
});

const tokens = (value) => [...new Set(value.match(/\[[A-Za-z0-9_@.,-]+\]/g) || [])].sort();
const section = (name, heading) => {
  const start = text[name].indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `${name}: no "## ${heading}" section`);
  const end = text[name].indexOf('\n## ', start + 4);
  return text[name].slice(start, end < 0 ? undefined : end);
};

test('every gate phrase names the value or the comment it changes, and its Target binds the same placeholders', () => {
  const problems = [];
  for (const g of ALL_GATES) {
    if (JSON.stringify(tokens(g.target)) !== JSON.stringify(tokens(g.phrase))) problems.push(`${g.id}: Target ${tokens(g.target).join(' ')} but phrase ${tokens(g.phrase).join(' ')}`);
    if (/\bpriority\b/i.test(g.effect) && !g.phrase.includes('[PRIORITY_LEVEL]')) problems.push(`${g.id}: sets a priority, phrase names no [PRIORITY_LEVEL]`);
    if (/\bsnooze\b/i.test(g.effect) && !g.phrase.includes('[DATE_TIME]')) problems.push(`${g.id}: sets a snooze, phrase names no [DATE_TIME]`);
    if (/^(?:replace|delete)\b[^;]*\b(?:comment|copy)\b/i.test(g.effect) && !g.phrase.includes('[COMMENT_ID]')) problems.push(`${g.id}: edits or deletes one comment, phrase names no [COMMENT_ID]`);
  }
  assert.deepEqual(problems, []);
  const byId = Object.fromEntries(ALL_GATES.map((g) => [g.id, g]));
  assert.equal(byId['linear-triage-fields-portal'].phrase, 'SET PRIORITY [PRIORITY_LEVEL] AND ADD LABEL [LABEL_NAME] ON [ISSUE_ID]');
  assert.equal(byId['linear-intake-label-priority-portal'].phrase, 'SET PRIORITY [PRIORITY_LEVEL] AND ADD LABEL [LABEL_NAME] ON [ISSUE_ID]');
  assert.equal(byId['linear-triage-snooze-portal'].phrase, 'SET SNOOZE ON [ISSUE_ID] UNTIL [DATE_TIME]');
  assert.equal(byId['linear-ticket-note-replace-portal'].phrase, 'REPLACE TEXT OF COMMENT [COMMENT_ID] ON [ISSUE_ID] WITH [NOTE_SHA256]');
  assert.equal(byId['linear-ticket-note-delete-portal'].phrase, 'DELETE NOTE COPY [COMMENT_ID] ON [ISSUE_ID]');
});

test('triage Phase E corrects a wrong priority under a gate that changes the priority and nothing else', () => {
  const g = ALL_GATES.find((x) => x.id === 'linear-triage-priority-portal');
  assert.ok(g, 'linear-triage-priority-portal exists');
  assert.equal(g.phrase, 'SET PRIORITY [PRIORITY_LEVEL] ON [ISSUE_ID]');
  assert.ok(!/\blabel\b/i.test(g.effect), 'the priority-only gate changes no label');
  assert.match(g.reversibility, /^R1\b/);
  const phaseE = section('linear-triage', 'Phase E');
  assert.ok(phaseE.includes('<!-- SAFETY GATE [linear-triage-priority-portal] -->'), 'the gate sits in Phase E');
  assert.match(phaseE, /wrong priority goes through the priority-only gate/);
  assert.ok(!/fields gate/i.test(phaseE), 'Phase E no longer sends a priority-only change to the fields gate, which adds a label');
});

// Splits a command line on spaces, keeping a double-quoted value ("[STATE_NAME]") whole.
function words(line) {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]));
}

test('every adapter line in the runbooks is one the adapter accepts, and the snooze gate is read back with verify-snoozed', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-linear-runbooks-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const noteFile = path.join(dir, 'note.md');
  fs.writeFileSync(noteFile, 'Printer driver reinstalled on [DEVICE_NAME]. Test page printed.\n');
  const SAMPLE = {
    '[ISSUE_ID]': 'IT-123', '[@Aegion_LINEAR_TEAM]': 'IT', '[STATE_NAME]': 'Done', '[LABEL_NAME]': 'Hardware',
    '[USER_ID]': 'user-7', '[NOTE_SHA256]': 'a'.repeat(64), '[NOT_BEFORE]': '2026-10-27T11:50:00.000Z', '[NOTE_FILE]': noteFile,
  };
  const seen = new Set();
  const problems = [];
  // a read-back of an R2 or R3 gate passes --change [CHANGE_ID]: a change opened and approved
  // for that command in a temporary trail (batch G3 close-out, owner decision 1)
  const trail = changeTrail(t);
  for (const name of RUNBOOKS) {
    const lines = text[name].split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      for (const m of lines[i].matchAll(/node scripts\/adapters\/linear-client\.js ([^`\n]+)/g)) {
        const raw = words(m[1].trim()).filter((w) => w !== '--execute').map((w) => SAMPLE[w] || w);
        const argv = raw.map((w) => (w === '[CHANGE_ID]' ? trail.changeFor(`linear:${raw[0]}`, raw) : w));
        const unknown = argv.filter((w) => /\[[^\]]+\]/.test(w));
        if (unknown.length) { problems.push(`${name}.md:${i + 1}: no sample value for ${unknown.join(' ')}`); continue; }
        seen.add(argv[0]);
        const out = [];
        const code = await linear.run(argv, {}, { transport: async () => { throw new Error('no transport in a dry run'); }, audit: trail.sink, out: (s) => out.push(s), err: (s) => out.push(s) });
        if (code !== (argv[0].startsWith('verify-') ? 4 : 0)) problems.push(`${name}.md:${i + 1}: exit ${code}: ${argv.join(' ')}: ${out.join('').slice(0, 200)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  for (const cmd of ['note', 'issue', 'comments', 'verify-comment', 'verify-state', 'verify-labels', 'verify-trashed', 'verify-snoozed', 'verify-suspended']) {
    assert.ok(seen.has(cmd), `the runbooks use ${cmd}`);
  }
  const snooze = ALL_GATES.find((g) => g.id === 'linear-triage-snooze-portal');
  assert.match(snooze.region, /node scripts\/adapters\/linear-client\.js verify-snoozed --issue \[ISSUE_ID\] --execute/, 'the snooze gate is read back with verify-snoozed');
  assert.ok(!/carries no snooze field/.test(text['linear-triage']), 'the runbook no longer says the issue read has no snooze field');
});

test('the workspace-admin Phase A stop depends on the person who makes the change, never on the key', () => {
  const phaseA = section('linear-workspace-admin', 'Phase A');
  const stop = (phaseA.match(/^\*\*Stop if:\*\*.*$/m) || [''])[0];
  assert.match(stop, /the person who will make the change is not a workspace Admin \(an Owner for the export\), whatever the key's role/);
  assert.match(stop, /A key whose user is not that person is itself a stop/);
  assert.ok(!/neither admin nor owner/i.test(stop) && !/\bkey's user is\b[^.]*\band the person\b/i.test(stop), 'the key check and the person check are not joined with "and"');
  const fast = (section('linear-workspace-admin', 'Fast path').match(/^1\. Phase A:.*$/m) || [''])[0];
  assert.match(fast, /The person who makes the change is not a workspace Admin \(Owner for export\): stop and escalate, whatever the key's role/);
  assert.match(phaseA, /Members → find your own row → read your role/, 'Phase A reads the person\'s own role');
});

test('ticket-note: a digest that still differs after one replace is a stop with a partial-state note, not another edit', () => {
  const replace = ALL_GATES.find((g) => g.id === 'linear-ticket-note-replace-portal');
  const stop = (replace.region.match(/^\*\*Stop if:\*\*[\s\S]*$/m) || [''])[0];
  assert.match(stop, /still fails on the digest after one replace/);
  assert.match(stop, /Do not edit again/);
  assert.match(stop, /next to `\[NOTE_SHA256\]`, the digest `verify-comment` printed for `\[COMMENT_ID\]`/);
  assert.match(stop, /partial-state form of the note: it names the editor's change[^\n]*next owner/);
  assert.match(section('linear-ticket-note', 'Phase E'), /use the Phase F replace gate once\./);
  const checklist = section('linear-ticket-note', '✅ Verification checklist');
  assert.match(checklist, /`verify-comment` passed[^\n]*, or, after one replace still left the digest different, [^\n]*partial-state note[^\n]*next owner/);
  assert.match(section('linear-ticket-note', '⚠️ Admin / safety gate'), /Not done until[^\n]*or, when one replace still leaves the digest different/);
});

test('wording matches the sources: the scanner rule, the unsuspend role, the 50-comment page, the poster check and the team token', () => {
  for (const name of RUNBOOKS) assert.ok(!/counts as a write even when it only reads/.test(text[name]), `${name}: a GraphQL POST is not itself a write in Linear`);
  for (const name of ['linear-triage', 'linear-workspace-admin']) assert.match(text[name], /This repo's safety scanner treats any curl POST or request body as a write, so this runbook has no curl path/);
  const admin = text['linear-workspace-admin'];
  assert.ok(!/description was not read for a role/.test(admin), 'the userUnsuspend role is in the schema');
  assert.match(admin, /`userUnsuspend` "can only be called by a workspace admin or owner"/);
  const phaseE = section('linear-ticket-note', 'Phase E');
  assert.match(phaseE, /verify-comment --issue \[ISSUE_ID\] --expect-sha256 \[NOTE_SHA256\] --not-before \[NOT_BEFORE\] --author \[USER_ID\] --execute/);
  assert.match(phaseE, /The `comments` read covers the first 50 comments only; on a longer thread, count the copies on the issue page/);
  const adapterSource = fs.readFileSync(path.join(__dirname, 'linear-client.js'), 'utf8');
  assert.ok(!adapterSource.includes('[TEAM_KEY]'), 'the adapter uses [@Aegion_LINEAR_TEAM], a dictionary token');
});

test('a reversal over more than 10 issues is its own R3 change: the bulk delete rolls back by a reviewed bulk restore, never by N single R1 restores', () => {
  const bulk = ALL_GATES.filter((g) => /^exactly the issues in \[FILE_NAME\][^;]*more than 10/.test(g.scope));
  assert.deepEqual(bulk.map((g) => g.id).sort(), ['linear-workspace-admin-bulk-delete-portal', 'linear-workspace-admin-bulk-move-portal']);
  for (const g of bulk) assert.match(g.reversibility, /its own (?:R3|reviewed) change/, `${g.id}: the reversal of a mass change is itself a reviewed change`);
  const del = bulk.find((g) => g.id === 'linear-workspace-admin-bulk-delete-portal');
  const rollback = /a bulk restore of every identifier in `?\[FILE_NAME\]`?, its own R3 change: `?\[FILE_NAME\]`? is its pre-state, it gets the independent review, each issue is restored under `?RESTORE LINEAR ISSUE \[ISSUE_ID\]`? and read back with the `?issue`? read, the restored count must equal the line count of `?\[FILE_NAME\]`?, and it finishes before the last restore day/;
  assert.match(del.reversibility, rollback, 'the Reversibility line names the bulk restore as its own R3 change');
  assert.match(del.action, rollback, 'the PORTAL ACTION waits for that rollback path');
  const admin = text['linear-workspace-admin'];
  assert.ok(!/restored under the restore gate, one at a time/.test(admin), 'no rollback path of single restores');
  const restore = ALL_GATES.find((g) => g.id === 'linear-workspace-admin-restore-portal');
  assert.match(restore.reversibility, /^R1\b/);
  assert.match(restore.scope, /restoring the issues of a bulk delete \(more than 10\) is not a run of this gate alone but the bulk restore named in Phase C, its own R3 change/);
  assert.match(section('linear-workspace-admin', '⚠️ Risk warning'), /undoing a bulk delete of 40 issues is a bulk restore: its own R3 change/);
});

test('every Linear-ready note read-back proves who posted it; workspace-admin never passes the member as --author', () => {
  const NOTE_LINE = /node scripts\/adapters\/linear-client\.js verify-comment --issue \[ISSUE_ID\] --expect-sha256 \[NOTE_SHA256\] --not-before \[NOT_BEFORE\]([^`\n]*)/;
  for (const name of ['linear-intake', 'linear-triage', 'linear-ticket-note']) {
    const note = section(name, '📝 Linear-ready note');
    const m = note.match(NOTE_LINE);
    assert.ok(m, `${name}: the note read-back is there`);
    assert.equal(m[1].trim(), '--author [USER_ID] --execute', `${name}: the note read-back names the poster`);
    assert.match(note, /# [^\n]*by Linear user \[USER_ID\] \(the poster's id, from the viewer read run with their own key\)/, `${name}: the comment names [USER_ID] as the poster`);
    assert.match(text[name], /`\[USER_ID\]` \(the Linear user ID of the administrator who posts/, `${name}: [USER_ID] is defined as the poster`);
  }
  const admin = section('linear-workspace-admin', '📝 Linear-ready note');
  const m = admin.match(NOTE_LINE);
  assert.ok(m && !/--author/.test(m[1]), 'workspace-admin: [USER_ID] is the member, so the note line passes no --author');
  assert.match(admin, /in this runbook \[USER_ID\] is the member, never the poster, so do not pass it as --author/);
  assert.match(admin, /proved only when the printed `observed\.match\.userId` is the poster's own id from the `viewer` read[^\n]*`\/linear-ticket-note` Phase E/);
  assert.match(section('linear-workspace-admin', '✅ Verification checklist'), /`observed\.match\.userId` is the poster's own `viewer` id/);
});

test('ticket-note stops when the comment it needs is past the 50-comment page or the 20-entry list', () => {
  const phaseE = section('linear-ticket-note', 'Phase E');
  assert.match(phaseE, /\*\*Stop if:\*\* the comment that step 3 or 4 needs is not in the `comments` read \(a thread over 50 comments[^\n]*never pick a comment on screen without its `\[COMMENT_ID\]` and `createdAt` from a read\./);
  const replace = ALL_GATES.find((g) => g.id === 'linear-ticket-note-replace-portal');
  assert.match(replace.region, /That list holds at most 20 comments created since `\[NOT_BEFORE\]`; if `\[COMMENT_ID\]` is not in it, write that in the ticket instead and escalate with the issue page open\./);
  // The numbers in the runbook are the adapter's: one page of 50 comments, at most 20 listed.
  const src = fs.readFileSync(path.join(__dirname, 'linear-client.js'), 'utf8');
  assert.match(src, /comments\(first: 50, after: \$after\)/);
  assert.match(src, /const MAX_LISTED = 20;/);
});

test('triage compares a snooze time in UTC, the form verify-snoozed prints', () => {
  const triage = text['linear-triage'];
  assert.match(triage, /`\[DATE_TIME\]` \(the date and time a snooze ends, written in the ticket and the phrase in UTC/);
  const snooze = ALL_GATES.find((g) => g.id === 'linear-triage-snooze-portal');
  assert.match(snooze.region, /compare it with \[DATE_TIME\] in UTC, to the minute/);
  assert.match(snooze.region, /the sources read do not say which time zone the snooze picker shows/);
  for (const line of triage.split('\n').filter((l) => /snoozedUntilAt[^\n]*matches `\[DATE_TIME\]`/.test(l))) {
    assert.match(line, /read in UTC, matches `\[DATE_TIME\]` \(UTC\)[^\n]*to the minute/, line);
  }
  assert.equal(triage.split('\n').filter((l) => /snoozedUntilAt[^\n]*matches `\[DATE_TIME\]`/.test(l)).length, 2, 'the Phase D checkpoint and the checklist');
});

test('every token a Linear runbook uses that the placeholder dictionary lacks is marked as not yet in it', () => {
  const dictionary = fs.readFileSync(path.join(ROOT, 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  const known = new Set(dictionary.match(/\[[A-Za-z0-9_@.,#-]+\]/g));
  const unmarked = [];
  for (const name of RUNBOOKS) {
    for (const token of new Set(text[name].match(/\[[A-Z][A-Z0-9_]*\]/g))) {
      if (known.has(token) || token === '[X]') continue; // [X] is the note template's minutes
      const escaped = token.replace(/[[\]]/g, '\\$&');
      if (!new RegExp(`\`${escaped}\` \\([^·]*not yet in the placeholder dictionary\\)`).test(text[name])) unmarked.push(`${name}: ${token}`);
    }
  }
  assert.deepEqual(unmarked, []);
});

test('ticket-note describes the note guard as it holds: tasks/ or the temporary folder only, and no promise that a mistyped path never prints a key', () => {
  const note = text['linear-ticket-note'];
  const inputs = section('linear-ticket-note', 'Inputs needed');
  assert.match(inputs, /`note` reads only a `\.md` or `\.txt` file under this repo's `tasks\/` folder or the system temporary folder/);
  assert.match(inputs, /A path taken from ticket text, such as a `passwords\.txt` on the Desktop, is refused before it is read\./);
  assert.match(inputs, /a password written in plain words is not a format the scanner knows, so keep only the note there/);
  assert.match(note, /`\[NOTE_FILE\]` \(the plain-text file[^)]*under this repo's `tasks\/` folder/);
  assert.match(section('linear-ticket-note', 'Phase B'), /under this repo's `tasks\/` folder or the system temporary folder\) on the administrator's machine; `note` refuses a file anywhere else/);
  assert.ok(!/never prints a key/.test(note), 'no promise that a mistyped path never prints a key');
});
