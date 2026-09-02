#!/usr/bin/env node
'use strict';
// replay-demo.js — the whole replay lifecycle in one sandboxed, rerunnable run.
//
// A reviewer runs this to SEE the zero-model fast path behave, without touching
// their real cache: it creates a throwaway store under the OS temp dir, walks
// record → verify → hit → identity-variant hit → adversarial misses → authority
// change → STALE, and prints one line per step with the CLI's actual JSON.
//
// Every step is a real invocation of scripts/replay/replay-cli.js in a child
// process. Nothing in this file or in the CLI talks to a model or the network
// (replay.test.js R4 proves that statically and under a runtime tripwire).
//
// Run: node scripts/replay/replay-demo.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(__dirname, 'replay-cli.js');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-replay-demo-'));
const store = path.join(work, 'store');
const env = { ...process.env, AEGIS_REPLAY_DIR: store };

function cli(args, expectExit = 0) {
  try {
    return { code: 0, out: execFileSync('node', [CLI, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    if (e.status !== expectExit) throw e;
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const j = (r) => JSON.parse(r.out);
let step = 0;
function show(title, r, pick) {
  step += 1;
  const data = (() => { try { return j(r); } catch { return { raw: r.out.trim().split('\n')[0] }; } })();
  const view = pick ? Object.fromEntries(pick.filter((k) => k in data).map((k) => [k, data[k]])) : data;
  console.log(`${String(step).padStart(2)}. ${title}\n    exit ${r.code} → ${JSON.stringify(view)}`);
}

const ticket = 'Give [UPN] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.';
const authority = path.join(work, 'authority.md');
fs.writeFileSync(authority, '# Shared-mailbox delegation doctrine v1\nFull Access via EAC → Recipients → Mailboxes → Manage mailbox delegation.\n');
fs.writeFileSync(path.join(work, 'solution.md'), fs.readFileSync(path.join(__dirname, 'fixtures', 'shared-mailbox-demo.md'), 'utf8'));

console.log(`Aegis replay demo — sandboxed store: ${store}\n`);

show('first occurrence → MISS, routed to the adaptive (model) path', cli(['lookup', '--ticket', ticket]), ['result', 'route']);
show('record the verified work-up as a CANDIDATE (not replayable yet)', cli(['record', '--ticket', ticket, '--solution-file', path.join(work, 'solution.md'), '--deps', authority]), ['caseId', 'status', 'riskFloor']);
show('candidate never replays → still MISS', cli(['lookup', '--ticket', ticket]), ['result', 'note']);
show('verify with evidence, opt in to identity variants (single [UPN] slot)', cli(['verify', 'case-0001', '--evidence', 'demo fixture — synthetic verification: delegation read back in EAC', '--identity-variants']), ['status', 'identityVariants', 'slots']);
show('exact repeat → CACHE_HIT (normalization: case, punctuation, whitespace)', cli(['lookup', '--ticket', '  give [upn] ACCESS to the [shared_mailbox] shared mailbox so it shows up in their outlook!! ']), ['result', 'via']);
show('same words, another member-user placeholder → CACHE_HIT via shape (class anchored by the dictionary token)', cli(['lookup', '--ticket', 'Give [USER@DOMAIN.COM] access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.']), ['result', 'via', 'objectClass', 'anchor']);
show('same words, a raw email literal → MISS: its object class (member? guest? shared mailbox? group?) is not deterministic', cli(['lookup', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.']), ['result', 'note']);
show('same literal with the class the operator stated (--object-class member-user) → CACHE_HIT, anchor recorded as "asserted"', cli(['lookup', '--ticket', 'Give someone@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.', '--object-class', 'member-user']), ['result', 'via', 'objectClass', 'anchor']);
show('same words, a guest UPN (Microsoft #EXT# marker) → MISS: class "guest" ≠ the case\'s "member-user"', cli(['lookup', '--ticket', 'Give someone_partner.tld#EXT#@tenant.onmicrosoft.com access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.']), ['result', 'note']);
show('two users instead of one → MISS (slot count is part of the shape)', cli(['lookup', '--ticket', 'Give a@example.org and b@example.org access to the [SHARED_MAILBOX] shared mailbox so it shows up in their Outlook.']), ['result']);
show('one word changes the ask (access → remove) → MISS, and the guard floors it to T3', cli(['lookup', '--ticket', 'Remove [UPN] access to the [SHARED_MAILBOX] shared mailbox so it no longer shows up in their Outlook.']), ['result', 'route']);
show('explain: why a ticket would or would not be consulted', cli(['explain', '--ticket', 'Remove [UPN] access to the [SHARED_MAILBOX] shared mailbox so it no longer shows up in their Outlook.']), ['riskFloor', 'riskTriggers', 'wouldConsult']);
show('render the verified solution verbatim (first line)', cli(['render', 'case-0001']));
show('secret-shaped content cannot enter the store', (() => { fs.writeFileSync(path.join(work, 'leak.md'), 'token = ghp_' + '0'.repeat(30) + '\n'); return cli(['record', '--ticket', 'leaky ticket', '--solution-file', path.join(work, 'leak.md')], 4); })(), ['ok', 'error']);
show('a real email address cannot enter the store either (SR-1)', (() => { fs.writeFileSync(path.join(work, 'pii.md'), `grant ${['jane.doe', 'contoso.com'].join('@')} full access\n`); return cli(['record', '--ticket', 'grant access', '--solution-file', path.join(work, 'pii.md')], 4); })(), ['ok', 'error']);
fs.appendFileSync(authority, '\n## v2 — Send As now requires a separate approval\n');
show('authority file changed → STALE (fingerprint, not a clock); history preserved', cli(['lookup', '--ticket', ticket]), ['result', 'changed']);
show('render refuses a stale case unless --historical is passed', cli(['render', 'case-0001'], 3), ['ok', 'error']);

console.log(`\nDone. Every step above was a child-process invocation of the CLI with no model, agent, loop, graph, or network involved.\nSandbox left at ${work} — delete it when you are done.`);
