# Aegis — Project State (public release)

> Dev-facing state file. In a fresh deployment this records YOUR current status;
> the shipped release starts it minimal. Machine-checked snapshot convention:
> `tasks/continuity.md` + `node scripts/harness/check-continuity.js` (created
> after your first working session).

## Current shipped state

- **Version:** v8.7-public — advisory-only boundary (`PRODUCT_CONTRACT.md`),
  named dev plane (`TEAM.md`), multi-session coordination (`scripts/dev/`),
  tier lane (`scripts/tier/`), on the v8.6 harness (replay/graph/memory/R0-R3).
- **Suites:** run `node --test` for the full battery.

## Current work

Check `node scripts/dev/claim.js list` and `tasks/active/` — live truth for
in-flight development tasks.
