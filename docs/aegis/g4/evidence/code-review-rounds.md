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

## Round 2: `5f09f91..af47dc3` (diff only: round 1's fixes)

15 findings; none re-reports a closed one.

| # | file:line | finding | disposition |
|---|---|---|---|
| 1 | `scripts/adapters/github-client.js:292` | `verify-protection`: `allow_force_pushes: {}` or `allow_deletions: {}` (no boolean `enabled`) passes `--no-force-push` and `--no-deletions`, a false pass; a missing object gives exit 2 where D1 asks for 5 (pre-existing, in a touched function) || F: red `d4f7f1b`, green `c2aeadf` (the false pass on `{}` closed; a review count that is not an integer, the same class: red `926d46a`, green `a6e3027`) |
| 2 | `scripts/adapters/linear-client.js:546` | `verify-labels` reads missing `labels.nodes` as empty and missing `pageInfo` as the last page (finding 8's class, one instance left) || F: red `795e143`, green `0ad48d2` |
| 3 | `scripts/adapters/fleet-client.js:443` | `verify-deleted` treats a page with no `meta.has_next_results` boolean as the last page || F: red `14fd9ff`, green `208132b` |
| 4 | `scripts/adapters/fleet-client.js:436`, `jamf-client.js:588`, `linear-client.js:491` | an unparseable time field is skipped as if absent, so exit 2 where D1 asks for 5 || F: red `8262bf1`, green `dd7acbd` |
| 5 | `scripts/adapters/fleet-client.js:353` | finding 12's Fleet fix covers an Apple `Pending` only; a Windows doWipe pending and an Apple `NotNow` still give exit 2 || F: red `b7b5921`, green `eb25259` |
| 6 | `scripts/adapters/fleet-client.js:334` | `verify-wipe` on Windows reads one page of commands and never checks for more (finding 7's class; pre-existing, in a touched function) || F: red `c317653`, green `fe2fbbd` (a failed Windows doWipe with more pages behind it, the same class: red `926d46a`, green `a6e3027`) |
| 7 | `scripts/adapters/github-client.js:324` | `--state dismissed` with `dismissed_reason: null` is a self-contradicting answer reported as "not dismissed", exit 2 || F: red `9bf1703`, green `34b68c8` |
| 8 | `scripts/adapters/README.md:54` | the new sentence says every connector's `--not-before` takes `approved_at` as printed; Jira's takes epoch ms || F: `245dd4b` (doc only; no runbook binds a Jira read-back) |
| 9 | `.claude/commands/gws-drive-sharing.md:102` | `[NOT_BEFORE]` written down before the change is opened and approved, so round 1 finding 4's pre-read check always refuses the R2 read-back || F: red `f514f14`, green `89f2edf` (8 runbook lines in 8 runbooks; `scripts/audit/time-bound-capture.test.js` checks every runbook) |
| 10 | `scripts/adapters/fleet-client.js:340` | `results: null` treated as no list; Go may encode an empty list as null (low confidence) | C: the shape is not confirmed; INCONCLUSIVE is the safe direction (exit 5, never a pass); added to the owner's real-tenant questions as vendor fact F-13 (`cf8b914`) |
| 11 | `scripts/audit/change-record.js:358` | the pre-read time check allows any bound when the approval's `at` is missing or unparseable; every other part of the check fails closed || F: red `e4a3478`, green `087d141` |
| 12 | `checks.md:64` | round 1's closed findings have their reasons only in the rounds file, not in checks.md || F: `7ca3b3a` |
| 13 | `progress.md:6` | progress.md stale (D1 to D3 not reached, next action security review, V2 to V5) || F: `7ca3b3a` |
| 14 | `scripts/adapters/msgraph-client.js:59` | the ISO time pattern now written four times | C: quality only; the four copies are identical and each connector's time bound is tested with the printed form (round 1 finding 3's tests), which catches a drift |
| 15 | `scripts/audit/change-record.js:603` | `earlyRunBound` walks repeated flags that every parser already refuses | C: defense in depth at the trust boundary; no behavior difference while the parsers refuse repeats |

After round 2's fixes: battery at `cf8b914`, `node --test` 1818/1818 and the same under the socket tripwire, the four evals, lint, release boundary and scanner (0 BLOCK) pass (`docs/aegis/g4/evidence/r2-battery/`).

## Round 3 (the last): `9ea0f2b..74fe5db` (diff only: round 2's fixes)

15 findings; none re-reports a closed one.

| # | file:line | finding | disposition |
|---|---|---|---|
| 1 | `scripts/adapters/fleet-client.js:355` | Windows `verify-wipe`: a 200 doWipe on page 0 passes when more pages may follow, though a newer doWipe (the current wipe, still pending) may be on page 1; a false pass on an R3 read-back | F |
| 2 | `scripts/adapters/gws-client.js:539`, `okta-client.js:535`, `msgraph-client.js:215`, `slack-client.js:666` | round 2 finding 4's class (a record that would prove the change but whose time cannot be read is skipped) in four more connectors (pre-existing, in files the diff does not touch) | F |
| 3 | `scripts/adapters/fleet-client.js:335` | the Apple branch of `verify-wipe` never checks `meta.has_next_results` | F |
| 4 | `scripts/adapters/fleet-client.js:360` | altitude: a Windows host with a long command history can never prove its wipe, since the read takes no page; ask newest first or walk pages | C: Fleet's ordering parameters for this endpoint are not in the vendor facts; INCONCLUSIVE is the safe direction (never a false pass); listed for the owner as a decision and a real-tenant question |
| 5 | `scripts/audit/time-bound-capture.test.js:90` | a runbook whose change-bound time flags are all literal gets no per-file test; any sentence containing `approved_at` passes | F |
| 6 | `scripts/adapters/fleet-client.js:358` | Windows: a page not full with no boolean `has_next_results` read as the last page, while `verify-deleted` reads it as unknown | C: the read asks for 100 per page, so a page of fewer is the last unless the server ignores `per_page`, which no vendor fact says; `verify-deleted` asks for no page size, so it cannot judge fullness; noted under vendor fact F-13 for the owner |
| 7 | `scripts/adapters/fleet-client.js:360` | the paging return on a host not wiping gives exit 2 with a note that says "not proof either way" and drops the Windows status caveat | F |
| 8 | `scripts/adapters/fleet-client.js:360` | the note names `--page 1` without `--per-page 100`, so the hand read does not continue page 0 | F |
| 9 | `scripts/audit/change-record.js:375` | the unreadable-approval message points to `audit-log.js verify`, which already reported the chain intact; the README's claim about how such a trail arises is wrong | F |
| 10 | `docs/aegis/owner/vendor-facts-priority.md:99` | F-13 matters to /fleet-device-actions' R3 gates but is filed under facts no gate rests on | F |
| 11 | `PROJECT_STATE.md:178` | "22 fixed test first": three of them were doc-only | F |
| 12 | `progress.md:8` | progress.md stale after round 2's fixes | F |
| 13 | `scripts/adapters/github-client.js:312` | the reviews miss is removed by matching its text prefix; a reworded message makes `splice(-1, 1)` drop another miss | F |
| 14 | `scripts/adapters/fleet-client.js:369` | the Windows pending test is written twice | F |
| 15 | `scripts/adapters/jamf-client.js:612` | with both a Pending and an undated command, the undated count is left out of the output | F |
