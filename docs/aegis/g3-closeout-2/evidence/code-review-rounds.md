# Code review rounds (batch G3 close-out 2, `/code-review xhigh`, tier C)

REVIEW.md was read before each round. Round 1 reviewed the branch against its base (`f086c88..09f9743`). Later rounds review only the diff added after the round before. Each finding is fixed in its own commit (a red test first where code or a pinned runbook line changes) or closed with a one-line reason here and in `checks.md`.

## Round 1 (`f086c88..09f9743`): 15 found

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `scripts/audit/change-record.js:186` | a Fleet read that got no answer (timeout, 404) recorded run null and blocked the change forever, and status claimed `fleet:verify-script` records no run id | fixed: for a read-back that records run ids, a read with no run id is listed as uncounted and neither counts nor blocks | `e537958` (red), `d2b3a6d` |
| 2 | `scripts/adapters/fleet-client.js:643` | a pass whose answer named no execution_id counted with no deduplication, so one execution read N times reached done | fixed: such a pass is uncounted | `e537958` (red), `d2b3a6d` |
| 3 | `scripts/audit/change-record.js:181` | an Okta remove change counts `verify-group-member` reads made without `--absent` (the trail does not record the flag) | closed: not introduced here; every Okta remove change since batch G3, the one-person gate included, binds the same read-back, so the fix (recording which form of a read-back ran, across connectors with an `--absent` form) is a trail-schema change for the owner; listed in the PR's decisions | none |
| 4 | `scripts/audit/change-record.js:192` | for a read-back with no run id, a failed read blocked done forever and a re-read pushed k past N | fixed: a failed read stays listed but does not block, and the change is done once N passed | `e537958` (red), `d2b3a6d` |
| 5 | `scripts/audit/change-record.js:191` | with no run id, one object read N times reaches done | closed: the owner's decision 2 accepts it for read-backs that take no run id ("say in the status output that a repeated read of the same object is not detected", which status does), and the keyed object digest that would close it is decision 3, parked | none |
| 6 | `scripts/audit/change-record.js:232` | a mistyped gate id fell back to the one-read-back rule | fixed: open refuses a gate the named runbook does not have | `e537958` (red), `264a8ea` |
| 7 | `.claude/commands/mfa-issue.md:51` | the R3 and R2 actions did not require the pre-state checkpoint or a written rollback path (CLAUDE.md R3 row, contract rule 1) | fixed | `e537958` (red), `d481d62` |
| 8 | `.claude/commands/mfa-issue.md:52` | `verify-mfa-cleared` passes only before the user registers again, but ran "after the person finishes" | fixed: run right after the gate, before step 2 | `e537958` (red), `0d103f1` |
| 9 | `.claude/commands/mfa-issue.md:111` | the checklist and note required `verify-mfa-cleared` on the one-method delete path too | fixed: each path has its own proof | `e537958` (red), `e07ae85` |
| 10 | `.claude/commands/fleet-device-actions.md:204` | the counted-change open sat after the PORTAL ACTION | fixed: before the gate | `e537958` (red), `29d3110` |
| 11 | `scripts/adapters/cli-support.js:107` | the UUID rule was copied instead of taken from the trail | fixed: `audit-log.js` exports `RUN_IDS` and `RUN_ID`, cli-support uses them | `e537958` (red), `8dca02c` |
| 12 | `docs/aegis/boundary-audit.md:69` | rows 35 and 37 cited moved lines | fixed | `e02d4dd` |
| 13 | `progress.md:8` | progress.md was not rewritten after the security review | fixed | the commit that adds this file |
| 14 | `scripts/audit/change-record.js:155` | changeView built link maps before the counted return, and a bound counted read-back still prints its audit seq | fixed for the early return (`d2b3a6d`); the audit-seq part closed: the seq is harmless, a counted change's printed next step names no link, and a link still records a valid join | `d2b3a6d` |
| 15 | `docs/security/STATE_CHANGE_INVENTORY.json:5721` | the role line in the one-method delete's region gave that gate "permission-related" and not the re-register gate | fixed: the role line follows its own gate; the inventory against `f086c88` is 1 entry added, gated, 0 changed | `e4caabe` |

