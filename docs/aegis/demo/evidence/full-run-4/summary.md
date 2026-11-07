# Full run 4 (the messy tickets, T1m to T9m): one row per ticket

| ticket | closing state | Fix card words | what stopped it, in plain words | Tell the user now | Tell the user when done | user message now check | lightest step first | cost in US dollars |
|---|---|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | 249 | Fixed in the practice copy: every change was made and double-checked. | IT is working on getting your new phone set up for sign-in. If you still have your old phone, please keep it charged and nearby. We will call to confirm it's you first. | Your new phone is set up. Open Outlook and Teams, sign in, and approve the prompt in Authenticator on your new phone. | pass | pass | 0.34 |
| T2m | INCONCLUSIVE | 183 | Not proved: at least one change has no way to be double-checked yet. | IT is preparing this for after [FIRST_NAME]'s last day. Please ask HR to confirm in writing on this ticket. | [FIRST_NAME]'s accounts are closed. Their files and calendar are with their manager. | pass | pass | 0.70 |
| T3m | INCONCLUSIVE | 247 | Not proved: at least one change has no way to be double-checked yet. | IT is checking your work accounts and the laptop's status. Please keep your phone close so we can call you back, and send us the police report number. | You're signed out of your work Google account everywhere, and the stolen laptop is locked. Sign in with the temporary password we gave you and pick a new one. | pass | pass | 0.64 |
| T4m | RESOLVED (SIMULATED) | 195 | Fixed in the practice copy: every change was made and double-checked. | IT is setting up your access to the billing inbox once the managing partner approves it. We will let you know when it is ready. | The billing inbox is now in your Outlook, and replies you send from it come from the billing address. If you don't see it, close and reopen Outlook. | pass | pass | 0.31 |
| T5m | RESOLVED (SIMULATED) | 190 | Fixed in the practice copy: every change was made and double-checked. | IT is tracing the vendor's messages to find where they stopped. Please ask the vendor for the send dates and subject lines. | The vendor's invoices are in your inbox now. Tell us if any are still missing. | pass | pass | 0.45 |
| T6m | RESOLVED (SIMULATED) | 181 | Fixed in the practice copy: every change was made and double-checked. | IT is checking that sign-in. Don't click anything in that email, and don't approve any Okta Verify prompt you didn't start. | You're signed out everywhere and your password is reset. Sign in with the new one. | pass | pass | 0.54 |
| T7m | OPEN | 200 | Not finished: Aegis named no change the desk can act on. | IT is checking what's slowing the office connection. If a call freezes, please note the time. | We found what was slowing the connection, and test calls are steady again. | pass | pass | 0.27 |
| T8m | RESOLVED (SIMULATED) | 180 | Fixed in the practice copy: every change was made and double-checked. | IT got your request. We'll call you to confirm it, and the managing partner needs to approve it. | The billing mailbox is set up for you. It will show up in Outlook by itself. Restart Outlook if you don't see it. | pass | pass | 0.21 |
| T9m | OPEN | 186 | Not finished: the runbook has no approved way to make this change yet. | Please quit Okta Verify fully, reopen it and sign in. If it loops, restart your Mac and try again. Send us your macOS and Okta Verify versions. | Your sign-in works again. If Okta asks, set up Okta Verify once. | pass | pass | 0.35 |

Run totals: Tickets: RESOLVED (SIMULATED) 5, INCONCLUSIVE 2, INVESTIGATE 0, OPEN 2, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 0; model sessions 9, total cost 3.81 US dollars, total time 466.0 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1m: none
- T2m: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T3m: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T4m: none
- T5m: none
- T6m: none
- T7m: the answer names no gate the runbooks know, so there is nothing to approve
- T8m: none
- T9m: the answer names okta-verify-loop-admin-reauth, a PREVIEW ONLY marker in okta-mfa-reset: the runbook authorizes no change there, so nothing can be approved

## The three thinking rules, per answer

| ticket | what changed | lightest step first | look before guessing | first step, as written |
|---|---|---|---|---|
| T1m | n/a (no change named) | pass | fail | Confirm it is really [FIRST_NAME]: the office manager vouches for them by phone. |
| T2m | n/a (no change named) | pass | fail | Get HR's written confirmation and the head of engineering's approval onto the ticket. Confirm which Friday is meant, because today is a Friday. |
| T3m | n/a (no change named) | pass | pass | Call the person back on the number in the staff list. Then read Jamf Pro → Computers → [SERIAL_NUMBER] (last check-in, FileVault) and Google Admin → Reporting → User log events since the theft. No check-in and no unknown sign-ins means nothing has been accessed yet. Any unknown sign-in is the Stop-if case. |
| T4m | n/a (no change named) | pass | n/a | Get the managing partner's approval on the ticket. |
| T5m | n/a (no change named) | pass | n/a | Exchange admin center → Mail flow → Message trace → sender: the vendor's domain, recipient: [USER@DOMAIN.COM], from last Tuesday. Delivered means look in the mailbox. Quarantined means go to step 3. No record means the mail never reached you. |
| T6m | n/a (no change named) | pass | pass | Okta Admin Console → Reports → System Log → search [UPN]. A successful Romania sign-in means someone got in. A failed one means MFA stopped it. No event at all means the email is likely phishing. |
| T7m | n/a (no change named) | pass | n/a | Open Jamf Pro → Computers → Management History. Look for a large update sent to many Macs recently. If you find one, those downloads may be filling the line. If not, rule it out. |
| T8m | n/a (no change named) | pass | n/a | Call the requester back on the number in the firm's staff list to confirm the request is really from them. |
| T9m | fail | pass | pass | Okta Admin Console → Reports → System Log → search [UPN]. Repeated Okta Verify failures from this Mac point to leftover state on the Mac. Sign-ins or pushes they didn't make mean stop. |

