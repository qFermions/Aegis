# Code review rounds (batch G3, `/code-review xhigh`, tier C)

REVIEW.md was read before each round. Round 1 reviewed the branch against `main` (`f185071..c1e60ec`); rounds 2 (`c1e60ec..97deaac`) and 3 (`97deaac..f034942`) reviewed only the diff added after the round before. Each finding is fixed in its own commit (a red test first where code changes) or closed with a one-line reason here and in `checks.md`.

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

## Round 2 (`c1e60ec..97deaac`, the diff after round 1): 15 found

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `scripts/audit/change-record.js:101` | a change opened before `read_back` existed could never be linked or reported done | closed: the change-record module was added on this branch and never released; no audit trail outside the tests holds a procedure entry without `read_back` | none |
| 2 | `docs/aegis/g3/evidence/tools/floor-diff.js:35` | the seeded generator lost bits in floating point and repeated after about 14,000 states (about 38,000 distinct inputs, not 40,000 per floor) | fixed: an integer generator; the tool prints the distinct count (802,288) | `c34a0e4` |
| 3 | `docs/aegis/g3/evidence/tools/leak-grep.js:11` | `C:\\\\Users` in the JS regex matched two backslashes, never a real Windows path | fixed: one backslash, as `grep -E` reads the charter's pattern; the capture command corrected too | `185faf2` |
| 4 | `scripts/audit/audit-log.js:198` | on Windows a real permission error spun 15 s and was reported as a busy lock | fixed: after 20 tries in a row with no lock file present the real error is raised | `e0da67c` (red), `5d7b157` |
| 5 | `scripts/audit/change-record.js:154` | one read-back could be linked to several changes and prove them all | fixed: one read-back proves one change; a second link is refused and one written around the CLI does not count | `68fa48d` (red), `c7516b0` |
| 6 | `scripts/audit/audit-log.js:404` | the audit CLI wrote a change-linked procedure without a read-back, which could never be proved | fixed: `--change` needs `--read-back`; the usage line names it | `d65d10d` (red), `f86b0e4` |
| 7 | `scripts/audit/change-record.js:122` | `open` accepted a read-back that does not exist (a typo) | fixed: the read-back must be a command key in its connector's source | `40d13b1` (red), `ff2039f` |
| 8 | `scripts/audit/change-record.js:107` | with no approval, status said the read-back ran before the approval | fixed | `ca37a3c` (red), `1fecf54` |
| 9 | `docs/aegis/g3/evidence/tools/suite-counts.sh:4` | the list left out `scripts/jira-contract.test.js`, which this batch added | fixed | `78f8580` |
| 10 | `checks.md:63` | the eval-title row cited the change-record line of the capture | fixed | `a14d1d3` |
| 11 | `docs/aegis/capability-map.md:91` | the timing wording did not match the 20 KB capture (twelve vs eleven measured, 13 to 16 vs 13 to 17, half an hour vs 25 to 40 minutes, "twelve shipped") | fixed | `8c83dc8` |
| 12 | `docs/aegis/g3/evidence/tools/floor-times.js:5` | the tool header kept the old figure and the README lacked the 20kb mode | fixed (one commit with finding 13, the same file) | `11d8060` |
| 13 | `docs/aegis/g3/evidence/tools/floor-times.js:36` | a case not found was skipped silently, and floor lists of different lengths were not checked | fixed | `11d8060` |
| 14 | `scripts/audit/change-record.js:31` | the read-back pattern was a copy of the trail's | fixed: imported from `audit-log.js` | `f4a8c67` |
| 15 | `scripts/audit/change-record.js:32` | altitude: bind a read-back to its change when it is recorded, not by kind at link time | closed: the verify-* CLIs of nine connectors would each need a `--change` flag carried into the trail, a cross-connector change beyond this batch; findings 5 and 7 close the reuse and typo paths, and which object a read-back read stays the operator's link (`docs/aegis/boundary-audit.md` row 37); proposed to the owner in the PR body | none |

Round 2: 15 found, 13 fixed, 2 closed.

## Round 3 (`97deaac..f034942`, the diff after round 2): 15 found

