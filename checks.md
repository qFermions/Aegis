# checks: batch G3, production hardening of the Tier 1 help desk (advisory mode)

Branch `feat/g3-production-hardening` on qFermions/Aegis, base `main` at `f185071` (`git merge-base --is-ancestor f185071 origin/main` and `... 6f579cc origin/main`: both exit 0). Evidence files: `docs/aegis/g3/baseline/` (Phase 0, fresh clone of `f185071`) and `docs/aegis/g3/evidence/` (captures on the branch). Verdicts: pass, fail, unresolved. The previous batch's table is kept at `docs/review/batches/g2-checks.md`.

## Baseline (Phase 0, fresh clone of f185071, node v24.22.1, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone https://github.com/qFermions/Aegis`, then `git checkout --detach f185071` | exit 0, HEAD `f185071`; no `package.json`, no lockfile, nothing to install | `docs/aegis/g3/baseline/clone.txt` |
| tests | `node --test` | 1045 tests, 1045 pass, 0 fail, exit 0 | `docs/aegis/g3/baseline/node-test.txt:1204-1207` |
| own-harness suites inside `node --test` (each counts as 1 test there) | same run | deploy-check 21 passed (`:25`), health-check 19 passed (`:47`), graph 33/33 (`:763`), memory 14/14 (`:921`), replay 16/16 (`:1031`) | `docs/aegis/g3/baseline/node-test.txt` |
| Microsoft eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs, 7 floored, exit 0 | `docs/aegis/g3/baseline/ms-ticket-eval.txt:41` |
| Google eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs, 16 floored, exit 0 | `docs/aegis/g3/baseline/gws-ticket-eval.txt:54` |
| G2 eval | `node scripts/eval/g2-ticket-eval.js` | 63/63 tickets, 12/12 pairs, 33 floored; Fleet 13/13 3/3, Linear 11/11 2/2, Slack 14/14 3/3, Jamf 12/12 2/2, Google 13/13 2/2; exit 0 | `docs/aegis/g3/baseline/g2-ticket-eval.txt:82-89` |
| structure lint | `node scripts/lint/command-structure.js` | 102 commands, clean, exit 0 | `docs/aegis/g3/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/aegis/g3/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 486 files, 0 BLOCK, 197 WARN, exit 0 | `docs/aegis/g3/baseline/pre-commit-check-all.txt:3`, `:524` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g3/baseline/release-boundary-check.txt:3` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE (snapshot `b9acd99`, live `f185071`), exit 2 | `docs/aegis/g3/baseline/check-continuity.txt` |
| tools | `node --version`, `pwsh --version` | v24.22.1 (MIT), PowerShell 7.6.9 (MIT); nothing added to the repo | `docs/aegis/g3/baseline/dependencies.md` |

A first baseline clone placed under the system temporary folder failed 1 of 1045 (`scripts/adapters/linear-client.test.js:502`): the Linear note guard trusts the whole temporary folder, so a repo checked out inside it loses the "repo file outside `tasks/` is refused" rule (`docs/aegis/g3/baseline/node-test-clone-under-tmp.txt`). The clone above sits outside it. The guard is fixed in this batch (row "Fixed beyond the task").

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| D1 production-readiness gate | unresolved | not written yet | |
| D2 G2 close-out | unresolved | not started | |
| D3 guardrails | unresolved | not started | |
| D4 intake, corpus, failure handling | unresolved | not started | |
| D5 platform gaps | unresolved | not started | |
| D6 observability and validation | unresolved | not started | |
| D7 boundary audit, tiers, contract, state, explainer | unresolved | not started | |
| D8 review rounds, CI, refs | unresolved | not started | |
| D9 floors | unresolved | baseline recorded above | |
| D10 no secret, token, personal path or real name | unresolved | not run | |
| D11 no em-dash | unresolved | not run | |
| D12 no real system, no socket in tests | unresolved | not run | |
| D13 dependencies and tools | unresolved | `docs/aegis/g3/baseline/dependencies.md` | |
| D14 platforms proven separately | unresolved | not run | |
| D15 product boundary unchanged | unresolved | not run | |
