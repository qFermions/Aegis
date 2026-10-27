# checks: batch 1, baseline and boundary

Branch `chore/baseline-and-boundary` on qFermions/Aegis, base `main` at `d5fc8c0` (the merge of PR #3). Evidence files: `docs/baseline/` (Phase 0, fresh clone) and `docs/baseline/branch/` (the battery on the branch). Verdicts: pass, fail, unresolved. The previous batch's table is kept at `docs/review/batches/review-layers-checks.md`.

## Baseline (Phase 0, fresh clone of d5fc8c0, node v24.22.1, pwsh 7.5.4)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone --depth 1 https://github.com/qFermions/Aegis /tmp/fresh` | exit 0, HEAD `d5fc8c0`; no `package.json`, no lockfile, nothing to install | `docs/baseline/clone.txt` |
| tests | `node --test` | 505 tests, 505 pass, 0 fail, exit 0 | `docs/baseline/node-test.txt` (tail) |
| Microsoft eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs, exit 0 | `docs/baseline/ms-ticket-eval.txt` |
| Google eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs, exit 0 | `docs/baseline/gws-ticket-eval.txt` |
| structure lint | `node scripts/lint/command-structure.js` | 77 commands, clean, exit 0 | `docs/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 276 files, 0 BLOCK, 170 WARN, exit 0 | `docs/baseline/pre-commit-check-all.txt` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/baseline/release-boundary-check.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE, exit 2 (snapshot HEAD `b9acd99`, live `d5fc8c0`) | `docs/baseline/check-continuity.txt` |

Floors from PR #3's head match on every row: 505 tests, 28/28 and 6/6, 38/38 and 9/9, 77 clean, 0 BLOCK, PASS. No gap.

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| A1 capability map rows carry evidence; "verified now" cites this session | pass | `docs/aegis/evidence/a1-capability-evidence.txt` (at `fbf6a15`): 36 rows, 0 failing, 0 rows whose platform is "Microsoft and Google"; status counts 18 verified now, 1 implemented but unverified, 13 partial, 4 missing; every "verified now" row cites `docs/baseline/` or `docs/aegis/evidence/` (captured 2026-10-27). Drift section: `docs/aegis/capability-map.md`, "## Drift", 20 bullets, 5 gaps resolved and 13 open | Evidence review: row 22 merged Microsoft and Google; split into rows 22 (Microsoft) and 36 (Google, Okta, Jamf), and the header states the platform rule (`fbf6a15`) |
| A2 boundary audit: no gate "none" left unnamed; every fix has its own commit and test | pass | `docs/aegis/boundary-audit.md` rows 1 to 19 and "Result": 1 violation (rows 1 and 2), fixed in `519db17` with `scripts/jira-client.test.js` and `scripts/command-safety-gates.test.js` cases; rows 4, 5 and 12 keep no code gate and are named with their reason (owner decisions). Every production-mutating path is in the C list of `.github/risk-tiers.json`; `scripts/risk_tier.test.js` 15/15 | Tier C list gained `modules/automation/scripts/deploy-check.js` and `scripts/init-memory.js`, one test case each |
| A3 three untrusted-data tests exist, run, pass; expected decision committed first | pass | `docs/aegis/evidence/a3-expected-decision-first.txt`: all three files added in `109387c` with an EXPECTED DECISION header and 0 tests; the test bodies follow in `717b585`, `e996f3d`, `1b7500c`, the fixes after them. Run: `docs/baseline/branch/node-test.txt:689-745`, 57 tests, all pass | |
| A4 harness and review layers present | pass | `docs/aegis/evidence/a4-harness-files.txt` (12 files plus `release-gate.yml`; REVIEW.md 6 headings), `docs/aegis/evidence/a4-plugin-validate.txt` (`claude plugin validate .claude/agents`: passed, exit 0), both at `dfc9da3`; at `fbf6a15`, `docs/aegis/evidence/final-head-checks.txt`: `grep -c "^## Harness$" CLAUDE.md` 1, `grep -c "^## Review$" CLAUDE.md` 1, evidence-reviewer frontmatter with tools, model, effort, and `.claude/settings.json` absent (left absent) | Head greps saved after the evidence review |
| A5 PRODUCT_CONTRACT.md changes readable line by line | pass | `PRODUCT_CONTRACT.md:125` "## Changes in this batch": each added or changed passage named with its reason, and "Nothing was removed"; `docs/aegis/evidence/final-head-checks.txt`: `git diff --numstat d5fc8c0...HEAD -- PRODUCT_CONTRACT.md` 73 added, 1 removed, the one removed line being the scope sentence the section names as changed (`2a3e11d`) | Numstat saved after the evidence review |
| A5b CLAUDE.md under 20000 bytes, moves traceable | pass | `docs/aegis/evidence/final-head-checks.txt` (at `fbf6a15`): `wc -c CLAUDE.md` 19041 (39948 at `d5fc8c0`); 18,824 characters by the repo's own measure (39,360 at `d5fc8c0`); Harness 1, Review 1; numstat 9 added, 262 removed; the boundary sentence and the Harness and Review sections identical to `d5fc8c0`. `docs/aegis/evidence/a5b-moved-lines.txt`: 139 of 143 moved non-blank lines found whole in the destination named by the move map, the other 4 are this batch's named edits. The PR body lists all 262 removed lines and the move map. Test `scripts/repository-structure.test.js` fails at 20,000 bytes | Title stays v8.7: `CHANGELOG.md`'s latest version entry is v8.9, not v8.8 (reported). The character count was first written as 18,821 (Python code points); the repo's measure (JS string length) is 18,824, corrected |
| A6 PROJECT_STATE.md verified claims point to this session | pass | `PROJECT_STATE.md` "Verified now" table: each row names the command and its capture in `docs/baseline/branch/` (clean clone at `5cc5d69`); the paragraph after it and the roadmap skeleton name the capability-map rows behind every "verified" and point to `docs/baseline/branch/node-test.txt:746-749` | Evidence review: the paragraph and the roadmap lines pointed to no capture; row numbers and capture pointers added (`fbf6a15`); counts refreshed in `38ef188` and `604cc3c` |
| A7 CI and Release Gate green on the pull request | pass | Draft PR https://github.com/qFermions/Aegis/pull/4. At `194379d`: CI run 40479052507 success, jobs verify (1 min 20 s; log: 588 tests, 588 pass, 0 fail), evals, detect, risk-tier; Release Gate run 40479052497 success, "Tests and full-tree scan" on ubuntu-latest (1 min 58 s) and windows-latest (4 min 21 s). Earlier at `604cc3c`: CI 40478557555 and Release Gate 40478557631, all green. Test count 505 to 588 equals the 83 tests this batch added | The commits after `194379d` change docs and captures only; their CI run is recorded in the PR body and the report |
| A8 no finding open; refs unchanged | pass | "Review rounds" below: 45 found, 42 fixed, 3 closed, 0 open. `docs/baseline/refs-after.txt` (09:08:47Z): every ref in `refs-before.txt` unchanged; created by this batch: `refs/heads/chore/baseline-and-boundary`, `refs/pull/4/head`, `refs/pull/4/merge` | |
| A9 baseline floors hold | pass | `docs/baseline/branch/` at `5cc5d69`: 588/588 tests (floor 505), ms 28/28 and 6/6, gws 38/38 and 9/9, lint 77 clean, scanner 0 BLOCK (170 WARN, same as Phase 0), release boundary PASS; CI at `194379d` repeats them (A7) | |
| A10 no secret, token, personal path or private email in the diff | pass | `docs/aegis/evidence/a10-diff-grep.txt` (at `fbf6a15`): the charter grep's hits are words in prose, code or test names ("org token", "API token" prompts, "secret" in scanner labels), copies of the grep command, and the capture's own earlier copy (counted per file); a second pass for real credential shapes in added lines finds 0; no `/Users/`, `C:\Users` or `@gmail` outside the quoted grep command | Evidence review: the capture named no commit and carried two U+2014 from tool output; regenerated with its commit, time and the A11 note |
| A11 no em-dash in files this batch wrote | pass | `docs/aegis/evidence/a11-long-dash.txt` (the batch diff including this commit's files): every added file and the added lines of every changed file, 0 U+2014 | 3 inherited dashes on edited lines removed (`6c988fe`); the A10 capture's 2 dashes found by the evidence review replaced with "--" and noted; tool output captures write U+2014 as "--" and say so on their last line |
| A12 dependencies and tools added | pass | `docs/baseline/dependencies.md:21-24`: Node.js 24.22.1 (MIT, nvm) and PowerShell 7.5.4 (MIT, release tarball with its sha256); nothing installed from the repo (no manifest) | |
| A13 no real tenant, device, ticket system, scheduler, mailbox or payment call | pass | Fixtures: `scripts/untrusted/fixtures/` (12 files: injection-pasted-ticket.txt, injection-replay-solution.md, injection-wipe-artifacts.json, injection-wipe-preapproved.txt, poison-kb-solution.md, poison-proposals.json, tenant-artifacts.json, tenant-b2b-guest-ticket.txt, tenant-foreign-ticket.txt, tenant-mixed-ticket.txt, tenant-proposal.json, tenant-solution.md); tenants are RFC example domains set per child process; Jira tests pass an in-memory `fetch` queue (`scripts/jira-client.test.js` `queuedFetch`) and the default fetch throws "Network tripwire fired"; `docs/aegis/evidence/boundary-grep-io.txt`: the only HTTPS client in code is the Jira client | |

## Review rounds

Each round ran `/security-review` on the branch, then `/code-review xhigh` (tier C; REVIEW.md read first). Round 1 covered the whole branch against `main`; rounds 2 and 3 covered only the diff since the previous round's fixes. Finding ids are round.number in the order the reviewer returned them; the raw findings are in this session's transcript.

| round | security review | code review found | fixed | closed | fixed + closed = found |
|---|---|---|---|---|---|
| 1 (branch) | 0 findings | 15 | 14 | 1 | yes |
| 2 (diff since `281f5d1`) | 0 findings | 15 | 13 | 2 | yes |
| 3 (diff since `f74c575`) | 0 findings | 15 | 15 | 0 | yes |

### Round 1

| id | file:line | finding | outcome | commit or reason |
|---|---|---|---|---|
| 1.1 | scripts/memory/memory-cli.js:107 | verify, merge, mark-stale and promote re-seal a record changed on disk | fixed | `0e94ad9` (B9) |
| 1.2 | scripts/replay/replay-cli.js:505 | lookup and render serve a stored solution with no read-time check | fixed | `e27552d` (A6) |
| 1.3 | CLAUDE.md:118 | the diet moved always-on script gates out of CLAUDE.md | fixed | `fa6e0e4` (repository-structure case) |
| 1.4 | scripts/jira-client.js:671 | verify-transition passes on any status other than the old one | fixed | `fb7146c` ("verify-transition proves the same immutable request left the preflight status and fails closed otherwise", `scripts/jira-client.test.js`) |
| 1.5 | scripts/graph/sanitize.js:155 | PII patterns carry /g with .test(), so lastIndex skips hits | fixed | `ae3ea89` (B8) |
| 1.6 | scripts/memory/memory-cli.js:222 | tenant check runs before the lock (race) | fixed | `7864929` (C10) |
| 1.7 | scripts/memory/memory-store.js:141 | problem text names attacker-chosen key names | fixed | `0e94ad9` (B10) |
| 1.8 | scripts/memory/memory-cli.js:561 | list prints index summaries with no integrity check | fixed | `0e94ad9` (B11) |
| 1.9 | scripts/jira-client.js:339 | printed procedures work only in POSIX shells | fixed | `59f86c5` (pwsh and bash run test) |
| 1.10 | scripts/graph/sanitize.js:143 | tenant-literal BLOCK matches only the raw line | fixed | `ae3ea89` (C9) |
| 1.11 | scripts/jira-client.js:637 | verify-create identity check is tautological | fixed | `fb7146c` ("verify-create proves the human-created request by an independent GET and fails closed on any mismatch": an older request with the same text fails `--not-before`) |
| 1.12 | scripts/memory/memory-cli.js:537 | withheld hits take top-K slots and are not back-filled | closed | Bounded retrieval by design: a withheld row costs one slot (availability) and serves no text (integrity holds); back-filling would let a poisoned row steer which records surface. |
| 1.13 | scripts/memory/memory-cli.js:246 | withLock binds the store before the write, so a refused write binds it | fixed | `7864929` (C10) |
| 1.14 | scripts/graph/sanitize.js:100 | org-token rule misses mixed-case and multi-segment names | fixed | `ae3ea89` (C8) |
| 1.15 | scripts/graph/sanitize.js:75 | confusable folding re-implemented instead of reused | fixed | `ae3ea89` (refactor, no new test: the A2 and B1 obfuscation cases pin the behavior) |

### Round 2

| id | file:line | finding | outcome | commit or reason |
|---|---|---|---|---|
| 2.1 | scripts/memory/memory-cli.js:115 | refuseIfChangedOnDisk skips a row with no seal | closed | An unsealed row is the documented migration path for pre-seal stores (README residual); retrieve still withholds it, and verify still runs every persist gate before sealing. |
| 2.2 | scripts/jira-client.js:665 | --from-version is printed unquoted from Jira's iso8601 text | fixed | `e9aeceb` ("a status version that is not a plain timestamp is refused before anything is printed to paste") |
| 2.3 | scripts/memory/memory-cli.js:591 | list still prints type, status, scope of a changed row | fixed | `2b02e36` (B13) |
| 2.4 | scripts/memory/memory-store.js:161 | sanitizer problem paths name nested keys | fixed | `2b02e36` (B13) |
| 2.5 | scripts/replay/replay-cli.js:578 | status and list print stored text unchecked | fixed | `41347c3` (A7) |
| 2.6 | scripts/graph/sanitize.js:110 | any bracket token exempts the whole line from the PII scan | fixed | `26ecaab` (B12) |
| 2.7 | scripts/tier/tier-guard.js:132 | chat handles read as a second tenant | fixed | `99cb18d` (C11) |
| 2.8 | scripts/tier/tier-guard.js:132 | a space inside the brackets hides a foreign token | fixed | `99cb18d` (C11) |
| 2.9 | scripts/tier/tier-guard.js:141 | containsLiteral folds the text but not the literal | fixed | `99cb18d` (C12) |
| 2.10 | scripts/jira-client.js:376 | PowerShell line sends JSON with no charset | fixed | `e9aeceb` (charset assertion in "printed procedures never carry the token, make curl prompt for it, and quote text for the shell", `scripts/jira-client.test.js:679`) |
| 2.11 | scripts/memory/memory-cli.js:260 | the lock is released twice (finally and exit) | fixed | `766e23c` (B14) |
| 2.12 | scripts/jira-client.js:25 | header example shows a verify form that now fails | fixed | `70fc82a` ("verify commands refuse a free-text flag instead of ignoring it, before credentials or network") |
| 2.13 | scripts/replay/replay-cli.js:209 | replay re-runs pattern gates instead of sealing case files | closed | Sealing would withhold every existing verified case until re-verified: an owner decision, put to the owner in the report; the read-time gates stay and the residual is in the README. |
| 2.14 | scripts/graph/sanitize.js:116 | each line is folded once per check | fixed | `99cb18d` (efficiency, no new test; C9, C11 and C12 pin the behavior) |
| 2.15 | progress.md:1 | progress.md stale after round 1 | fixed | `f74c575` (docs, no test) |

### Round 3

| id | file:line | finding | outcome | commit or reason |
|---|---|---|---|---|
| 3.1 | scripts/tier/tier-guard.js:132 | an unclosed [@Aegion_ swallows the next foreign token | fixed | `4a22024` (C13) |
| 3.2 | scripts/tier/tier-guard.js:136 | camelCase and digit spellings pass; word list is a hand copy | fixed | `4a22024` (C13, C14) |
| 3.3 | scripts/replay/replay-cli.js:571 | status and list print caseId, status, deps and provenance unchecked | fixed | `bd6b358` (A9) |
| 3.4 | scripts/replay/replay-cli.js:204 | history scanned as JSON, so a newline-split marker passes | fixed | `bd6b358` (A9) |
| 3.5 | scripts/replay/replay-cli.js:474 | lookup STALE echoes stored history and crashes on an empty one | fixed | `b8511a4` (A10) |
| 3.6 | scripts/tier/tier-guard.js:161 | an upper-case bracket hides a real phone number from PII gates | fixed | `585f788` (B15) |
| 3.7 | scripts/tier/tier-guard.js:130 | a space after "@" or before "_" hides a foreign token | fixed | `4a22024` (C13) |
| 3.8 | scripts/tier/tier-guard.js:136 | handles with a common word ([@bob_site_visit]) hard-block a ticket | fixed | `4a22024` (C13) |
| 3.9 | scripts/memory/memory-cli.js:263 | the lock flag is process-local; stealers delete each other's lock | fixed | `fe05385` (B16) |
| 3.10 | scripts/jira-client.js:476 | a status version like "--execute" prints a line that never parses | fixed | `ad1b7f8` ("a status version that does not start with a digit is refused, so the printed verify line always parses") |
| 3.11 | checks.md:1 | checks.md has no per-finding record of the rounds | fixed | `5cc5d69`, which added this table (docs, no test) |
| 3.12 | scripts/graph/README.md:158 | unbalanced parentheses garble the org-token sentence | fixed | `51efa48` (docs, no test) |
| 3.13 | scripts/graph/sanitize.js:40 | header still says placeholders exempt the line | fixed | `11501b9` (comment, no test) |
| 3.14 | scripts/tier/tier-guard.js:149 | the literal is re-folded on every call | fixed | `c13680f` (efficiency, no new test; C9 and C12 pin the behavior) |
| 3.15 | scripts/graph/sanitize.js:116 | scanText copies the marker loop instead of injectionMarkersIn | fixed | `092ca47` (A8) |

Deviation (one commit per finding): nine commits carry two to four findings each: `ae3ea89` (1.5, 1.10, 1.14, 1.15), `0e94ad9` (1.1, 1.7, 1.8), `7864929` (1.6, 1.13), `fb7146c` (1.4, 1.11), `99cb18d` (2.7, 2.8, 2.9, 2.14), `2b02e36` (2.3, 2.4), `e9aeceb` (2.2, 2.10), `4a22024` (3.1, 3.2, 3.7, 3.8), `bd6b358` (3.3, 3.4). In each, the findings sit in the same function or the same lines and one change fixes them together; the batch instruction asks to "group findings by class so one fix covers every instance", while `CLAUDE.md`'s Review section asks for one commit per finding, so this is recorded as a deviation. Every finding names its commit above. 35 of the 42 fixes carry a test that fails before the fix and passes after it; the other 7 are docs, comment, efficiency or refactor fixes (1.15, 2.14, 2.15, 3.11, 3.12, 3.13, 3.14) whose behavior, where there is any, the existing tests named in their rows pin.

## Evidence review

One run of the evidence-reviewer agent (read-only; given checks.md, the acceptance checks, and the saved outputs) on the branch at `194379d`. Its verdicts: 18 rows, 12 pass, 4 fail (A1, A6, A11, progress.md), 2 unresolved (A5b, A7); 17 factual errors (12 important, 5 nits). Every error was corrected or answered; the rows above carry the verdicts after the corrections.

| # | error | correction |
|---|---|---|
| 1 | progress.md stale (said not pushed, no PR, no CI) | rewritten in the commit that adds this section |
| 2 | "fixed with a test each" is false for 13 findings | 35 of 42 fixes have a test; every row now names its test or says why there is none; PROJECT_STATE.md, the explainer and the deviation note say so (`fbf6a15`) |
| 3 | the grouped-commit note read as a REVIEW.md quote | the quote is attributed to the batch instruction and CLAUDE.md's one-commit rule is named (`fbf6a15`) |
| 4 | A11 said 0 dashes; the A10 capture had 2 | capture regenerated with "--" and a note; A11 re-run over the batch diff including this commit |
| 5 | Jira line citations stale at the head | capability-map row 32 and boundary-audit row 1 cite the head lines (`fbf6a15`) |
| 6 | row 3's procedure modules are not all tier C | boundary audit states the exception: modules outside `modules/security/` are tier B, text a human runs (`fbf6a15`) |
| 7 | drift tally stale | release status and Okta/Jamf/macOS/Zoom scope marked resolved; 5 resolved, 13 open (`fbf6a15`) |
| 8 | "every dangerous pair floored" is false | explainer: "kept apart" (`fbf6a15`) |
| 9 | runbook gates backed by the lint | explainer cites the 287 safety-gate tests (`fbf6a15`) |
| 10 | "Microsoft and Google kept apart" not true of row 22 | row 22 split into rows 22 and 36; the map header states the platform rule; row 11 no longer names Okta (`fbf6a15`) |
| 11 | the map's description of its captures was wrong | header names the commit each capture set ran at; the acceptance captures carry commit and time |
| 12 | several claims had no saved output | `docs/aegis/evidence/final-head-checks.txt` (bytes, characters, headings, numstats, boundary sentence and sections unchanged, settings files absent, agent frontmatter, inventory counts); CI run IDs and durations in A7 |
| 13 | PROJECT_STATE.md "Partial" incomplete | names all 13 partial rows and row 5 (`fbf6a15`) |
| 14 | finding 3.11 named no commit | `5cc5d69` (`fbf6a15`) |
| 15 | A6 credited the wrong commit | `38ef188` (line citations) and `604cc3c` (counts) |
| 16 | row 31 citation range missed Okta and macOS | `:121-157`, `:159-163`, `:190-201` (`fbf6a15`) |
| 17 | CHANGELOG "Tests" omitted the script-gates test | added (`fbf6a15`) |

Found while saving the captures for error 12: the character count 18,821 was a Python code-point count; the repo's own measure is 18,824 (corrected in checks.md, CHANGELOG.md and the PR body).
