# Full run 6 (the messy tickets, T1m to T9m, batch 10): one row per ticket

| ticket | closing state | Fix card words | what stopped it: the line, then the desk rule | gates the action block lists | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | 216 | none | mfa-session-revoke-portal | pass | 0.36 |
| T2m | RESOLVED (SIMULATED) | 172 | none | gws-offboard-okta-deactivate-portal, github-offboard-member-remove-portal | pass | 0.67 |
| T3m | RESOLVED (SIMULATED) | 187 | none | gws-password-reset-cookies-portal, jamf-lock-erase-lock-portal | pass | 0.69 |
| T4m | RESOLVED (SIMULATED) | 164 | none | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0.31 |
| T5m | RESOLVED (SIMULATED) | 188 | none | quarantine-release-one-portal | pass | 0.36 |
| T6m | RESOLVED (SIMULATED) | 181 | none | okta-user-lifecycle-clear-sessions-portal | pass | 0.42 |
| T7m | INVESTIGATE | 246 | answer line "Gate: none"; rule scripts/demo/customer-desk.js:562: the answer advises looking first and names no change, so there is nothing to approve yet; its steps: 1. Ask one remote staff member whether Zoom freezes for them too. If it does, the problem is Zoom or a wider outage. If it doesn't, the problem is at the office. 2. At the office, run a speed test on one Mac on Wi-Fi and one Mac plugged in by cable. If both are slow, it's the internet line. If only the Wi-Fi Mac is slow, it's the Wi-Fi. 3. Ask whether anyone is uploading or syncing large files right now, such as to Google Drive or a backup. 4. If the line itself is slow, check the internet provider's status page, then call the provider with the speed test results. | none | pass | 0.23 |
| T8m | RESOLVED (SIMULATED) | 191 | none | shared-mailbox-full-access-portal | pass | 0.23 |
| T9m | RESOLVED (SIMULATED) | 191 | none | okta-mfa-reset-clear-sessions-portal | pass | 0.34 |

Run totals: Tickets: RESOLVED (SIMULATED) 8, INCONCLUSIVE 0, INVESTIGATE 1, OPEN 0, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 0; model sessions 9, total cost 3.59 US dollars, total time 447.8 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1m: none
- T2m: none
- T3m: none
- T4m: none
- T5m: none
- T6m: none
- T7m: the answer advises looking first and names no change, so there is nothing to approve yet; its steps: 1. Ask one remote staff member whether Zoom freezes for them too. If it does, the problem is Zoom or a wider outage. If it doesn't, the problem is at the office. 2. At the office, run a speed test on one Mac on Wi-Fi and one Mac plugged in by cable. If both are slow, it's the internet line. If only the Wi-Fi Mac is slow, it's the Wi-Fi. 3. Ask whether anyone is uploading or syncing large files right now, such as to Google Drive or a backup. 4. If the line itself is slow, check the internet provider's status page, then call the provider with the speed test results.
- T8m: none
- T9m: none

The two messages to the user, word for word:

| ticket | Tell the user now | user message now check | Tell the user when done |
|---|---|---|---|
| T1m | IT is checking your sign-in setup. If you still have your old phone, please keep it nearby and don't reset it. | pass | Your new phone now approves sign-ins. Open Outlook and Teams and sign in. |
| T2m | IT is preparing [FIRST_NAME]'s offboarding for Friday. We need HR's written confirmation in this ticket first. Please arrange the laptop return. | pass | [FIRST_NAME]'s access has ended everywhere. Their files are kept for now. |
| T3m | IT is securing your account and the laptop. Please change your Google password from another device. Send us the police report number. | pass | Your Google account is signed out on the stolen laptop and the laptop is locked. |
| T4m | IT is setting up your billing inbox access after the managing partner approves it. We'll tell you when it's ready. | pass | You now have the billing inbox in Outlook and can reply from it. If it doesn't show, restart Outlook. |
| T5m | IT is tracing the vendor's messages. Please send us the vendor's sending address. Don't act on any new payment details until IT confirms them. | pass | The vendor's invoices are in your inbox. Please check that all six arrived. |
| T6m | Thanks for reporting this. Don't click any links in that email. IT is checking your account's sign-in history now. | pass | Your account's sessions have been ended. Please sign in again and approve only prompts you start yourself. |
| T7m | IT is checking the office connection. For important calls, plug your Mac in with a cable if you can, and pause any large uploads. | pass | We found what was slowing the connection and sorted it out. Zoom calls should be smooth again, so let us know if they freeze. |
| T8m | We'll call you on the number we have on file to confirm this request. The managing partner needs to approve access to the billing inbox first. | pass | You now have the billing inbox in Outlook. If it doesn't appear, close Outlook and open it again. |
| T9m | IT is looking into the sign-in loop. Please fully quit Okta Verify, open it again and sign in once. If it still loops, restart your Mac and try again. | pass | Your old sign-in sessions are cleared. Open Okta Verify and sign in once. |

## Side by side with full-run-4 and, for T9m, batch 9b

| ticket | closing state, full-run-4 | closing state, now | Fix card words, full-run-4 | Fix card words, now | lightest step first, full-run-4 | lightest step first, now | cost full-run-4 | cost now |
|---|---|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 249 | 216 | pass | pass | 0.34 | 0.36 |
| T2m | INCONCLUSIVE | RESOLVED (SIMULATED) | 183 | 172 | pass | pass | 0.70 | 0.67 |
| T3m | INCONCLUSIVE | RESOLVED (SIMULATED) | 247 | 187 | pass | pass | 0.64 | 0.69 |
| T4m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 195 | 164 | pass | pass | 0.31 | 0.31 |
| T5m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 190 | 188 | pass | pass | 0.45 | 0.36 |
| T6m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 181 | 181 | pass | pass | 0.54 | 0.42 |
| T7m | OPEN | INVESTIGATE | 200 | 246 | pass | pass | 0.27 | 0.23 |
| T8m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 180 | 191 | pass | pass | 0.21 | 0.23 |
| T9m | OPEN | RESOLVED (SIMULATED) | 186 | 191 | pass | pass | 0.35 | 0.34 |

## T9m: batch 9 and batch 9b against now

| run | closing state | Fix card words | gates the action block lists | lightest step first | cost |
|---|---|---|---|---|---|
| full-run-4 (batch 9) | OPEN | 186 | okta-verify-loop-admin-reauth, okta-mfa-reset-selected-portal | pass | 0.35 |
| batch 9b | RESOLVED (SIMULATED) | 208 | okta-mfa-reset-clear-sessions-portal, okta-mfa-reset-selected-portal | pass | 0.29 |
| now | RESOLVED (SIMULATED) | 191 | okta-mfa-reset-clear-sessions-portal | pass | 0.34 |
