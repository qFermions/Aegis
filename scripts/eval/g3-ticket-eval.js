#!/usr/bin/env node
'use strict';
// g3-ticket-eval.js: batch G3 ticket evaluation, deterministic half (task 4b).
//
// Built on ticket-eval-core.js, so every ticket gets the same checks as the Microsoft,
// Google and G2 corpora (tier-guard floor and triggers, route lint, a first-occurrence
// replay MISS, dangerous pairs that never share an exact or shape key). On top of the
// core, for each ticket in g3-tickets.json:
//
//   platform   one of PLATFORMS; counts are printed per platform (platforms are proven
//              separately)
//   decision   checked against the implementation:
//                ADVISE          the tier guard leaves it clean (floor none)
//                GATE            the tier guard floors it to T3
//                FLAG_INJECTION  the shared injection detector flags its text
//                CLARIFY         scripts/intake/clarify.js asks one question first, of the
//                                ticket's expectQuestion kind (system, symptom or group)
//              and clarify.js asks nothing first for every other ticket
//   intake     a ticket with an intake source is read from its fixture by
//              scripts/intake/intake.js under INTAKE_ENV: ACCEPTED, and the case text
//              equals the ticket text that is scored
//   pairs      on top of the core pair checks, the two tickets never share a decision:
//              their floors, their triggers or their expected decisions differ
//
// Run: node scripts/eval/g3-ticket-eval.js [--json]      exit 0 pass · 1 fail

