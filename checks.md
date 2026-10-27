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
| A1 capability map rows carry evidence; "verified now" cites this session | pass | `docs/aegis/evidence/a1-capability-evidence.txt`: 35 rows, 0 failing; every row has file or command evidence, and all 17 "verified now" rows cite `docs/baseline/` or `docs/aegis/evidence/` (captured 2026-10-27). Drift section: `docs/aegis/capability-map.md:47`, 20 bullets | |
| A2 boundary audit: no gate "none" left unnamed; every fix has its own commit and test | pass | `docs/aegis/boundary-audit.md` rows 1 to 19 and "Result": 1 violation (rows 1 and 2), fixed in `519db17` with `scripts/jira-client.test.js` and `scripts/command-safety-gates.test.js` cases; rows 4, 5 and 12 keep no code gate and are named with their reason (owner decisions). Every production-mutating path is in the C list of `.github/risk-tiers.json`; `scripts/risk_tier.test.js` 15/15 | Tier C list gained `modules/automation/scripts/deploy-check.js` and `scripts/init-memory.js`, one test case each |
| A3 three untrusted-data tests exist, run, pass; expected decision committed first | pass | `docs/aegis/evidence/a3-expected-decision-first.txt`: all three files added in `109387c` with an EXPECTED DECISION header and 0 tests; the test bodies follow in `717b585`, `e996f3d`, `1b7500c`, the fixes after them. Run: `docs/baseline/branch/node-test.txt:689-745`, 57 tests, all pass | |
| A4 harness and review layers present | pass | `docs/aegis/evidence/a4-harness-files.txt` (12 files plus `release-gate.yml` exist; Harness 1, Review 1; REVIEW.md 6 headings; evidence-reviewer frontmatter has tools, model, effort; `.claude/settings.json` absent and left absent); `docs/aegis/evidence/a4-plugin-validate.txt` (`claude plugin validate .claude/agents`: passed, exit 0). At the head: `grep -c "^## Harness$" CLAUDE.md` 1, `grep -c "^## Review$" CLAUDE.md` 1 | |
| A5 PRODUCT_CONTRACT.md changes readable line by line | pass | `PRODUCT_CONTRACT.md:125` "## Changes in this batch": each added or changed passage named with its reason, and "Nothing was removed"; `git diff --numstat d5fc8c0...HEAD -- PRODUCT_CONTRACT.md`: 73 added, 1 removed, the one removed line being the scope sentence the section names as changed (`2a3e11d`) | |
| A5b CLAUDE.md under 20000 bytes, moves traceable | pass | `wc -c CLAUDE.md`: 19041 (was 39948; characters 39360 to 18821); `grep -c "^## Harness$"` 1, `grep -c "^## Review$"` 1; `docs/aegis/evidence/a5b-moved-lines.txt`: 139 of 143 moved non-blank lines found whole in the destination named by the move map, the other 4 are this batch's named edits; the PR body lists all 262 removed lines and the move map; test `scripts/repository-structure.test.js` fails at 20,000 bytes | Title stays v8.7: `CHANGELOG.md`'s latest version entry is v8.9, not v8.8 (reported) |
| A6 PROJECT_STATE.md verified claims point to this session | pass | `PROJECT_STATE.md:18-26`: each "Verified now" row names the command and its capture in `docs/baseline/branch/` (clean clone at `5cc5d69`, 2026-10-27) | Line citations and suite sizes refreshed after round 3 (`38ef188`) |
| A7 CI and Release Gate green on the pull request | unresolved | Draft PR https://github.com/qFermions/Aegis/pull/4. At `604cc3c`: CI run 40478557555 success; Release Gate run 40478557631 in progress. Final head not yet run | Recorded after the final push |
| A8 no finding open; refs unchanged | pass | "Review rounds" below: 45 found, 42 fixed, 3 closed, 0 open. `docs/baseline/refs-after.txt` (09:08:47Z): every ref in `refs-before.txt` unchanged; created by this batch: `refs/heads/chore/baseline-and-boundary`, `refs/pull/4/head`, `refs/pull/4/merge` | |
| A9 baseline floors hold | pass | `docs/baseline/branch/`: 588/588 tests (floor 505), ms 28/28 and 6/6, gws 38/38 and 9/9, lint 77 clean, scanner 0 BLOCK (170 WARN, same as Phase 0), release boundary PASS | |
| A10 no secret, token, personal path or private email in the diff | pass | `docs/aegis/evidence/a10-diff-grep.txt`: the charter grep prints 371 lines, every one a word in prose or code ("org token", "API token" prompts, "secret" in scanner labels, test names) or a copy of the grep itself; per-file counts listed; a second pass for real credential shapes in added lines finds 0; no `/Users/`, `C:\Users` or `@gmail` outside the quoted grep command | |
| A11 no em-dash in files this batch wrote | pass | `docs/aegis/evidence/a11-long-dash.txt`: 78 added files and the added lines of 28 changed files, 0 U+2014 | 3 inherited dashes on edited lines removed in the A11 commit; tool output captures write U+2014 as "--" and say so on their last line |
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
