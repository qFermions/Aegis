## Verdict
**The cause isn't known yet, so I don't advise any change yet.** Nothing has been checked: Aegis has no access to this tenant, and "the vendor keeps sending" is only the vendor's claim. A message trace will show where the mail is going, and that result decides the fix.

Don't add an allow entry to get the invoices flowing. This could also be invoice fraud, so check that too (step 3).

Most likely causes, none confirmed:
- **Vendor changed something:** only this sender is affected, so a new sending address or platform, or an authentication failure, may be getting the mail blocked or quarantined.
- **Inbox rule or forwarding:** something on the mailbox is moving the mail, either by accident or from an attacker.
- **Recipient address changed:** an address or group was changed on-prem and synced.

## What to check first (read-only, R0)
1. Message trace.
2. Quarantine.
3. Inbox rules and forwarding on the receiving mailbox.

## Step-by-step

**1. Run the trace**

`Exchange admin center → Mail flow → Message trace → + Start a trace`
- **First search:** `[SENDER]` to `[USER@DOMAIN.COM]`, starting from before the last invoice that arrived, so you have a good message to compare.
- **If nothing comes back:** search by recipient only and look for the vendor's domain, because the vendor may have changed sending address.
- **For older messages:** the live trace only covers about 10 days, and older searches run as a downloadable report. This is from memory, so confirm it in the portal.

**2. Follow the result**

| Trace shows | Meaning | Next step |
|---|---|---|
| **No record** | The mail never reached the tenant, or was rejected at the edge | Ask the vendor for the bounce message, send time and exact recipient address |
| **Failed / bounced** | Rejected | Read the event detail, including any rule name. If the address no longer exists, check step 4 |
| **Quarantined / filtered as spam** | Held by Defender | Go to step 5 |
| **Delivered** | It reached the mailbox | Go to step 3 |
| **Redirected / forwarded / expanded** | It went somewhere else | Follow it, and that's your answer. If the destination is external, treat it as the stop condition in step 3 |
| **Mail flow rule event** | A rule acted on it | Review it at `Mail flow → Rules → [rule name]`, including when it changed and who changed it |

**3. Check the mailbox**
- **With the clerk:** search all folders, including Junk, Deleted Items and Archive.
- **Rules:** `Outlook on the web → Settings → Mail → Rules`. Hidden rules don't show here, so use the PowerShell below.
- **Blocked senders:** `Settings → Mail → Junk email → Blocked senders and domains`.
- **Forwarding:** `Exchange admin center → Recipients → Mailboxes → [mailbox] → Manage mail flow settings`.

🛑 **Stop if you find a rule or forwarding the clerk didn't create.** That is a classic sign of invoice fraud.
- Don't delete it, because it's evidence.
- Move the ticket to `/security-alert-triage` as a suspected account compromise.

**4. If the address is the problem**
- Check the address at `Exchange admin center → Recipients → [mailbox or group] → email addresses`. If it's a group, also check that the clerk is still reached through it.
- For synced objects, the fix belongs in on-prem AD, followed by a sync. Bring the finding back before changing anything.

**5. If it's quarantined**

`Defender portal → Email & collaboration → Review → Quarantine`
- Read the quarantine reason and the SPF, DKIM and DMARC results.
- **Phish or failed authentication:** don't release. Call the vendor on a number you already have on file, not one from the emails.
- **Confirmed false positive:** `/email-quarantine` has a one-recipient release gate, `[quarantine-release-one-portal]`, with its own typed confirmation for each message. Delivery can't be recalled.
- **If it keeps recurring:** `/email-whitelist` method 1 is the safest option: one exact sender, with an expiry. It is preview only (`[email-whitelist-method-1]`), so it needs its own reviewed procedure.

## PowerShell - for reference only
The portal doesn't show hidden rules, so this is the one check that needs PowerShell. All of it is read-only, and the script safety scan found nothing to flag.

<details>
<summary>Read-only checks</summary>

```powershell
# Sign in to Exchange Online with an admin account (needs the ExchangeOnlineManagement module)
Connect-ExchangeOnline -UserPrincipalName "[UPN]"

# List the mailbox's inbox rules, including hidden ones
Get-InboxRule -Mailbox "[USER@DOMAIN.COM]" -IncludeHidden |
    # Show each rule's trigger and where it sends or moves mail
    Select-Object Name, Enabled, From, SubjectContainsWords, MoveToFolder, DeleteMessage, ForwardTo, RedirectTo

# Show any forwarding set on the mailbox itself
Get-Mailbox "[USER@DOMAIN.COM]" |
    # A value in either forwarding field means mail is being sent on
    Select-Object ForwardingSmtpAddress, ForwardingAddress, DeliverToMailboxAndForward

# Trace the last 10 days of mail from the vendor to this recipient
Get-MessageTraceV2 -SenderAddress "[SENDER]" -RecipientAddress "[USER@DOMAIN.COM]" -StartDate (Get-Date).AddDays(-10) -EndDate (Get-Date)
```
</details>

`/email-to-spam` still uses `Get-MessageTrace`. As I recall, Microsoft replaced it with the V2 cmdlet, but I couldn't check current docs in this session.

## ⚠️ Risk warning
- **Fraud:** treat any invoice that arrives during this problem with bank details or a sender address you don't recognize as suspect. Accounts payable should confirm by phone before paying.
- **Allow entries:** these weaken filtering for a sender you haven't verified. If the vendor's account has been compromised, an allow entry lets the attacker's mail through as well.
- **Scope:** don't use domain-wide allows, SCL -1 rules or IP allows here.

## ✅ Verification checklist
- [ ] Trace result recorded, comparing the last good message with a missing one
- [ ] Rules, including hidden ones, and forwarding checked, with any rule the clerk didn't create escalated
- [ ] Root cause matches the trace evidence
- [ ] Fix read back in the portal, if a fix was needed
- [ ] Vendor's new test message traced as delivered, and the clerk sees it in the Inbox
- [ ] Missing invoices resent and details checked against known vendor records

## 📝 Jira-ready note
> Investigating missing invoices from one freight vendor, reported by accounts payable. Other vendors are unaffected. No configuration changes made so far. Next steps: read-only message trace, quarantine review, and inbox rule and forwarding check, including hidden rules. Trace result: [PENDING]. Root cause: [PENDING]. No allow entry will be added until the trace confirms the block reason and the sender is verified through a known vendor contact. AP advised to confirm any changed bank details by phone. Ticket stays open until a new vendor message is confirmed in the mailbox and the missing invoices are recovered. Ref: [JIRA-###].

**How this was worked:**
- **Routing:** I handled this directly as bounded Tier 2 troubleshooting, using your replay MISS.
- **Skipped checks:** this session has no shell, so `tier-guard.js` and the memory CLI weren't run. No local memory store exists in the repo to search.
- **Customer environment:** I only used the platforms listed in the ticket, because the environment details in `CLAUDE.md` don't describe Customer C.

Gate: none
