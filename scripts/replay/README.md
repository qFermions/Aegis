# Aegis Replay Cache — deterministic fast path (V1)

Contract for `replay-cli.js`. Decision record: `docs/adr/ADR-006-harness-native-governance.md`.
Suite: `node scripts/replay/replay.test.js` (R1–R8).

## What it is

The cheapest rung of the execution-strategy ladder (`docs/harness.md`): a
previously **verified** ticket solution whose authority basis is unchanged is
replayed verbatim from local storage — no model reasoning, no agents, no loops,
no graph, no network. Determinism is the point: an exact duplicate is decided by
normalization + sha256 keying, never by an LLM.

## Lifecycle

```
record (candidate) ──verify --evidence──▶ verified ──lookup/render──▶ CACHE_HIT
                                             │ authority fingerprint changed
                                             ▼
                                           stale  (preserved as historical
                                                   evidence; live tickets route
                                                   through the adaptive path)
```

- **Only verified solutions replay.** Raw ticket text, guesses, draft agent
  output, and failed attempts are not authoritative memory (R2/R5).
- **Invalidation is fingerprint-based, never a time TTL.** Each verified case
  records sha256 fingerprints of the authority files it depends on; fingerprints
  are rechecked at lookup AND at render (time-of-use). A changed basis → STALE,
  served only with `--historical` under an explicit banner (R6). Unrelated
  changes do not invalidate (R7).
- **Sanitization at the persistence boundary:** secret-shaped content and the
  tenant literal are refused at `record` (exit 4) — private material cannot
  even enter the store (R8).
- **Aliases** are deterministic additional keys (`alias --case … --ticket …`)
  for known equivalent phrasings. No semantic-similarity model in V1 — adding a
  model call to save model calls is a non-goal.

## The honest token boundary

Measured, not asserted:

| Path | Ticket-solving model calls | Platform overhead |
|---|---|---|
| `node scripts/replay/replay-cli.js lookup/render` run directly (terminal, script, scheduled job) | **0** | **0** — no model anywhere in the process (R4 forbids network/subprocess capability in the CLI source) |
| `/onboard` (or any slash command) inside Claude Code | **0 on CACHE_HIT** — the model executes the lookup, then emits the stored solution verbatim; no re-derivation, no workers, no loops, no graph | 1 conversation turn — Claude Code necessarily sends the command through the model. This is platform overhead, not ticket reasoning, and is documented rather than hidden |

If zero total tokens matter, use the CLI directly — that is the supported,
tested, truly model-free path.

## Store & privacy boundary

Store: `memory/replay/` (git-ignored wholesale with the rest of `memory/`).
Public releases ship the **engine, the suite, and synthetic fixtures**
(`fixtures/onboard-demo.md`) — never real cases. Enforced by R8 +
`scripts/harness/release-boundary-check.js`.
