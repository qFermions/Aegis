# Review rounds, batch G2

Each finding with what closed it: the commit that fixed it (each carries a test or a check) or a one-line reason. Findings are from `/code-review` at xhigh on this branch; round 1 reviewed the PR at `35b0415`, round 2 the diff `35b0415..ada5339`, round 3 the diff `ada5339..44031dc`. `/security-review` ran before round 1: no findings (`security-review.md`).

## Round 1 (15 findings)

| # | Finding (file:line at review) | Closed by |
|---|---|---|
| 1 | Fleet floors need the bare word fleet, so fleetctl and FleetDM miss (`scripts/tier/tier-guard.js:77`) | `dae91cd` |
| 2 | Slack and Linear offboarding wordings get no floor (`tier-guard.js:88`) | `dae91cd` |
| 3 | A bare carriage return does not end a GraphQL comment (`scripts/adapters/readonly-contract.js:139`) | `b69c918` |
| 4 | Slack user reads quote personal text in flags (`scripts/adapters/slack-client.js:538`) | `b81b158` |
| 5 | A timed-out request is not cancelled (`readonly-contract.js:403`) | `5a4160e` |
| 6 | An oversized body is retried as a network error (`readonly-contract.js:387`) | `e5b6c23` |
| 7 | G2 floors match Microsoft and G1 wordings (`tier-guard.js:81`) | `dae91cd` (with 1 and 2 in one commit: deviation, see round 2 finding 13) |
| 8 | A short token lifetime is kept for 300 s (`readonly-contract.js:485`) | `02a1d60` |
| 9 | Two Jamf boundary fixtures send nothing (`scripts/g2-boundary.test.js:77`) | `e7e0569` |
| 10 | get() and plan() refuse a parameter that needs encoding (`readonly-contract.js:539`) | `7cff8a3`, comment `c37a97c` |
| 11 | Google user reads print personal fields (`scripts/adapters/gws-client.js:553`) | `98eeaeb` |
| 12 | --not-before accepts impossible dates in three adapters (`scripts/adapters/jamf-client.js:346`) | `49717c3` |
| 13 | Fleet and Slack SCIM DELETE patterns miss `--request DELETE` (`scripts/pre-commit-check.js:117`) | `e3fb53b`; the same gap in the batch 1 Okta and Jamf patterns `b818bdf`. The multi-line Linear mutation part is closed: the scanner reads one line at a time by design. |
| 14 | progress.md not rewritten (`progress.md:8`) | `ada5339` |
| 15 | An evidence capture holds an absolute host path (`docs/aegis/g2/evidence/gws-posture-preview.txt:172`) | `0e84dfd` |

## Batch 1 findings from the misdirected first run (PR #4's diff, 15 findings)

Fixed because this batch edits the file: 5 (`tier-guard.js:138`, a second org name inside the own namespace or after a dot) `8575df0`, `e050d78`; 9 (`tier-guard.js:146`, chat handles read as a second tenant) `0995f92`, reversed to fail safe by `47425c3`, refusal note `80ef80d`, `ab89a1b`; 13 (`docs/aegis/capability-map.md:69`, stale CLAUDE.md citations) `540ff8c`; 15 (`scripts/pre-commit-check.js:204`, own marker list) `5629f57`. The other 11 are in files this batch does not edit (`scripts/graph/sanitize.js`, `scripts/replay/replay-cli.js`, `scripts/memory/memory-cli.js`, `scripts/jira-client.js`, `docs/review/incidents.md`) and are listed in the report with a proposed fix.

## Round 2 (15 findings)

