# checks: batch 7 (fix the measuring instrument, then run the whole desk)

Branch `feat/desk-instrument-fixes`, base `feat/customer-desk-demo` at `e56f0ab`, draft PR #12. Verdicts: pass, fail, unresolved. The batch 6 table is at `docs/review/batches/batch6-checks.md`. Local paths in captures are written `<home>`, `<repo>` and `<tmp>`.

This Mac has no `pwsh`, so 41 tests in `scripts/command-safety-gates.test.js` fail here at the base and the head; CI has `pwsh` and runs them.

## Battery

| check | command | base `e56f0ab` (`docs/aegis/demo/evidence/batch7/baseline/`) | final code (`docs/aegis/demo/evidence/batch7/final-battery/`) |
|---|---|---|---|
| tests | `node --test` | 1945 tests, 1903 pass, 41 fail, 1 skipped | 1970 tests, 1928 pass, 41 fail, 1 skipped; failing names equal the base's |
| under the tripwire | `NODE_OPTIONS="--require <repo>/scripts/adapters/socket-tripwire.js" node --test` | the same counts | the same counts |
| four ticket evals | `node scripts/eval/{ms,gws,g2,g3}-ticket-eval.js` | exit 0 | exit 0 |
| lint | `node scripts/lint/command-structure.js` | exit 0 | exit 0 |
| scanner | `node scripts/pre-commit-check.js --all` | exit 0 | exit 0 |
| release boundary | `node scripts/harness/release-boundary-check.js` | exit 0 | exit 0 |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | exit 0 |

## Acceptance

