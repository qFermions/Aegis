# ADR-004 — Internal ticket graph: deterministic engine, model nodes

**Date:** 2026-08-05 · **Status:** Accepted · **Owner:** Aegis session (operator-directed)

## Context

Aegis is a single-brain agent whose safety contract (R0–R3, SR-1–SR-8, checkpoints,
retry limits, human gates) is enforced almost entirely by prompt. ADR-001 already
names the gap: classification and gating are "enforced by contract + measured by
probes… rather than by a deterministic interceptor."

We want an internal multi-agent execution graph (Router → Specialist → Builder →
Reviewer → Risk Finalizer → Human Gate → Verification → Jira output) so that one
IT ticket can be worked by specialized, isolated workers. The danger: every
context boundary between workers is a place where a prompt-enforced invariant
silently dies — hallucinated approvals, trust-laundered injected instructions,
multiplied retries, boolean "verified" claims.

Prior art in this tree:

- `identity-lifecycle-factory/` (ILF) — a working 5-agent challenge loop
  (SCOUT→ARCHITECT→BUILDER→AUDITOR→ADVERSARY→HUMAN) with typed JSON artifacts
  per edge, loop-limit 3 → DEADLOCK, a double-key commit gate
  (`--commit` + `ILF_ALLOW_COMMIT=1`), and evidence records in `runs/`.
- `.claude/commands/troubleshoot.md` — the live prose router (symptom → specialist command).
- `scripts/pre-commit-check.js` — the only deterministic content scanner.
- `.claude/agents/` — empty project-subagent socket.

## Decision

Build the graph as **a deterministic, zero-dependency Node engine that owns state,
edges, and gates** (`scripts/graph/`), with **native Claude Code subagents as the
node brains** (`.claude/agents/graph-*.md`), and the Aegis session as the driver
that shuttles artifacts between them.

- The engine is the referee: it validates every artifact against a schema,
  applies the transition table, keeps the retry ledger, computes effective risk
  as a **monotonic max**, and refuses to advance when a gate's preconditions are
  missing (empty `undo` on R1, no checkpoint file on R2+, no hash-bound approval
  on R3).
- Human approval is **state, not memory**: a single-use record bound to a SHA-256
  hash of the exact plan payload, created only by an explicit CLI invocation,
  invalidated by any plan change. No node can write it.
- Every artifact crossing an edge passes the sanitizer (tenant literals BLOCK,
  PII warn, injection markers flag) — the commit-time pattern set applied
  per-hop, because nothing else watches inter-agent messages.
- Builder and Reviewer are separate subagents with disjoint instructions;
  the Reviewer may not rewrite, only FAIL with `requiredFix` (ILF AUDITOR rule).
  Exactly one node (Scribe) owns final rendering (command-output-standard rules 8/10).
- Vocabulary is inherited, not invented: R0–R3 from CLAUDE.md/ADR-001, lane
  taxonomy from `troubleshoot.md`, artifact shapes from ILF `contracts/`.

Not chosen:

- **LangGraph / Agents SDK / any framework** — would introduce the repo's first
  `package.json` + lockfile against an explicit zero-dep convention, for
  primitives a few hundred lines of Node provide.
- **Native subagents alone (no engine)** — leaves routing, retries, and the human
  gate as prose; untestable, and exactly how invariants die across hops.
- **Standalone API-driven orchestrator** — needs an API key path that doesn't
  exist here, and re-implements tool access Claude Code already provides.

## Consequences

- Graph transitions become testable in CI (`node scripts/graph/graph.test.js`,
  zero-dep, same idiom as `jira-client.test.js`) and wireable into
  `release-gate.yml` without an install step.
- The dry-run default is preserved: `live` mode requires `AEGIS_GRAPH_ALLOW_LIVE=1`
  (ILF idiom); execution never happens in `dry-run`.
- Known residual risk (same class as `--no-verify`, single-operator trust model):
  the engine cannot cryptographically distinguish the operator's shell from an
  agent's shell when `approve` runs. The control is auditability (hash, timestamp,
  event log) plus the standing SR-2 prompt gate on the agent side.
- The internal Reviewer does **not** satisfy the independent-review requirement.
  Independent, out-of-session review of destructive plans (maker ≠ checker, fresh
  context) remains a separate, human-mediated step; the graph records
  `independentReviewRequired` in the work-up rather than absorbing the role.
- ILF remains a separate factory for identity lifecycle; the ticket graph
  generalizes its contract idioms but does not replace it.

## Canonical spec

`scripts/graph/README.md` — nodes, edges, state schema, invariants, CLI.
