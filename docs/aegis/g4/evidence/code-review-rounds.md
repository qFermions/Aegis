# /code-review xhigh rounds, batch G4

## Round 1: `origin/main...8492bee` (the whole branch)

15 findings. Disposition: F fixed (commit named when it lands), C closed with the reason given.

| # | file:line | finding | disposition |
|---|---|---|---|
| 1 | `.claude/commands/jamf-patch-management.md:73` and others | runbook stop conditions and read-back comments say exit 2 where D1 now gives exit 5 (INCONCLUSIVE); no runbook names exit 5 || F: red `8162e01`, green `7b01f2e` (19 lines in 12 runbooks; `scripts/audit/runbook-exit-codes.test.js` checks every runbook) |
| 2 | `scripts/audit/audit-log.js:231` | a change record opened before A3 (bare form for a command that gained a pass flag) no longer matches its verify entries | C: production is not deployed, so no trail from before this batch exists; the mismatch fails closed (never a false done); the audit README says to reopen such a change (`82cbae5`) |
| 3 | `scripts/audit/change-record.js:644` | `approve` prints `approved_at` with milliseconds; msgraph's `--not-before` takes whole seconds, so the copied value is refused and a truncated one is earlier than the approval || F: red `7ec2f82`, green `ba22792` (Graph `--not-before` and `--since` take 1 to 3 fractional digits; the other connectors' time bounds already did, now tested with the printed form; Jira's bound is the preview time its own client prints in ms and is never bound to a change record, so it is not an instance) |
| 4 | `scripts/audit/change-record.js:575` | a `--not-before` earlier than the approval is refused only after the read, which is recorded and printed as linkable || F: red `14e4bc6`, green `4382dfb` (`bindRefusal` gets the run's arguments from `cli-support.js` `changeRefusal` and refuses before any read; test trails approve at a fixed earlier time) |
| 5 | `.claude/commands/mfa-issue.md:12` and three others | change-record examples name the read-back without the pass flags `open` now requires || F: red `35cf65e` (its subject wrongly repeats finding 1's green; the content is finding 5's test, `scripts/audit/runbook-change-examples.test.js`; not rewritten, deviation V2), green `b89aff5`, then `6224d27` updates the one existing pin to the stricter form (the full suite read 1700/1701 at `b89aff5`, never pushed alone) |
| 6 | `scripts/adapters/github-client.js:319` | `dismissed_reason: null` (GitHub's value for an alert not dismissed) read as not shown, so INCONCLUSIVE instead of a definite failure || F: red `59ab491`, green `537ef3b` |
| 7 | `scripts/adapters/fleet-client.js:440` | `verify-deleted`: unread pages count as inconclusive only when no other deletion was found, though the manual deletion may sit on them || F: red `eca3bfa`, green `cc45285` |
| 8 | `scripts/adapters/fleet-client.js:417`, `:337`; `scripts/adapters/linear-client.js:482`, `:511` | a missing list read as an empty one, a definite failure instead of INCONCLUSIVE || F: red `9fe13f0`, green `05b684e` |
| 9 | `scripts/audit/change-record.js:639` | the one-approval guard also counts an earlier mismatched approval | C: a mismatched approval could only be written through the removed `audit-log.js approval`; no deployed trail holds one; such a change is reopened, which the refusal's audit seq points to |
| 10 | `scripts/eval/judged/calibrate.js:28` | a case id starting with `-` gets the formula guard's apostrophe and the sheet reader then refuses its own id || F: red `40f7e91`, green `e9db239` |
| 11 | `scripts/audit/change-record.js:307` | an invisible letter-class filler (U+3164, U+115F) inside "Count" survives the fold, so a disguised count line is not seen || F: red `f25fd78`, green `7fc4420` (`fold` strips `\p{Default_Ignorable_Code_Point}`) |
| 12 | `scripts/adapters/jamf-client.js:596` | a matching command still Pending is a definite failure in Jamf, while Fleet treats a run not reported yet as INCONCLUSIVE || F: red `48a4ba2`, green `4a07864` (Jamf); the same class in Fleet `verify-wipe` (a Mac wiping, its EraseDevice still Pending): red `b495f06`, green `27eeded`. Jamf `NotNow` stays exit 2: Jamf's exact status string is not confirmed |
| 13 | `scripts/adapters/github-client.js:239` | each connector has its own small unproven helper around `inconclusive()` | C: quality only, no behavior; one shared helper across nine connectors is a refactor for a later batch |
| 14 | `scripts/adapters/github-client.js:250` and three others | dead branches left behind by D1's new guards | C: quality only, removing them changes no behavior; left to keep this round's connector diff to the fixes |
| 15 | `scripts/eval/vendor-facts-priority.js:184` | repeated extraction per G2 row; gates parsed three times in `readBackProblems` | C: efficiency only, on repo-sized inputs (under a second) |

After round 1's fixes: battery at `82cbae5`, `node --test` 1745/1745 and the same under the socket tripwire, the four evals, lint, release boundary and scanner (0 BLOCK) pass (`docs/aegis/g4/evidence/r1-battery/`).
