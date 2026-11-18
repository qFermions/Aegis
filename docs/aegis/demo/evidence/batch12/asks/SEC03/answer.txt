Writing the answer now. I read the answer format, `/phishing-bec` and `/identity-compromise`.

Mode: Incident answer
Assumed setup: Microsoft 365 Business Premium with hybrid Active Directory and Exchange Online (no company profile given). Tell me what your company runs for a better answer.

## Incident answer
**Severity:** SEV-2 until shown otherwise. Raise it to SEV-1 if any payment, bank detail or supplier instruction has changed. At risk: the accounts payable mailbox and outgoing payments. She didn't make the rule. A rule that hides bank mail in the RSS Feeds folder is a known sign of a mailbox takeover. Nobody has confirmed that yet.

**Contain first:**
1. Before acting on any pending payment or bank-detail change, call the bank on a number finance already has. *Decides:* finance lead. *Cost:* payments run slower for a while.
2. End her sign-in sessions. *Decides:* security on-call. *Cost:* she has to sign in again.
3. Reset her password at the on-premises source. Give her the new one on a call the tech places to the number on file. *Decides:* security on-call. *Cost:* a short time without access.
4. Write the rule into the ticket, then switch it off without deleting it. *Decides:* security on-call. *Cost:* none.
5. Block the account only if the security lead decides to. *Cost:* she can't work until it's lifted.

**Preserve:** 30 days of Entra sign-in logs (interactive and non-interactive), the full rule list including hidden rules, forwarding settings, her sign-in methods, and one bank message with full headers. Do all of this before step 2.

**Escalate to:** the security on-call, by phone. They need the mailbox, what the rule does, when bank mail started going missing, and the exports above.

**Communications:** finance lead now. The reporter gets the reply below. Don't contact her about this by email.

**Timeline:** first seen: unknown. Rule created: unknown. Reported: in this ticket. Now: under triage.

## Details
- No replay lookup was run.
- Who else, and what left: read the audit log for mail sent from her mailbox, rules in other finance mailboxes, and replies to the bank. Don't judge how serious it is until that's done.
- Step 2 (end sessions): R1. Double-check: Aegis reads that the sign-ins stop.
- Step 3 (password reset): R1. Double-check: Aegis reads the new password-change time.
- Step 4 (rule off): R1. Double-check: Aegis reads the rule as Enabled False.
- Later step, only if the rule is hidden from Outlook on the web: the security team removes it under its own reviewed change, using preview `identity-compromise-hidden-rule-preview`.

<details><summary>PowerShell, for reference only (read-only)</summary>

```powershell
# Lists every inbox rule, hidden ones too, with where each moves or sends mail
Get-InboxRule -Mailbox "[UPN]" -IncludeHidden | Format-List Name,Enabled,RedirectTo,ForwardTo,DeleteMessage,MoveToFolder
# Shows whether the mailbox forwards mail elsewhere
Get-Mailbox -Identity "[UPN]" | Format-List ForwardingAddress,ForwardingSmtpAddress,DeliverToMailboxAndForward
```
</details>

**Jira note:** [JIRA-###]: an inbox rule moves bank mail to RSS Feeds for [UPN] (accounts payable). The user denies creating it. Escalated to security on-call as SEV-2. Evidence captured before any change. Finance told to confirm payments with the bank by phone.

```asker-reply
Yes, it can be fixed, but first it goes to our security team: a rule she never made that hides bank mail can mean someone else has got into her mailbox. I haven't confirmed that, and it may turn out to be harmless.

Thank you for raising it quickly. Please pass this on to her: don't delete the rule or any of the moved emails, don't reply to anything that asks for a payment or bank details by email, and check the RSS Feeds folder for anything from the bank she still needs to act on. Before any payment goes out, confirm it by calling the bank on a number she already has.

The security team and a technician pick this up next. They will call her to make the changes to her account.
```

```aegis-desk
Gate: security-session-revoke-portal
Change record: R1, owned by /security-alert-triage (phrase and read-back as that runbook writes them)
Gate: password-reset-synced-portal
Change record: R1, owned by /password-reset (phrase and read-back as that runbook writes them)
Gate: identity-compromise-inbox-rule-off-portal
Phrase: DISABLE INBOX RULE [MAIL_RULE_NAME] FOR [UPN]
Change record: R1, no change record
Read-back: Get-InboxRule -Mailbox "[UPN]" -IncludeHidden | Format-List Name,Enabled,RedirectTo,ForwardTo,ForwardAsAttachmentTo,DeleteMessage,MoveToFolder,Identity
```