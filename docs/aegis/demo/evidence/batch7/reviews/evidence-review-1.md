# Batch 7 evidence review 1

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

**9 important findings, 5 nits.** The numbers mostly hold. What fails is the causes and "would move" claims, which are contradicted by the code, plus one row whose evidence file does not exist.

## Verdict table

| requirement | verdict | evidence opened | correction |
|---|---|---|---|
| Battery: tests, base and final | pass | `<repo>/docs/aegis/demo/evidence/batch7/baseline/node-test.txt:2107-2112` (1945/1903/41/1); `<repo>/docs/aegis/demo/evidence/batch7/final-battery/node-test.txt:2132-2137` (1970/1928/41/1) | The 41 names were not compared line by line; both files have 79 matching failure lines. The final battery is stamped `1f78a38` |
| Battery: tripwire | pass | `node-test-tripwire.txt` in the same two folders, same counts | none |
| Battery: 4 evals, lint, scanner, release boundary, replay | pass | Both folders, `exit 0` on all seven files | none |
| Task 1: account name | pass | `t1-red.txt`, `t1-green.txt`, `final-battery/node-test.txt:50`, `acceptance.txt:1-2`; my own search found 0 | See nit 5 |
| Task 2: sentences, existing tests unchanged, DEV verdicts same | fail | `<repo>/scripts/eval/judged/checks.test.js:51-67`; DEV files identical; `<repo>/checks.md:24,104`; reflog `f094437` | Important 8 |
| Task 3: replay sentence | pass | `<repo>/scripts/demo/customer-desk.js:147`; reflog `50c7422` | none |
| Task 4: read limits on the listed paths | pass | `<repo>/scripts/eval/judged/backends.js:57,63-73`; `isolation-probe.txt:11`; 8 init files; `session-activity.md:72,181-182` | Only the listed paths pass. The wider claim is Important 5 |
| Task 5: 40 turns, no persistence; runner 24 | pass | `customer-desk.js:48,165`; `backends.js:78,116,122`; reflog `12cfc4d` | none |
| Task 6: tier C | pass | `<repo>/.github/risk-tiers.json:22`; `t6-red.txt`, `t6-green.txt`; `acceptance.txt:17-18` | none |
| Task 7: README 2d, TMPDIR, no scanner or guard change | pass | `<repo>/scripts/eval/README.md:178-180`; `t7-red.txt`, `t7-green.txt`; `acceptance.txt:15`; reflog `2aa1d67` | none |
| Task 8a: sign-in proof | pass | `<repo>/docs/aegis/demo/evidence/full-run-1/terminal-T7.txt:6` | none |
| Task 8b: seven in order, no retry | pass | `<repo>/docs/aegis/demo/evidence/full-run-1/terminal-T1-T6-T8.txt`; run IDs at 09:00:52Z and 09:02:29Z | "None retried" rests on these outputs and timing only |
| Task 8c: at most 8 sessions, 20 dollars | pass | `<repo>/docs/aegis/demo/evidence/full-run-1/summary.md:14`; line costs sum to 6.513 | The D4 flag values appear in no saved output |
| Task 8d: run evidence saved | pass | `desk.html` (tickets at lines 68 to 1372), 8 init files, `summary.md` | Nit 3 |
| Task 8e: cause, side, fix; no Aegis cause fixed | fail | `<repo>/docs/aegis/demo/evidence/full-run-1/causes.md:7-13`; every cited runbook and code line | The rows and `acceptance.txt:4-13` satisfy the form. The fix text is wrong: Important 1 and 2 |
| Rules diff: four files and tests | pass | `acceptance.txt:4-13` | `fake-claude.js` is recorded as D1 |
| `PROJECT_STATE.md` unchanged | pass | `acceptance.txt:15` | none |
| No em-dash added | pass | `acceptance.txt:29-35`; U+2014 search found 0 in `checks.md`, `progress.md`, the explainer, the quiz and both evidence folders | Nit 3 |
| No rewrite or force-push | pass | `<repo>/.git/logs/refs/remotes/origin/feat/desk-instrument-fixes:1-3`, three pushes in an unbroken chain; `acceptance.txt:36-38` | Cite the reflog in the row |
| Push only where the battery passes | fail | `<repo>/checks.md:39,108` | Important 6 |
| Draft PR, template, CI green | unresolved | No PR body or final CI run is saved; `checks.md:40` | Save the final run's output |
| Evidence reviewer, corrections applied | fail | `batch7/reviews/evidence-review-1.md` does not exist (folder listing); `checks.md:41,118` | Important 3 |
| Security review table | pass | `security-review-1.md` to `-7.md`: 1, 1, 4, 3, 1, 1, 0 = 11; commits match the reflog | none |
| Code review mapping | fail | `code-review-1.md` to `-3.md` finding by finding; `<repo>/.git/logs/refs/heads/feat/desk-instrument-fixes:28-53` | Order and most commits are right. R3.10 is wrong: Important 5 |
| Run after all reviews, no code change after it | unresolved | No row. Reflog: `b8ef0d3` committed 09:00:50Z, run started 09:00:52Z; later subjects are docs or evidence only | Important 7 |
| Aegis files unchanged | pass | `acceptance.txt:4-13` | Give it its own row. D2's "expected result unchanged" has no saved diff |
| `progress.md` lines kept as written | unresolved | No row and no saved earlier version. `code-review-1.md:104` quotes part of the Verified line, and it matches | Important 7 |
| Paths written `<home>`, `<repo>` | fail | `checks.md:113`; explainer line 42; quiz line 17 | Nit 1 |
| Account name in no tracked file | pass | As Task 1 | none |
| Explainer under 60 lines | pass | `<repo>/docs/explainers/batch7-instrument-and-full-run.md`, 42 lines | No row in `checks.md` |
| Quiz: 5 questions, answers collapsed | fail | `<repo>/docs/explainers/batch7-instrument-and-full-run-quiz.md:5-9,11-19` | The structure passes. Question 3's "one line" is false: Important 1 |
| Incidents, last 2 rows | pass | `<repo>/docs/review/incidents.md:13-14`; `9ceccbe`, `c6b3252` in the reflog | none |
| Numbers: costs, turns, seconds, states, predictions | pass | `summary.md`, both terminal files; 5 of 8 predictions exact (T1, T2, T4, T6, T8) | Nit 4 covers the only soft count |

