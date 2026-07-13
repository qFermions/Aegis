---
description: Grant, audit, or remove Exchange mailbox permissions — Full Access, Send As, Send on Behalf, and calendar/folder delegation. Portal first. Placeholders only.
---

# /mailbox-permissions

**Verdict:** Three distinct rights people conflate: **Full Access** (open & read the mailbox), **Send As** (send *as* the mailbox), **Send on Behalf** (send *on behalf of*). Calendar/folder delegation is separate again. Grant the least that solves the ask.

## What to check first
- Whose mailbox (`[MAILBOX]`), which delegate (`[UPN]`), and what they actually need (read? send? calendar only?).
- EAC → Recipients → Mailboxes → `[MAILBOX]` → **Delegation** to see current grants.

## Step-by-step (portal first — EAC)
1. EAC → Recipients → Mailboxes → `[MAILBOX]` → **Delegation**.
2. Grant what's needed:
   - **Read and manage (Full Access)** → add `[UPN]` (auto-maps into their Outlook).
   - **Send As** → add `[UPN]`.
   - **Send on Behalf** → add `[UPN]`.
3. **Calendar-only:** the owner shares the calendar in Outlook (Editor/Reviewer), or set folder-level permissions.
4. **Audit:** review the Delegation list; remove anyone who shouldn't have access (offboarding, role change).
5. **Remove:** Delegation → remove the user from the relevant right.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline
# Audit current permissions (read-only)
Get-MailboxPermission -Identity "[MAILBOX]" | Where-Object {$_.User -notlike "NT AUTHORITY*"}  # Full Access grants
Get-RecipientPermission -Identity "[MAILBOX]"                                                   # Send As grants
# Grant
Add-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -AutoMapping $true
Add-RecipientPermission -Identity "[MAILBOX]" -Trustee "[UPN]" -AccessRights SendAs -Confirm:$false
# ⚠️ Remove access
Remove-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -Confirm:$false
```
</details>

## ⚠️ Risk warning
- Full Access lets the delegate read **everything** in the mailbox — confirm it's authorized (especially for exec/HR/finance mailboxes). Logging access grants is good hygiene.
- Removing permission during active use will drop the mailbox from the delegate's Outlook — expected; tell them.

## ✅ Verification checklist
- [ ] Delegate has exactly the right(s) requested — no more
- [ ] Send As / on-behalf produces the correct From line on a test send
- [ ] Full Access mailbox auto-maps (or re-add profile if delayed)
- [ ] Audit list reflects only authorized delegates

## 📝 Jira-ready note
> Resolved [date/time]. [Granted/removed/audited] `[UPN]` [Full Access / Send As / Send on Behalf] on `[MAILBOX]`. Verified expected behavior on a test send. Access authorized by [MANAGER_NAME]. Time spent: [X] min.
