Saved word for word from the reviewer's final report (batch 11, resumed session).

16 findings: 5 important, 11 minor. I could not run commands, so every verdict comes from files I opened, plus `.git/logs/HEAD` for commit order and times.

| # | requirement | verdict | evidence you opened | correction |
|---|---|---|---|---|
| 1 | Baseline recorded before any edit, "node-test-vs-batch9.txt empty" (checks.md:11) | fail | `baseline/node-test-vs-batch9.txt:1-85` is not empty. One side was normalized and the other still has its "✖ " prefixes and the "failing tests:" header, so `comm -3` lists every name twice. The counts are right (`baseline/node-test.txt:2407-2412`: 2246 / 2204 / 41 / 1), and by eye the 41 names match. | Rerun with both sides normalized, the way `battery-final/failing-names-vs-batch9.txt` does, and fix checks.md:11 and progress.md:5. |
| 2 | T1: a case can carry `setup` (markers, privacy step, one judge line) | pass | `t1-red.txt:12-15` (7 of 9 fail), `t1-green.txt:12-15` (9 of 9) and `:27` (335); `scripts/eval/judged/setup.test.js:65-101` | none |
| 3 | T1: no setup gives a byte-identical prompt | pass | `setup.test.js:103-113` (hashes taken from the prompts at 3ca7a12), `:158` | none |
| 4 | T1: dry run prints the setup count; CI dry run exits 4 | pass | `t137-final.txt:121-134` at c004523; `setup.test.js:191` runs the real CLI and is green in the battery at 04c0b61 | The row cites c004523 only. Name the battery test instead, since judged-eval changed after c004523. |
| 5 | T2: assumed-setup rule; Rule 11 reconciled | pass | `CLAUDE.md:76`, `:79`, `:86`; `docs/aegis/answer-format.md:29-31` | none |
| 6 | T2: desk row tests (3 must carry, 3 must not, 2 Google or Okta setups) | pass | `assumed-setup-red.txt:9-12` (6 of 7 fail), `assumed-setup-green.txt:9-12` (7 of 7). I checked counts, not each fixture. | none |
| 7 | T3: quoting is not complying, decisions (a) to (d) plus five pairs | pass | `t3-red.txt:15-18` (9 of 12 fail), `t3-green.txt:27-30`, `:42-45` (324 of 324) | none |
| 8 | T3: every existing probe test passes unchanged | unresolved | Only `git show --stat 980969f` is cited, and no output of it is saved. That covers one commit, not 3ca7a12..HEAD. | Save `git diff --stat 3ca7a12 HEAD -- scripts/eval/judged/checks.test.js`. |
| 9 | T4: ask-first rule; Rule 8 and the `## Fix` line reworded | pass | `CLAUDE.md:76`, `:86`; `answer-format.md:126-135` | none |
| 10 | T4: twenty own phrasings as format tests | pass | `scripts/demo/ask-first.test.js:70-93`; `ask-first-red.txt:6-9`, `ask-first-green.txt:7-10` | none |
| 11 | T4: tidy T7 still closes CLARIFY | pass | `customer-desk.test.js:1516`; `desk-rows-green.txt:2-5`; `full-run-9/summary.md:8` | none |
| 12 | T5: four rules in section 2 with examples, named in CLAUDE.md | pass | `answer-format.md:56-70`; `CLAUDE.md:86` | none |
| 13 | T5: two fixture pairs on two platforms per rule | pass | `thinking-rules.test.js:56,86` (rule a: Google and Okta), `:121,:147`, `:186,:211`, `:237,:269`; red 9 of 9 fail, green 9 of 9 | checks.md:23 says "Microsoft and Google pairs per rule", but rule a uses Google and Okta. Fix the wording. |
| 14 | T5: Microsoft lane applied | pass | `t5-ms-red.txt:29-32` (7 of 27 fail), `t5-ms-green.txt:29-32`; `t5-ms-review-red.txt:15-18` | checks.md:24 and :51 say "(12 of 13)". The capture shows 1 of 13 failing, so write "1 of 13 fail". I could not open merge 9b28c9b. |
| 15 | T5: Google, Okta and Jamf lane applied | pass | `t5-gok-node-test.txt:2409-2412` (44 fail); `t5-gok-ladder-audit-check.txt:3` (exit 1) | The row cites these lane checks for a pass but does not say two of them failed (stale generated pages, regenerated in 195f040). The Microsoft row does say this. Add it here too. |
| 16 | T5: sender-authentication and offboarding mail rules on every mail and offboarding runbook | pass (spot check) | "restore window" appears in offboard, gws-offboard, okta-user-lifecycle, github-offboard-member, linear-workspace-admin; the leaver section is at `slack-user-lifecycle.md:44-50`; the sender-side fix is in email-whitelist, email-to-spam, email-quarantine and gws-gmail-delivery | I could not open the commits. This is a sample only. |
| 17 | T5: each vendor fact CONFIRMED with link or UNCONFIRMED | pass | `docs/aegis/batch11/vendor-facts-microsoft.md:14-78`; `vendor-facts-google-okta-jamf.md:13-90` | checks.md:27 and PROJECT_STATE.md:307 say GB-01 to GB-53, but the file runs to GB-59 (`:85-90`). Also tell the owner that most CONFIRMED lines rest on a "fetch tool summary" (a model's reading of the page; see `:6-7`). |
| 18 | T5: lint and ladder lint exit 0 | pass | `battery-final/command-structure-lint.txt:4`, `ladder-audit-check.txt:1-2` | none |
| 19 | T6: `--reply-to asker`; eight pairs; argument tests; output unchanged without the flag | pass | `asker-reply.test.js:48-64` (eight pairs); asker-reply red 4 of 5 fail, green 5 of 5; reply-to red 6 of 30 fail, green 30 of 30 | Without the flag, the tools no longer behave exactly as at 3ca7a12: they add `--model` and save `init.json`, and the "unchanged" test was edited to allow that. List this as a conflict between the two instructions in the report's deviations. |
| 20 | T7: deny rules, tool-call record, INCONCLUSIVE rule, report line, card words | pass | `t7-red.txt:13-16`, `t7-green.txt:13-16`, `:28-31`; `results.json:564-595`; `report.md:23`, `:25` | none |
| 21 | T7: real-session probe refused | pass | `exam-wall-probe.txt:10-27` | `exam-wall-probe.txt:29` counts its 0.4929 dollars against the 18 dollar limit, while checks.md:31 says it is outside it. Make them agree. |
| 22 | T8: predictions written before any run | pass | `progress.md:6`; `.git/logs/HEAD:420` (6b00904 at 2026-11-14 07:57Z); the first run started 23:08Z (`report.md:5`) | none |
| 23 | T8: 16 own dev cases as specified | pass | `judged-dev-run/summary.md:17-32` (DEV09 to DEV24: each pair on two platforms, two ask-first, two with a setup); `.git/logs/HEAD:419` | none |
| 24 | T8 resumed: every session on claude-opus-5-5, recorded per case | pass (judged and demo runs); unresolved (the six asks) | `results.json:9-19` plus every per-case model line (all claude-opus-5-5); `full-run-8/init/*.json:13` (9 files); `full-run-9/init/*.json:13` (4 files) | The six asks' `init.json` and `result.json` are not in the repo; only the text of `asker-replies.md` names the model. Save them, sanitized. checks.md:34 says model-pin-red had "10 fail"; `model-pin-red.txt:146` shows 11. |
| 25 | T8: dev judged run saved | pass | `report.md:5-25`, `summary.md:48-53`, `terminal.txt:26-30` | `results.json` records no commit. From the reflog, the run started at dc11a5e (`.git/logs/HEAD:440`, 23:07:02Z; run start 23:08:09Z). Record the commit in `results.json`. |
| 26 | T8: six asker replies on three platforms with word counts | pass | `asker-replies.md:5-14`, `:16-94`; I recounted DEV14 by hand: 91 words | The listed costs add to 2.16, not the 2.17 claimed (rounding). |
| 27 | T8: messy and tidy reruns saved with side-by-sides | fail | `full-run-8/summary.md:63-75` is complete; `full-run-9/summary.md:59-61`: T2, T3 and T6 not run; the side-by-sides match `full-run-6/summary.md:5-13` and `full-run-7/summary.md:5-12` | The instruction asks for T1 to T8. Set checks.md:37 to fail and keep the deviation text. The owner decides whether to allow about 2 to 4 more dollars. |
| 28 | T8: within 18 dollars of claude-opus-5-5 sessions; total 15.79 | pass for the limit, fail for the figure | `results.json:13` (8.9471514); `full-run-8/terminal.txt` per-ticket costs (sum 3.5458); `full-run-9/terminal.txt:9,93,142,199` (sum 1.1346); asks 2.1690 cannot be opened | From the saved figures: 8.9472 + 2.1690 + 3.5457 + 1.1346 = 15.7965, which rounds to **15.80**. The 15.79 used the rounded tidy cost (1.13). Fix checks.md:38, explainer:28 and PROJECT_STATE.md:312. |
| 29 | T8: every failed dev case names the exact line and rule that stopped it | fail | `summary.md:55-111`: each failure names a must item or a check name, plus the judge's note cut off mid-sentence (`:61` ends "Classification gets"). Check failures name only "scripts/eval/judged/checks.js", with no line and no answer text (`:63`, `:98-99`). | checks.md:39's own correction admits there is no answer line, so the verdict should be fail. For each failed case, add the answer line (from `results.json`) and the checks.js line or the must item. |
| 30 | T8: each demo ticket not RESOLVED names the line and rule | pass | `full-run-8/summary.md:11`, `full-run-9/summary.md:8` | At HEAD, `customer-desk.js:569` is a comment; the rule is at `:571`. Say the line number is as at 43d3e63 and c32c55b. |
| 31 | T8: no rule, runbook, check or threshold changed to force a pass; builder cases stated as not independent | unresolved (caveat: pass) | The caveat is at `summary.md:3`. `.git/logs/HEAD:441-444` shows docs and evidence subjects only, but the cited `git diff --stat dc11a5e 8e539a5` output is not saved. | Save that output. |
| 32 | T9: PROJECT_STATE "Changed by batch 11"; both READMEs | pass | `PROJECT_STATE.md:291-317`; `README.md:36-54`; `scripts/eval/README.md:180-188` | Fix the GB range and the 15.79 there (rows 17 and 28). |
| 33 | Full battery at the pushed head; same failing names as batch 9 | pass at 04c0b61; unresolved at HEAD | `battery-final/HEAD.txt:1`; `node-test.txt:2521-2526` (2360 / 2318 / 41 / 1), tripwire run the same; `failing-names-vs-batch9.txt:1-4` (empty for both); `release-boundary-check.txt:1-3` (exit 1, only on `.codex`, as in the baseline) | There is no capture at 24c04e5, and the branch is not pushed (no remote ref in `.git/refs/remotes` or `packed-refs`). Save `node --test` at the commit you push. |
| 34 | `ladder-audit.js --check` exit 0 | pass | `battery-final/ladder-audit-check.txt:1-2`, `vendor-facts-priority-check.txt:2` | none |
| 35 | Pre-commit scan between add and commit, every commit | fail (self-reported) | no per-commit capture; `battery-final/pre-commit-check-all.txt:750` exit 0 | The first session's commits have no row at all, though the instruction says "every commit, including the first". Add a row, unresolved unless there is a capture. |
| 36 | `.codex/` untouched | pass | Glob shows 13 `.toml` files in `.codex/agents/`; git status shows `?? .codex/` | The commander counted 12 at 3ca7a12; checks.md:45 says 13 without comment. Explain the difference in the report. |
| 37 | Resumed: lane checks saved as `t5-ms-*.txt` | pass | `t5-ms-node-test.txt:2415-2418` (2253 / 2208 / 44); `t5-ms-ladder-audit-check.txt:3` (exit 1, disclosed); the others exit 0 | none |
| 38 | Resumed: both lanes on the branch, no rewrite | unresolved | the `merge-base` and `git cherry` outputs are not saved | Save them. |
| 39 | Resumed: generated pages regenerated | pass | `battery-final/ladder-audit-check.txt`, `vendor-facts-priority-check.txt` | none |
| 40 | /security-review (checks.md:61) | unresolved | no saved review output | Save the review text. |
| 41 | /code-review rounds 1 to 3 (checks.md:62-72) | pass for the fixes; unresolved for the finding lists | `cr1-red.txt`/`cr1-green.txt`, cr2, cr3 (for example `cr3-red.txt:1-30`) | The findings with file and line are not saved, so the counts (15, 15+2, 15) and the closed reasons cannot be checked. |
| 42 | After round 3, state what keeps failing | pass | checks.md:73 | none |
| 43 | Not in checks.md: progress.md rewritten after each stage | fail | `progress.md:9` stops at round 1 (02790ff); `:12` Next action is "close code review round 2", but checks.md:70-73 shows round 3 done and the battery at 04c0b61 | Rewrite Completed, Open issues and Next action. |
| 44 | Not in checks.md: resumed task 4, remove the worktrees after the push | unresolved (not due yet) | the branch is not pushed | Add a row; do it after the push and list the older worktrees. |
| 45 | Not in checks.md: draft PR, template, CI run | unresolved (not due yet) | no remote ref | Add a row. |
| 46 | Not in checks.md: owner explainer under 50 lines, numbers match | pass with corrections | explainer: 36 lines; `:30-34` match the summaries | `:28` should say 15.80. `:17` "about 60 runbooks" has no evidence I could open. `:32` "8 fixed and checked" should say they closed against pretend systems, and should note that T1m's new-way-in row failed (`full-run-8/summary.md:19,31`). |
| 47 | Not in checks.md: quiz, 5 questions with collapsed answers | pass | `-quiz.md:5-20` | none |
| 48 | Not in checks.md: no names, `/Users/` paths or U+2014 in batch 11 files | pass | Grep found 0 U+2014 and 0 `/Users/` in batch11/**, full-run-8/**, full-run-9/**, checks.md, progress.md, PROJECT_STATE.md, the explainer and quiz, answer-format.md and docs/aegis/batch11/*. Name hits are only in files batch 11 did not touch (for example CHANGELOG.md:150). | Pre-existing: README.md (28) and scripts/eval/README.md (12) have em dashes, none in the batch 11 lines (README.md:45-54, scripts/eval/README.md:180-188). |
| 49 | Not in checks.md: model recorded per case "in each run's summary" | pass | `full-run-8/summary.md:35`, `full-run-9/summary.md:29`; judged `summary.md:5` gives the aggregate only | Add a per-case model column to the judged summary.md. |

**Corrections, most important first**
1. checks.md:39: change to fail. For each failed dev case, quote the answer line from `results.json` and the checks.js line or must item; the judge's notes are cut off in `summary.md`.
2. checks.md:37: change to fail, because T2, T3 and T6 did not run. Put the spend decision to the owner.
3. checks.md:11 and progress.md:5: the baseline comparison file is not empty. Rerun it with both sides normalized and save it.
4. progress.md is stale (`:9`, `:12`). Rewrite it to round 3, the battery at 04c0b61, and the next action (push).
5. The cost total is 15.80, not 15.79 (checks.md:38, explainer:28, PROJECT_STATE.md:312). The six asks' `init.json` and `result.json` are not saved, so their model and the 2.169 figure cannot be checked (checks.md:34, :38).
6. Save the missing evidence: the checks.test.js diff from 3ca7a12, the `dc11a5e..8e539a5` diff stat, the merge-base and cherry outputs, the security-review text, each review round's findings, and `node --test` at the pushed head.
7. Minor fixes:
   - model-pin-red has 11 fails, not 10.
   - t5-ms-review-red is "1 of 13 fail".
   - The GB facts run to GB-59.
   - Rule a's test platforms are Google and Okta.
   - The t5-gok row should say its ladder check exited 1 and its test run had 44 fails.
   - Make the probe's cost line agree with checks.md:31.
   - Explain 12 versus 13 `.codex` files.
   - The customer-desk line number is from the frozen commit.
   - Fix the explainer wording (row 46).
   - Record the commit in `results.json`.
   - Add rows for the first session's pre-commit scans, the worktree cleanup and the PR.

I did not check: the commit diffs themselves (no git), every runbook line for the six rules (a sample only), the fixture content of the desk-row tests, and whether the answers and replies are good IT advice.
