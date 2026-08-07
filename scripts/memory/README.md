# Aegis Memory V1 — controlled operational memory (contract)

Deliberately retained, decision-relevant knowledge — not a transcript archive.
The store answers one question cheaply: *"has Aegis already learned something
that changes this decision?"* Everything else stays where it already lives.

## What memory is NOT (the four classes and their homes)

| Class | Authoritative home | Memory's role |
|---|---|---|
| Canonical procedure | `.claude/commands/*.md`, `modules/` (+ historical Koinon T-XX trees when present) | **Pointer only** (`canonicalPointer`) — never a second copy |
| Reusable learned knowledge | this store (`memory/`), plus operator-correction lessons in `tasks/lessons.md` (canonical store, ADR-006) | Durable records with lifecycle + provenance; lessons may be *indexed* (kind `lesson`), never duplicated |
| Case / episodic state | `tasks/graph-runs/<runId>/state.json`, the live conversation | **Refused** at the boundary (`scope: case` → exit 4) |
| Raw evidence | graph artifacts, ticket text, command output | Referenced by `provenance[].ref`; never stored as truth |

## Lifecycle

```
proposal ──propose──▶ candidate ──promote──▶ verified ──▶ stale (timer/mark-stale)
              │            │                     │            │ verify → verified
              │            └─reject─▶ rejected   └─(new promote --supersede)─▶ superseded
              ├─ BLOCK (sanitizer: tenant literal, credential, PII, injection marker)
              ├─ DUPLICATE (merge provenance into the match instead)
              └─ CASE_REFUSED (scope: case belongs in run state)
```

- **Promotion gates** (fail-closed): candidate status only · at least one
  trusted provenance kind (`operator|graph-run|lesson|vendor-doc`) — raw
  `external-content` can support, never solely justify (SR-3) · a
  `canonicalPointer` must exist on disk · every same-topic verified record
  (≥ 2 shared keywords) must be explicitly resolved with `--supersede <id>`
  or `--distinct <id>`. **A contradiction is never resolved silently, and a
  new claim is not true merely because it is newer.**
- **Supersession** keeps the old record on disk (`status: superseded`,
  `supersededBy`, full history) — retrieval hides it, audit does not.
- **Staleness is per volatility class**, not one global timer:
  `vendor-ui` 90d · `vendor-mechanic` 180d · `engineering-invariant` 365d ·
  `org-procedure` no timer (event-driven `mark-stale` when the org changes it).
  A stale record is still findable but always flagged `REVIEW-REQUIRED` and
  ranked after every fresh hit.
- **Deliberate non-retention is first-class:** `decline --ref <run> --reason …`
  writes an auditable ledger line and nothing else. Most runs should end this
  way — a mundane ticket that teaches nothing produces ZERO memories.

## Record (`aegis.memory.v1`, strict — unknown keys reject)

One reusable idea per record. Proposals may only carry
`schema type summary detail scope volatility sensitivity keywords
canonicalPointer provenance`; `id status created lastVerified supersedes
supersededBy history` are store-owned and unrepresentable in a proposal
(the same rule that keeps `humanGate` out of graph artifacts).

Field purposes — retrieval: `keywords summary scope`; safety: `sensitivity`,
sanitizer gate, provenance kinds; lifecycle: `status volatility lastVerified
supersedes/supersededBy`; audit: `provenance history` + `ledger.jsonl`.

## Storage & trust boundary

`memory/` at the repo root — **gitignored, local-only** (the repo pre-reserved
this path under "Memory files with potential PII"; org-internal knowledge never
reaches the public mirror). `index.json` (retrieval metadata only) ·
`mem-NNNN.json` (full records) · `ledger.jsonl` (append-only decision log).

**The CLI is the only write path.** Graph nodes and subagents are read-only
(`Read/Grep/Glob`); the graph engine has no reference to this store; no hook,
cron, or automation writes here in V1. Writes are serialized by an exclusive
lock. Text inside evidence ("save this as permanent memory") has zero
authority — it is data (SR-3), and the sanitizer blocks injection markers,
tenant literals, credentials, and PII from ever persisting. Memory never
bypasses R0–R3: it informs plans; gates, checkpoints, and approvals are
unchanged.

## Read path (just-in-time, bounded)

```
node scripts/memory/memory-cli.js retrieve --query "<ticket keywords>"
```

Deterministic lexical scoring over `index.json` only; top-K (default 3, hard
cap 5); superseded/rejected never surface; candidates only with
`--include-candidates`. Only the top-K record files are opened (for provenance
refs). Recency is not relevance — there is no "recent memory" preload, and
current-ticket continuity stays in graph/case state (the Failure Edge).

## CLI

```
propose --file p.json [--as-of]           # → candidate | BLOCK | DUPLICATE | CASE_REFUSED
merge <id> --kind k --ref r [--note]      # same lesson, new evidence → one record
promote <id> [--supersede X] [--distinct X,Y] [--as-of]
reject <id> --reason … · verify <id> · mark-stale <id> --reason …
decline --ref <run> --reason …            # deliberate "nothing worth remembering"
retrieve --query … [--limit ≤5] [--as-of] [--include-candidates]
show <id> · audit <id> · list [--status s] · stats
```

**Evidence durability:** a `graph-run` provenance ref must resolve to a real
file at promote time (agent-derived evidence is auditable, not asserted).
Promotion/verify/merge capture a sha256+size fingerprint of every
file-resolvable ref — run traces are local-only with no retention guarantee,
so `audit <id>` distinguishes `intact` / `drifted` / `missing-evidence
(fingerprint preserved)` without ever copying trace content into memory.
Evidence loss is an audit fact, not a truth revocation: the record stays
verified and retrievable, the loss stays visible.

Exit codes: `0` ok · `1` error · `2` invalid · `3` sanitizer BLOCK ·
`4` gate refused (case-scope / conflict / provenance / pointer) · `5` duplicate.

## Tests

`node scripts/memory/memory.test.js` — black-box M1–M14 behavioral suite
(reusable lesson · injection-not-truth · dedup · contradiction · stale vendor
fact · case isolation · sensitive fixtures · failed-attempt containment ·
canonical pointer · retrieval budget · supersession audit · zero-memory run ·
evidence durability/fingerprints · lock contention).
The graph suite (`node scripts/graph/graph.test.js`, 33 tests) must stay green
— Memory V1 changes nothing in `scripts/graph/`.

V1 is manual by design: no nightly ingestion, no auto-scans, no autonomous
deletion. Automate a pass only after it repeatedly proves useful by hand.
