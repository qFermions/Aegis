# checks: batch 10 (one rung at a time, and the missing double-checks)

Branch `feat/batch10-ladder-and-readbacks`, base main at `1a719ed`. Verdicts: pass, fail, unresolved. Batch 9b's table is archived at `docs/review/batches/batch9b-checks.md`. Evidence paths without a folder are in `docs/aegis/demo/evidence/batch10/`.

This Mac has no `pwsh`, so 41 tests in `scripts/command-safety-gates.test.js` fail here at the base and the head; CI has `pwsh` and runs them. Failing names are compared with `docs/aegis/demo/evidence/batch9b/tools/failing-names.sh` against batch 9's `docs/aegis/demo/evidence/batch9/baseline/failing-tests.txt` (an empty `comm -3` means the same names).

## Battery

`TMPDIR=/private/tmp bash docs/aegis/demo/evidence/batch9/tools/battery.sh <out-dir>`, then `node scripts/lint/ladder-audit.js --check`.

| check | base `1a719ed` (`baseline/`) | after tasks 1, 2, 5, 6 at `4bd1cf8` (`battery-mid/`) | code head `192287a`, the runs' code (`battery-head/`) | final head |
|---|---|---|---|---|
| `node --test` | 2202 tests, 2160 pass, 41 fail, 1 skipped; names equal batch 9's (`baseline/node-test-vs-batch9.txt`) | 2216 tests, 2174 pass, 41 fail; same names (`battery-mid/node-test-vs-batch9.txt`) | 2233 tests, 2191 pass, 41 fail; same names (`battery-head/node-test-vs-batch9.txt`) | FINAL_TESTS |
| the same under the socket tripwire | the same counts | the same counts | the same counts and names (`battery-head/node-test-tripwire-vs-batch9.txt`) | FINAL_TRIPWIRE |
| four ticket evals, structure lint, `pre-commit-check --all`, release boundary, replay demo | every one exit 0 | every one exit 0 | every one exit 0 (`battery-head-run.log`) | FINAL_REST |
| ladder lint `--check` | exit 0, 141 sections | exit 0 | exit 0 (`battery-head/ladder-audit-check.txt`) | FINAL_LADDER |

## Acceptance

