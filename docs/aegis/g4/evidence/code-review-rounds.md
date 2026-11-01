# /code-review xhigh rounds, batch G4

## Round 1: `origin/main...8492bee` (the whole branch)

15 findings. Disposition: F fixed (commit named when it lands), C closed with the reason given.

| # | file:line | finding | disposition |
|---|---|---|---|
| 1 | `.claude/commands/jamf-patch-management.md:73` and others | runbook stop conditions and read-back comments say exit 2 where D1 now gives exit 5 (INCONCLUSIVE); no runbook names exit 5 | F |
| 2 | `scripts/audit/audit-log.js:231` | a change record opened before A3 (bare form for a command that gained a pass flag) no longer matches its verify entries | C: production is not deployed, so no trail from before this batch exists; the mismatch fails closed (never a false done); the audit README says to reopen such a change |
| 3 | `scripts/audit/change-record.js:644` | `approve` prints `approved_at` with milliseconds; msgraph's `--not-before` takes whole seconds, so the copied value is refused and a truncated one is earlier than the approval | F |
| 4 | `scripts/audit/change-record.js:575` | a `--not-before` earlier than the approval is refused only after the read, which is recorded and printed as linkable | F |
| 5 | `.claude/commands/mfa-issue.md:12` and three others | change-record examples name the read-back without the pass flags `open` now requires | F |
| 6 | `scripts/adapters/github-client.js:319` | `dismissed_reason: null` (GitHub's value for an alert not dismissed) read as not shown, so INCONCLUSIVE instead of a definite failure | F |
| 7 | `scripts/adapters/fleet-client.js:440` | `verify-deleted`: unread pages count as inconclusive only when no other deletion was found, though the manual deletion may sit on them | F |
| 8 | `scripts/adapters/fleet-client.js:417`, `:337`; `scripts/adapters/linear-client.js:482`, `:511` | a missing list read as an empty one, a definite failure instead of INCONCLUSIVE | F |
| 9 | `scripts/audit/change-record.js:639` | the one-approval guard also counts an earlier mismatched approval | C: a mismatched approval could only be written through the removed `audit-log.js approval`; no deployed trail holds one; such a change is reopened, which the refusal's audit seq points to |
| 10 | `scripts/eval/judged/calibrate.js:28` | a case id starting with `-` gets the formula guard's apostrophe and the sheet reader then refuses its own id | F |
| 11 | `scripts/audit/change-record.js:307` | an invisible letter-class filler (U+3164, U+115F) inside "Count" survives the fold, so a disguised count line is not seen | F |
| 12 | `scripts/adapters/jamf-client.js:596` | a matching command still Pending is a definite failure in Jamf, while Fleet treats a run not reported yet as INCONCLUSIVE | F |
| 13 | `scripts/adapters/github-client.js:239` | each connector has its own small unproven helper around `inconclusive()` | C: quality only, no behavior; one shared helper across nine connectors is a refactor for a later batch |
| 14 | `scripts/adapters/github-client.js:250` and three others | dead branches left behind by D1's new guards | C: quality only, removing them changes no behavior; left to keep this round's connector diff to the fixes |
| 15 | `scripts/eval/vendor-facts-priority.js:184` | repeated extraction per G2 row; gates parsed three times in `readBackProblems` | C: efficiency only, on repo-sized inputs (under a second) |
