---
description: Create and manage shared mailboxes in Exchange Online — members, Send As vs Send on Behalf, auto-mapping, convert user→shared. Portal first. Placeholders only.
---

# /shared-mailbox

**Verdict:** Shared mailboxes need **no license** under 50 GB. Manage in the new Exchange admin center (EAC). The two access types people confuse: **Send As** (looks like it came from the mailbox) vs **Send on Behalf** ("[USER] on behalf of [MAILBOX]").

## What to check first
- Does the mailbox exist? EAC → Recipients → Mailboxes → filter Shared.
- What does the user actually need: read, Send As, or Send on Behalf?

## Step-by-step fix (portal first — EAC: admin.exchange.microsoft.com)

**Create:** EAC → Recipients → **Mailboxes → Add a shared mailbox** → name + alias `[MAILBOX]@[@Aegion_DOMAIN]`.

**Grant access:** open the shared mailbox → **Delegation**:
- **Read and manage (Full Access)** → add `[UPN]`. Auto-mapping adds it to their Outlook automatically.
- **Send As** → add `[UPN]` (sends *as* the mailbox).
- **Send on Behalf** → add `[UPN]` (sends *on behalf of*).

**Convert a user mailbox → shared:** EAC → Mailboxes → `[UPN]` → **Others → Convert to shared mailbox**. (Used in `/offboard` to retain mail without a license.)

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline                                            # connect to Exchange Online
# Create a shared mailbox
New-Mailbox -Shared -Name "[MAILBOX]" -PrimarySmtpAddress "[MAILBOX]@[@Aegion_DOMAIN]"  # new shared mbx
# Full Access (auto-maps into Outlook)
Add-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -AutoMapping $true
# Send As
Add-RecipientPermission -Identity "[MAILBOX]" -Trustee "[UPN]" -AccessRights SendAs -Confirm:$false
# Send on Behalf
Set-Mailbox -Identity "[MAILBOX]" -GrantSendOnBehalfTo @{Add="[UPN]"}
# Convert user mailbox to shared
Set-Mailbox -Identity "[UPN]" -Type Shared                        # convert (then remove license)
```
</details>

## ⚠️ Risk warning
- Shared mailbox >50 GB or with In-Place Archive **needs a license** — don't strip the license if it's large/archived.
- Auto-mapping change can take time to appear in Outlook; a full re-add to profile may be needed.

## ✅ Verification checklist
- [ ] Mailbox shows under Recipients → Shared
- [ ] Delegate sees it in Outlook (auto-mapped) and can read
- [ ] Test Send As / Send on Behalf produces the expected From line
- [ ] (Converted) license removed only after confirming <50 GB

## 📝 Jira-ready note
> Resolved [date/time]. [Created shared mailbox `[MAILBOX]` / granted `[UPN]` Full Access + Send As / converted `[UPN]` to shared]. Auto-mapping enabled; delegate confirmed access. Time spent: [X] min.
