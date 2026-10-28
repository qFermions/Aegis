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
| C1 lane spec | pass | `docs/aegis/g2/evidence/c1-lane-spec-check.txt` (script inside): Fleet 6 jobs, Linear 8, Slack 8, Jamf 7, Google 10, each naming file:line or a gap, none naming another platform's command; dated vendor sources Fleet 9, Linear 3, Slack 4, Jamf 4, Google 6; read-only API surface per platform at `docs/aegis/lanes/g2.md:47`, `:99`, `:143`, `:200`, `:252` | |
| C2 corpus first, scorer in `node --test` and CI | pass | `docs/aegis/g2/evidence/c2-corpus-first.txt`: `g2-tickets.json` lands in `554aa42`, an ancestor of the first command, adapter or floor commit `951309d`; scorer 9/9 in `node --test`, `.github/workflows/ci.yml:149`; per-platform and pair counts printed (Fleet 13/13 3/3, Linear 11/11 2/2, Slack 14/14 3/3, Jamf 12/12 2/2, Google 13/13 2/2) | Deviation: the five runbook test files (`*-runbooks.test.js`) landed after their runbooks; every adapter, contract, posture and boundary test file landed first (same capture) |
| C3 shared read-only adapter contract | pass | `docs/aegis/g2/evidence/contract-tests.txt` (23/23 at `7cf42e2`); red first: `c3-contract-tests-before-module.txt`. Rule to test in `scripts/adapters/readonly-contract.test.js`: every non-GET method `:143`; a mutation hidden after a query `:218`, `:438`; a token exchange with a business payload `:251`; a credential in an error `:292`; an injected instruction in a response field `:325`; a mixed-tenant response `:342`; a timeout `:364`, `:473`; a retry never repeats a non-read `:397` | |
| C4 per platform (Fleet, Linear, Slack, Jamf, Google Workspace) | pass | Lint 102 commands clean, 25 new (Fleet 5, Linear 4, Slack 6, Jamf 5, Google 5): `command-structure-lint.txt`; safety gates 433/433 cover the new commands, 177 G2 inventory entries (142 gated, 35 preview): `head-suite-counts.txt`, `docs/security/STATE_CHANGE_INVENTORY.json`; adapter and runbook tests with the socket tripwire: Fleet 44/44, Linear 33/33, Slack 46/46, Jamf 33/33, Google 39/39 (`head-suite-counts.txt`; landing captures `*-adapter-tests.txt`); corpus per platform with floors and pairs: `c14-platform-rows.txt`, `g2-eval-after-*.txt` | |
| C5 Google Workspace posture audit | pass | `scripts/gws-posture-audit.test.js` 12/12 (`gws-posture-tests.txt`, `head-suite-counts.txt`): each check's output `:180`, an empty export `:300`, a malformed export `:316`, an injected instruction `:373` | |
| C6 boundary audit and tiers | pass | 0 G2 inventory entries outside gated or preview (the file has only those two modes; 177 G2 entries); boundary-audit rows 20 to 27 each name the gate (`docs/aegis/boundary-audit.md:45-52`); risk-tier tests 22/22 (`risk-tier-tests.txt`); no-autonomous-write test 13/13 (`boundary-g2-tests.txt`) | |
| C7 state, contract and explainer | pass | Each "verified" G2 row cites a capture taken in this session under `docs/aegis/g2/evidence/`; head counts in `head-suite-counts.txt`; `wc -c CLAUDE.md` 19202 (19041 at base; one pointer line added) | Stale line references fixed after the review rounds: `7529981`, `4c8936e`, `8d927b0`, `f5c9241` |
| C8 review rounds, CI, refs | unresolved | No finding open: `docs/aegis/g2/evidence/code-review-rounds.md`, `security-review.md`. CI and Release Gate at the head and `git ls-remote` against `docs/aegis/g2/refs-before.txt` not yet checked | Run after the last push |
| C9 floors | pass | `c9-test-count.txt`: `node --test` 1041/1041 = 588 + 453 added, 0 base tests removed or renamed; own-harness suites unchanged (deploy-check 21, health-check 19, graph 33/33, memory 14/14, replay 16/16); ms 28/28 6/6 and gws 38/38 9/9 unchanged (`ms-ticket-eval.txt`, `gws-ticket-eval.txt`); G2 63/63 12/12; lint 102 clean; scanner 0 BLOCK; release boundary PASS; replay demo exit 0 (battery at `cef6cee`) | Scanner WARN 170 at base, 197 at head: G2 runbooks, tests and corpus add 12; the shared injection markers (`5629f57`) add 15, all fixtures and quoted examples (`scanner-marker-warn-diff.txt`). A WARN count is not a pass count, so no floor regressed |
| C10 no secret, token, personal path, real name or private email | pass | `docs/aegis/g2/evidence/c10-leak-grep.txt`: the charter grep's 2182 lines grouped by class; 0 real credential shapes (Slack xox and xapp, Linear lin_api and lin_oauth, Google key, AIza and ya29, GitHub, AWS, JWT, bearer); the 61 long strings are 14 digests, 48 paths and 4 cmdlet names; every literal value on a secret-like name is a fixture | The capture is named `c10-leak-grep.txt` because `.gitignore` excludes file names with secret, credential or password |
| C11 no em-dash in files this batch wrote | pass | `docs/aegis/g2/evidence/c11-em-dash.txt`: 0 added lines with U+2014 since `3592bd1`; 0 of 116 new files hold one; 57 of 59 captures say they write it as "--" and the other 2 hold none | `ab89a1b`: the intake refusal line kept exactly as at base, so no added line carries its U+2014 |
| C12 no real customer system called, no socket in tests | pass | `docs/aegis/g2/evidence/c12-network.txt`: network modules in non-test code are the contract transport and `scripts/jira-client.js`; every G2 test file loads `scripts/adapters/socket-tripwire.js`; mocks `queuedTransport` (contract and five adapter tests), `recordingTransport` (boundary test), `fakeRequest` (transport tests); fixtures `scripts/eval/g2-tickets.json`, the GAM exports in `scripts/gws-posture-audit.test.js`, a temporary note file, a key generated by `node:crypto`; tripwire tests 10/10. This session called no Google, Fleet, Jamf, Slack or Linear system | |
| C13 dependencies and tools added | pass | `docs/aegis/g2/evidence/c13-dependencies.txt`: no manifest, lockfile or package added; no require() beyond Node built-ins and repo files; tools Node.js v24.22.1 (MIT) and PowerShell 7.6.9 (MIT), both already installed (`docs/aegis/g2/baseline/dependencies.md`) | |
| C14 platforms proven separately | pass | `docs/aegis/g2/evidence/c14-platform-rows.txt`: the 28 capability-map rows added or changed (12, 14, 37 to 62) each name one platform, none names two; per-platform corpus lines; the report lists each platform on its own line | |

## Review rounds

| round | scope | findings | outcome | evidence |
|---|---|---|---|---|
| /security-review | branch at `35b0415` against `3592bd1` | 0 (one below-bar observation) | observation fixed: `b497ce7` (red), `a7fab15` | `docs/aegis/g2/evidence/security-review.md` |
| /code-review 1 (xhigh) | PR #5 at `35b0415` | 15 | 15 fixed (part of 13 closed: the scanner reads one line at a time by design); findings 1, 2 and 7 in one commit (deviation) | `docs/aegis/g2/evidence/code-review-rounds.md` |
| batch 1 findings (misdirected first run on PR #4's diff) | files this batch edits | 15 | 4 fixed (`8575df0`, `0995f92` then `47425c3`, `540ff8c`, `5629f57`); 11 in unedited files, in the report | same file |
| /code-review 2 (xhigh) | `35b0415..ada5339` | 15 | 13 fixed, 2 closed with a reason (altitude, already-pushed commit) | same file |
| /code-review 3 (xhigh, last) | `ada5339..44031dc` | 15 | 15 fixed (6 with 1 in one commit, one class; 11 by the progress.md rewrite) | same file |
| evidence-reviewer | | | not yet run | |
