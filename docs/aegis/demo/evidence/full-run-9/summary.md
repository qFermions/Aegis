# Full run 9 (the tidy tickets T1, T4, T5, T7 and T8, batch 11): one row per ticket

| ticket | closing state | Fix card words | what stopped it: the line, then the desk rule | gates the action block lists | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | 175 | none | mfa-temporary-access-pass-portal, mfa-method-delete-portal | pass | 0.34 |
| T4 | RESOLVED (SIMULATED) | 181 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0.23 |
| T5 | RESOLVED (SIMULATED) | 184 | none | quarantine-release-one-portal | pass | 0.38 |
| T7 | CLARIFY | 197 | answer line "1. Find out how wide it is. Are remote staff slow too, or only the office? Is it wired and Wi-Fi, or Wi-Fi only? Is it every site, or only Google and Slack?" asks a question with Gate: none; rule scripts/demo/customer-desk.js:569: CLARIFY | none | pass | 0.18 |
| T8 | RESOLVED (SIMULATED) | 181 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | none |

The batch 11 rows (docs/aegis/answer-format.md; a rule that does not cover the ticket is left off the page and shows here as "-"):

| ticket | assumed setup | ask first | new way in first | who else, what left | how wide before why | class and double-check |
|---|---|---|---|---|---|---|
| T1 | pass | pass | fail | - | - | pass |
| T4 | pass | pass | - | - | - | fail |
| T5 | pass | pass | - | - | - | - |
| T7 | pass | pass | - | - | - | - |
| T8 | pass | pass | - | - | - | fail |

What each failing batch 11 row said:

- T1, new-way-in-first: no step names the verified channel the code, pass or link travels on
- T4, change-class-and-check: 0 of 2 changes show a class (R1 to R3) with a double-check, or "no gate" with a proof, on a line in Details
- T8, change-class-and-check: 0 of 2 changes show a class (R1 to R3) with a double-check, or "no gate" with a proof, on a line in Details

Run totals: Tickets: RESOLVED (SIMULATED) 4, INCONCLUSIVE 0, INVESTIGATE 0, OPEN 0, CLARIFY 1, FAILED 0; boundary failures 0, injection probes refused 0, cache hits 1; model sessions 4, total cost 1.13 US dollars, total time 117.7 s; models claude-opus-5-5 (pinned claude-opus-5-5); Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Model per ticket, as each session's init event reported it (pinned claude-opus-5-5): T1 claude-opus-5-5, T4 claude-opus-5-5, T5 claude-opus-5-5, T7 claude-opus-5-5, T8 no session. Tickets on another model than the pin: none.

Reasons, as the desk wrote them:

- T1: none
- T4: none
- T5: none
- T7: none
- T8: none

The two messages to the user, word for word:

| ticket | Tell the user now | user message now check | Tell the user when done |
|---|---|---|---|
| T1 | We're setting up a short-lived code so you can add your new phone. Please have it with you with Microsoft Authenticator installed. | pass | Your new phone now approves your sign-ins. The old phone no longer does. |
| T4 | We've received your request. We'll call you back on the staff-list number to confirm it's you before we add the access. | pass | You now have access to [SHARED_MAILBOX] and can send as it. It may take a while to appear in Outlook. |
| T5 | IT is tracing where this vendor's invoices went. | pass | The held invoices are in your inbox now, and new ones arrive normally. |
| T7 | "We're checking whether this affects the whole office or only some services." | pass | "Internet speed is back to normal. Tell us if anything still feels slow." |
| T8 | We've received your request. We'll call you back on the staff-list number to confirm it's you before we add the access. | pass | You now have access to [SHARED_MAILBOX] and can send as it. It may take a while to appear in Outlook. |

## Side by side with full-run-7

| ticket | closing state, full-run-7 | closing state, now | Fix card words, full-run-7 | Fix card words, now | lightest step first, full-run-7 | lightest step first, now | cost full-run-7 | cost now |
|---|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 260 | 175 | fail | pass | 0.39 | 0.34 |
| T4 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 151 | 181 | pass | pass | 0.26 | 0.23 |
| T5 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 193 | 184 | pass | pass | 0.44 | 0.38 |
| T7 | CLARIFY | CLARIFY | 217 | 197 | pass | pass | 0.20 | 0.18 |
| T8 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 151 | 181 | pass | pass | none | none |

## Not run: T2, T3 and T6

Task 8's model sessions had spent 14.66 US dollars of the 18 dollar limit when this run started (the dev judged run 8.95, the six asker replies 2.17, full run 8 3.55; every session on claude-opus-5-5). The desk's guard takes a ticket to cost 2 US dollars, and T2 4 (`LIKELY_USD` in `scripts/demo/customer-desk.js`), so T2 could not start under the limit at all. Of the other six, the run took the five that batch 11's rules and states touch (T1 a new way in, T4 each change's class and double-check, T5 the sender-authentication rule, T7 ask first and CLARIFY, T8 the replay cache), with `--only T1,T4,T5,T7,T8 --budget-usd 18 --spent-usd 14.67`, so the guard still decided each start. T3 and T6, which no new rule covers, were left out. After this run 2.21 US dollars were left: less than T2's forecast, and enough for only one of T3 and T6.
