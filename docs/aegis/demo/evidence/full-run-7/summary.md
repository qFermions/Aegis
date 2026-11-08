# Full run 7 (the tidy tickets, T1 to T8, batch 10): one row per ticket

| ticket | closing state | Fix card words | what stopped it: the line, then the desk rule | gates the action block lists | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | 260 | none | mfa-method-delete-portal | fail | 0.39 |
| T2 | RESOLVED (SIMULATED) | 180 | none | gws-offboard-okta-deactivate-portal, github-offboard-member-remove-portal, linear-workspace-admin-suspend-portal | pass | 0.66 |
| T3 | RESOLVED (SIMULATED) | 199 | none | gws-password-reset-cookies-portal, jamf-lock-erase-lock-portal | pass | 0.46 |
| T4 | RESOLVED (SIMULATED) | 151 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0.26 |
| T5 | RESOLVED (SIMULATED) | 193 | none | quarantine-release-one-portal | pass | 0.44 |
| T6 | RESOLVED (SIMULATED) | 227 | none | okta-user-lifecycle-clear-sessions-portal | pass | 0.34 |
| T7 | CLARIFY | 217 | the answer asks a question with Gate: none; rule scripts/demo/customer-desk.js:558: CLARIFY | none | pass | 0.20 |
| T8 | RESOLVED (SIMULATED) | 151 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | none |

Run totals: Tickets: RESOLVED (SIMULATED) 7, INCONCLUSIVE 0, INVESTIGATE 0, OPEN 0, CLARIFY 1, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 1; model sessions 7, total cost 2.76 US dollars, total time 334.1 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1: none
- T2: none
- T3: none
- T4: none
- T5: none
- T6: none
- T7: none
- T8: none

The two messages to the user, word for word:

| ticket | Tell the user now | user message now check | Tell the user when done |
|---|---|---|---|
| T1 | IT is checking your account. Please install Microsoft Authenticator on your new phone and keep the phone with you. We will call you when it's time to set it up. | pass | Your new phone now approves your sign-ins. Outlook and Teams should work again. Reply here if anything still asks for the old phone. |
| T2 | IT is preparing the leaving steps for the end of Friday. HR needs to confirm in writing first. | pass | [FIRST_NAME]'s access to Okta, Google Workspace, GitHub and Linear has ended. |
| T3 | IT is checking the laptop's status and protecting your accounts. Please don't sign in on new devices until IT contacts you. | pass | Your accounts are signed out everywhere and the laptop can't be used. |
| T4 | IT is getting your request approved. We'll let you know when the mailbox is ready. | pass | You can open [SHARED_MAILBOX] in Outlook and send as it. If it's missing, restart Outlook. |
| T5 | IT is tracing the vendor's messages. Please check your Junk folder in the meantime. | pass | The held invoices are in your inbox now. Tell us if another one goes missing. |
| T6 | Thanks for reporting this so quickly. IT is checking your account's sign-in records. Don't approve any sign-in prompt you didn't start yourself. | pass | Your account is signed out everywhere. Please sign in again and tell IT if anything looks wrong. |
| T7 | IT is checking whether the slowness is in the office or online. Could you tell us if you're in the office or working remotely? | pass | Speeds are back to normal. Let us know if anything feels slow again. |
| T8 | IT is getting your request approved. We'll let you know when the mailbox is ready. | pass | You can open [SHARED_MAILBOX] in Outlook and send as it. If it's missing, restart Outlook. |

## Side by side with full-run-5

| ticket | closing state, full-run-5 | closing state, now | Fix card words, full-run-5 | Fix card words, now | lightest step first, full-run-5 | lightest step first, now | cost full-run-5 | cost now |
|---|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 183 | 260 | pass | fail | 0.39 | 0.39 |
| T2 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 178 | 180 | fail | pass | 0.98 | 0.66 |
| T3 | INCONCLUSIVE | RESOLVED (SIMULATED) | 182 | 199 | pass | pass | 0.84 | 0.46 |
| T4 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 156 | 151 | pass | pass | 0.21 | 0.26 |
| T5 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 212 | 193 | pass | pass | 0.41 | 0.44 |
| T6 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 236 | 227 | pass | pass | 0.47 | 0.34 |
| T7 | OPEN | CLARIFY | 224 | 217 | pass | pass | 0.33 | 0.20 |
| T8 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 156 | 151 | pass | pass | none | none |

## Batch 10 notes (written by hand after the run)

- Code: the run used the code at `192287a`, as full run 6 did; run folder `20261108T022346Z-775b11e0`; `--budget-usd 10 --spent-usd 3.59364` (full run 6's cost). 7 sessions and one cache hit (T8, from T4 in the same run), 2.76 US dollars. Both runs: 16 sessions, 6.36 US dollars.
- Predictions (`progress.md`, committed in `3227e8f` before either run): 7 of 8 matched. Missed: T7 closed CLARIFY, not INVESTIGATE: its "Tell the user now" line asks the user a question, the risk the prediction named, and CLARIFY is the expected path the ticket file gives T7. T2's lightest-step row passes: it led with `gws-offboard-okta-deactivate-portal`, not the Okta lifecycle deactivate that failed it in full run 5.
- T1's lightest-step row fails: its block holds only `mfa-method-delete-portal` (R3), while `/mfa-issue`'s section lists the session revoke first. The answer says why it skips the revoke (the old phone was wiped, so it holds no sessions); the row reads the runbook's ladder, not that line (batch 9's rule, unchanged here). The row never stops a ticket; T1 resolved.
- No ticket that did not resolve was stopped by a missing read-back or a rule line: T7 is a question with Gate: none (`customer-desk.js:558`).