## Important

**1. "Would move" contradicts the code. It affects T2, T3, T6, T8 and the owner's first decision.**

`causes.md:3` says it reports "what the code says should happen". All paths below are under `<repo>/`.

- **T2, "one line" (`docs/aegis/demo/evidence/full-run-1/causes.md:7`, explainer line 37, quiz lines 7 and 16):**
  - `.claude/commands/gws-offboard.md` has no `verify-*` line, so a field alone binds nothing and T2 stays INCONCLUSIVE (`scripts/audit/change-record.js:197`, `scripts/demo/catalog.js:27`).
  - A field on an R1 gate fails `change-record.js:217` and `scripts/audit/read-back-field.test.js:57,63`.
  - With a run line added, `open` refuses R1 (`change-record.js:639`). The desk then closes T2 OPEN (`scripts/demo/customer-desk.js:254-255`), which is worse.
  - Right text: "Re-class this gate to R2, as the same suspend is at `.claude/commands/gws-account-containment.md:104,111`; name the read-back with `--change`; add the run line; update `read-back-field.test.js:69` (89 to 90)."
- **T6 (`causes.md:11`):**
  - "The password reset leaves no status to read, so it needs its own proof" is wrong. `scripts/adapters/okta-client.js:259` has `verify-password-reset`, `scripts/demo/sim/gates.js:66` writes the event it reads, and the answer names it (`terminal-T1-T6-T8.txt:583`).
  - Worse, all gates apply before any read-back (`customer-desk.js:512,526`). `verify-status --status SUSPENDED` would therefore read ACTIVE, give exit 2, count as FAIL (`:284`) and close T6 **FAILED** (`:552`).
  - Right text: "Needs an R2 re-class and a desk that reads back after each gate in order. As the code stands, the proposed fix closes T6 FAILED."
