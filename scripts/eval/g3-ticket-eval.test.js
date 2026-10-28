'use strict';
// g3-ticket-eval.test.js: wires the batch G3 ticket eval into `node --test` (task 4b),
// pins the corpus shape so it cannot decay into a trivial suite, and proves the scorer
// judges the implementation, not the fixtures.
//
// EXPECTED DECISION (written with the corpus, before the scorer and clarify.js)
// - Every ticket in g3-tickets.json passes the shared core (floor and triggers, route
//   lint, a first-occurrence replay MISS) and its own decision:
//     ADVISE          the tier guard leaves it clean (floor none), no question first
//     GATE            the tier guard floors it to T3, no question first
//     FLAG_INJECTION  the shared injection detector flags the ticket's own text
//     CLARIFY         scripts/intake/clarify.js asks exactly one question first, of the
//                     expected kind: which system, what the symptom is, or which group
//   and no ticket outside CLARIFY gets a question first.
// - A ticket that arrives through an intake source is read from its fixture by
//   scripts/intake/intake.js: the intake ACCEPTS it and the case text is exactly the
//   ticket text the corpus scores.
// - Minimums (charter task 4b): 6 Okta, 6 Microsoft 365, 6 ambiguous (CLARIFY), and 4
//   tickets through each intake source (Linear, GitHub, Slack, email), and 8 GitHub tickets
//   (task 5a, with the GitHub runbooks; MINIMUMS.github was 0 until then).
// - Dangerous pairs never share a replay key or a shape key, and never share a decision:
//   their floors, their triggers or their expected decisions differ.
// Run: node --test scripts/eval/g3-ticket-eval.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const g3 = require('./g3-ticket-eval.js');
const { clarify } = require('../intake/clarify.js');

const ROOT = path.resolve(__dirname, '..', '..');
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'g3-tickets.json'), 'utf8'));
const report = (rows) => rows.filter((r) => !r.ok).map((r) => `${r.id || `${r.a} / ${r.b}`}: ${r.problems.join('; ')}`).join('\n');

test('every G3 ticket passes the core checks and its expected decision; every pair holds', () => {
  const res = g3.evaluate(corpus);
  assert.equal(report(res.rows), '');
  assert.equal(report(res.pairs), '');
  assert.equal(res.ok, true);
});

test('the corpus meets the charter minimums, and the minimums are the charter numbers', () => {
  assert.deepEqual({ ...g3.MINIMUMS }, { okta: 6, microsoft: 6, clarify: 6, intakePerSource: 4, github: 8 });
  const s = g3.evaluate(corpus).summary;
  assert.ok(s.counts.okta >= 6, `okta ${s.counts.okta}`);
  assert.ok(s.counts.microsoft >= 6, `microsoft ${s.counts.microsoft}`);
  assert.ok(s.counts.github >= g3.MINIMUMS.github, `github ${s.counts.github}`);
  assert.ok(s.counts.clarify >= 6, `clarify ${s.counts.clarify}`);
  for (const source of ['linear', 'github', 'slack', 'email']) assert.ok(s.counts.intake[source] >= 4, `intake ${source} ${s.counts.intake[source]}`);
  assert.ok(corpus.tickets.some((t) => t.expectDecision === 'GATE' && t.platform === 'okta'), 'an Okta ticket floors');
  assert.ok(corpus.tickets.some((t) => t.expectDecision === 'GATE' && t.platform === 'microsoft'), 'a Microsoft ticket floors');
  assert.ok(corpus.tickets.some((t) => t.expectDecision === 'GATE' && t.platform === 'github'), 'a GitHub ticket floors');
  assert.ok(corpus.dangerousPairs.some((p) => p.a === 'G01-github-repo-read-access' && p.b === 'G02-github-remove-branch-protection'), 'the charter pair: adding a collaborator against removing branch protection');
  assert.ok(corpus.tickets.some((t) => t.expectDecision === 'FLAG_INJECTION' && t.intake && t.intake.source === 'email'), 'an injected email');
  assert.ok(corpus.tickets.some((t) => t.intake && t.intake.source === 'email' && /\.eml$/.test(t.intake.file) && fs.readFileSync(path.join(ROOT, t.intake.file), 'utf8').includes('Content-Type: text/html')), 'an HTML-only email');
});

test('each intake ticket is read from its fixture: ACCEPTED, and the case text is the ticket text', () => {
  const rows = g3.evaluate(corpus).rows.filter((r) => r.intake);
  assert.equal(rows.length, corpus.tickets.filter((t) => t.intake).length);
  for (const r of rows) {
    assert.equal(r.intake.state, 'ACCEPTED', r.id);
    assert.equal(r.intake.textMatches, true, r.id);
  }
});

test('clarify.js: exactly one question for each CLARIFY ticket, of the expected kind, and none for any other ticket', () => {
  for (const t of corpus.tickets) {
    const c = clarify(t.text);
    if (t.expectDecision === 'CLARIFY') {
      assert.equal(c.clarify, true, t.id);
      assert.equal(c.kind, t.expectQuestion, t.id);
      assert.equal((c.question.match(/\?/g) || []).length, 1, `${t.id}: one question`);
    } else {
      assert.equal(c.clarify, false, `${t.id}: ${c.question || ''}`);
    }
  }
  assert.equal(clarify('Outlook will not open on my laptop.').clarify, false);
  assert.equal(clarify('Onboard a new hire who starts on [START_DATE].').clarify, false);
  assert.equal(clarify('Help!').kind, 'symptom');
  assert.equal(clarify('Give [UPN] access to the shared drive folder.').clarify, false, 'a shared drive names the system');
  assert.equal(clarify('Remove [FIRST_NAME] from their groups today.').kind, 'group');
});

test('the scorer judges the implementation: a changed expectation or a changed ticket fails', () => {
  const copy = JSON.parse(JSON.stringify(corpus));
  const clar = copy.tickets.find((t) => t.expectDecision === 'CLARIFY');
  clar.text = `${clar.text} It is about Okta.`;
  const gate = copy.tickets.find((t) => t.expectDecision === 'GATE');
  gate.expectFloor = 'none';
  const moved = copy.tickets.find((t) => t.intake);
  moved.text = `${moved.text} (edited)`;
  const res = g3.evaluate(copy);
  const failed = res.rows.filter((r) => !r.ok).map((r) => r.id);
  for (const t of [clar, gate, moved]) assert.ok(failed.includes(t.id), `${t.id} should fail`);
});

test('CI runs the G3 eval beside the other ticket evals', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(ci, /run: node scripts\/eval\/g3-ticket-eval\.js/);
});

// Batch G3: the report's title names every platform group the corpus scores, GitHub
// included (it read "Okta, Microsoft 365, ambiguous, intake sources" after GitHub landed).
test('the report title names GitHub, Okta, Microsoft 365, the ambiguous tickets and the intake sources', () => {
  const title = g3.render(g3.evaluate(corpus)).split('\n').find((l) => /^G3 ticket eval/.test(l));
  assert.match(title, /^G3 ticket eval \(GitHub, Okta, Microsoft 365, ambiguous, intake sources\)/);
});
