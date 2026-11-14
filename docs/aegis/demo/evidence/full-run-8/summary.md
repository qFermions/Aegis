# Full run 8 (the messy tickets, T1m to T9m, batch 11): one row per ticket

| ticket | closing state | Fix card words | what stopped it: the line, then the desk rule | gates the action block lists | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | 247 | none | mfa-temporary-access-pass-portal, mfa-method-delete-portal | pass | 0.32 |
| T2m | RESOLVED (SIMULATED) | 215 | none | gws-offboard-okta-deactivate-portal, gws-offboard-drive-transfer-portal, gws-offboard-calendar-transfer-portal, github-offboard-member-remove-portal | pass | 0.71 |
| T3m | RESOLVED (SIMULATED) | 236 | none | gws-password-reset-cookies-portal, jamf-lock-erase-lock-portal | pass | 0.64 |
| T4m | RESOLVED (SIMULATED) | 208 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0.33 |
| T5m | RESOLVED (SIMULATED) | 249 | none | quarantine-release-one-portal | pass | 0.31 |
| T6m | RESOLVED (SIMULATED) | 197 | none | okta-user-lifecycle-clear-sessions-portal | pass | 0.32 |
| T7m | CLARIFY | 235 | answer line "1. Work out how wide it is. Is it everyone in the office, or remote staff too? Is it only Zoom, or are other sites slow as well? Check Zoom's status page and the internet provider's status page." asks a question with Gate: none; rule scripts/demo/customer-desk.js:569: CLARIFY | none | pass | 0.24 |
| T8m | RESOLVED (SIMULATED) | 189 | none | shared-mailbox-full-access-portal | pass | 0.24 |
| T9m | RESOLVED (SIMULATED) | 242 | none | okta-mfa-reset-clear-sessions-portal | pass | 0.42 |

The batch 11 rows (docs/aegis/answer-format.md; a rule that does not cover the ticket is left off the page and shows here as "-"):

| ticket | assumed setup | ask first | new way in first | who else, what left | how wide before why | class and double-check |
|---|---|---|---|---|---|---|
| T1m | pass | pass | fail | - | - | pass |
| T2m | pass | pass | - | - | - | pass |
| T3m | pass | pass | - | - | - | pass |
| T4m | pass | pass | - | - | - | pass |
| T5m | pass | pass | - | - | - | - |
| T6m | pass | pass | - | - | - | - |
| T7m | pass | pass | - | - | - | - |
| T8m | pass | pass | - | - | - | - |
| T9m | pass | pass | - | - | - | - |

What each failing batch 11 row said:

- T1m, new-way-in-first: the step that issues the way in names no admin role

Run totals: Tickets: RESOLVED (SIMULATED) 8, INCONCLUSIVE 0, INVESTIGATE 0, OPEN 0, CLARIFY 1, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 0; model sessions 9, total cost 3.55 US dollars, total time 371.2 s; models claude-opus-5-5 (pinned claude-opus-5-5); Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Model per ticket, as each session's init event reported it (pinned claude-opus-5-5): T1m claude-opus-5-5, T2m claude-opus-5-5, T3m claude-opus-5-5, T4m claude-opus-5-5, T5m claude-opus-5-5, T6m claude-opus-5-5, T7m claude-opus-5-5, T8m claude-opus-5-5, T9m claude-opus-5-5. Tickets on another model than the pin: none.

Reasons, as the desk wrote them:

- T1m: none
- T2m: none
- T3m: none
- T4m: none
- T5m: none
- T6m: none
- T7m: none
- T8m: none
- T9m: none

The two messages to the user, word for word:

| ticket | Tell the user now | user message now check | Tell the user when done |
|---|---|---|---|
| T1m | IT is getting you set up on your new phone. Please keep the new phone with you and wait for our call. | pass | Your new phone is now your sign-in phone. Outlook and Teams should work again; tell us if they don't. |
| T2m | Thanks. IT will plan [FIRST_NAME]'s access removal for the end of their last day. Please ask HR to send their written confirmation to IT, and tell us who should receive their files and email. | pass | [FIRST_NAME]'s access to company apps has ended. Their files and calendar now belong to their manager. |
| T3m | Thanks for filing the police report. IT is checking your account and the laptop now. Please keep the report number handy, and tell us if anything in your email looks odd. | pass | Your account is signed out on the stolen laptop, and the laptop is locked. Sign in again on your other devices when asked. |
| T4m | IT is setting up your access to the billing inbox. The managing partner needs to approve it first, and we'll let you know when it's ready. | pass | You now have the billing inbox in Outlook and can reply from it. If you can't see it yet, close Outlook and open it again. |
| T5m | IT is tracing the vendor's messages. Please ask the vendor to resend by phone, not by email. | pass | The held invoices are in your mailbox. Here is why they were stopped. |
| T6m | Thanks for reporting this. IT is checking your account. Don't click any links in that email. | pass | We signed your account out everywhere. Sign in again with Okta Verify, and report any prompt you didn't start. |
| T7m | IT is checking whether this is the Wi-Fi or the internet line. When a call freezes, please note the time and where you were sitting. | pass | We found what was slowing calls and dealt with it. Please tell us if a call freezes again. |
| T8m | We'll call you on your number in the staff list to confirm. Your request is going to the managing partner for approval. | pass | You can now open the billing inbox. It appears in Outlook by itself. If it doesn't, close and reopen Outlook. |
| T9m | IT is looking into the sign-in loop. Please quit Okta Verify completely, open it again and try to sign in once, then tell us what happens. | pass | You can sign in normally again. If the loop comes back, reply on this ticket. |

## Side by side with full-run-6

| ticket | closing state, full-run-6 | closing state, now | Fix card words, full-run-6 | Fix card words, now | lightest step first, full-run-6 | lightest step first, now | cost full-run-6 | cost now |
|---|---|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 216 | 247 | pass | pass | 0.36 | 0.32 |
| T2m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 172 | 215 | pass | pass | 0.67 | 0.71 |
| T3m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 187 | 236 | pass | pass | 0.69 | 0.64 |
| T4m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 164 | 208 | pass | pass | 0.31 | 0.33 |
| T5m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 188 | 249 | pass | pass | 0.36 | 0.31 |
| T6m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 181 | 197 | pass | pass | 0.42 | 0.32 |
| T7m | INVESTIGATE | CLARIFY | 246 | 235 | pass | pass | 0.23 | 0.24 |
| T8m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 191 | 189 | pass | pass | 0.23 | 0.24 |
| T9m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 191 | 242 | pass | pass | 0.34 | 0.42 |
