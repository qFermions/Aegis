# Code review rounds (batch G3, `/code-review xhigh`, tier C)

REVIEW.md was read before each round. Round 1 reviewed the branch against `main` (`f185071..c1e60ec`); rounds 2 and 3 review only the diff added after the round before. Each finding is fixed in its own commit (a red test first where code changes) or closed with a one-line reason here and in `checks.md`.

## Round 1 (`f185071..c1e60ec`): 15 found

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `scripts/tier/tier-routing.test.js:687` | the Google 2-Step floor's engine twin was skipped silently after the guard label changed | fixed: each case now requires its engine twin, the one guard-only case is named | `4111d7f` (red), `10f2383` |
| 2 | `docs/aegis/boundary-audit.md:71` | a change record could be closed by a verified read-back of any connector or command | fixed: `open` names the proving read-back, `link` refuses any other kind, `status` counts only a match; row 37 reworded | `73d02d9` (red), `6e3b748`, `91aaf0a` |
| 3 | `docs/aegis/capability-map.md:93` | row 59 and the counts still called the `/gws-audit-log` gap open after `babc6d0` closed it | fixed: row 59 verified now with this batch's captures; counts, drift bullet and PROJECT_STATE.md updated | `23b9a8f` |
| 4 | `PROJECT_STATE.md:159` | PRs #4 and #5 were called open drafts; both were merged on 2026-10-28 | fixed | `95b3b13` |
| 5 | `PROJECT_STATE.md:37` | a capability-map citation pointed at a moved line | fixed | `6b1944f` |
| 6 | `PROJECT_STATE.md:98` | the suite-count capture was older than the head it claimed | fixed: every cited capture re-run at a clean committed head | `a558bc4`, `6eebc30` |
| 7 | `docs/aegis/capability-map.md:73` | citations that did not show the claimed per-file split or pair count | fixed: the inventory capture prints the split per file and mode; citations corrected | `a558bc4`, `6eebc30` |
| 8 | `docs/explainers/g3-production-hardening.md:25` | "under 1 ms per ticket" while the slowest ticket took 1.04 ms, and no process-start cost | fixed | `480524b` |
| 9 | `scripts/adapters/README.md:20` | header, tenant and scope rules still described G2 only | fixed | `d41ad2e` |
| 10 | `docs/aegis/boundary-audit.md:68` | rows 34 and 38 left out an audit-trail append and a temporary folder | fixed | `34d0ea0` |
| 11 | `scripts/tier/tier-guard.js:102` | guard and engine twins carried different labels | fixed: the engine label matches | `10f2383` |
| 12 | `scripts/eval/g3-ticket-eval.js:152` | the report title was a hand-kept list | fixed: built from `GROUP_NAMES`, one per `MINIMUMS` entry | `d5986ff` (red), `12c30d6` |
| 13 | `scripts/tier/tier-routing.test.js:687` | the label rewrite weakened the check (the engine half dropped) | fixed by findings 1 and 11: the engine half is required again and passes on the renamed twin | `4111d7f`, `10f2383` |
| 14 | `progress.md:7` | progress.md and checks.md were stale | fixed | `c340290` |
| 15 | `docs/aegis/g3/evidence/t7-head-suite-counts.txt:1` | captures ran scripts that were not checked in, some with uncommitted changes | fixed: the tools are checked in (`docs/aegis/g3/evidence/tools/`) and every cited capture re-run at a clean head with them | `101e9ac`, `a558bc4`, `6eebc30` |

Round 1: 15 found, 15 fixed, 0 closed.

## CI failure handled during the rounds

Release Gate windows-latest failed at `96564ea` (job 122725205776): in the audit trail's concurrent-writer test a writer died with `EPERM` opening `audit.lock`, which Windows reports while another writer is deleting the file. Later heads passed by timing; the race was real. Fixed test first: `bc351a8` (red: EPERM and EACCES on the lock open mean wait, on Windows), `ebb8cc1`.