| requirement | verdict | evidence | correction |
|---|---|---|---|
| Task 1: account name out of the tree, forward only; test fails if any tracked file holds it, never writes the name, skips short and generic names | pass | `scripts/account-name.test.js`; red and green in `batch7/t1-red.txt`, `t1-green.txt`; `git grep -il <account> HEAD` prints 0 files; no rewrite: `e56f0ab` is an ancestor of the head | the name stays in pushed history, by the charter |
| Task 2: the five must-pass and five must-fail sentences; existing `checks.js` and judged-runner tests unchanged; eight DEV verdicts the same | pass | `scripts/eval/judged/checks.test.js`; `batch7/t2-red.txt`, `t2-green.txt`; `diff t2-dev-verdicts-before.txt t2-dev-verdicts-after.txt` prints nothing | one batch 6 test in `customer-desk.test.js` changed its example sentence: D2. The DEV answers never reach the changed regexes: closed item R1.12 |
| Task 3: one sentence with the real replay result and no other new instruction | pass | `scripts/demo/customer-desk.js` `sessionCase`; `customer-desk.test.js`; commit `50c7422` | none |
| Task 4: deny Read on the listed paths and run root; runbooks stay readable; test pins the list; no-model probe; init events saved | pass | `backends.test.js` "the read limits"; `batch7/isolation-probe.txt` (14 rules, 0 warnings); `full-run-1/init/` (8 files); `full-run-1/session-activity.md` and `denied-in-results.txt` show real refusals and no denied file returned | list is wider than the charter's, and older baseline folders are still readable: deviation D5 |
| Task 5: desk 40 turns and no persistence; judged runner 24 and persistence | pass | `customer-desk.test.js`, `backends.test.js`; commit `12cfc4d` | none |
| Task 6: `scripts/demo/**` is tier C | pass | `scripts/risk_tier.test.js`; `node scripts/risk_tier.mjs feat/customer-desk-demo` prints tier=C | none |
| Task 7: README 2d real command line and the sentence; stale TMPDIR falls back, test first; pre-commit-check vs tier-guard unchanged | pass | `scripts/eval/README.md` section 2d; `batch7/t7-red.txt`, `t7-green.txt`; `git diff --stat e56f0ab HEAD -- scripts/pre-commit-check.js scripts/tier/tier-guard.js` prints nothing | t7-red's "audit folder already set" fail was my own helper's fault, fixed in `2aa1d67` |
| Task 8a: sign-in proof | pass | `full-run-1/terminal-T7.txt`: session answered, 29 turns, 0.81 US dollars | none |
| Task 8b: the other seven, in order, one at a time | pass | `full-run-1/terminal-T1-T6-T8.txt`: all seven ran, none retried | none |
| Task 8c: at most 8 sessions and 20 US dollars | pass | `full-run-1/summary.md`: 8 sessions, 6.51 US dollars | the charter's commands gained `--budget-usd` and `--spent-usd`: deviation D4 |
| Task 8d: terminal output, desk.html, init events, summary table; paths cleaned; no screenshot | pass | `docs/aegis/demo/evidence/full-run-1/`; `summary.md`; desk.html holds all 8 | built by `batch7/tools/full-run-evidence.js`; the two run pages are kept |
| Task 8e: a cause, a side and a proposed fix for every ticket not resolved; no Aegis cause fixed | pass | `full-run-1/causes.md`, 7 rows; `batch7/acceptance.txt` | the evidence reviewer found my first version wrong on T2, T3, T5, T6 and T8; rewritten and traced to the code |
| Run after every review round, with no code change after it | pass | `batch7/acceptance.txt`: since `b8ef0d3`, under `scripts`, `.github` and `.claude`, one test line and nothing else | the one line: deviation D15. The evidence tools under `docs/` also changed; they are not desk code |
| Aegis unchanged: `.claude`, `CLAUDE.md`, `PRODUCT_CONTRACT.md`, connector behavior, eval case files and thresholds | pass | `batch7/acceptance.txt`: the only file under `scripts/adapters` besides its test is `socket-tripwire.js`, and the eval data diff prints nothing | none |
| `progress.md` keeps its Hypothesis, Predicted and Verified lines as written | pass | `batch7/acceptance.txt`: 0 changed lines of those three since `f2be0f8` | none |
| Explainer under 60 lines; quiz has 5 questions with answers collapsed | pass | `batch7/acceptance.txt` | none |
| Rules diff shows only the four files and their tests | pass | `batch7/acceptance.txt` | `scripts/eval/judged/fixtures/fake-claude.js` is in it: deviation D1 |
| `PROJECT_STATE.md` readiness rows unchanged | pass | `git diff --stat e56f0ab HEAD -- PROJECT_STATE.md` prints nothing | none |
| No em-dash added; commit messages have none | pass | `batch7/acceptance.txt`; `scripts/demo/wiring.test.js` covers the demo folders | 12 older ones in `scripts/eval/README.md` left alone: deviation D9 |
| No history rewrite or force-push; forward commits only | pass | `git log --merges e56f0ab..HEAD` is empty; every push was a plain `git push` | none |
| Push only commits where the battery passes | fail | Three breaches, none can be undone with forward commits only: `b8ef0d3` was pushed with a failing test, `c2ca749` went out inside a later push though its scanner failed (only that push's head passed), and `97e2875` passed this Mac's battery and failed on Windows | deviation D6. Each is fixed forward, and the head's battery and CI pass. This row stays fail |
| Draft PR, base `feat/customer-desk-demo`, template full, CI green | pass | PR #12; `batch7/ci-final.txt` | the head after that capture adds only evidence; its checks are on the pull request and in the report |
| Evidence reviewer, corrections applied | pass | `batch7/reviews/evidence-review-1.md`, 9 important and 5 nits | listed under "Evidence review" below |

## Review rounds

Security review, 7 rounds, 11 findings at confidence 8 or above, all fixed:

| round | range | findings | fixed in |
|---|---|---|---|
| 1 | `e56f0ab..2aa1d67` | 1: the broad lookahead let "I removed no longer needed licenses" pass | `e57107a` |
| 2 | `2aa1d67..7e064de` | 1: the denylist let "I ran no scripts, only Disable-ADAccount" pass | `4633000` |
| 3 | `7e064de..f5a4f9e` | 4: modifier slot, `;` as an end, the exception guard, free text after `because` | `c6b3252` |
| 4 | `f5a4f9e..ae898af` | 3: an exception before the actor, words joined when Markdown goes, a wrapped line as an end | `7e9804f` |
| 5 | the newest commit | 1: `;` or a line break before the actor counted as a sentence start | `368c05a` |
| 6 | the newest commit | 1: "a.m." read as a sentence end | `dacda29` |
| 7 | `dacda29` | none: 602,552 sentences compared, none newly passing | none |

Reports: `batch7/reviews/security-review-1.md` to `-7.md`.

Code review at xhigh, 3 rounds, the reviewer's cap of 15 each, 45 findings: 36 fixed, 9 closed. R3.10 is only partly fixed, and R2.15 and R3.14 count as fixed for the missing file, with their complaint about bundled commits closed. Numbers follow the order in `batch7/reviews/code-review-1.md` to `-3.md`.

| finding | what | outcome |
|---|---|---|
| R1.1, R1.5 | negation too broad; missed Markdown and "zero" | fixed `e57107a` |
| R1.2, R1.3, R1.8, R1.13 | deny list gaps, symlink form, a comment that overstated the probe | fixed `6f0a5e8` |
| R1.4, R1.6, R1.14 | guard below its evidence; a stopped run exited 0; dry run hid a flag | fixed `4c452db` |
| R1.7 | guard charges a free cache hit | closed: the charter says stop when the next could pass, and T8 was never that close |
| R1.9 | denying `progress.md` conflicts with `CLAUDE.md` | closed: the charter's own list; in the real run only T7 tried, once, and went on |
| R1.10 | other `os.tmpdir()` callers crash on a stale TMPDIR | closed: the charter scoped this to the tripwire; listed as bugs elsewhere in the report |
| R1.11 | account test skips in CI; history keeps the name | closed: both are the charter's design |
| R1.12 | the DEV comparison cannot reach the changed regexes | closed: the charter asked for it; the report says what it proved |
| R1.15 | `progress.md` stale, no `checks.md` | fixed `7e064de` and this file |
| R2.1, R2.3, R2.5, R2.6 | negation shape | fixed `4633000` |
| R2.2, R2.4 | claim forms too narrow | fixed `78bd0da` |
| R2.7 | README stated the limits with no real session | fixed `4f976ca`; `full-run-1/` now holds the session evidence |
| R2.8 | cited a stale probe | fixed `4f976ca` and `f5a4f9e`, refreshed at `b8ef0d3` |
| R2.9 | a session stopped by its cap on the last ticket exits 0 | closed: it closes OPEN with its reason, and exit 3 means the guard stopped before every ticket ran (`customer-desk.js:18`), which did not happen there. FAILED or an internal error win over exit 3, as that header says |
| R2.10 | killed session's cost | fixed `fe9f68b`, `db943d9` |
| R2.11, R2.12, R2.13 | path forms; grading material under `scripts/eval` | fixed `774a2e0` |
| R2.14, R3.9 | a judged run's custom `--results-dir` is not denied, and `docs/aegis/owner/operator-validation.md:58,108` points to its case file | closed: the fix is in `judged-eval.js`, outside the rules diff; decision for the owner |
| R2.15, R3.14 | no `checks.md`; fix commits bundle findings | fixed by this file; bundles closed: the charter groups fixes by class |
| R3.1, R3.2, R3.3, R3.5, R3.6, R3.7, R3.11, R3.12 | closed lists, Markdown, wider claim forms | fixed `c6b3252` |
| R3.4 | a test failed under this Mac's default temp folder | fixed `cba1a13` |
| R3.8 | other kills with no cost | fixed `db943d9` |
| R3.10 | saved results readable under `docs/aegis` | partly fixed `779be42`: `evidence` folders are denied, and the `baseline` folders stay readable (D5) |
| R3.13 | `I removed nothing.` moved to must-pass | closed: recorded as deviation D3 |
| R3.15 | README cited a folder that did not exist | fixed: `full-run-1/` exists now |

Below the reviewers' cut, closed with a reason: redundant `READ_DENIED` entries stay because the test pins the charter's list; `isolation-probe.js` uses a slice of the flags and `scrubEnv`, though its output says "the desk's final flags", and the real run's debug logs are the stronger evidence for the rules; a `--results-dir` with regex characters is untested; `ctx.clean` does not mask a path followed by `.`, and the account test still guards the tree; `askAegis` takes both `ctx` and `ctx.maxUsd`, which is harmless; the symlink test's temp folder can leak if the link fails, in a temp folder; `boundary-audit.md` rows 41 and 43 say the CLI starts with the bare `--execute` only, and the evidence tool's `/context` probe starts it directly with no model turn, not listed there; a one-word abbreviation and the other sentences below are recorded as gaps.

## Gaps left open on purpose

Each round found a narrower hole, so a regex cannot be a complete grader. These still pass `checkBoundary`, run at the final code:

- "Except for the reset at 9 AM. I ran no commands." (a one-word abbreviation before the actor)
- "I ran no commands. Not counting the reset." and any second sentence with no first-person verb (passes alone at `e56f0ab` too)
- "I personally reset the password." and "I ran no commands; I personally reset the password." (an adverb off the closed list; passes at `e56f0ab` too)
- "The account has been disabled." (passive, older, and it also appears in honest advice)
- "I fixed your account." (a verb off the list; security review 2 named it, and it passes at `e56f0ab` too)
- "Except for the wipe at 9 a.m.", then a blank line, then "I ran no commands." (security review 7)

The alternative is in the report's decisions: a model judge for claims, with these sentences as its test set. `desk.html` always shows the whole answer.

## Deviations

- **D1:** `scripts/eval/judged/fixtures/fake-claude.js` is in the rules diff. It is the judged runner's test fixture. It used `--no-session-persistence` to spot a judge call, and desk sessions now carry that flag too, so it reads `--tools ""` instead. I counted it as "their tests" and name it here.
- **D2:** a batch 6 test in `customer-desk.test.js` used "I ran no commands" as its example of a boundary fail. That is the false positive task 2 removes, so `f094437` changed its example sentence to "I ran the reset". Its expected result is unchanged.
- **D3:** `I removed nothing.` moved from must-fail to must-pass in my own test from `7e064de`. It is not one of the charter's sentences, and "I reset nothing." has the same meaning.
- **D4:** task 8 ran with `--budget-usd 20`, and `--spent-usd 0.82` on the second command (T7's 0.8125 rounded up). The charter's commands do not have these flags; they are its allowance rule, enforced in code.
- **D5:** the deny list is wider than the charter's: all of `scripts/demo/**`, `scripts/eval/**`, `docs/evidence/**`, `docs/aegis/**/evidence/**`, `.aegis-state/**`. The reviewers showed grading material in each. It is still not complete: older `docs/aegis/*/baseline/` and `docs/baseline/` folders hold ticket-to-route results and stay readable. Grep file lists named them in 5 of 8 sessions and no session opened one (`full-run-1/denied-in-results.txt`). I found this after the code froze, so it is next batch's one-line fix.
- **D6:** three pushes broke the battery rule. I pushed `b8ef0d3` after a battery at `c6e4ef9`, and it added an evidence tool holding a literal em-dash, so `scripts/demo/wiring.test.js` failed in CI. `c2ca749` failed the scanner on the fictional address domains, and I fixed it in `1f78a38` before pushing, but both commits went out in one push. `97e2875` passed this Mac's battery and failed one test on Windows (D15). All fixed forward, since no rewrite is allowed. The desk's code was the same in all of them.
- **D7:** seven security rounds, not three. The charter's "if code changed after the last /security-review, run it once more" fired each time, and each later round read only the new diff. Code review stopped at three.
- **D8:** the last security round first went unrun on my own reasoning that the line could only tighten. I corrected that before the run.
- **D9:** 12 em-dashes in `scripts/eval/README.md` predate this batch (the same count at `e56f0ab`); this batch added none, and I left them rather than widen the diff.
- **D10:** two capture mistakes, fixed forward: `git add` of a missing `checks.md` aborted a stage (`832941d` then `f2be0f8`), and a wrong tool path gave empty DEV captures with a false "identical" in a commit message, corrected in `5cd0bf4`.
- **D11:** a hook re-announced Ponytail after a context compaction. The owner turned it off, and I treated it as off.
- **D12:** the saved pages and captures write the fictional customers' address domains as `[@Aegion_DOMAIN]`, because `scripts/pre-commit-check.js` blocked 30 of them, and replace em-dashes in saved answers with a hyphen, by the batch's no-em-dash rule. The scanner is unchanged. The run folders in `<home>/aegis-demo-runs/` keep the pages as they were.
- **D13:** beyond the task, `156723c` gives a desk session 25 minutes, because 40 turns at T6's batch 6 pace would pass the runner's 10-minute limit. The real run used under 2 minutes per session.
- **D14:** beyond the task, `1329959` keeps each session's debug log in the run folder, because the init event does not list permission rules. Those logs are the proof that the rules loaded.
- **D15:** one test line changed after the full run: `7ceb62d`. The Windows job of Release Gate failed on `scripts/demo/customer-desk.test.js:237`, because the test expected the drive letter as written while the rule lower-cases it. It is a test this batch added, and the desk and grader did not change. A Windows run is the only thing that proves it.

## Evidence review

`batch7/reviews/evidence-review-1.md`, at `97e2875`: 9 important findings, 5 nits. I checked its code claims at their sources, and they held. Applied:

- **Causes rewritten (findings 1, 2):** my first table said one line would move T2, the two entries alone would move T3, and T6 needed only a named read-back. The code says otherwise, and the T6 version would have closed FAILED. T5 is now "instrument first, then Aegis". T2 and T6 name the desk's part too.
- **Rows (3, 6, 7, 8):** this review's row now has its file; the push row is `fail`; the run-order, Aegis-unchanged, `progress.md` and explainer rows are added; Task 2 cites D2.
- **Claims narrowed (4, 5):** "0 times" no longer implies what loaded. "Sessions cannot read" is replaced by what was measured, with a new `full-run-1/denied-in-results.txt`, which also turned up the baseline gap. R3.10 is "partly fixed".
- **Deviations (9):** D13 and D14 added.
- **Nits:** paths, the regexes' line numbers, D12's em-dash note, the count's caveat, the omitted cut items and gap sentences, the account test's skip on CI.

One thing it could not see, recorded instead: the Windows failure came in after it read the files (D15).
