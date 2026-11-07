# Batch 9b, T9m alone: one row per ticket

| ticket | closing state | Fix card words | what stopped it, in plain words | Tell the user now | Tell the user when done | user message now check | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|---|---|
| T9m | RESOLVED (SIMULATED) | 208 | Fixed in the practice copy: every change was made and double-checked. | IT is looking at your sign-in. Please quit Okta Verify completely, open it again and sign in once, then tell us what happens. | Your sign-in works again. If Okta Verify loops again, reply to this ticket. | pass | pass | 0.29 |

Run totals: Tickets: RESOLVED (SIMULATED) 1, INCONCLUSIVE 0, INVESTIGATE 0, OPEN 0, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 0, cache hits 0; model sessions 1, total cost 0.29 US dollars, total time 31.7 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T9m: none

## The three thinking rules, per answer

| ticket | what changed | lightest step first | look before guessing | first step, as written |
|---|---|---|---|---|
| T9m | pass | pass | pass | Okta Admin Console → Reports → System Log → search [UPN]. Look at the Okta Verify sign-ins since the update. Repeated failures with the same reason point to old sign-in data left on the Mac. Prompts or locations the user doesn't recognize mean you should stop. |

Read by rule: "what changed" applies when the ticket names a recent change and passes when the first step names it; "look before guessing" applies to a sign-in, account or device ticket and passes when the first step reads, looks or checks; "lightest step first" is the desk's row. A word match is not a judgment of the step: a person should read the answers.

## Batch 9b notes (written by hand after the run)

- Prediction (`progress.md`, committed in `d500a87` before the run): RESOLVED (SIMULATED), a card of about 170 to 200 words, about 0.35 US dollars; named risk: the answer also names `okta-mfa-reset-selected-portal`. Result: RESOLVED (SIMULATED) as predicted; 208 words, which missed the predicted 170 to 200; 0.29 US dollars, under the predicted 0.35; and the named risk happened: the aegis-desk block lists both gates, the session clear first and the last-resort reset second (`answers/T9m-answer.txt`, the aegis-desk block).
- The desk approved and simulated both gates (`terminal.txt`, steps 6 to 8: 2 of 2 read-backs passed), although the answer's step 5 says the reset is the last resort, for when the session clear did not stop the loop. The desk applies every gate in the block in order and has no way to model "only if the step before did not work"; the closing state therefore proves both changes in the practice copy, not that the reset was needed.
- Batch 9 (`full-run-4/`, same ticket, the admin step as a PREVIEW ONLY marker): OPEN, 186 words, 0.35 US dollars.
- The session cap: the desk's guard assumes 2 US dollars a ticket, so `--budget-usd 2` was the smallest budget it would run; the wrapper `tools/claude-cap.sh`, first on PATH, passed every argument unchanged except `--max-budget-usd`, which it set to 1.50 (its log line is the first line of `terminal.txt`). The run used the wrapper as committed in `8533733`; code review 1 (finding 11) then made it keep the smaller of the desk's value and the cap and read the `=` form (`claude-cap-selfcheck.txt`), which for this run's 2.00 gives the same 1.50.