Round 1: 15 found, 12 fixed, 2 closed (3, 5), 1 fixed in part and closed in part (14); fixed plus closed equals found.

## Round 2 (`09f9743..9966e7c`, diff only): 15 found

The reviewer reproduced findings 2 and 3 against a scratch audit folder. Red tests for findings 1 to 6, 8 to 10 and 13 to 15 first (`92e1b41`, 7 of 153 failing, `r2-red.txt`); green after the fixes (`r2-green.txt`, 670/670 over the touched suites).

| # | file:line (as reported) | finding | outcome | commit |
|---|---|---|---|---|
| 1 | `scripts/audit/change-record.js:221` | with no run id, a failed read no longer blocked, so a batch with a known failed object read done | fixed: a failed read keeps the change not done and is named; round 1 finding 4 is reversed | `be8f44a` |
| 2 | `scripts/audit/change-record.js:86` | a missing runbook passed checkGate silently, so a misspelled `--command` skipped the gate check | fixed: `--command` must have the trail's COMMAND shape and name a runbook that exists | `def84ea` |
| 3 | `scripts/audit/change-record.js:268` | the gate was checked after the count, so a misspelled counted gate given `--expected` was told to drop it | fixed: the gate is checked first | `0c2561a` |
| 4 | `scripts/audit/change-record.js:210` | a Fleet failure that got an answer but recorded no run id was uncounted, so it never blocked | fixed: an answered failure blocks; only a read with no answer is uncounted | `66bd082` |
| 5 | `scripts/audit/change-record.js:233` | more passes than N read done for a read-back with no run id | fixed: partial, as with run ids | `f75eb4a` |
| 6 | `scripts/adapters/fleet-client.js:350` | verify-script verified an answer with no execution_id that status then would not count | fixed: it verifies only when the answer names the execution asked for | `6b84594` |
| 7 | `docs/aegis/boundary-audit.md:70` | row 36 cited stale audit-log.js lines | fixed: rows 36 and 37 cite current lines, each read back | `ebb435f` |
| 8 | `.claude/commands/mfa-issue.md:50` | the role line came after the PORTAL ACTION | fixed: the role opens the re-register PORTAL ACTION; the inventory's re-register entry now has the one-method delete's categories | `6969649` |
| 9 | `scripts/audit/change-record.js:277` | open's next step promised "distinct" for a read-back with no run id | fixed: "read each of the N objects once: a re-read of the same object is not detected" | `96390a9` |
| 10 | `.claude/commands/mfa-issue.md:29` | the R2 revocation recorded "no pre-state to restore" against CLAUDE.md contract rule 1 | fixed: the user's recent sign-ins from `msgraph-client.js sign-ins` saved to `tasks/checkpoints/` | `9694444` |
| 11 | `scripts/audit/change-record.js:196` | round 1 findings 1, 2, 4 and 14 were fixed in one commit, `d2b3a6d` | closed: `d2b3a6d` is pushed and history is not rewritten on this branch; the part this finding worried about (round 1 finding 4) was reversed on its own in `be8f44a`; recorded as a deviation in `checks.md` | none |
| 12 | `.claude/commands/mfa-issue.md:118` | the rewritten Jira note kept an em-dash | fixed: no added line holds U+2014 | `c973268` |
| 13 | `.claude/commands/fleet-device-actions.md:206` | a broken sentence and a twice-opened change in the counted paragraph | fixed | `bdc9fdc` |
| 14 | `scripts/audit/audit-log.js:82` | the trail accepted a run on any read-back, and the lookup was copied three times | fixed: `recordsRunId`, enforced in checkEntry and used by cli-support and change-record | `034a814` |
| 15 | `.claude/commands/mfa-issue.md:38` | the R3 pre-state and the delete's proof were hand-copied portal reads | fixed: `msgraph-client.js auth-methods` saved as it prints, for both | `f506fc0` |

The audit README's counted rules were rewritten to match (`103927e`). Round 2: 15 found, 14 fixed, 1 closed (11); fixed plus closed equals found.
