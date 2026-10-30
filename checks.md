# checks: batch G3 close-out (owner decisions 1, 2, 3 and 5 from PR #6)

Branch `fix/g3-closeout` on qFermions/Aegis, base `main` at `01dcb37` (the merge of PR #6; `git branch -r --contains 01dcb37` and `--contains 355d28b` both list `origin/main`). Evidence files: `docs/aegis/g3-closeout/baseline/` (Phase 0, fresh clone of `01dcb37`) and `docs/aegis/g3-closeout/evidence/` (captures on the branch). Verdicts: pass, fail, unresolved. The previous batch's table is kept at `docs/review/batches/g3-checks.md`.

## Baseline (Phase 0, fresh clone of 01dcb37, node v24.22.2, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone <repo> <clone>`, then `git checkout --detach 01dcb37` (after `git fetch origin`) | HEAD `01dcb37`, clean; no `package.json`, no lockfile, nothing to install | `docs/aegis/g3-closeout/baseline/clone.txt` |
| tests | `node --test` | 1294 tests, 1294 pass, 0 fail, exit 0 | `docs/aegis/g3-closeout/baseline/node-test.txt:1454-1457` |
| own-harness suites inside `node --test` (each counts as 1 test there) | same run | deploy-check 21 passed (`:25`), health-check 19 passed (`:47`), graph 33/33 (`:946`), memory 14/14 (`:1147`), replay 16/16 (`:1261`) | `docs/aegis/g3-closeout/baseline/node-test.txt` |
| tests under the socket tripwire | `bash -c NODE_OPTIONS="--require <clone>/scripts/adapters/socket-tripwire.js" node --test` | 1294/1294, exit 0 | `docs/aegis/g3-closeout/baseline/node-test-under-tripwire.txt` |
| Microsoft eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs, exit 0 | `docs/aegis/g3-closeout/baseline/ms-ticket-eval.txt:41` |
| Google eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs, exit 0 | `docs/aegis/g3-closeout/baseline/gws-ticket-eval.txt:54` |
| G2 eval | `node scripts/eval/g2-ticket-eval.js` | 65/65 tickets, 13/13 pairs, exit 0 | `docs/aegis/g3-closeout/baseline/g2-ticket-eval.txt:85` |
| G3 eval | `node scripts/eval/g3-ticket-eval.js` | 44/44 tickets, 8/8 pairs, exit 0 | `docs/aegis/g3-closeout/baseline/g3-ticket-eval.txt:59` |
| structure lint | `node scripts/lint/command-structure.js` | 108 commands, clean, exit 0 | `docs/aegis/g3-closeout/baseline/command-structure-lint.txt:3` |
| replay demo | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/aegis/g3-closeout/baseline/replay-demo.txt:37` |
| scanner | `node scripts/pre-commit-check.js --all` | 679 files, 0 BLOCK, 207 WARN, exit 0 | `docs/aegis/g3-closeout/baseline/pre-commit-check-all.txt:3`, `:558`; `head-checks.txt:8` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g3-closeout/baseline/release-boundary-check.txt:3` |
| head checks | `bash docs/aegis/g3/evidence/tools/head-checks.sh 01dcb37` | evals as above; lint 108 clean; 0 BLOCK; PASS; CLAUDE.md 19202 bytes; boundary sentence present (1 at base, 1 here); SAFETY GATE markers 476 | `docs/aegis/g3-closeout/baseline/head-checks.txt` |
| safety gates and the G3 suites | `bash docs/aegis/g3/evidence/tools/suite-counts.sh` | command-safety-gates 474/474; every listed G3 suite passing (github 14, okta 28, msgraph 6, contract-g3 10, readonly-contract 23, audit-log 13, change-record 13, jira-client 65 and the rest) | `docs/aegis/g3-closeout/baseline/suite-counts.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE (snapshot `b9acd99`, live `01dcb37`), exit 2: it exits 2 whenever HEAD moves | `docs/aegis/g3-closeout/baseline/check-continuity.txt:14` |
| tools | `node --version`, `pwsh --version` | v24.22.2 (MIT), PowerShell 7.6.9 (MIT); nothing added to the repo | `docs/aegis/g3-closeout/baseline/dependencies.md` |
| refs before the first push | `git ls-remote origin` | 14 refs, `main` at `01dcb37` | `docs/aegis/g3-closeout/refs-before.txt` |

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| E1 read-backs bound to their change (owner decision 1) | unresolved | not built yet | |
| E2 a verify-* dry run exits 4 in every connector (owner decision 2) | unresolved | not built yet | |
| E3 GitHub rate-limit 403s are not permission refusals (owner decision 3) | unresolved | not built yet | |
| E4 connector variables in `.env.example` (owner decision 5) | unresolved | not built yet | |
| E5 floors | unresolved | not run yet | |
| E6 no secret, token, personal path, real name, internal hostname or private email | unresolved | not run yet | |
| E7 no em-dash in any file or added line this batch wrote | unresolved | not run yet | |
| E8 no real system, no socket in tests | unresolved | not run yet | |
| E9 dependencies and tools added | unresolved | not run yet | |
| E10 product boundary unchanged | unresolved | not run yet | |
| E11 CLAUDE.md size, contract, state and progress files | unresolved | not run yet | |
