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
tenant literals, credentials, and PII from ever persisting. Injection markers
are also caught when obfuscated with zero-width characters, look-alike letters
or fullwidth forms (the edge sanitizer folds before matching;
`scripts/untrusted/poisoned-memory.test.js` B1). An org token from another
namespace than `[@Aegion_*]` is a second tenant and BLOCKs the same way
(`scripts/untrusted/wrong-customer.test.js` C3). Memory never
bypasses R0–R3: it informs plans; gates, checkpoints, and approvals are
unchanged.

## Integrity: only what the CLI wrote is served

Every `index.json` row carries a `seal`: sha256 over the canonical JSON of the
record file the CLI just wrote. `retrieve` serves a top-K hit only when its
row is exactly the row the CLI would write for the record on disk (seal
included) and the record still passes the persist gates (strict
`aegis.memory.v1` keys, the proposal field rules, the sanitizer, no `case`
scope, trusted provenance for `verified`/`stale`). Anything else (an index row
or record edited by hand, a hand-written record, an unsealed row) is listed
under `withheld: [{ id, reason }]` and never served; its stored text is not
printed. `show <id>` still prints the record for audit, labelled
`integrity: "intact"` or with the reason.

Every CLI write that leaves a record servable (`candidate`, `verified`,
`stale`) re-applies the same gates to the whole record first, so `verify`,
`merge` and `mark-stale` cannot re-seal a record that was changed on disk
(exit 3 / 4 / 2, `RESEAL_REFUSED` in the ledger). Writes to a terminal status
(`rejected`, `superseded`) are never blocked, so a bad record can always be
disposed of.

**Existing stores:** rows written before sealing carry no seal and are
withheld until an operator re-verifies them through the CLI (`verify <id>`;
`promote <id>` for candidates), which re-runs the gates and seals them.
Serving unsealed rows would make a hand-written row indistinguishable from
approved knowledge.

**Residual, stated plainly:** the seal is unkeyed (no secret exists to key
it), so a writer that replays this CLI's own write path can forge it. The
read-time gates hold even then: a forged record still cannot serve
instruction-shaped text, PII, a tenant literal, case state or external-only
"verified" knowledge. Pinned by `scripts/untrusted/poisoned-memory.test.js`
(B3 to B6).

## Read path (just-in-time, bounded)

```
node scripts/memory/memory-cli.js retrieve --query "<ticket keywords>"
```

Deterministic lexical scoring over `index.json` only; top-K (default 3, hard
cap 5); superseded/rejected never surface; candidates only with
`--include-candidates`. Only the top-K record files are opened (for provenance
refs and the integrity check above; a withheld hit is not back-filled). Recency is not relevance: there is no "recent memory" preload, and
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