| # | Finding (file:line at review) | Closed by |
|---|---|---|
| 1 | The unenroll anchor drops Intune, tablet, workstation and LT-/DT- wordings (`tier-guard.js:77`) | `ef782a5`; Intune word removed again in round 3 `b7cfc05` |
| 2 | No floor catches a mass Exchange purge (`tier-guard.js:91`) | `3aa4aef`; made linear in round 3 `6532359` |
| 3 | verify-app-approved quotes a requester name (`slack-client.js:660`) | `1459763` |
| 4 | Slack personal text outside user reads is quoted (`slack-client.js:511`) | `d7fc558`; replaced by an allow-list in round 3 `af7a655` |
| 5 | The Linear issue key matches Office-365 under /i (`tier-guard.js:83`) | `cecacc9`; replaced in round 3 `7fc2e6b` |
| 6 | Google aliases print in full (`gws-client.js:554`) | `b96a887`, fixture `0ef9cde` |
| 7 | The lower-case handle exemption removes detection of lower-case foreign tokens (`tier-guard.js:188`) | `47425c3` (fail safe) |
| 8 | The tenant-literal BLOCK does not fold (`pre-commit-check.js:420`) | `ada71f0` |
| 9 | Google accepts hour 24; Slack keeps its own calendar copy (`gws-client.js:346`) | `fe2a78e` |
| 10 | Sign-out everywhere allows one word only (`tier-guard.js:94`) | `0ecf5b8`; tightened in round 3 `872b316` |
| 11 | PowerShell -Method spellings do not warn (`pre-commit-check.js:107`) | `273d076` |
| 12 | Altitude: quote withholding is patched per adapter path (`slack-client.js:507`) | Closed: each adapter now has one rule on every flag path (Jamf scans stripped data, Fleet scans what it prints, Linear queries only printed fields, Google shares one helper, Slack routes both flag sites through one allow-list `af7a655`); documented in `scripts/adapters/README.md` (`a4a0756`). A contract-wide predicate would change all five adapters' flag output with no leak path left. |
| 13 | Round 1 findings 1, 2 and 7 share one commit (`progress.md:5`) | Closed: `dae91cd` was pushed before the review; splitting it would rewrite pushed history, which the owner ruled out; recorded as a deviation. |
| 14 | Fleet says "wrong format" for an impossible date (`fleet-client.js:466`) | `6d268fa` |
| 15 | The deadline test can hang CI (`readonly-contract.test.js:476`) | `5732ffd` |

## Round 3 (15 findings, the last round)

| # | Finding (file:line at review) | Closed by |
|---|---|---|
| 1 | A lower-case Linear key no longer floors (`tier-guard.js:85`) | `7fc2e6b` (with 6: one class) |
| 2 | The refusal hint tells how to get past the gate (`scripts/graph/sanitize.js:115`) | `855a820`, then `80ef80d` and `ab89a1b` (note moved to the graph engine; sanitize.js and replay-cli.js back to base) |
| 3 | The purge floor backtracks in cubic time (`tier-guard.js:51`) | `6532359` (4.8 s to 34 ms at 10 KB) |
| 4 | A disguised tenant literal in a file path is printed (`pre-commit-check.js:323`) | `87ac665` |
| 5 | Sign-out everywhere floors symptom reports (`tier-guard.js:96`) | `872b316` |
| 6 | (?-i:) needs Node 23; a Node 22 hook fails to load (`tier-guard.js:85`) | `7fc2e6b` |
| 7 | Google and Linear call an impossible date a format error (`gws-client.js:394`) | `168eead` |
| 8 | A Slack denylist misses attachment authors (`slack-client.js:496`) | `af7a655` (per-route allow-list) |
| 9 | Shortened -Method and splatted Method keys do not warn (`pre-commit-check.js:107`) | `8585100` |
| 10 | The word Intune floors a course unenroll (`tier-guard.js:79`) | `b7cfc05` |
| 11 | progress.md is stale (`progress.md:7`) | The progress.md rewrite committed with this file |
| 12 | Each line is folded twice (`pre-commit-check.js:437`) | `5a1c13f` |
| 13 | The method fragment is copied eight times (`pre-commit-check.js:110`) | `773ed6e` |
| 14 | Dead capture groups in Slack ISO_TIME (`slack-client.js:215`) | `0a3e006` (the 1 to 3 fraction digits are kept on purpose) |
| 15 | Altitude: the guard and engine floors are hand-mirrored (`scripts/graph/engine.js:36`) | `2e80705`: a test pins every G2 pair by pattern source. A shared source module is closed: the engine keeps its own copy on purpose ("the fortress never imports the lane", `engine.js` comment). |

No finding is open. The round 3 fixes had no fourth review round (the charter allows three); each rests on its own test and on the battery at `cef6cee` (`node-test.txt`, `head-suite-counts.txt`).
