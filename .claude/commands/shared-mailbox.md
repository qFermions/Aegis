---
description: Create and manage shared mailboxes in Exchange Online — members, Send As vs Send on Behalf, auto-mapping, convert user→shared. Portal first. Placeholders only.
disable-model-invocation: true
---

# /shared-mailbox

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Shared mailboxes need **no license** under 50 GB. Manage in the new Exchange admin center (EAC). The two access types people confuse: **Send As** (looks like it came from the mailbox) vs **Send on Behalf** ("[USER] on behalf of [MAILBOX]").

## What to check first
- Does the mailbox exist? EAC → Recipients → Mailboxes → filter Shared.
- What does the user actually need: read, Send As, or Send on Behalf?

## Step-by-step fix (portal first — EAC: admin.exchange.microsoft.com)

> **PREVIEW ONLY [shared-mailbox-create-grant]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

**Create:** EAC → Recipients → **Mailboxes → Add a shared mailbox** → name + alias `[MAILBOX]@[@Aegion_DOMAIN]`.

**Grant access:** open the shared mailbox → **Delegation**:
- **Read and manage (Full Access)** → add `[UPN]`. Auto-mapping adds it to their Outlook automatically.
- **Send As** → add `[UPN]` (sends *as* the mailbox).
- **Send on Behalf** → add `[UPN]` (sends *on behalf of*).

<!-- SAFETY GATE [shared-mailbox-convert-portal] -->
- **Target:** [UPN]
- **Effect:** convert the user mailbox to Shared without removing its license
- **Scope:** one mailbox verified below 50 GB with archive requirements reviewed
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by converting the mailbox back to User
- **Required confirmation:** Type exactly `CONVERT MAILBOX [UPN] TO SHARED`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [shared-mailbox-convert-portal]:** Only after the exact match, EAC → Mailboxes → `[UPN]` → **Others → Convert to shared mailbox**. License removal is a separate destructive action and is not authorized by this phrase.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline                                            # connect to Exchange Online
# PREVIEW ONLY [shared-mailbox-create] — non-executing mailbox-creation reference.
# New-Mailbox -Shared -Name "[MAILBOX]" -PrimarySmtpAddress "[MAILBOX]@[@Aegion_DOMAIN]"
# PREVIEW ONLY [shared-mailbox-full-access] — non-executing Full Access grant reference.
# Add-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -AutoMapping $true
# PREVIEW ONLY [shared-mailbox-send-as] — non-executing Send As grant reference.
# Add-RecipientPermission -Identity "[MAILBOX]" -Trustee "[UPN]" -AccessRights SendAs -Confirm:$false
# PREVIEW ONLY [shared-mailbox-send-on-behalf] — non-executing Send on Behalf grant reference.
# Set-Mailbox -Identity "[MAILBOX]" -GrantSendOnBehalfTo @{Add="[UPN]"}
# PREVIEW ONLY [shared-mailbox-convert] — non-executing conversion reference; use the adjacent portal conversion gate.
# Set-Mailbox -Identity "[UPN]" -Type Shared
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
> Resolved [date/time]. Shared-mailbox state: [conversion of `[UPN]` verified under this command's exact gate / creation of `[MAILBOX]` verified under a separate workflow / unchanged]. Delegation for `[UPN]`: [Full Access/Send As verified under separate actions / unchanged / not requested]. Auto-mapping and delegate access: [verified / not verified]. Time spent: [X] min.
