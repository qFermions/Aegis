#!/usr/bin/env node
'use strict';
// latency.js: times Aegis's deterministic path for every corpus ticket (batch G3, task 6c).
//
// The path, in-process, per ticket: intake into the graph engine's INTAKE node (the intake
// module for a ticket that arrives through Linear, GitHub, Slack or email; the engine for
// a typed one), the tier-guard floor, the one-question check (clarify.js), the replay
// lookup on an empty sandbox store, and reading the routed runbooks (procedure
// selection). One warm-up pass, then one measured pass. A session also starts a Node
// process for each CLI it runs; that start time is measured once and reported apart.
// Model answer time is not measured: it is outside this repository.
//
// Run: node scripts/eval/latency.js      prints the measurement as JSON

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CORPORA = ['ms', 'gws', 'g2', 'g3'];
// Set from the batch G3 measurement on the build container (three runs over 175 tickets,
// docs/aegis/g3/evidence/t6c-latency-runs.txt, re-run at ebb8cc1: p50 0.24 to 0.33 ms, p95 0.52 to
// 0.85 ms, max 0.70 to 1.16 ms, one Node process start 35 to 43 ms).
// 50 ms leaves room for a slower CI runner and garbage-collection pauses, and is far under
// the charter's 1,000 ms per ticket.
const BUDGET_P95_MS = 50;

const percentile = (sorted, p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
const round = (ms) => Math.round(ms * 100) / 100;

function processStartMs() {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const start = process.hrtime.bigint();
    spawnSync(process.execPath, ['-e', '0']);
    runs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return round(runs.sort((a, b) => a - b)[1]);
}

function measure() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-latency-'));
  const previous = process.env.AEGIS_REPLAY_DIR;
  // the replay store is read from AEGIS_REPLAY_DIR when replay-cli.js loads: a sandbox
  process.env.AEGIS_REPLAY_DIR = path.join(sandbox, 'store');
  try {
    const engine = require('../graph/engine.js');
    const { assess } = require('../tier/tier-guard.js');
    const { clarify } = require('../intake/clarify.js');
    const intake = require('../intake/intake.js');
    const replay = require('../replay/replay-cli.js');
    const { INTAKE_ENV } = require('./g3-ticket-eval.js');
    const now = () => Date.parse('2026-10-28T00:00:00Z');
    const tickets = CORPORA.flatMap((c) => JSON.parse(fs.readFileSync(path.join(__dirname, `${c}-tickets.json`), 'utf8')).tickets.map((t) => ({ corpus: c, t })));
    const one = ({ t }) => {
      const start = process.hrtime.bigint();
      let text = t.text;
      if (t.intake) {
        const rec = intake.fromFile(t.intake.source, path.join(ROOT, t.intake.file), { env: INTAKE_ENV, now });
        if (rec.state === 'ACCEPTED') text = rec.case.ticket.text;
      } else {
        engine.newState({ ticketText: t.text });
      }
      assess(text);
      clarify(text);
      replay.resolveCase(replay.loadIndex(), text);
      for (const cmd of t.route) fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${cmd}.md`), 'utf8');
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    tickets.forEach(one); // warm-up
    const times = tickets.map((x) => ({ corpus: x.corpus, ms: one(x) }));
    const sorted = times.map((x) => x.ms).sort((a, b) => a - b);
    const perCorpus = {};
    for (const c of CORPORA) {
      const s = times.filter((x) => x.corpus === c).map((x) => x.ms).sort((a, b) => a - b);
      perCorpus[c] = { tickets: s.length, p50_ms: round(percentile(s, 50)), p95_ms: round(percentile(s, 95)) };
    }
    return {
      tickets: times.length,
      intake_tickets: tickets.filter((x) => x.t.intake).length,
      p50_ms: round(percentile(sorted, 50)),
      p95_ms: round(percentile(sorted, 95)),
      max_ms: round(sorted[sorted.length - 1]),
      budget_p95_ms: BUDGET_P95_MS,
      per_corpus: perCorpus,
      process_start_ms: processStartMs(),
      node: process.version,
      platform: process.platform,
      note: 'In-process deterministic path per ticket; each CLI a session runs adds about one process start. Model answer time is not measured: it is outside this repository.',
    };
  } finally {
    if (previous === undefined) delete process.env.AEGIS_REPLAY_DIR; else process.env.AEGIS_REPLAY_DIR = previous;
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

module.exports = { measure, BUDGET_P95_MS, CORPORA };

if (require.main === module) {
  const m = measure();
  console.log(JSON.stringify(m, null, 2));
  process.exit(m.p95_ms <= BUDGET_P95_MS ? 0 : 1);
}