| requirement | verdict | evidence | correction |
|---|---|---|---|
| Baseline recorded before any change | pass | `baseline/` at `1a719ed`, run before the first edit, committed in `647810b` | |
| Task 1: the rule in CLAUDE.md and answer-format.md: the block lists only the gates to run now; a later step is named in the prose with its gate id and condition and stays out of the block; example from no demo ticket | pass | `CLAUDE.md` Answer format (19,952 bytes, under the 20,000-byte test); `docs/aegis/answer-format.md` section 5, "One rung per block" (its example: "Step 4, only if step 3 did not stop the errors"), and section 2's last-resort line | the gate id goes in Details, not the card, since section 1 keeps gate ids out of the card (Deviations) |
| Task 1: the row fails for an R2/R3 gate with a lighter gate for the same symptom, and for a gate the prose calls a last resort or conditional | pass | `scripts/demo/step-ladder.js` (cases 2 and 3 in its header); `t1-red.txt` (3 failing), `t1-green.txt` (12 of 12); `t1-mutations.txt`: three mutations, each caught | "same symptom" is read from the runbook's own ladder lines (Deviations) |
| Task 1: fixtures: batch 9b's T9m fails; the session-clear-only version passes; two more pairs from no demo ticket | pass | `scripts/demo/lightest-step.test.js`, tests "batch 10, task 1" (T9m both ways; pair 1 lock and erase; pair 2 two R1 rungs; an offboarding checklist that must pass) | |
| Task 1: the full battery passes | pass | the Battery table, `battery-head/` | |
| Task 2: change words count only as the step's verb; nouns and relayed user checks do not | pass | `scripts/demo/answer.js` `stepChange`; `t2-red.txt` (4 failing), `t2b-red.txt` (1), `t2-green.txt` (66 of 66); `t2-mutations.txt`: five mutations, each caught | "first word of the step" read as the first word of the step or of each sentence in it (Deviations) |
| Task 2: T7 and T7m (full runs 4 and 5) pass the look-first rule; "Restart the Mac" and "Update the profile" still count; three more pairs | pass | `answer.test.js` tests "batch 10, task 2" (pairs 1 to 4); `t2-saved-answers.txt`: of the saved answers only T7 and T7m change, OPEN to INVESTIGATE | |
| Task 3: Jamf lock read-back `verify-command --type DEVICE_LOCK`, named in the lock gate | pass | `.claude/commands/jamf-lock-erase.md` lock gate Read-back field; `t3-lock-red.txt`, `t3-lock-green.txt` | `--type` had no allow-list to extend: it takes any capitalised type (Deviations) |
| Task 3: the cookie reset event from Google's documentation, a `verify-event` read named | pass | `RESET_SIGNIN_COOKIES`, vendor fact W-07, CONFIRMED on https://developers.google.com/workspace/admin/reports/v1/appendix/activity/admin-user-settings ; `gws-password-reset.md` Phase C read line; `t3-cookie-red.txt`, `t3-cookie-green.txt` | named as the gate section's one read line, since the lint refuses a command in an R1 Read-back field (Deviations) |
| Task 3: simulator entries; lint and ladder lint exit 0; a desk test with a fixture answer for each | pass | `scripts/demo/sim/gates.js`, `vendors.js`; `scripts/demo/batch10-readbacks.test.js`; `battery-head/command-structure-lint.txt`, `battery-head/ladder-audit-check.txt` | |
| Task 4: Okta deactivate `verify-status DEPROVISIONED` | pass | `gws-offboard.md` gate `gws-offboard-okta-deactivate-portal` and its fenced twin; `t4-okta-red.txt`, `t4-okta-green.txt` | the gate is R3, so its read takes a change record |
| Task 4: a read-only Data Transfer read (transfers.get), passing only on completed for the named old owner, new owner and application; read-only scope; refusal, audit, exit-code and INCONCLUSIVE rules; the transport seam | pass | `scripts/adapters/gws-client.js` `verify-transfer`; `gws-client.test.js`; `t4-transfer-red.txt`, `t4-transfer-green.txt`, `t4-transfer-notbefore-*` | |
| Task 4: method, fields and scope confirmed in Google's documentation, each CONFIRMED or UNCONFIRMED | pass | `docs/aegis/g3/vendor-facts.md` W-09 to W-14; the UNCONFIRMED ones (W-11, W-13, W-14) on `vendor-facts-to-check.md` | |
| Task 4: the delete gate left as it is | pass | `git diff 1a719ed -- .claude/commands/gws-offboard.md` changes no field of `gws-offboard-delete-portal` or `gws-offboard-delete` | |
| Task 4: connector tests (refusal before any request, read-only scope, pass, fail, INCONCLUSIVE), lint, ladder lint | pass | `gws-client.test.js` "verify-transfer" tests; lints in `battery-head/` | |
| Task 5: ask-aegis.js and aegis-chat.js in tier C, with a test | pass | `.github/risk-tiers.json`; `scripts/risk_tier.test.js`; `t5-red.txt`, `t5-green.txt` | REVIEW.md's tier C list names them too |
| Task 6: "password isHunter22!" and other spellings refused, ordinary tickets not; test first; ten phrasings each way | pass | `scripts/ask-aegis.js` `protect`; `ask-aegis.test.js` "batch 10, task 6" (15 refused, 13 passed); `t6-red.txt`, `t6-green.txt`; `t6-mutations.txt`: four mutations, each caught | |
| Task 7: PROJECT_STATE.md current, with "Changed by batch 10" | pass | `PROJECT_STATE.md` header, "Changed by batch 10", "Current work" (PRs to #16, `pr-list.txt`) | |
| Task 8: predictions in progress.md before the runs | pass | `progress.md` "Run predictions", committed in `3227e8f`; full run 6 started after it (run folder `20261108T021531Z-5b818ac6`) | |
| Task 8: messy then tidy, one ticket at a time, within 10 US dollars and 17 sessions, same isolation as full-run-4 | pass | `full-run-6/terminal.txt`, `full-run-7/terminal.txt`: 9 + 7 sessions, 3.59 + 2.76 = 6.36 US dollars; the desk's isolation arguments (the dry run's session line) unchanged since full-run-4 | |
| Task 8: both runs saved with the side-by-side against full-run-4, full-run-5 and batch 9b's T9m | pass | `full-run-6/summary.md` (side by side with full-run-4; T9m against batch 9 and 9b), `full-run-7/summary.md` (with full-run-5) | |
| Task 8: each ticket that did not close RESOLVED (SIMULATED) names the exact line and rule | pass | T7m: answer line "Gate: none", rule `customer-desk.js:562` (INVESTIGATE); T7: a question with Gate: none, rule `customer-desk.js:558` (CLARIFY) | |
| Task 8: no desk or runbook change made to force a pass | pass | `git diff 192287a d6b5aef -- scripts .claude CLAUDE.md` is empty: no code or runbook changed during or after the runs before they were saved | |
| Rule: the pre-commit scan between `git add` and `git commit`, every commit | pass | `staged-scan-replay.txt` (`tools/replay-staged-scans.sh`): every commit after `1a719ed`, the subagent's included, replayed as a staged scan: exit 0 each | my early commits used `scan \| tail -1 && commit`, which would not have stopped on a failing scan; the replay shows none failed, and later commits drop the pipe |
| Rule: no employer, customer or person names; no em dashes in what this batch wrote | pass | `pre-commit-check --all` exit 0 (`battery-head-run.log`); `scripts/demo/wiring.test.js` (captures, dashes); `dash-check.txt`: 0 added lines with a long dash outside the captures | |
| Rule: the new Google read is read-only and cannot start a transfer | pass | `gws-client.js` allow-list: one `GET` route `transfers/:dataTransferId`; `gws-client.test.js` refuses every other method and path | |

