# checks: batch 8 (short answers a tech can use, a desk a non-coder can read, then run it twice)

Branch `feat/desk-v2-plain-answers`, base `feat/desk-instrument-fixes` at `abb6ea6`. Verdicts: pass, fail, unresolved. The batch 7 table is at `docs/review/batches/batch7-checks.md`. Local paths in captures are written `<home>`, `<repo>` and `<tmp>`; each long dash in a capture is written `-` (the repo's rule).

This Mac has no `pwsh`, so 41 tests in `scripts/command-safety-gates.test.js` fail here at the base and the head; CI has `pwsh` and runs them. The battery runs with `TMPDIR=/private/tmp`, as batch 7 ran it (decision C2).

## Battery

| check | command | base `abb6ea6` (`docs/aegis/demo/evidence/batch8/baseline/`) | final code |
|---|---|---|---|
| tests | `node --test` | 1970 tests, 1928 pass, 41 fail, 1 skipped | unresolved: not run yet |
| under the tripwire | `NODE_OPTIONS="--require <repo>/scripts/adapters/socket-tripwire.js" node --test` | the same counts | unresolved |
| four ticket evals | `node scripts/eval/{ms,gws,g2,g3}-ticket-eval.js` | exit 0 | unresolved |
| lint | `node scripts/lint/command-structure.js` | exit 0 | unresolved |
| scanner | `node scripts/pre-commit-check.js --all` | exit 0 | unresolved |
| release boundary | `node scripts/harness/release-boundary-check.js` | exit 0 | unresolved |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | unresolved |

## Acceptance

| requirement | verdict | evidence | correction |
|---|---|---|---|
| Task 1: a test parses three fixture answers (routine, multi-system, security): card first, five parts in order, at most 150 words, no command, no gate id, aegis-desk block last | pass | `scripts/demo/answer.test.js`; fixtures `scripts/demo/fixtures/answers/`; red `batch8/t1-red.txt` (module missing), green `batch8/t1-green.txt` (4 of 4) | the red is a missing module, not a wrong behavior: the parser was written first (D1) |
| Task 1: the format is in CLAUDE.md's rules within its size check, detail in `docs/aegis/answer-format.md`, linked | pass | `CLAUDE.md` "## Answer format"; `wc -c CLAUDE.md` 19885 (test: under 20000, `scripts/repository-structure.test.js:161`) | none |
| Task 1: no Aegis-side text quotes or paraphrases the 16 tickets | pass | `batch8/t1-no-ticket-quotes.txt`: CLAUDE.md, `docs/aegis/answer-format.md` and the three fixtures share 0 four-word runs with the 16 tickets' bodies and titles; read by hand too: the examples are a shared calendar, a new starter, a phishing click and a full mailbox | a word-run check cannot see a paraphrase; the hand reading covers that |
| Task 2: rename to "Default environment (used only when no customer profile is given)" and one line that a profile replaces it | pass | `CLAUDE.md` heading and line; commit `e7f1e53` | none |
| Task 2: the desk prompt carries the right customer's profile and no other's | pass | `customer-desk.test.js` "task 2: each session gets its own customer profile"; red/green `batch8/t2-t5-t6-red.txt`, `t2-t5-t6-green.txt` | none |
| Task 3: four gates re-classed R2 with read-backs and run lines; counts moved in their own commits; lint clean | unresolved | subagent worktree, not merged yet | |
| Task 4: identity step in `/mfa-issue` before the first gate; test; lint clean | unresolved | subagent worktree | |
| Task 5: two-gate ticket whose first read-back fails: the second gate is never applied | pass | `customer-desk.test.js` "task 5: when the first gate's read-back fails"; red/green as task 2 | none |
| Task 5: an R1 gate with a named read-back runs it | pass | `customer-desk.test.js` "task 5: an R1 gate with no change record still gets the read" | none |
| Task 6: CLARIFY counts a question mark anywhere in the line; T7's full-run-1 answer | pass | `customer-desk.test.js` "task 6: a question counts wherever"; fixture `scripts/demo/fixtures/full-run-1/T7-answer.txt` | an all-bold line stays a heading (kept from batch 6) |
| Task 6: INVESTIGATE, its rule in one sentence in the README, T5's full-run-1 answer, and an answer naming a change does not close INVESTIGATE | pass | `scripts/demo/README.md` "Closing states"; `customer-desk.test.js` "task 6: an answer that only looks"; `answer.test.js` "the INVESTIGATE step rule" | none |
| Task 6: simulator entries for T3 (two Google password gates, the Jamf lock with a Jamf simulated vendor); a `Read-back: none` gate still ends INCONCLUSIVE | pass | `sim/gates.js`, `sim/vendors.js`; `customer-desk.test.js` "task 6: T3's Google password gates" and "the Jamf simulated vendor" | none |
| Task 7: profile.md per customer: stack, identity rule or [org gap], approver, hours; fictional, placeholders, example domains | pass | `scripts/demo/customers/{a,b,c,d,e}/profile.md`; `customers.test.js` "task 7: every customer has a profile" | written with its test in one step (D1) |
| Task 8: five new rows on step 5 (card first, five parts, 150 words, no command outside the block, no default fact the profile lacks), pass or fail, a fail does not stop the ticket, the existing checks unchanged | pass | `customer-desk.test.js` "task 8"; `answer.test.js` "task 8"; red/green `batch8/t8-red.txt`, `t8-green.txt` | the desk wiring was written before its desk test; the red sets it aside (D1) |
| Task 9: renamed steps, a plain sentence first, technical text folded, step 4 card first, step 6 phrase, step 8 yes or no; no forbidden word, at most 25 words per plain sentence | pass | `render.test.js` "task 9" (3 tests); red/green `batch8/t9-red.txt`, `t9-green.txt` | words are matched whole and quoted text is skipped (C12) |
| Task 9: one screenshot at 1280 px of T1, as base64 text | unresolved | taken from Run A's page after the run | |
| Task 10: deny older baseline folders; judged-eval passes runRoot; one TMPDIR helper for four callers; tests first | unresolved | subagent worktree | |
| Task 11: predictions for all 16 written before either run | pass | `progress.md` line 5, in commit `4b3072d`, before any run | none |
| Task 11: Run A and Run B under the 16-session, 30 US dollar limit, one ticket at a time | unresolved | not run yet | |
| Rules: `git diff --stat abb6ea6 -- .claude CLAUDE.md PRODUCT_CONTRACT.md scripts/adapters scripts/audit scripts/replay scripts/eval` shows only the allowed files | unresolved | after the merge | |
| Push only when the battery passes | unresolved | | |
| Every review finding fixed in its own commit (CLAUDE.md, Review) | fail | round 1: findings 2 and 8 share `74b2c9e`, 4 and 9 share `ea3657e`, 6, 7, 10 and 15 share `3e9abba`, 13 and 14 share `87fa578`; round 2: eleven findings in `6021cd8`. Found by code review 3 (finding 7). History is not rewritten | round 3's fixes went one class per commit; grouping by class is allowed by the batch's review rules, grouping across classes was not |
| Battery before the second push, at the frozen code `de55c4d` | pass | `batch8/final-battery/`: 2021 tests, 1979 pass, 41 fail (the base's names), 1 skipped, in both runs; the four ticket evals, the lint, the scanner, the release boundary and the replay demo exit 0 | none |
| Every commit passes its own tests | fail | (1) `d79298b` fails `scripts/demo/wiring.test.js` (a long dash in the evidence tool), fixed forward in `95cd1e3`. (2) Every commit from `01b8be6` to the merge fails one test in `scripts/command-safety-gates.test.js`, "every discovered manual portal mutation has one action-local gate or preview owner", because the fixture `multi-system.md` holds "Users → Add a user"; my per-commit gate ran only the demo suite and the scanner, and the full battery after the merge found it; fixed forward by D3. (3) The subagent's task 3 runbook commits come before the commits that move the counts, as the charter asks ("each in its own commit"), so those runbook commits fail the count tests until the next one. None of these commits had been pushed when found; history is not rewritten | each commit now runs the whole `node --test` before it is made |

## Review rounds

| round | range | findings | fixed | closed (reason) | record |
|---|---|---|---|---|---|
| security 1 | `abb6ea6..6705ff0` | 0 | 0 | 0 | `batch8/reviews/security-review-1.md` |
| code 1 (xhigh, tier C) | `abb6ea6..bffecff` | 15 | 13, in 10 commits (`f20eaaf` to `87fa578`) | 2: #13's pattern copy (scripts/audit is outside the allowed files), #15's repeated parse (no measurable cost) | `batch8/reviews/code-review-1.md` |
| security 2 | `bffecff..71a0388` | 1 (Medium) | 1 (`4b60407`) | 0 | `batch8/reviews/security-review-2.md` |
| code 2 (xhigh) | `bffecff..4b60407` | 15 | 11, in `6021cd8` (one class per bullet) | 4: #2 (the safe side), #5 (CLAUDE.md per-step verify), #13 and #14 (owner decisions, outside this batch's files or scope) | `batch8/reviews/code-review-2.md` |
| security 3 | `4b60407..8e6e589` | 1 (Low to Medium) | 1 (`1775639`) | 0 | `batch8/reviews/security-review-3.md` |
| code 3 (xhigh, last) | `4b60407..1775639` | 14 | 12, one class per commit (`397a6b2` to `98226c3`) | 1: #5 (the safe side, and the card already fails its parts check); #7 recorded as a fail row below | `batch8/reviews/code-review-3.md` |
| security 4 (final) | `8e6e589..da7745d` | 1 (Medium) | 1 (`b68ab07`) | 0 | `batch8/reviews/security-review-4.md` |
| security 5 | `da7745d..b68ab07` | 1 (Low, older than the range) | 1 (`de55c4d`), not the reviewer's "scan every line", which would stop T5 closing INVESTIGATE | 0 | `batch8/reviews/security-review-5.md` |
| security 6 | `b68ab07..de55c4d` | 0 at 80% or more | 0 | 3 label-only notes below the threshold, recorded as known limits | `batch8/reviews/security-review-6.md` |

## Deviations and decisions

- **C1:** ponytail has no "off" level; the instruction counts as its "normal mode".
- **C2:** battery with `TMPDIR=/private/tmp`; this session's own TMPDIR is a `/var/folders` path behind a link, and 20 more tests refuse linked paths there.
- **C3:** the messy tickets are a second set behind `--set messy`; the tidy set stays the default, so Run A is the plain command.
- **C4 to C9:** six old desk tests change because this batch changes their behavior on purpose, each with a comment in the test and named in commit `d8176c0`: the pinned prompt lines (tasks 1 and 2); a rhetorical question is CLARIFY (task 6); a quoted-Gate answer with one look step is INVESTIGATE (task 6); the "read fails, another cannot run" case runs GitHub first (task 5); worst exit is now exit 5 then 0 (task 5); T6's three gates resolve one at a time (task 5). Also the hand-counted summary and the state list gain INVESTIGATE, the page test pins the new step names (task 9), and the wiring list gains `answer.test.js`.
- **C10:** a simulator error must still apply nothing, so every gate is first applied in order to a copy in memory; only a failed read-back can stop a ticket after a gate was applied.
- **C11:** "command" in the Fix card rules means node, npm and other package tools, and this repository's scripts. PowerShell cmdlets stay allowed under Details, labeled, as CLAUDE.md rule 3 says.
- **C12:** the plain-word check reads whole words ("shared" is not "sha", "investigate" is not "gate") and skips quoted text: the customer's message and Aegis's own answer.
- **D1:** for task 1 and task 8 some code came before its test; each red run says so.
- **D3:** answers stored in the repository (the test fixtures, and Run A and Run B's saved answers) are `.txt`, not `.md`. `scripts/command-safety-gates.test.js` reads every tracked markdown file as operator instructions and requires each portal change step to sit beside its own SAFETY GATE or PREVIEW ONLY marker. A stored answer is test input or recorded model output, not an instruction, and the check stays unchanged. It also shows a design question for the owner: the new answer format puts gate ids in the closing aegis-desk block, away from the steps, so an answer saved as a document would never meet that rule.
