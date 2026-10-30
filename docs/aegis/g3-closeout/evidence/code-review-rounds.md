# Code review rounds (batch G3 close-out, `/code-review xhigh`, tier C)

REVIEW.md was read before each round. Round 1 reviewed the branch against `main` (`01dcb37..3bba35e`, 100 files). Later rounds review only the diff added after the round before. Each finding is fixed in its own commit (a red test first where code changes) or closed with a one-line reason here and in `checks.md`.

## Round 1 (`01dcb37..3bba35e`): 13 found

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `.claude/commands/fleet-device-actions.md:312` | the R2 gate written as a comment block inside a bash fence, the batch script run's per-host read-backs and the branch-protection rollback's read-back were left unbound | fixed: the pin test reads both gate forms and the two prose read-backs; 72 read-backs bound | `cc849e9` (red), `d957697` |
| 2 | `scripts/audit/change-record.js:139` | a change linked before this branch with an unbound read-back now reads not done | closed: production is not deployed and the module reached `main` less than a day before this branch, so no trail holds such a change; status must stay strict or a link written around the CLI would count; the audit README says how to bind such a read-back | `5d44b0f` (docs) |
| 3 | `scripts/adapters/readonly-contract.js:569` | a primary limit with no usable reset threw away a retry-after it carried; a secondary limit with a past reset got the clock message | fixed: retry-after is the fallback for a primary limit, at least one minute for a secondary one | `c67210d` (red), `871657c` |
| 4 | `scripts/jira-client.js:936` | (pre-existing, in a function this branch edits) Jira printed "Verified" before the audit write, so a withheld verdict still showed as verified | fixed: a read-back's lines are held until its verdict is on record | `6fc7f4a` (red), `b877c5b` |
| 5 | `scripts/adapters/cli-support.js:85` | the audit seq (and Jira's "link takes it" line) was printed for unbound and unverified read-backs that link always refuses | fixed: printed only for a bound read-back that verified | `73263e7` (red), `7902143` |
| 6 | `scripts/adapters/cli-support.js:51` | `--change=chg-...` read as an unknown flag | fixed: taken out and refused with the two-argument form named | `cf2d8c2` (red), `219263c` |
| 7 | `docs/aegis/boundary-audit.md:69` | rows 35 and 37 cited moved lines | fixed (lines checked again at the final head) | `5d44b0f` |
| 8 | `progress.md:8` | progress.md and checks.md were stale after security review 1 | fixed: both rewritten with this record | the commit that adds this file |
| 9 | `scripts/adapters/cli-support.js:24` | the change-id and verify-command patterns were copied; the binding test's trail helper repeats `test-trail.js` | fixed for the patterns (cli-support uses audit-log.js's, a test holds the contract's copy equal); the helper part closed: the binding test needs uncached opens, unapproved opens and link and status calls, which the runbook-line helper must not carry | `9967dec` |
| 10 | `scripts/adapters/slack-client.js:786` | the offline branches called `changeRefusal(..., null)` only for its message | fixed: a fixed `NOT_A_READ_BACK` message, pinned by a test | `dce46aa` |
| 11 | `scripts/audit/change-record.js:158` | `bindRefusal` reads the trail twice (chain check, then entries) | closed: a bound read-back runs once per R2 or R3 change, a human-paced step, and `status` and `link` already read the trail the same way; a shared single read is a trail-wide change outside this batch | none |
| 12 | `scripts/adapters/fleet-client.js:593` | design: the `--change` wiring is copied into ten CLIs instead of one wrapper | closed with a guard: each CLI's flow differs (offline commands, the dry run before or after the client, Jira's runtime), so the three shared calls stay per CLI, and a static test now fails any connector with a verify-* command that leaves one out (shown failing on a removed `bound.change`) | `9cf9a7c` |
| 13 | `scripts/adapters/operator-message.js:120` | the RATE_LIMITED words named GitHub's header and an hourly window for any opted-in spec | fixed: the header comes from the spec, no window is named | `c25acb4` (red), `d974d1e` |

Round 1: 13 found, 10 fixed, 3 closed (2, 11, 12); fixed plus closed equals found.

## Round 2 (`3bba35e..f6fd359`, the diff after round 1): 15 found

| # | file:line (as reported) | finding | outcome | commit(s) |
|---|---|---|---|---|
| 1 | `scripts/adapters/change-binding.test.js:250` | a gate marked "R1 to R3" counted as R1, so the run-script read-backs stayed unbound and the test locked that in | fixed: a range counts as its highest class; both read-backs bound, each says to drop `--change` when step 1 set R1; 74 bound | `4c33de8` (red), `74f581d` |
| 2 | `scripts/adapters/cli-support.js:92` | `open`'s next step did not say to run the read-back with `--change`, and an unbound read-back now prints no seq | fixed: the step names `--change <id>` and the `audit_seq` link takes | `f5655e7` (red), `5207b83` |
| 3 | `scripts/adapters/operator-message.js:128` | the no-reset fallback still named an hourly window | fixed | `d93ce08` (red), `92fce46` |
| 4 | `scripts/adapters/readonly-contract.js:573` | a usable reset beat a longer retry-after, so the read retried before the vendor allowed | fixed: the later of the two | `d93ce08` (red), `2403205` |
| 5 | `.claude/commands/fleet-device-actions.md:204` | the batch run's read-back step lacked `--change` while its checkpoint required it | fixed with finding 1 (same runbook lines and pin test) | `4c33de8` (red), `74f581d` |
| 6 | `scripts/jira-client.js:467` | (pre-existing, in a function this branch edits) every Jira verify entry was recorded with state OK, a failed read included | fixed: the read's own state; incidents row added | `dc35062` (red), `0f0a4b6`, `a7fcf50` |
| 7 | `scripts/adapters/cli-support.js:64` | `--change=` on a plain read gave the two-argument advice before "not a read-back" | fixed: `changeRefusal` takes the whole `takeChange` result and checks in one order everywhere | `b86469b` (red), `a30fa39` |
| 8 | `scripts/adapters/change-binding.test.js:291` | no test covered a bound read-back that did not verify | fixed: test added, shown failing when the condition is dropped | `a5be106` |
| 9 | `docs/review/incidents.md:10` | no incidents row for round 1 finding 4, a shipped bug | fixed | `428e429` |
| 10 | `docs/review/incidents.md:10` | the audit-seq row said every read-back prints its seq | fixed | `1a01645` |
| 11 | `docs/aegis/boundary-audit.md:69` | round 1 findings 2 and 7 share commit `5d44b0f` | closed: the branch is pushed and the charter forbids force-pushing and rebasing, so history is not rewritten; reverting `5d44b0f` reverts both (recorded as a deviation in `checks.md`) | none |
| 12 | `checks.md:31` | E1 to E4 carried a verdict outside pass, fail, unresolved | fixed: unresolved until the head capture, then set from it | the commit that adds this round |
| 13 | `scripts/jira-client.js:946` | altitude: the Jira fix buffered output around every verify-* | fixed: a passed read-back returns its line, `run()` prints it after the record | `1cd0773` |
| 14 | `scripts/adapters/operator-message.js:114` | the header-name rule was copied three times | fixed: one `HEADER_NAME` | `abf370b` |
| 15 | `scripts/adapters/rate-limit.test.js:15` | the rate-limit test header and `takeChange`'s comment were stale | fixed | `e7f0396` |

Round 2: 15 found, 14 fixed, 1 closed (11); fixed plus closed equals found.