## Fixed beyond the task

| fix | commit | proof |
|---|---|---|
| Jamf `verify-command` read the filter's field names, not the record's (`commandType`, `commandState`, `client.managementId`), so every real lock or wipe read-back would have read "not done" (found by the subagent) | `dc8bd47` | `t3-jamf-fields-red.txt`, `t3-jamf-fields-green.txt` |
| `verify-transfer` was not bounded by `--not-before`: an earlier transfer of the same owners could pass (the subagent's fresh review) | `577290c` | `t4-transfer-notbefore-red.txt`, `t4-transfer-notbefore-green.txt` |
| a profile command whose record names no profile read as "not done" (exit 2); now INCONCLUSIVE | `192287a` | `jamf-profile-red.txt`, `jamf-profile-green.txt` |
| `[TRANSFER_ID]` missing from the placeholder dictionary; the transfer route and scope missing from the G2 lane page; the four UNCONFIRMED facts missing from the to-check list | `d65e880` | `scripts/repository-structure.test.js`; `vendor-facts-priority.js --check` exit 0 |

## Review rounds

REVIEW_ROUNDS

## Deviations and decisions

- The executor ran in a session with `~/.claude/CLAUDE.md` and global plugins loaded; the instruction asked for a session without them, and they could not be unloaded in-session. The model sessions the desk started had the isolation the dry run shows (only this repository's CLAUDE.md, no MCP, denied evidence folders).
- The hypothesis in `progress.md` was written after task 1's code, not before the first edit.
- Task 1: "the same symptom" is read from the runbook's own ladder lines ("Try first:", "Lighter step:", a fallback line naming the heavier gate after the lighter gate). Two gates in one section are not rungs by that alone: `/mfa-issue` lists "revoke the sessions, then remove the method" and offboardings list steps that all run now (`t1-saved-answers.txt`: T1m and T2m still pass). Case 3 (a gate the answer calls a later step) fires only when the block holds another gate: a single gate after user checks ("if it still loops") is the rung to run now, as the session-clear-only fixture requires.
- Task 1: the prose that names a later rung's gate id is Details, since answer-format section 1 keeps gate ids out of the card; CLAUDE.md now says so.
- Task 2: "the first word of the step" is read as the first word of the step or of a sentence in it, so "Open the record. Remove the old certificate." counts; after "Ask the user to <verb>" the asked verb counts (the task's list) and the rest of that step is the relayed check. "Done when" keeps batch 9's reading, so security review 5's case stays. A change written only as a portal path's last button is not a verb (a shortcut comment in `answer.js`).
- Task 3: `--type` had no allow-list; the cookie read is the section's read line, not the Read-back field (the lint refuses a command in an R1 field).
- Task 8: T7's prediction missed (CLARIFY, not INVESTIGATE); predictions matched 9 of 9 and 7 of 8.