- **T3 (`causes.md:8`):**
  - "Add the two entries. That alone gives INCONCLUSIVE" is false. `scripts/demo/customers/tickets.json:28` has only a `jamf` target, so `gates.js:123` still returns "not simulated" and T3 stays OPEN.
  - Reaching RESOLVED also needs a Jamf entry in `scripts/demo/sim/vendors.js:24-30`, because `customer-desk.js:274` gives INCONCLUSIVE without one.
  - The wipe gate is not R1: `.claude/commands/jamf-lock-erase.md:86` gives its own reason where an R1 gate must say `R1: no change record`. So "read-backs on the R1 gates" does not cover T3.
- **T8 (`causes.md:13`, explainer line 38):** a CACHE_HIT requires T4's answer in the store, and storing needs every check to pass (`customer-desk.js:558`). T4 failed human-confirmation (`terminal-T1-T6-T8.txt:358`), as `causes.md:19` itself records. Right text: "CACHE_HIT only if T4's new answer also passes every check."
- **Summary lines (`progress.md:11`, explainer line 37):** "up to 3 tickets" should read "T2 after an R2 re-class. T3 and T6 also need desk and simulator work."

**2. Side assignments (`causes.md:7,10,11,12`).**

- **T5: the instrument label is incomplete.**
  - The desk stopped it (`customer-desk.js:482`), and `Gate: none` is what the prompt asked for (`:148`).
  - But the answer's next steps are `quarantine-release-one-portal` and `email-whitelist-method-1` (`terminal-T1-T6-T8.txt:424-425`).
  - The first says `Read-back: none` because no connector reads Defender (`.claude/commands/email-quarantine.md:80`). The second is preview only (`.claude/commands/email-whitelist.md:23`).
  - The ticket's expected path needs a read-back (`tickets.json:41`), and `progress.md:4` predicted this.
  - Right text: "instrument first, then Aegis", with those lines, matching T3's row. Update explainer line 13.
- **T7: instrument stands.**
  - The best Aegis argument is `docs/command-output-standard.md:70` ("Symptom intake first... ONE clarifying question"), since the question comes last and mid-line.
  - But the rule that decided the close is desk code (`catalog.js:77`), and the prompt never asks for a question on its own line.
  - Line 68 of `terminal-T7.txt` is the only `?` in that answer, and T5 has none, so the proposed fix reaches T7 and not T5.
  - Open point: T7 is mostly a diagnostic plan with one closing question, so "should read CLARIFY" is a judgment, not a result.
- **T2 and T6: "Aegis (runbook)" is too narrow.**
  - `Read-back: none (R1: no change record)` is required text (`read-back-field.test.js:63`), not a runbook omission.
  - T2's answer already names the read (`terminal-T1-T6-T8.txt:157`), and T6's names all three (`:581-585`).
  - The desk proves a read-back only through a change record (`customer-desk.js:246-247,528-531`). So there is also a desk-side option that changes no Aegis rule, and the owner is not told.

**3. The evidence reviewer row passes on a missing file (`checks.md:41`).** `evidence-review-1.md` does not exist, and `checks.md:118` says the corrections are still to come. Right text: "unresolved", until the report is saved and its corrections are applied.

**4. "0 times" is stronger than the evidence (`causes.md:29`, also `progress.md:5`).**

- The tool counts four regexes over the raw stream (`docs/aegis/demo/evidence/batch7/tools/full-run-evidence.js:54,64,84`).
- As far as the saved evidence shows, that stream holds events, model text, tool input and tool results. Nothing shows it carries the system prompt or loaded memory, so zero hits cannot show what was loaded. It shows only that those phrases were not emitted or returned.
- The tool's header promises "deny and memory lines", but line 61 keeps only `/deny rule/`. `session-activity.md` is titled "What each session loaded" and has no load data for any session.
- The only load evidence is the `/context` table at `isolation-probe.txt:4-8`, which is not a real session.
- The streams are not saved, so nobody can recount. The same applies to "T1's Glob returned only `tasks/continuity.md`" (`causes.md:27`).
- The init events cannot show the rules either (`isolation-probe.txt:13`), although the Verified line expects them to.
- Right text: "The phrases appear 0 times in the 8 streams. That says nothing about loading. Loading rests on one no-model probe."

**5. Read limits are overstated.**