const fs = require('fs');
const path = require('path');
const core = require('./ticket-eval-core.js');
const { assess, injectionMarkersIn } = require('../tier/tier-guard.js');
const { clarify } = require('../intake/clarify.js');
const intake = require('../intake/intake.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'g3-tickets.json'), 'utf8'));
const PLATFORMS = ['github', 'okta', 'microsoft', 'google', 'slack', 'linear', 'jamf', 'fleet', 'general', 'unknown'];
const DECISIONS = new Set(['ADVISE', 'GATE', 'FLAG_INJECTION', 'CLARIFY']);
const QUESTION_KINDS = new Set(['system', 'symptom', 'group']);
const INTAKE_SOURCES = ['linear', 'github', 'slack', 'email'];
const INTAKE_DIR = path.join(ROOT, 'scripts', 'eval', 'g3-intake');
// The charter's minimums (task 4b). github rises to 8 with the GitHub runbooks (task 5a).
const MINIMUMS = Object.freeze({ okta: 6, microsoft: 6, clarify: 6, intakePerSource: 4, github: 8 });
// The report title names each group the minimums score, in this order (one name per minimum).
const GROUP_NAMES = Object.freeze({ github: 'GitHub', okta: 'Okta', microsoft: 'Microsoft 365', clarify: 'ambiguous', intakePerSource: 'intake sources' });
// The deployment the intake fixtures belong to, and a fixed receive time.
const INTAKE_ENV = Object.freeze({ LINEAR_ORG: 'org-a', GITHUB_ORG: 'org-a', SLACK_TEAM_ID: 'T0OURS0001', AEGION_DOMAIN: 'example.org' });
const INTAKE_NOW = () => Date.parse('2026-10-28T00:00:00Z');

function decisionProblems(t) {
  const problems = [];
  if (!PLATFORMS.includes(t.platform)) problems.push(`unknown platform ${t.platform}`);
  if (!DECISIONS.has(t.expectDecision)) { problems.push(`unknown decision ${t.expectDecision}`); return problems; }
  const floor = assess(t.text).floor;
  const asked = clarify(t.text);
  switch (t.expectDecision) {
    case 'ADVISE':
      if (floor !== 'none') problems.push(`decision ADVISE needs floor none, got ${floor}`);
      break;
    case 'GATE':
      if (floor !== 'T3') problems.push(`decision GATE needs floor T3, got ${floor}`);
      break;
    case 'FLAG_INJECTION':
      if (!injectionMarkersIn(t.text).length) problems.push('decision FLAG_INJECTION: the shared injection detector does not flag this ticket');
      break;
    case 'CLARIFY':
      if (!QUESTION_KINDS.has(t.expectQuestion)) problems.push(`decision CLARIFY needs expectQuestion system, symptom or group, got ${t.expectQuestion}`);
      if (!asked.clarify) problems.push('decision CLARIFY: clarify.js asks no question first');
      else {
        if (asked.kind !== t.expectQuestion) problems.push(`decision CLARIFY: clarify.js asks a ${asked.kind} question, expected ${t.expectQuestion}`);
        if ((asked.question.match(/\?/g) || []).length !== 1) problems.push('decision CLARIFY: the question is not exactly one question');
      }
      break;
    default:
      break;
  }
  if (t.expectDecision !== 'CLARIFY' && asked.clarify) problems.push(`clarify.js asks a ${asked.kind} question first, but the decision is ${t.expectDecision}`);
  return problems;
}

// The ticket read from its fixture through the intake, as an operator would import it.
function intakeCheck(t) {
  if (!t.intake) return { result: null, problems: [] };
  const { source, file } = t.intake;
  if (!INTAKE_SOURCES.includes(source)) return { result: null, problems: [`unknown intake source ${source}`] };
  const full = path.resolve(ROOT, String(file));
  if (path.dirname(full) !== INTAKE_DIR || !fs.existsSync(full)) return { result: null, problems: [`intake fixture ${file} is not a file in scripts/eval/g3-intake/`] };
  const rec = intake.fromFile(source, full, { env: INTAKE_ENV, now: INTAKE_NOW });
  const result = {
    source,
    state: rec.state,
    textMatches: rec.state === 'ACCEPTED' && rec.case.ticket.text === t.text,
    caseSource: rec.state === 'ACCEPTED' ? rec.case.ticket.source : null,
  };
  const problems = [];
  if (rec.state !== 'ACCEPTED') problems.push(`intake ${rec.state}: ${rec.reason}`);
  else {
    if (!result.textMatches) problems.push(`intake text differs from the ticket text: ${JSON.stringify(rec.case.ticket.text).slice(0, 300)}`);
    if (result.caseSource !== source || rec.case.ticket.provenance !== 'external_content') problems.push('intake case source or provenance is wrong');
  }
  return { result, problems };
}

function decisionOf(t) {
  const r = assess(t.text);
  return { floor: r.floor, triggers: [...r.triggers].sort(), decision: t.expectDecision };
}

function evaluate(corpus = CORPUS) {
  const base = core.evaluate(corpus);
  const byId = Object.fromEntries(corpus.tickets.map((t) => [t.id, t]));
  const rows = base.rows.map((row) => {
    const t = byId[row.id];
    const ic = intakeCheck(t);
    const problems = [...row.problems, ...decisionProblems(t), ...ic.problems];
    return { ...row, platform: t.platform, decision: t.expectDecision, intake: ic.result, ok: problems.length === 0, problems };
  });
  const pairs = base.pairs.map((p) => {
    const a = byId[p.a]; const b = byId[p.b];
    const problems = [...p.problems];
    if (a && b) {
      const da = decisionOf(a); const db = decisionOf(b);
      if (da.floor === db.floor && JSON.stringify(da.triggers) === JSON.stringify(db.triggers) && da.decision === db.decision) {
        problems.push(`the two tickets get the same decision (${da.decision}, floor ${da.floor}, triggers ${da.triggers.join('; ') || 'none'})`);
      }
    }
    return { ...p, ok: problems.length === 0, problems };
  });
  const direct = corpus.tickets.filter((t) => !t.intake);
  const counts = {
    ...Object.fromEntries(PLATFORMS.map((p) => [p, direct.filter((t) => t.platform === p).length])),
    clarify: corpus.tickets.filter((t) => t.expectDecision === 'CLARIFY').length,
    intake: Object.fromEntries(INTAKE_SOURCES.map((s) => [s, corpus.tickets.filter((t) => t.intake && t.intake.source === s).length])),
  };
  const perPlatform = {};
  for (const p of PLATFORMS) {
    const pr = rows.filter((r) => r.platform === p);
    if (!pr.length) continue;
    perPlatform[p] = {
      tickets: pr.length, ticketsPassed: pr.filter((r) => r.ok).length, floored: pr.filter((r) => r.floor === 'T3').length,
      decisions: Object.fromEntries([...DECISIONS].map((d) => [d, pr.filter((r) => r.decision === d).length])),
    };
  }
  const summary = {
    ...base.summary,
    ticketsPassed: rows.filter((r) => r.ok).length,
    pairsPassed: pairs.filter((x) => x.ok).length,
    counts,
    perPlatform,
  };
  return { ok: summary.ticketsPassed === rows.length && summary.pairsPassed === pairs.length, summary, rows, pairs };
}

function render(res) {
  const out = [core.render(res, `G3 ticket eval (${Object.values(GROUP_NAMES).join(', ')})`).split('\nModel-judged half')[0].trimEnd(), '', 'Per platform:'];
  for (const [p, s] of Object.entries(res.summary.perPlatform)) {
    out.push(`  ${p.padEnd(9)} ${s.ticketsPassed}/${s.tickets} tickets · ${s.floored} floored · decisions ${JSON.stringify(s.decisions)}`);
  }
  const c = res.summary.counts;
  out.push(`Minimums: okta ${c.okta}/${MINIMUMS.okta} · microsoft ${c.microsoft}/${MINIMUMS.microsoft} · github ${c.github}/${MINIMUMS.github} · clarify ${c.clarify}/${MINIMUMS.clarify} · intake ${INTAKE_SOURCES.map((s) => `${s} ${c.intake[s]}/${MINIMUMS.intakePerSource}`).join(', ')}`);
  out.push('Model-judged half (first action, depth, continuity, human-executes framing): scripts/eval/README.md');
  return out.join('\n');
}

module.exports = { evaluate, render, CORPUS, PLATFORMS, DECISIONS, MINIMUMS, GROUP_NAMES, INTAKE_ENV };

if (require.main === module) {
  const res = evaluate();
  const meets = res.summary.counts.okta >= MINIMUMS.okta && res.summary.counts.microsoft >= MINIMUMS.microsoft && res.summary.counts.github >= MINIMUMS.github
    && res.summary.counts.clarify >= MINIMUMS.clarify && INTAKE_SOURCES.every((s) => res.summary.counts.intake[s] >= MINIMUMS.intakePerSource);
  console.log(process.argv.includes('--json') ? JSON.stringify(res, null, 2) : render(res));
  process.exit(res.ok && meets ? 0 : 1);
}
