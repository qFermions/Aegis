# Aegis — Project State (public release)

> Dev-facing state file. In a fresh deployment this records YOUR current status;
> the shipped release starts it minimal. Machine-checked snapshot convention:
> `tasks/continuity.md` + `node scripts/harness/check-continuity.js` (created
> after your first working session).

## Current shipped state

- **Version:** v8.9 (in review, batch G1, 2026-10-15) — the Google Workspace / Okta /
  Jamf / macOS lane with the same deterministic proof as the Microsoft lane: shell-lane
  safety gates with a plain-text gate analyzer, structure-lint G1 rules, tier/engine
  floors, scanner secret formats, a 38-ticket Google corpus on a shared evaluator, 19
  runbooks, `docs/gws-reversibility.md`, `docs/portal-nav-google-2026.md`
  (CHANGELOG v8.9; ledger section "Google Workspace / Okta / Jamf lane"). Pending: the
  operator's lab excerpts and the fresh-context rubric run on the Google corpus.
- **Previous:** v8.8-public — recruiter-grade proof pass on the v8.7 harness:
  claim→evidence ledger (`docs/evidence/`), GUI-first structure lint
  (`scripts/lint/`), Microsoft ticket eval (`scripts/eval/`), replay V2
  identity-variant keys + PII boundary (`scripts/replay/`), current Entra
  admin-center paths, Fable 5.1 single-model policy (`TEAM.md`).
- **Suites:** run `node --test` for the full battery; `EVALUATE.md` is the
  reviewer entry point (deterministic evidence first, then the red-team probes).

## Current work

Check `node scripts/dev/claim.js list` and `tasks/active/` — live truth for
in-flight development tasks.
