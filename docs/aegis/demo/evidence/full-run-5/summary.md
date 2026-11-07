# Full run 5 (the tidy tickets, T1 to T8): one row per ticket

| ticket | closing state | Fix card words | what stopped it, in plain words | Tell the user now | Tell the user when done | user message now check | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | 183 | Fixed in the practice copy: every change was made and double-checked. | IT is checking your account and will confirm it's you with the office manager. Please install Microsoft Authenticator on your new phone. | Your new phone now approves your sign-ins. Open Outlook and Teams and approve the prompt. | pass | pass | 0.39 |
| T2 | RESOLVED (SIMULATED) | 178 | Fixed in the practice copy: every change was made and double-checked. | IT has the request for the end of the day Friday. Please ask HR to confirm it in writing in the ticket. | [FIRST_NAME]'s access to Okta, GitHub, Google Workspace and Linear has ended. | fail | fail | 0.98 |
| T3 | INCONCLUSIVE | 182 | Not proved: at least one change has no way to be double-checked yet. | IT is checking the Mac's protection and the designer's accounts. We will call you back before anything changes. | The designer's Google sign-ins on the Mac are ended and the Mac is [locked / erased]. | pass | pass | 0.84 |
| T4 | RESOLVED (SIMULATED) | 156 | Fixed in the practice copy: every change was made and double-checked. | IT is reviewing your request for the shared mailbox. It needs the managing partner's sign-off first. | You can now open the shared mailbox in Outlook and send as it. Restart Outlook if it doesn't show up. | pass | pass | 0.21 |
| T5 | RESOLVED (SIMULATED) | 212 | Fixed in the practice copy: every change was made and double-checked. | IT is tracing where this vendor's emails are going. Please don't act on any payment-detail change from this vendor until IT gets back to you. | The held invoices are now in your inbox. Tell us if a new one goes missing. | pass | pass | 0.41 |
| T6 | RESOLVED (SIMULATED) | 236 | Fixed in the practice copy: every change was made and double-checked. | IT is checking the sign-in record for your account now. Please don't approve any Okta Verify prompt you didn't start. We'll set up a short video call with you. | Other sign-ins to your account have ended and your password is new. Please sign in again with the new one. | pass | pass | 0.47 |
| T7 | OPEN | 224 | Not finished: Aegis named no change the desk can act on. | IT is looking into the slow internet. Please tell us whether you're in the office or at home, and whether you're on Wi-Fi or a cable. | Internet speed is back to normal. Let us know if anything still feels slow. | pass | pass | 0.33 |
| T8 | RESOLVED (SIMULATED) | 156 | Fixed in the practice copy: every change was made and double-checked. | IT is reviewing your request for the shared mailbox. It needs the managing partner's sign-off first. | You can now open the shared mailbox in Outlook and send as it. Restart Outlook if it doesn't show up. | pass | pass | none |

Run totals: Tickets: RESOLVED (SIMULATED) 6, INCONCLUSIVE 1, INVESTIGATE 0, OPEN 1, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 1; model sessions 7, total cost 3.63 US dollars, total time 407.5 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1: none
- T2: none
- T3: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T4: none
- T5: none
- T6: none
- T7: the answer names no gate the runbooks know, so there is nothing to approve
- T8: none

## The three thinking rules, per answer

| ticket | what changed | lightest step first | look before guessing | first step, as written |
|---|---|---|---|---|
| T1 | n/a (no change named) | pass | pass | Open Entra admin center → Users → [UPN] → Sign-in logs. If the latest Outlook/Teams sign-in shows "MFA not completed", the lost phone is the cause. Any other failure is a different problem. |
| T2 | n/a (no change named) | fail | fail | Get HR's written confirmation and the head of engineering's approval into the ticket. |
| T3 | n/a (no change named) | pass | fail | Call the studio manager back on the staff-list number to confirm the request. |
| T4 | n/a (no change named) | pass | n/a | Open Exchange admin center → Recipients → Mailboxes → [SHARED_MAILBOX] → Mailbox Delegation. Copy the current lists into the ticket. If [UPN] is already listed, only add the missing right. |
| T5 | n/a (no change named) | pass | n/a | Exchange admin center → Mail flow → Message trace: vendor sender → [USER@DOMAIN.COM], last 10 days. **Delivered** → step 2. **Quarantined** → step 3. **Failed** or no result → step 4. |
| T6 | n/a (no change named) | pass | pass | Okta Admin Console → Reports → System Log → search [UPN]. Find that sign-in. If the password failed, nobody got in. If the password worked but Okta Verify was denied, the password is known. If the sign-in succeeded, treat the account as taken over. |
| T7 | n/a (no change named) | pass | n/a | Run a speed test on one office Mac and ask one remote person to run one too. If only the office is slow, the problem is the studio's line. If both are slow, it's probably a service. |
| T8 | n/a (no change named) | pass | n/a | Open Exchange admin center → Recipients → Mailboxes → [SHARED_MAILBOX] → Mailbox Delegation. Copy the current lists into the ticket. If [UPN] is already listed, only add the missing right. |

