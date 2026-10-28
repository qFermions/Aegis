'use strict';
// latency.test.js: the latency budget of Aegis's deterministic path (batch G3, task 6c).
//
// EXPECTED DECISION (written before the code)
// - scripts/eval/latency.js measures, for every ticket of the four corpora (Microsoft,
//   Google Workspace, G2, G3), the deterministic path a ticket takes before any model
//   answers: intake into the graph engine's INTAKE node (the intake module for a ticket
//   that arrives through Linear, GitHub, Slack or email, the engine for a typed one), the
//   tier-guard floor, the one-question check, the replay lookup on an empty sandbox store,
//   and reading the routed runbooks (procedure selection). One warm-up pass, then one
//   measured pass.
// - It reports the ticket count, p50, p95 and max in milliseconds, and the start time of
//   one Node process (each CLI a session runs adds about that much). Model answer time is
//   not measured: it is outside this repository.
// - The budget BUDGET_P95_MS is set from the measurement (batch G3: a measured p95 under
//   1 ms on the build container, so the budget is set well above it for a slower CI
//   runner), and is at most 1,000 ms per ticket. This test fails when the measured p95 is
//   over it.
// Run: node --test scripts/eval/latency.test.js

const assert = require('node:assert/strict');
const test = require('node:test');

const latency = require('./latency.js');

test('the deterministic path from intake to procedure selection stays inside its p95 budget on every corpus ticket', (t) => {
  assert.ok(Number.isFinite(latency.BUDGET_P95_MS) && latency.BUDGET_P95_MS > 0 && latency.BUDGET_P95_MS <= 1000, 'a budget of at most 1,000 ms');
  const m = latency.measure();
  t.diagnostic(`tickets ${m.tickets} · p50 ${m.p50_ms} ms · p95 ${m.p95_ms} ms · max ${m.max_ms} ms · budget p95 ${latency.BUDGET_P95_MS} ms · one Node process start ${m.process_start_ms} ms`);
  assert.ok(m.tickets >= 170, `every corpus ticket is measured (${m.tickets})`);
  assert.deepEqual(Object.keys(m.per_corpus).sort(), ['g2', 'g3', 'gws', 'ms']);
  assert.ok(m.intake_tickets >= 16, 'the intake tickets go through the intake');
  assert.ok(m.p95_ms <= latency.BUDGET_P95_MS, `p95 ${m.p95_ms} ms is over the ${latency.BUDGET_P95_MS} ms budget`);
  assert.ok(m.p50_ms <= m.p95_ms && m.p95_ms <= m.max_ms);
  assert.match(m.note, /model answer time is not measured/i);
});
