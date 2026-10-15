'use strict';
// ticket-eval-core.js — the one deterministic ticket evaluator both corpora run.
//
// scripts/eval/ms-ticket-eval.js (Microsoft) and scripts/eval/gws-ticket-eval.js
// (Google Workspace / Okta / Jamf / macOS) differ only in their corpus file and
// report title; the checks are this module, so the two lanes are held to the
// same logic and a fix here lands on both.
//
// For every sanitized ticket it proves, with no model involved:
//   floor      the tier guard floors consequential tickets to the Tier-3/R-ladder
//              path and leaves routine ones clean (expectFloor / expectTriggers)
//   route      every command the ticket routes to exists and passes the GUI-first
//              structure lint (exact breadcrumbs, CLI/PowerShell collapsed + commented,
//              one checklist, one Jira note, fresh portal paths, no dangling refs)
//   replay     a first occurrence is a replay MISS routed to the adaptive path
//   pairs      the "dangerous pairs" (similar words, different required resolution)
//              never share an exact key, never share a shape key, and floor apart
//              where doctrine requires it
//
// Zero dependencies; the replay lookup runs the real CLI in a throwaway store.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const { assess } = require('../tier/tier-guard.js');
const replay = require('../replay/replay-cli.js');
const lint = require('../lint/command-structure.js');

const CLASSES = new Set(['QUICK_FIX', 'DIAGNOSTIC', 'PROCEDURE', 'REFERENCE']);
const REPLAY_CLI = path.join(ROOT, 'scripts', 'replay', 'replay-cli.js');

function replayLookup(store, ticket) {
  const out = execFileSync('node', [REPLAY_CLI, 'lookup', '--ticket', ticket], {
    encoding: 'utf8', env: { ...process.env, AEGIS_REPLAY_DIR: store },
  });
  return JSON.parse(out);
}

function evaluate(corpus) {
  const commands = new Set(fs.readdirSync(path.join(ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-eval-')), 'store');
  const lintCache = new Map();
  const lintOf = (name) => {
    if (!lintCache.has(name)) {
      const text = fs.readFileSync(path.join(ROOT, '.claude', 'commands', name + '.md'), 'utf8');
      lintCache.set(name, lint.lintCommand(name, text, { commands }));
    }
    return lintCache.get(name);
  };

  const rows = [];
  for (const t of corpus.tickets) {
    const problems = [];
    if (!CLASSES.has(t.class)) problems.push(`unknown class ${t.class}`);
    if (/\b[A-Za-z0-9._%+-]+@(?!DOMAIN\.COM\])[A-Za-z0-9-]+\.[A-Za-z]{2,}\b/.test(t.text)) problems.push('ticket text carries a literal email — corpus must be placeholder-only');

    const risk = assess(t.text);
    if (risk.floor !== t.expectFloor) problems.push(`floor ${risk.floor}, expected ${t.expectFloor} (${risk.triggers.join('; ') || 'no triggers'})`);
    for (const want of t.expectTriggers || []) {
      if (!risk.triggers.some((x) => x.toLowerCase().includes(want.toLowerCase()))) problems.push(`missing trigger containing "${want}" (got: ${risk.triggers.join('; ') || 'none'})`);
    }

    for (const cmd of t.route) {
      if (!commands.has(cmd)) { problems.push(`route /${cmd} does not exist`); continue; }
      const r = lintOf(cmd);
      for (const f of r.findings) problems.push(`/${cmd} lint: [${f.rule}] ${f.message}`);
    }

    const miss = replayLookup(store, t.text);
    if (miss.result !== 'MISS' || miss.route !== 'adaptive') problems.push(`first occurrence should be a replay MISS → adaptive, got ${miss.result}`);

    rows.push({ id: t.id, class: t.class, floor: risk.floor, triggers: risk.triggers, route: t.route, ok: problems.length === 0, problems });
  }

  const pairs = [];
  const byId = Object.fromEntries(corpus.tickets.map((t) => [t.id, t]));
  for (const p of corpus.dangerousPairs) {
    const a = byId[p.a]; const b = byId[p.b];
    const problems = [];
    if (!a || !b) { problems.push('unknown ticket id in pair'); }
    else {
      if (replay.keyOf(a.text) === replay.keyOf(b.text)) problems.push('exact keys collide');
      if (replay.shapeOf(a.text).shape === replay.shapeOf(b.text).shape) problems.push('shape keys collide (identical shape in every object class)');
      const fa = assess(a.text).floor; const fb = assess(b.text).floor;
      if (p.floorsMustDiffer && fa === fb) problems.push(`floors do not differ (${fa} / ${fb})`);
    }
    pairs.push({ a: p.a, b: p.b, why: p.why, ok: problems.length === 0, problems });
  }

  const summary = {
    tickets: rows.length, ticketsPassed: rows.filter((r) => r.ok).length,
    pairs: pairs.length, pairsPassed: pairs.filter((r) => r.ok).length,
    byClass: Object.fromEntries([...CLASSES].map((c) => [c, rows.filter((r) => r.class === c).length])),
    floored: rows.filter((r) => r.floor === 'T3').length,
    commandsCovered: [...new Set(rows.flatMap((r) => r.route))].length,
  };
  return { ok: summary.ticketsPassed === rows.length && summary.pairsPassed === pairs.length, summary, rows, pairs };
}

function render(res, title) {
  const out = [`${title} — deterministic half (floor · route lint · replay MISS · dangerous pairs)`, ''];
  for (const r of res.rows) {
    out.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(36)} ${r.class.padEnd(11)} floor=${r.floor.padEnd(4)} → ${r.route.map((c) => '/' + c).join(', ')}`);
    for (const p of r.problems) out.push(`        ! ${p}`);
  }
  out.push('');
  for (const p of res.pairs) {
    out.push(`${p.ok ? 'PASS' : 'FAIL'}  pair ${p.a} ≠ ${p.b} — ${p.why}`);
    for (const x of p.problems) out.push(`        ! ${x}`);
  }
  const s = res.summary;
  out.push(`\n${s.ticketsPassed}/${s.tickets} tickets · ${s.pairsPassed}/${s.pairs} dangerous pairs · ${s.floored} floored to T3 · ${s.commandsCovered} commands exercised · classes ${JSON.stringify(s.byClass)}`);
  out.push('Model-judged half (first action, depth, continuity, human-executes framing): scripts/eval/README.md');
  return out.join('\n');
}

// Shared CLI driver: prints the report (or --json) and exits 0 pass · 1 fail.
function main(corpus, title, argv = process.argv) {
  const res = evaluate(corpus);
  console.log(argv.includes('--json') ? JSON.stringify(res, null, 2) : render(res, title));
  process.exit(res.ok ? 0 : 1);
}

module.exports = { evaluate, render, main, CLASSES };
