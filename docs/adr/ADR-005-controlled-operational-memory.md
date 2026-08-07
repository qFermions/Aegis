# ADR-005 — Controlled operational memory: promotion boundary, not an archive

**Date:** 2026-08-06 · **Status:** Accepted · **Owner:** Aegis session (operator-directed)

> **Amended by ADR-006 (2026-08-07):** lesson flow is now local-canonical (`tasks/lessons.md`);
> Koinon references below are historical. The command count cited below is also historical
> (the surface is 58 after the Hermes decoupling). The memory contract itself is unchanged.

## Context

Aegis should improve from real work without rereading run histories, without
saving every ticket forever, and without letting stale or injected content
silently steer future tickets. The viral pattern (dump transcripts to `raw/`,
distill to `wiki/`, add a vector DB and nightly agents) was explicitly rejected
as the starting point.

Repository inspection found the memory functions mostly already homed:

- **Canonical procedure** — `.claude/commands/` (65 runbooks), Koinon
  `shared/knowledge/troubleshooting/T-XX`, `modules/`; declared source of truth.
- **Operator-correction lessons** — `tasks/lessons.md` staging → PR into Koinon
  `shared/memory/lessons-*.md` (append-only, no IDs/status/provenance/index).
- **Case/episodic state** — `tasks/graph-runs/<runId>/state.json` (gitignored);
  the Failure Edge appends attempts in-run; runs never read each other.
- **Raw evidence** — graph artifacts with typed provenance
  (`operator_typed | agent_derived | external_content`), schema-enforced.
- **A pre-reserved home** — `.gitignore` already reserved `memory/*` under
  "Memory files with potential PII"; the directory had never been created.

What was missing: a durable store for reusable FACT/SKILL/CORRECTION/DECISION
knowledge with lifecycle state, provenance, dedup/conflict discipline, and
bounded just-in-time retrieval.

## Decision

Build **`scripts/memory/`** in the ATG idiom (ADR-004): a zero-dependency Node
store + CLI + adversarial black-box suite, with data in the pre-reserved,
gitignored **`memory/`** directory (org-internal knowledge never reaches the
public mirror).

- **Promotion boundary:** proposal → `candidate` → `verified`, gated by the
  graph sanitizer (tenant literals, credentials, PII, and injection markers
  all BLOCK at persist time), dedup (same claim merges provenance into one
  record), a conflict gate (same-topic verified records must be explicitly
  resolved with `--supersede` or `--distinct` — never silent, and a new claim
  is not true merely because it is newer), a trusted-provenance requirement
  (external content can support, never solely justify — SR-3), and a
  canonical-pointer existence check (runbooks are pointed to, never copied).
- **Forgetting engineered first:** supersession keeps the old record for audit
  while hiding it from retrieval; staleness is policy per volatility class
  (`vendor-ui` 90d · `vendor-mechanic` 180d · `engineering-invariant` 365d ·
  `org-procedure` event-driven) and surfaces only as a REVIEW-REQUIRED flag;
  `decline` makes deliberate non-retention a first-class auditable outcome.
- **One write path:** the CLI, serialized by an exclusive lock. Subagents are
  read-only, the graph engine has no reference to the store (tripwire-tested),
  and no hook/cron/automation writes in V1 — manual until proven.
- **Bounded lexical retrieval:** deterministic scoring over a small
  `index.json`, hard-capped top-5, superseded/rejected never surface. No
  embeddings at tens-of-records scale; revisit only if measurements prove
  lexical retrieval inadequate.
- **Instrumented write path:** `ledger.jsonl` records every considered
  candidate, verdict, and promotion evidence.

Not chosen:

- **A second wiki/truth store** — canonical runbooks stay canonical; memory
  points at them (`canonicalPointer`).
- **Vector DB / embeddings** — infrastructure without a measured need.
- **Extending Koinon lessons files** — Koinon is a shared, append-only,
  PR-gated cross-agent store with a "never delete" contract; it cannot carry
  lifecycle state or org-sensitive facts. The `tasks/lessons.md` → Koinon flow
  continues unchanged for operator corrections; memory may index those lessons.
- **Autonomous maintenance** (nightly ingestion, auto-pruning, scheduled
  audits) — deferred until the manual lifecycle repeatedly proves useful.

## Consequences

- Memory becomes testable: `node scripts/memory/memory.test.js` (M1–M12 —
  recall, injection resistance, dedup, contradiction, staleness, case-state
  isolation, sensitive-data refusal, pointer discipline, retrieval budget,
  supersession audit, deliberate forgetting). The graph suite (33) is
  untouched and stays green.
- Memory is a new trust boundary and is fail-closed: nothing in evidence text
  can promote itself; a wrong answer stored once cannot silently become a
  wrong answer on every future ticket (conflict gate + audit trail).
- Memory never bypasses R0–R3/SR-2: it informs plans; gates, checkpoints, and
  approvals are unchanged.
- Cost model: storage and retrieval are deterministic (zero model calls);
  candidate identification remains session judgment at the end of real work.

## Canonical spec

`scripts/memory/README.md` — classes, lifecycle, record schema, CLI, exit codes.
