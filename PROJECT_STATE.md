# Aegis — Project State (public release)

> Dev-facing state file. In a fresh deployment this records YOUR current status;
> the shipped release starts it minimal. Machine-checked snapshot convention:
> `tasks/continuity.md` + `node scripts/harness/check-continuity.js` (created
> after your first working session).

## Current shipped state

- **Version:** v8.8-public — recruiter-grade proof pass on the v8.7 harness:
  claim→evidence ledger (`docs/evidence/`), GUI-first structure lint
  (`scripts/lint/`), Microsoft ticket eval (`scripts/eval/`), replay V2
  identity-variant keys + PII boundary (`scripts/replay/`), current Entra
  admin-center paths, Fable 5.1 single-model policy (`TEAM.md`).
- **Suites:** run `node --test` for the full battery; `EVALUATE.md` is the
  reviewer entry point (deterministic evidence first, then the red-team probes).

## Current work

Check `node scripts/dev/claim.js list` and `tasks/active/` — live truth for
in-flight development tasks.
