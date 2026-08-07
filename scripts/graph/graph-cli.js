#!/usr/bin/env node
/**
 * graph-cli.js — Aegis Ticket Graph driver surface
 *
 * The Aegis session (or a test) drives a run through this CLI:
 *   new → next → (spawn the node's subagent, get its JSON artifact) → submit → …
 *
 * Storage: <runsDir>/<runId>/state.json + artifacts/NN-<node>[-rejected].json
 *   runsDir = AEGIS_GRAPH_RUNS_DIR or <repo>/tasks/graph-runs (gitignored)
 *
 * All output is JSON on stdout (machine-readable, ILF idiom).
 * Exit codes: 0 ok · 1 error · 2 invalid artifact/sequence · 3 sanitizer BLOCK
 *             4 gate precondition missing · 5 approval refused/hash mismatch
 *
 * The human gate is CLI-only BY DESIGN: approve/reject exist here and nowhere
 * in any artifact path. Known residual risk (single-operator trust model,
 * ADR-004): the engine cannot prove who typed approve — the control is the
 * echoed action summary, the payload hash, and the audit trail in history[].
 *
 * Usage:
 *   node scripts/graph/graph-cli.js new     --ticket-file t.md [--source jira] [--mode dry-run|sim|live]
 *   node scripts/graph/graph-cli.js status  <runId>
 *   node scripts/graph/graph-cli.js next    <runId>
 *   node scripts/graph/graph-cli.js submit  <runId> --node ROUTER --file artifact.json
 *   node scripts/graph/graph-cli.js approve <runId> --hash <sha256>
 *   node scripts/graph/graph-cli.js reject  <runId> --reason "…"
 *   node scripts/graph/graph-cli.js abort   <runId> --reason "…"
 *   node scripts/graph/graph-cli.js list
 */

const fs = require('fs');
const path = require('path');
const engine = require('./engine');

const RUNS_DIR = process.env.AEGIS_GRAPH_RUNS_DIR || path.join(__dirname, '..', '..', 'tasks', 'graph-runs');

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
function fail(code, message, details) {
  out({ ok: false, error: message, details: details || [] });
  process.exit(code);
}

function runDir(runId) { return path.join(RUNS_DIR, runId); }
function statePath(runId) { return path.join(runDir(runId), 'state.json'); }

function loadState(runId) {
  const p = statePath(runId);
  if (!fs.existsSync(p)) fail(1, `run not found: ${runId} (looked in ${RUNS_DIR})`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveState(state) {
  fs.mkdirSync(runDir(state.runId), { recursive: true });
  fs.writeFileSync(statePath(state.runId), JSON.stringify(state, null, 2) + '\n');
}

function saveArtifact(state, node, artifact, accepted) {
  const dir = path.join(runDir(state.runId), 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const seq = String(fs.readdirSync(dir).length + 1).padStart(2, '0');
  const name = `${seq}-${node.toLowerCase()}${accepted ? '' : '-rejected'}.json`;
  fs.writeFileSync(path.join(dir, name), JSON.stringify(artifact, null, 2) + '\n');
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
    }
  }
  return flags;
}

// Persist state even when the engine throws — a rejected artifact still
// consumed a retry, an armed gate is still armed. Audit trail over tidiness.
function withState(runId, fn) {
  const state = loadState(runId);
  try {
    const result = fn(state);
    saveState(state);
    return result;
  } catch (e) {
    saveState(state);
    if (e instanceof engine.GraphError) fail(e.code, e.message, e.details);
    throw e;
  }
}

function summarize(state) {
  return {
    runId: state.runId,
    status: state.status,
    node: state.status === 'active' ? state.node : null,
    mode: state.mode,
    lane: state.classification ? state.classification.lane : null,
    effectiveRisk: state.risk.effective,
    gates: state.risk.gates,
    humanGate: { decision: state.humanGate.decision, payloadHash: state.humanGate.payloadHash },
    reviewRound: state.review.round,
    warnings: state.warnings.length,
    updatedAt: state.updatedAt,
  };
}

// ── commands ─────────────────────────────────────────────────────────────────

function cmdNew(flags) {
  if (!flags['ticket-file']) fail(1, 'required: --ticket-file <path>');
  if (!fs.existsSync(flags['ticket-file'])) fail(1, `ticket file not found: ${flags['ticket-file']}`);
  const ticketText = fs.readFileSync(flags['ticket-file'], 'utf8');
  let state;
  try {
    state = engine.newState({ ticketText, source: flags.source || 'operator', mode: flags.mode || 'dry-run' });
  } catch (e) {
    if (e instanceof engine.GraphError) fail(e.code, e.message, e.details);
    throw e;
  }
  saveState(state);
  out({ ok: true, ...summarize(state), injectionFlags: state.ticket.injectionFlags });
}

function cmdStatus(runId) {
  const state = loadState(runId);
  out({ ok: true, summary: summarize(state), state });
}

function cmdNext(runId) {
  const envelope = withState(runId, (state) => engine.nextEnvelope(state));
  out({ ok: true, ...envelope });
}

function cmdSubmit(runId, flags) {
  if (!flags.node || !flags.file) fail(1, 'required: --node <NODE> --file <artifact.json>');
  if (!fs.existsSync(flags.file)) fail(1, `artifact file not found: ${flags.file}`);
  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(flags.file, 'utf8'));
  } catch (e) {
    fail(2, `artifact is not valid JSON: ${e.message}`);
  }
  const node = String(flags.node).toUpperCase();
  const result = withState(runId, (state) => {
    try {
      engine.submit(state, node, artifact);
      saveArtifact(state, node, artifact, true);
      return { ok: true, ...summarize(state) };
    } catch (e) {
      saveArtifact(state, node, artifact, false);
      throw e;
    }
  });
  out(result);
}

