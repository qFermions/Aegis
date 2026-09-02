#!/usr/bin/env node
'use strict';
// ms-ticket-eval.js — Microsoft ticket usability evaluation, deterministic half.
//
// For each sanitized ticket in ms-tickets.json this proves, without a model:
//   floor      the tier guard floors consequential tickets to the Tier-3/R-ladder
//              path and leaves routine ones clean (expectFloor / expectTriggers)
//   route      every command the ticket routes to exists and passes the GUI-first
//              structure lint (exact breadcrumbs, PowerShell collapsed + commented,
//              one checklist, one Jira note, fresh portal paths, no dangling refs)
//   replay     a first occurrence is a replay MISS routed to the adaptive path
//   pairs      the "dangerous pairs" (similar words, different required resolution)
//              never share an exact key, never share a shape key, and floor apart
//              — so the zero-model fast path cannot serve the wrong procedure
//
// What it does NOT prove — the model-judged half, run inside Claude Code with the
// rubric in scripts/eval/README.md: useful first action, depth sized to the class
// (QUICK_FIX / DIAGNOSTIC / PROCEDURE / REFERENCE), continuity after "still no",
// and human-executes framing in the rendered answer.
//
// Run: node scripts/eval/ms-ticket-eval.js [--json]      exit 0 pass · 1 fail

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const { assess } = require('../tier/tier-guard.js');
const replay = require('../replay/replay-cli.js');
const lint = require('../lint/command-structure.js');

const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'ms-tickets.json'), 'utf8'));
const CLASSES = new Set(['QUICK_FIX', 'DIAGNOSTIC', 'PROCEDURE', 'REFERENCE']);
const REPLAY_CLI = path.join(ROOT, 'scripts', 'replay', 'replay-cli.js');

function replayLookup(store, ticket) {
  const out = execFileSync('node', [REPLAY_CLI, 'lookup', '--ticket', ticket], {
    encoding: 'utf8', env: { ...process.env, AEGIS_REPLAY_DIR: store },
  });
  return JSON.parse(out);
}

function evaluate(corpus = CORPUS) {
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

module.exports = { evaluate };

if (require.main === module) {
  const res = evaluate();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log('Microsoft ticket eval — deterministic half (floor · route lint · replay MISS · dangerous pairs)\n');
    for (const r of res.rows) {
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(36)} ${r.class.padEnd(11)} floor=${r.floor.padEnd(4)} → ${r.route.map((c) => '/' + c).join(', ')}`);
      for (const p of r.problems) console.log(`        ! ${p}`);
    }
    console.log('');
    for (const p of res.pairs) {
      console.log(`${p.ok ? 'PASS' : 'FAIL'}  pair ${p.a} ≠ ${p.b} — ${p.why}`);
      for (const x of p.problems) console.log(`        ! ${x}`);
    }
    const s = res.summary;
    console.log(`\n${s.ticketsPassed}/${s.tickets} tickets · ${s.pairsPassed}/${s.pairs} dangerous pairs · ${s.floored} floored to T3 · ${s.commandsCovered} commands exercised · classes ${JSON.stringify(s.byClass)}`);
    console.log('Model-judged half (first action, depth, continuity, human-executes framing): scripts/eval/README.md');
  }
  process.exit(res.ok ? 0 : 1);
}
