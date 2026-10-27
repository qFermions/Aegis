# checks: batch G2, Google Workspace, Fleet, Jamf, Slack and Linear

Branch `feat/g2-gws-fleet-jamf-slack-linear` on qFermions/Aegis, stacked on draft PR #4 (`chore/baseline-and-boundary`, head `3592bd1`; PR #4 was not merged when this batch started: `git merge-base --is-ancestor 3592bd1 origin/main` exit 1). Evidence files: `docs/aegis/g2/baseline/` (Phase 0, fresh clone of `3592bd1`) and `docs/aegis/g2/` (captures on the branch). Verdicts: pass, fail, unresolved. The previous batch's table is kept at `docs/review/batches/batch1-checks.md`.

## Baseline (Phase 0, fresh clone of 3592bd1, node v24.22.1, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone https://github.com/qFermions/Aegis fresh`, then `git checkout --detach 3592bd1` | exit 0, HEAD `3592bd1`; no `package.json`, no lockfile, nothing to install | `docs/aegis/g2/baseline/clone.txt` |
| tests | `node --test` | 588 tests, 588 pass, 0 fail, exit 0 | `docs/aegis/g2/baseline/node-test.txt:747-750` |
| own-harness suites inside `node --test` (each counts as 1 test there) | same run | deploy-check 21 passed (`:25`), health-check 19 passed (`:47`), graph 33/33 (`:391`), memory 14/14 (`:519`), replay 16/16 (`:616`) | `docs/aegis/g2/baseline/node-test.txt` |
| Microsoft eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs, 7 floored, exit 0 | `docs/aegis/g2/baseline/ms-ticket-eval.txt` |
| Google eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs, 16 floored, exit 0 | `docs/aegis/g2/baseline/gws-ticket-eval.txt` |
| structure lint | `node scripts/lint/command-structure.js` | 77 commands (A 36, B 19, C 11, D 3, E 6, alias 2), clean, exit 0 | `docs/aegis/g2/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/aegis/g2/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 360 files, 0 BLOCK, 170 WARN, exit 0 | `docs/aegis/g2/baseline/pre-commit-check-all.txt` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g2/baseline/release-boundary-check.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE, exit 2 (snapshot HEAD `b9acd99`, live `3592bd1`) | `docs/aegis/g2/baseline/check-continuity.txt` |
| CLAUDE.md size | `wc -c CLAUDE.md` | 19041 bytes | this session, at `3592bd1` |

Floors from PR #4's head match on every row: 588 tests, 28/28 and 6/6, 38/38 and 9/9, 77 clean, 0 BLOCK, PASS. No gap. Captures carry U+2014 from tool output as "--" and say so on their last line.

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| C1 lane spec | unresolved | not yet written | |
| C2 corpus first, scorer in `node --test` and CI | unresolved | not yet written | |
| C3 shared read-only adapter contract | unresolved | not yet written | |
| C4 per platform (Fleet, Linear, Slack, Jamf, Google Workspace) | unresolved | not yet written | |
| C5 Google Workspace posture audit | unresolved | not yet written | |
| C6 boundary audit and tiers | unresolved | not yet written | |
| C7 state, contract and explainer | unresolved | not yet written | |
| C8 review rounds, CI, refs | unresolved | not yet written | |
| C9 floors | unresolved | not yet written | |
| C10 no secret, token, personal path, real name or private email | unresolved | not yet written | |
| C11 no em-dash in files this batch wrote | unresolved | not yet written | |
| C12 no real customer system called, no socket in tests | unresolved | not yet written | |
| C13 dependencies and tools added | unresolved | `docs/aegis/g2/baseline/dependencies.md` (Node.js 24.22.1 MIT, PowerShell 7.6.9 MIT; nothing in the repo) | |
| C14 platforms proven separately | unresolved | not yet written | |