function cmdApprove(runId, flags) {
  if (!flags.hash) fail(5, 'required: --hash <sha256> — quote the exact payload hash shown by status/next; approvals are never from memory');
  const result = withState(runId, (state) => {
    engine.approve(state, flags.hash);
    return {
      ok: true,
      approved: { payloadHash: flags.hash, decidedAt: state.humanGate.decidedAt, singleUse: true },
      ...summarize(state),
    };
  });
  out(result);
}

function cmdReject(runId, flags) {
  const result = withState(runId, (state) => {
    engine.reject(state, flags.reason || '');
    return { ok: true, ...summarize(state) };
  });
  out(result);
}

function cmdAbort(runId, flags) {
  const result = withState(runId, (state) => {
    engine.abort(state, flags.reason || '');
    return { ok: true, ...summarize(state) };
  });
  out(result);
}

function cmdList() {
  if (!fs.existsSync(RUNS_DIR)) { out({ ok: true, runs: [] }); return; }
  const runs = fs.readdirSync(RUNS_DIR)
    .filter((d) => fs.existsSync(path.join(RUNS_DIR, d, 'state.json')))
    .map((d) => summarize(JSON.parse(fs.readFileSync(path.join(RUNS_DIR, d, 'state.json'), 'utf8'))));
  out({ ok: true, runs });
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  // runId is always the first positional, immediately after the command
  const runId = rest.length > 0 && !rest[0].startsWith('--') ? rest[0] : null;
  const flags = parseFlags(rest);

  switch (cmd) {
    case 'new': return cmdNew(flags);
    case 'status': return runId ? cmdStatus(runId) : fail(1, 'required: <runId>');
    case 'next': return runId ? cmdNext(runId) : fail(1, 'required: <runId>');
    case 'submit': return runId ? cmdSubmit(runId, flags) : fail(1, 'required: <runId>');
    case 'approve': return runId ? cmdApprove(runId, flags) : fail(1, 'required: <runId>');
    case 'reject': return runId ? cmdReject(runId, flags) : fail(1, 'required: <runId>');
    case 'abort': return runId ? cmdAbort(runId, flags) : fail(1, 'required: <runId>');
    case 'list': return cmdList();
    default:
      fail(1, 'usage: graph-cli.js <new|status|next|submit|approve|reject|abort|list> — see scripts/graph/README.md');
  }
}

main();
