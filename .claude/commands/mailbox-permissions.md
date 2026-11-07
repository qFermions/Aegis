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

1. EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation**: read the three lists (Send as, Send on behalf, Read and manage (Full Access)) before any change. This is the pre-state; copy it into the ticket. Aegis can read the same lists with the read-only Exchange connector (`exo-client.js mailbox-permissions` and `recipient-permissions`).
2. Grant only what the person needs, with the gate for that permission below: Full Access to read the mailbox, Send As to send as it. Send on Behalf has no gate here yet:

> **PREVIEW ONLY [mailbox-send-on-behalf-portal]:** Mailbox Delegation → **Send on behalf** → **Edit** → **Add members** is not authorized by this reference; no gate and no read-back cover it yet.

3. **Calendar-only:** the owner shares the calendar in Outlook (Editor/Reviewer), or set folder-level permissions.
4. **Audit:** review the Mailbox Delegation lists; remove anyone who shouldn't have access (offboarding, role change), with the removal gates below.

Source for the Mailbox Delegation path, the Edit, Add members, Save and Confirm buttons, and the Delete button for a removal: Microsoft Learn, "Manage permissions for recipients in Exchange Online", https://learn.microsoft.com/exchange/recipients-in-exchange-online/manage-permissions-for-recipients (opened 2026-11-06; `docs/aegis/batch9/vendor-facts.md` X-30).

**Change record (R2 gates):** before a gate whose reversibility is R2 and that has a read-back named for it below, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and its read-back below as `--read-back`: `exo:verify-mailbox-permission` for [mailbox-full-access-grant-portal], `exo:verify-recipient-permission` for [mailbox-send-as-grant-portal]), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved. A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names.

<!-- SAFETY GATE [mailbox-full-access-grant-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** grant Full Access (read and manage) on one mailbox to one delegate; auto-mapping opens the mailbox in the delegate's Outlook
- **Scope:** one delegate and one mailbox; Send As and Send on Behalf are unchanged
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: it opens a whole mailbox to another person, and what they read while it was open cannot be taken back): undone by removing the grant with [mailbox-permission-remove-portal]
- **Required confirmation:** Type exactly `GRANT FULL ACCESS TO [MAILBOX] FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `exo-client.js verify-mailbox-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mailbox-full-access-grant-portal]:** Only after the exact match: EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation** → **Read and manage (Full Access)** → **Edit** → **Add members** → `[UPN]` → **Save** → **Confirm**. Undo: the removal gate [mailbox-permission-remove-portal].

```bash
# HUMAN-RUN read-only read-back of [mailbox-full-access-grant-portal]: passes only when [UPN] holds Full Access on [MAILBOX]
node scripts/adapters/exo-client.js verify-mailbox-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute
```

<!-- SAFETY GATE [mailbox-send-as-grant-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** grant Send As on one mailbox to one delegate, so mail they send from it shows only the mailbox as the sender
- **Scope:** one delegate and one mailbox; Full Access and Send on Behalf are unchanged
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: mail sent as the mailbox while the grant stood cannot be recalled): undone by removing the grant with [mailbox-send-as-remove-portal]
- **Required confirmation:** Type exactly `GRANT SEND AS ON [MAILBOX] TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `exo-client.js verify-recipient-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mailbox-send-as-grant-portal]:** Only after the exact match: EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation** → **Send as** → **Edit** → **Add members** → `[UPN]` → **Save** → **Confirm**. Undo: the removal gate [mailbox-send-as-remove-portal].

```bash
# HUMAN-RUN read-only read-back of [mailbox-send-as-grant-portal]: passes only when [UPN] holds Send As on [MAILBOX]
node scripts/adapters/exo-client.js verify-recipient-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute
```

<!-- SAFETY GATE [mailbox-send-as-remove-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** remove Send As from one delegate while leaving Full Access and Send on Behalf unchanged
- **Scope:** one user and one mailbox
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by granting Send As again with [mailbox-send-as-grant-portal]
- **Required confirmation:** Type exactly `REMOVE SEND AS FOR [UPN] FROM [MAILBOX]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [mailbox-send-as-remove-portal]:** Only after the exact match: EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation** → **Send as** → select `[UPN]` → **Delete** → **Confirm**. Then run its own read:

```bash
# HUMAN-RUN read-only read of [mailbox-send-as-remove-portal]: passes only when no Send As entry names [UPN] on [MAILBOX]
node scripts/adapters/exo-client.js verify-recipient-permission --mailbox [MAILBOX] --delegate [UPN] --absent --execute
```

<!-- SAFETY GATE [mailbox-permission-remove-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** remove Full Access while leaving other delegation unchanged
- **Scope:** one user and one mailbox
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by granting Full Access again
- **Required confirmation:** Type exactly `REMOVE FULL ACCESS FOR [UPN] FROM [MAILBOX]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [mailbox-permission-remove-portal]:** Only after the exact match, remove `[UPN]` from **Full Access** on `[MAILBOX]` and re-read the Delegation list.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline
# Audit current permissions (read-only)
Get-MailboxPermission -Identity "[MAILBOX]" | Where-Object {$_.User -notlike "NT AUTHORITY*"}  # Full Access grants
Get-RecipientPermission -Identity "[MAILBOX]"                                                   # Send As grants
# Grant Full Access or Send As: use the portal gates [mailbox-full-access-grant-portal] and
# [mailbox-send-as-grant-portal] above; this block has no grant line.
# ⚠️ Remove access
# SAFETY GATE [mailbox-permission-remove]
# Target: [UPN] on [MAILBOX]
# Effect: removes Full Access while leaving other delegation unchanged
# Scope: one user and one mailbox
# Reversibility: R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible with Add-MailboxPermission
# Read-back: none, R1: no change record
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