Round 3 is the last round REVIEW.md allows; no round 4 was run.

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `scripts/audit/change-record.js:42` | a Google Workspace change could never be proved: verify entries say `google-workspace`, the file is `gws-client.js` | fixed: one registry of the nine connectors maps each recorded name to its file | `c3313ca` (red), `79f0b63` |
| 2 | `scripts/audit/audit-log.js:415` | the audit CLI was a second way to write a change-linked procedure, without the read-back, digest, gate and class checks | fixed: the CLI refuses `--change`, and the trail refuses a change-linked procedure without read-back, digest and gate or outside R2 and R3, whoever writes it | `15c00f0` (red), `e82607b` |
| 3 | `scripts/audit/audit-log.js:205` | on Windows a lock pending deletion is unreadable too, so 20 tries (about 0.2 s) were all that told it from a real permission error | fixed: the folder decides: if it takes a new probe file the lock is busy and the writer waits, if not the real error is raised | `1aa54fc` (red), `3f76e5e` |
| 4 | `scripts/audit/change-record.js:174` | `link` checked "not linked yet" outside the write lock, so two links of one read-back at once could both succeed | fixed: `append` takes a guard that runs under the lock; `link` checks there | `21fc69f` (red), `cffefd0` |
| 5 | `scripts/audit/change-record.js:176` | `link` recorded a read-back that could not prove the change (no approval, ran before it, not verified, another change's), taking it from the change it proves | fixed: `link` refuses each case | `c7111a6` (red), `4ee3e73` |
| 6 | `scripts/audit/change-record.js:45` | the command check searched the whole file, so a mention in a comment or string passed | fixed: only a key line of the command table counts | `57f1feb` (red), `ce7f30f` |
| 7 | `checks.md:59` | "twelve shipped" floors: eleven were on `main`, one pair was added in this batch | fixed (also progress.md and PROJECT_STATE.md) | `c16440b` |
| 8 | `docs/review/incidents.md:9` | the extrapolation (25 to 40 minutes) did not follow from its own figures (about 28 to 52) | fixed in the incidents row, checks.md and the explainer | `04a542d` |
| 9 | `docs/aegis/g3/evidence/tools/suite-counts.sh:2` | six test files this batch changed were not counted | fixed: appended at the end; header and README say added or changed | `bd9dfd8` |
| 10 | `docs/aegis/g3/evidence/tools/leak-grep.js:11` | the personal pass missed `C:\\Users` as a JS string holds it and `c:\users`; the tool skipped diff headers, so its count was one under the charter grep | fixed: every line searched (1537 = 1537), personal pass over every line in any case with one or two backslashes | `0e3edaf` |
| 11 | `docs/aegis/g3/evidence/tools/floor-times.js:41` | the after floor was paired by position, not label | fixed: each side looked up by label | `19522d3` |
| 12 | `docs/aegis/capability-map.md:86` | citations still gave the `ebb8cc1` counts (audit 10/10, change records 7/7, latency) after round 2 added tests | fixed: every cited capture re-run at `a237fac` and the citations updated | `d0757cd`, `934679c` |
| 13 | `progress.md:8` | progress.md was not rewritten after round 2 | fixed: rewritten | `c03d823` |
| 14 | `docs/aegis/g3/evidence/code-review-rounds.md:46` | round 2 findings 12 and 13 share one commit; the reasons for closed findings 1 and 15 were not in checks.md | fixed: checks.md carries both closed reasons and the shared commit as a deviation (the two findings changed the same lines of one file; history on a pushed branch is not rewritten) | `d0f2b3b` |
| 15 | `scripts/audit/change-record.js:172` | `link` read and parsed the whole trail four times; `withLock` read the lock twice per denied retry | fixed: `link` reads it once and passes it on (`a2415f7`); the double read went with finding 3's rewrite (`3f76e5e`) | `a2415f7` |

Round 3: 15 found, 15 fixed, 0 closed.

## Totals over the three rounds

45 found: 43 fixed, 2 closed with a reason (round 2 findings 1 and 15). Fixed plus closed equals found.

Found while fixing round 3, outside its findings: `leak-grep.js` counted a commit message under the last file of the commit before it (`0535cb3`); the capture check left the evidence tools out of "uncommitted changes" (the session's capture script now leaves out only the files directly in `docs/aegis/g3/evidence/`; the tools README says so, `a237fac`); the latency budget's comment copied one run's figures, then a bound one run missed (`970e0bd`, `1fd018c`).