- **Explainer line 23:** "sessions cannot read" lists six areas, but real refusals exist only for `progress.md` and `scripts/eval` (`session-activity.md:72,181-182`).
- **Whole-repo searches:** T2 grepped `<repo>`, and several sessions grepped `Customer A`, `D` and `E`, whose data sits in denied folders. Their results are not saved, so exclusion from those searches is not shown.
- **R3.10 (`checks.md:84`) says "fixed `779be42`":** the rule `docs/aegis/**/evidence/**` does not match `baseline/`. `docs/aegis/g4/baseline/ms-ticket-eval.txt:5` holds the exact line that finding quoted, and `docs/aegis/g3-closeout/baseline/ms-ticket-eval.txt:13-14` routes the mailbox tickets. That is 21 readable files. `security-review-4.md:62` flagged them. Right text: "partly fixed; the baseline trees stay readable."
- **R2.14 and R3.9 (`checks.md:79`):** the closure mentions the results folder but not the readable pointer at `docs/aegis/owner/operator-validation.md:58,108` to the case file.

**6. Invalid verdict (`checks.md:39`).** "pass, one breach recorded" is not a verdict, and a breach is a fail. Commit `c2ca749` also went out in the last push, and `1f78a38`'s subject and D12 say that commit failed the scanner. D6 does not mention it, and no scanner output at that commit is saved. Right text: "fail: D6, and `c2ca749` inside the last pushed range; the head's battery passes."

**7. Charter rules with no row.**

- No code change after the run. Add `git diff --stat b8ef0d3 HEAD -- scripts .github .claude` to `acceptance.txt`. `1f78a38` touched evidence tooling, and only subjects support "docs only".
- `progress.md`'s three lines unchanged. Save a diff against `f2be0f8`.
- Explainer length and quiz structure.
- Connector behavior and eval case files or thresholds, which are only implied by `acceptance.txt:4-13`.

**8. Task 2 row contradicts D2 (`checks.md:24` against `:104`).** "Existing tests unchanged" is false, because `f094437` changed a batch 6 test's input sentence. Right text: "existing tests unchanged except one example sentence (D2)", and cite D2 in the correction cell. `t2-green.txt:1` makes the same claim, though only for the judged suite.

**9. Unlisted scope changes (`checks.md:103-114`).** Commits `156723c` (25-minute session timeout, `customer-desk.js:55`) and `1329959` (debug log) both say "beyond the task" in their subjects. Neither has a deviation entry. Add one for each.

## Nits

1. `<repo>/checks.md:113`, explainer line 42 and quiz line 17 write `~/aegis-demo-runs/`. Change them to `<home>/aegis-demo-runs/`.
2. `causes.md:19-20` cites `checks.js:118,123`, but the regexes are at `scripts/eval/judged/checks.js:66,68`. Also, "each one keeps that answer out of the replay store" (`causes.md:17`) overstates: T3, T4, T5 and T8 never reached that branch (`customer-desk.js:558`).
3. `full-run-evidence.js:19` rewrites em-dashes in saved answers, and D12 discloses only the domains. Add this to D12. Also, D12 sits before D11 in `checks.md:113-114`.
4. `checks.md:59` and `:80`: 36 fixed and 9 closed adds up only if R2.15 and R3.14 count as fixed, yet that row also says "bundles closed". R2.8 is credited to `f5a4f9e`, while `4f976ca`'s subject claims findings 7 and 8.
5. Items left out of `checks.md`:
   - Line 76 does not address R2.9's exit-code mismatch (`customer-desk.js:18`, `code-review-2.md:61`).
   - Line 88 omits `code-review-2.md:110-111` and `code-review-3.md:113-114`.
   - Lines 94-97 omit "I fixed your account." (`security-review-2.md:53`) and the blank-line form (`security-review-7.md:44`).
   - Explainer line 20's "fails if it comes back" is true only on a machine with that account: `scripts/account-name.test.js:19,46` skips on CI.
   - `isolation-probe.txt:1` says "the desk's final flags", but its tool takes a slice (`isolation-probe.js:16`).

## Pre-existing

None to report against this change.

Skipped or not checked: I ran nothing, so every "would close" above is traced by reading the code. I could not open the PR, CI, the run folders, streams, debug logs or earlier versions of `progress.md`, and the charter text itself is not in the tree.

Risk: if the owner picks the recommended first Aegis fix as written, it breaks an existing test and closes T2 OPEN. T6 would close FAILED.
