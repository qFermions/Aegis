# checks: batch 9 (safer messages, the missing admin steps, a clean way to try Aegis, then run it again)

Branch `feat/batch9-safety-and-gaps`, base main at `73bdc68`. Verdicts: pass, fail, unresolved. The batch 8 table is at `docs/review/batches/batch8-checks.md` (and its progress at `batch8-progress.md`). Local paths in captures are written `<home>`, `<repo>` and `<tmp>`; each long dash in a capture is written `-`.

This Mac has no `pwsh`, so 41 tests in `scripts/command-safety-gates.test.js` fail here at the base and the head; CI has `pwsh` and runs them. The battery runs with `TMPDIR=/private/tmp` (`docs/aegis/demo/evidence/batch9/tools/battery.sh`).

(Filled in as the batch goes; see the sections below.)
