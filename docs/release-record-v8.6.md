# Release record — Aegis v8.6-public (2026-08-07)

| Field | Value |
|---|---|
| Private source HEAD | `35c6194` (qFermions/Aegis-private `main`) |
| Public parent HEAD | `dca3d90` (live lineage: `65deb9a` snapshot → `e74fe67` safety-gate hardening → `ee7eea6` printer-harness fix → `dca3d90` F1 fix) |
| Public release HEAD | this commit (child of `dca3d90` — no history replaced, no force push) |
| Validation | `node --test` 302/302 (Ubuntu/Windows CI matrix) · replay 8/8 · graph 33/33 · memory 14/14 · scanner `--all` keyless exit 0 · release-boundary PASS |

## What this release adds (from the private v8.6 line)

Harness identity (CLAUDE.md v8.6 + ADR-006), native governance
(`modules/security/security-doctrine.md`, `placeholder-dictionary.md`),
deterministic replay cache (`scripts/replay/`), graph engine + role cards
(`scripts/graph/`, `.claude/agents/`), controlled memory engine
(`scripts/memory/`), release boundary guard (`scripts/harness/`), rewritten
README/architecture on the one-product story.

## Preserved public-only changes (2026-07-13/14 lineage, kept intact)

- Hardened `pre-commit-check.js`, `jira-client.js`, `init-memory.js`,
  `security-audit.js`, `deploy-check.js`, `health-check.js` + their adversarial
  test suites, `command-policy` / `command-safety-gates` / `repository-structure`
  / `markdown-links` / plugin-layout regressions (the P1 hardening).
- The honest-claims corrections: R0–R3 documented as behavioral policy with an
  explicit enforcement-boundary statement; command risk metadata
  (`docs/security/COMMAND_RISK_METADATA.md`, `STATE_CHANGE_INVENTORY.json`);
  operator-only frontmatter; fence-ownership conventions (EVALUATE/README).
- Conflicting files resolved toward the safer/newer behavior: public versions
  kept for all hardened scripts and `jira-update`/`examples`/`ticket-examples`/
  `plan-mode-templates`/`EVALUATE`; private v8.6 versions kept for identity,
  governance, and decoupling content, with public conventions re-applied.

## Removed from the product surface (owner decision, ADR-006)

Hermes/trading bridge (7 commands, 3 skills, `hermes-bridge.ps1` + test,
integration docs) · Metis/Nova coupling (generic independent-review contract
instead) · codex-modes (separate agent's docs) · legacy YOUR-prefixed parallel
token set. The corresponding safety-gate manifest entries were regenerated via
the suite's own discovery printer; no check logic was weakened — feature
removal only. History preserves everything removed.

## Boundary

Private tickets, tenant values, operator/client data, and the private replay/
memory stores are excluded structurally (git-ignored stores + release-boundary
check + replay suite R8). Public and private differ in data, not behavior.
