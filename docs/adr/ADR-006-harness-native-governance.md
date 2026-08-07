# ADR-006 — Aegis is the harness: native governance and decoupling

Date: 2026-08-07 · Status: accepted (owner decision, recorded verbatim in intent)

## Context

A portfolio-surface audit (2026-08-07, four-worker read-only sweep) proved:
Aegis has **zero code-level runtime dependency** on the Koinon submodule, Metis,
Nova, or Hermes. All coupling was instruction-level (CLAUDE.md pointers) or
presentational (README/docs). A hiring manager reading the public repo concluded
Aegis was "one entangled stack" of six projects. The owner issued authoritative
architecture decisions; this ADR records them and the implementation.

## Decision — the product model

**AEGIS IS THE HARNESS.** The operator (an IT administrator, not a software
engineer) types a real ticket in plain English. The lead model (Fable-tier
orchestrator) operates *inside* Aegis and dynamically chooses the smallest
sufficient execution shape: deterministic replay → direct reasoning → specialist
agents → bounded loops → dependency graphs → controlled memory → independent
review → R0–R3 authorization → verification → documentation. Agents, loops,
graphs, memory, and safety are **first-class internal capabilities**, never
things the operator coordinates by hand.

## Decisions on historical coupling

1. **Koinon** — no presence gate (do not strengthen a historical dependency).
   Aegis natively owns the governance it needs to operate safely:
   `modules/security/security-doctrine.md` (SR-1…SR-8 + trusted-resource
   hierarchy) and `modules/security/placeholder-dictionary.md` (token authority).
   Koinon stays untouched as a **read-only historical source** until decoupling
   completes; it is no longer the runtime authority. T-XX diagnostic trees remain
   readable from `shared/` when present; their absence degrades gracefully.
2. **Metis** — no current Aegis purpose. Removed from the active product surface
   (lane tables, lesson routing). History preserved in git.
3. **Nova** — the *property* is kept, the brand is not: maker/worker ≠
   independent checker where independence is required. `novaReviewRequired` →
   `independentReviewRequired` (graph schema/engine/tests/role cards); prose
   genericized to "independent out-of-session plan review."
4. **Hermes/trading** — outside the IT-operations mission. The 7 bridge commands,
   3 skills, and integration docs left the product surface (archived locally
   under `local-aegis-upgrade-archive/hermes-decouple-2026-08-07/`, history in
   git). No IT capability was lost — no IT command called Hermes.
5. **aegisco / GameSwitch / client snapshots / personal scripts** — not Aegis.
   Excluded structurally: `.gitignore` release-boundary block +
   `scripts/harness/release-boundary-check.js` wired into `sync.bat` before
   `git add -A`. No new repository invented; relocation to existing homes
   (`qFermions/aegisco-space`, `qFermions/Aegis_D_Hermes`, client repo) is a
   separate operator-paced step.
6. **Public Aegis ships the real harness** — router/selector doctrine, controlled
   memory engine, replay cache engine, graph engine, loop contracts, R0–R3
   machinery, scanner/security gates, and their test suites. Private
   tickets/org data stay local (gitignored stores + boundary check). Public and
   private differ in *data*, never in core product behavior.

## Equivalence mapping (Koinon → native)

| Koinon source | Native Aegis authority |
|---|---|
| `shared/security/security-preamble.md` SR-1…SR-8, §4 | `modules/security/security-doctrine.md` (full restatement, generalized) |
| `shared/security/placeholder-dict.md` | `modules/security/placeholder-dictionary.md` (all org + generic tokens incl. post-dict additions) |
| `shared/memory/lessons-*.md` | `tasks/lessons.md` is the canonical Aegis lesson store; upstream promotion is optional |
| `shared/knowledge/troubleshooting/T-XX` | Not vendored (commands cover the ground procedurally); read from `shared/` opportunistically when present |

## Consequences

- A fresh clone without the submodule loses nothing required for safe operation.
- The silent-failure mode found by the audit (session-start pointing at missing
  files) is eliminated by repointing, not by gating.
- Koinon may later be fully detached (`.gitmodules` removal) once the owner
  confirms nothing else consumes it — deliberately NOT done in this phase.