Read by rule: "what changed" applies when the ticket names a recent change and passes when the first step names it; "look before guessing" applies to a sign-in, account or device ticket and passes when the first step reads, looks or checks; "lightest step first" is the desk's row. A word match is not a judgment of the step: a person should read the answers.

## Side by side with batch 8 (full-run-2)

Batch 8 answers had one "Tell the user" line; the new check reads it as the now line. Batch 8 had no T9m.

| ticket | closing state, batch 8 | closing state, now | Fix card words, batch 8 | Fix card words, now | Tell the user, batch 8 | user message check, batch 8 | Tell the user now, now | Tell the user when done, now | user message check, now | cost batch 8 | cost now |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 161 | 183 | We're resetting your sign-in approval now. Have your new phone ready. You'll set up Authenticator once and you'll be back in. | pass | IT is checking your account and will confirm it's you with the office manager. Please install Microsoft Authenticator on your new phone. | Your new phone now approves your sign-ins. Open Outlook and Teams and approve the prompt. | pass | 0.34 | 0.39 |
| T2 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 151 | 178 | We'll remove access at close of business Friday once HR confirms in writing. Please make sure their work and laptop are handed over. We'll confirm here when it's done. | pass | IT has the request for the end of the day Friday. Please ask HR to confirm it in writing in the ticket. | [FIRST_NAME]'s access to Okta, GitHub, Google Workspace and Linear has ended. | fail | 0.89 | 0.98 |
| T3 | INCONCLUSIVE | INCONCLUSIVE | 155 | 182 | We are changing your password and signing you out everywhere. The stolen laptop will be erased remotely. Anything saved only on that laptop will be lost. | pass | IT is checking the Mac's protection and the designer's accounts. We will call you back before anything changes. | The designer's Google sign-ins on the Mac are ended and the Mac is [locked / erased]. | pass | 0.37 | 0.84 |
| T4 | OPEN | RESOLVED (SIMULATED) | 133 | 156 | You now have access to the shared mailbox and can send from it. It can take up to an hour to show up in Outlook. If it doesn't show up, restart Outlook. | fail | IT is reviewing your request for the shared mailbox. It needs the managing partner's sign-off first. | You can now open the shared mailbox in Outlook and send as it. Restart Outlook if it doesn't show up. | pass | 0.21 | 0.21 |
| T5 | OPEN | RESOLVED (SIMULATED) | 175 | 212 | We're tracing the vendor's invoices now. Please don't pay any invoice that asks you to change bank details. We'll update you today. | fail | IT is tracing where this vendor's emails are going. Please don't act on any payment-detail change from this vendor until IT gets back to you. | The held invoices are now in your inbox. Tell us if a new one goes missing. | pass | 0.47 | 0.41 |
| T6 | FAILED | RESOLVED (SIMULATED) | 142 | 236 | We've locked your account to keep you safe. We'll call you on video to get you back in. Ignore any message that asks for your password. | fail | IT is checking the sign-in record for your account now. Please don't approve any Okta Verify prompt you didn't start. We'll set up a short video call with you. | Other sign-ins to your account have ended and your password is new. Please sign in again with the new one. | pass | 0.48 | 0.47 |
| T7 | CLARIFY | OPEN | 170 | 224 | We're looking into the slow internet now. We'll find out whether it's coming from inside the office or from the provider. We'll update you soon. | pass | IT is looking into the slow internet. Please tell us whether you're in the office or at home, and whether you're on Wi-Fi or a cable. | Internet speed is back to normal. Let us know if anything still feels slow. | pass | 0.21 | 0.33 |
| T8 | OPEN | RESOLVED (SIMULATED) | 135 | 156 | You now have access to the shared mailbox. It will appear in Outlook within about an hour. Let us know if it doesn't show up. | fail | IT is reviewing your request for the shared mailbox. It needs the managing partner's sign-off first. | You can now open the shared mailbox in Outlook and send as it. Restart Outlook if it doesn't show up. | pass | 0.29 | none |