Read by rule: "what changed" applies when the ticket names a recent change and passes when the first step names it; "look before guessing" applies to a sign-in, account or device ticket and passes when the first step reads, looks or checks; "lightest step first" is the desk's row. A word match is not a judgment of the step: a person should read the answers.

## Side by side with batch 8 (full-run-3)

Batch 8 answers had one "Tell the user" line; the new check reads it as the now line. Batch 8 had no T9m.

| ticket | closing state, batch 8 | closing state, now | Fix card words, batch 8 | Fix card words, now | Tell the user, batch 8 | user message check, batch 8 | Tell the user now, now | Tell the user when done, now | user message check, now | cost batch 8 | cost now |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 176 | 249 | We're moving your sign-in app to your new phone. Keep the new phone handy and we'll walk you through a 2-minute setup. You'll be in before patients arrive. | pass | IT is working on getting your new phone set up for sign-in. If you still have your old phone, please keep it charged and nearby. We will call to confirm it's you first. | Your new phone is set up. Open Outlook and Teams, sign in, and approve the prompt in Authenticator on your new phone. | pass | 0.31 | 0.34 |
| T2m | OPEN | INCONCLUSIVE | 153 | 183 | We'll switch off [FIRST_NAME]'s access at the end of Friday. Please ask HR to confirm in writing on the ticket. Please also confirm their GitHub username. | pass | IT is preparing this for after [FIRST_NAME]'s last day. Please ask HR to confirm in writing on this ticket. | [FIRST_NAME]'s accounts are closed. Their files and calendar are with their manager. | pass | 0.89 | 0.70 |
| T3m | INCONCLUSIVE | INCONCLUSIVE | 163 | 247 | You did the right thing reporting it. We're locking your account now and will erase the laptop. You'll get a new password by phone. | pass | IT is checking your work accounts and the laptop's status. Please keep your phone close so we can call you back, and send us the police report number. | You're signed out of your work Google account everywhere, and the stolen laptop is locked. Sign in with the temporary password we gave you and pick a new one. | pass | 0.64 | 0.64 |
| T4m | OPEN | RESOLVED (SIMULATED) | 152 | 195 | You now have the billing inbox. Restart Outlook and it will show up. Replies will go out from the billing address. | fail | IT is setting up your access to the billing inbox once the managing partner approves it. We will let you know when it is ready. | The billing inbox is now in your Outlook, and replies you send from it come from the billing address. If you don't see it, close and reopen Outlook. | pass | 0.24 | 0.31 |
| T5m | INCONCLUSIVE | RESOLVED (SIMULATED) | 173 | 190 | Your email is working. The vendor's invoices look like they were held by our spam filter. We're checking each one and will release the safe ones today. | fail | IT is tracing the vendor's messages to find where they stopped. Please ask the vendor for the send dates and subject lines. | The vendor's invoices are in your inbox now. Tell us if any are still missing. | pass | 0.33 | 0.45 |
| T6m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 174 | 181 | Please don't click anything in that email. We're checking your account now. If we reset your password, we'll give you the new one on a call. | pass | IT is checking that sign-in. Don't click anything in that email, and don't approve any Okta Verify prompt you didn't start. | You're signed out everywhere and your password is reset. Sign in with the new one. | pass | 0.36 | 0.54 |
| T7m | OPEN | OPEN | 176 | 200 | We're checking the office internet now. It's probably not your laptop. We'll update you within the hour. | fail | IT is checking what's slowing the office connection. If a call freezes, please note the time. | We found what was slowing the connection, and test calls are steady again. | pass | 0.24 | 0.27 |
| T8m | OPEN | RESOLVED (SIMULATED) | 147 | 180 | We've got your request. Once the managing partner approves it, the billing inbox will show up in Outlook by itself. You may need to restart Outlook. | pass | IT got your request. We'll call you to confirm it, and the managing partner needs to approve it. | The billing mailbox is set up for you. It will show up in Outlook by itself. Restart Outlook if you don't see it. | pass | 0.28 | 0.21 |
| T9m | not run | OPEN | none | 186 | none | not run | Please quit Okta Verify fully, reopen it and sign in. If it loops, restart your Mac and try again. Send us your macOS and Okta Verify versions. | Your sign-in works again. If Okta asks, set up Okta Verify once. | pass | none | 0.35 |
