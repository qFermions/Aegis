---
description: Grant, audit, or remove Exchange mailbox permissions — Full Access, Send As, Send on Behalf, and calendar/folder delegation. Portal first. Placeholders only.
disable-model-invocation: true
---

# /mailbox-permissions

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Three distinct rights people conflate: **Full Access** (open & read the mailbox), **Send As** (send *as* the mailbox), **Send on Behalf** (send *on behalf of*). Calendar/folder delegation is separate again. Grant the least that solves the ask.

## What to check first
- Whose mailbox (`[MAILBOX]`), which delegate (`[UPN]`), and what they actually need (read? send? calendar only?).
- EAC → Recipients → Mailboxes → `[MAILBOX]` → **Delegation** to see current grants.

## Step-by-step (portal first — EAC)

> **PREVIEW ONLY [mailbox-grant-portal]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. EAC → Recipients → Mailboxes → `[MAILBOX]` → **Delegation**.
2. Grant what's needed:
   - **Read and manage (Full Access)** → add `[UPN]` (auto-maps into their Outlook).
   - **Send As** → add `[UPN]`.
   - **Send on Behalf** → add `[UPN]`.
3. **Calendar-only:** the owner shares the calendar in Outlook (Editor/Reviewer), or set folder-level permissions.
4. **Audit:** review the Delegation list; remove anyone who shouldn't have access (offboarding, role change).
<!-- SAFETY GATE [mailbox-permission-remove-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** remove Full Access while leaving other delegation unchanged
- **Scope:** one user and one mailbox
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by granting Full Access again
- **Required confirmation:** Type exactly `REMOVE FULL ACCESS FOR [UPN] FROM [MAILBOX]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mailbox-permission-remove-portal]:** Only after the exact match, remove `[UPN]` from **Full Access** on `[MAILBOX]` and re-read the Delegation list.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline
# Audit current permissions (read-only)
Get-MailboxPermission -Identity "[MAILBOX]" | Where-Object {$_.User -notlike "NT AUTHORITY*"}  # Full Access grants
Get-RecipientPermission -Identity "[MAILBOX]"                                                   # Send As grants
# PREVIEW ONLY [mailbox-full-access-grant] — non-executing permission-grant reference.
# Add-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -AutoMapping $true
# PREVIEW ONLY [mailbox-send-as-grant] — non-executing permission-grant reference.
# Add-RecipientPermission -Identity "[MAILBOX]" -Trustee "[UPN]" -AccessRights SendAs -Confirm:$false
# ⚠️ Remove access
# SAFETY GATE [mailbox-permission-remove]
# Target: [UPN] on [MAILBOX]
# Effect: removes Full Access while leaving other delegation unchanged
# Scope: one user and one mailbox
# Reversibility: R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible with Add-MailboxPermission
$requiredConfirmation = "REMOVE FULL ACCESS FOR [UPN] FROM [MAILBOX]"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Remove-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -AccessRights FullAccess -Confirm:$false -ErrorAction Stop
    $remaining = @(Get-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -ErrorAction Stop | Where-Object { $_.AccessRights -contains 'FullAccess' -and -not $_.Deny })
    if ($remaining.Count -ne 0) { throw "Removal returned but Full Access is still present on read-back." }
} else {
    throw "Confirmation did not match. No change was made."
}
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
> Resolved [date/time]. Mailbox-permission state for `[UPN]` on `[MAILBOX]`: [read-only audit / removal verified under this command's exact gate / grant verified under a separate authorized workflow]. Permission: [Full Access / Send As / Send on Behalf]. Read-back/test-send state: [verified result / not performed]. Authorization reference: [MANAGER_NAME / JIRA-###]. Time spent: [X] min.
