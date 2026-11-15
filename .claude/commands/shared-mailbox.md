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
- **Least privilege** (answer-format section 2, rule b): the lowest right that does the job, Send on Behalf before Send As, and Full Access only for someone who must read the mailbox. The mailbox's owner (the team lead it belongs to) approves, named in the ticket. For a whole team, a mail-enabled security group is the better holder of Full Access, though the mailbox then does not auto-map in Outlook (`docs/aegis/batch12/vendor-facts-runbook-rules.md` RR-01); the gates below grant to one person, so a group grant is its own reviewed change. Temporary access gets an end date in the ticket and is removed on that date under `/mailbox-permissions` (RR-02).

## Step-by-step fix (portal first — EAC: admin.exchange.microsoft.com)

> **PREVIEW ONLY [shared-mailbox-create-grant]:** Creating a shared mailbox is not authorized by this reference. Move it to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation. Granting access to an existing shared mailbox has its own gates below.

**Create:** EAC → Recipients → **Mailboxes → Add a shared mailbox** → name + alias `[MAILBOX]@[@Aegion_DOMAIN]`.

**Grant access:** first read the shared mailbox's **Mailbox Delegation** lists (EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation**) and copy them into the ticket: that is the pre-state. Then grant only what the person needs, with the gate for it: Full Access to read the mailbox, Send As to send as it. Send on Behalf is not available in the EAC for a shared mailbox, and removing a grant is in `/mailbox-permissions`.

Source for the Mailbox Delegation path and its Edit, Add members, Save and Confirm buttons: Microsoft Learn, "Manage permissions for recipients in Exchange Online", https://learn.microsoft.com/exchange/recipients-in-exchange-online/manage-permissions-for-recipients (opened 2026-11-06; `docs/aegis/batch9/vendor-facts.md` X-30, X-31).

**Change record (R2 gates):** before a gate whose reversibility is R2 and that has a read-back named for it below, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and its read-back below as `--read-back`: `exo:verify-mailbox-permission` for [shared-mailbox-full-access-portal], `exo:verify-recipient-permission` for [shared-mailbox-send-as-portal]), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved. A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names.

<!-- SAFETY GATE [shared-mailbox-full-access-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** grant Full Access (read and manage) on one shared mailbox to one delegate; auto-mapping opens it in the delegate's Outlook
- **Scope:** one delegate and one shared mailbox; Send As is unchanged
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: it opens a whole mailbox to another person, and what they read while it was open cannot be taken back): undone by removing the grant with `/mailbox-permissions` [mailbox-permission-remove-portal]
- **Required confirmation:** Type exactly `GRANT FULL ACCESS TO [MAILBOX] FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `exo-client.js verify-mailbox-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute`
**PORTAL ACTION [shared-mailbox-full-access-portal]:** Only after the exact match: EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation** → **Read and manage (Full Access)** → **Edit** → **Add members** → `[UPN]` → **Save** → **Confirm**.

```bash
# HUMAN-RUN read-only read-back of [shared-mailbox-full-access-portal]: passes only when [UPN] holds Full Access on [MAILBOX]
node scripts/adapters/exo-client.js verify-mailbox-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute
```

<!-- SAFETY GATE [shared-mailbox-send-as-portal] -->
- **Target:** [UPN] on [MAILBOX]
- **Effect:** grant Send As on one shared mailbox to one delegate, so mail they send from it shows only the mailbox as the sender
- **Scope:** one delegate and one shared mailbox; Full Access is unchanged
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: mail sent as the mailbox while the grant stood cannot be recalled): undone by removing the grant with `/mailbox-permissions` [mailbox-send-as-remove-portal]
- **Required confirmation:** Type exactly `GRANT SEND AS ON [MAILBOX] TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `exo-client.js verify-recipient-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute`
**PORTAL ACTION [shared-mailbox-send-as-portal]:** Only after the exact match: EAC → Recipients → Mailboxes → `[MAILBOX]` → **Mailbox Delegation** → **Send as** → **Edit** → **Add members** → `[UPN]` → **Save** → **Confirm**.

```bash
# HUMAN-RUN read-only read-back of [shared-mailbox-send-as-portal]: passes only when [UPN] holds Send As on [MAILBOX]
node scripts/adapters/exo-client.js verify-recipient-permission --mailbox [MAILBOX] --delegate [UPN] --change [CHANGE_ID] --execute
```

<!-- SAFETY GATE [shared-mailbox-convert-portal] -->
- **Target:** [UPN]
- **Effect:** convert the user mailbox to Shared without removing its license
- **Scope:** one mailbox verified below 50 GB with archive requirements reviewed
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by converting the mailbox back to User
- **Required confirmation:** Type exactly `CONVERT MAILBOX [UPN] TO SHARED`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [shared-mailbox-convert-portal]:** Only after the exact match, EAC → Mailboxes → `[UPN]` → **Others → Convert to shared mailbox**. License removal is a separate destructive action and is not authorized by this phrase.

**Who else, and what left (answer-format section 2; a read, R0, no gate):** when a ticket says someone had the shared mailbox who should not have, the grant is removed under `/mailbox-permissions`, and the next step is its audit-log read: who else was given the mailbox by the same hand, and what that person opened or sent as the mailbox while the grant stood. For a shared mailbox the address goes in the Keywords field of the search. Until that read is done the answer does not say how serious it is.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline                                            # connect to Exchange Online
# PREVIEW ONLY [shared-mailbox-create] — non-executing mailbox-creation reference.
# New-Mailbox -Shared -Name "[MAILBOX]" -PrimarySmtpAddress "[MAILBOX]@[@Aegion_DOMAIN]"
# Grant Full Access or Send As: use the portal gates [shared-mailbox-full-access-portal] and
# [shared-mailbox-send-as-portal] above; this block has no grant line.
# PREVIEW ONLY [shared-mailbox-send-on-behalf] — non-executing Send on Behalf grant reference.
# Set-Mailbox -Identity "[MAILBOX]" -GrantSendOnBehalfTo @{Add="[UPN]"}
# PREVIEW ONLY [shared-mailbox-convert] — non-executing conversion reference; use the adjacent portal conversion gate.
# Set-Mailbox -Identity "[UPN]" -Type Shared
```
</details>

## ⚠️ Risk warning
- Shared mailbox >50 GB or with In-Place Archive **needs a license** — don't strip the license if it's large/archived.
- Auto-mapping change can take time to appear in Outlook; a full re-add to profile may be needed.
- Licence rules for a shared mailbox, as Microsoft states them (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-50, MB-51): no licence while it is under 50 GB; an Exchange Online Plan 2 licence when it holds more than 50 GB, uses in-place archiving or is on litigation hold. The account behind it stays: deleting it takes the mailbox with it (MB-52).
- A converted mailbox still opens with the person's old sign-in until that password is reset or sign-in is blocked (MB-53). For a leaver, `/offboard` contains the identity before it converts, and says where the mail goes and for how long.

## ✅ Verification checklist
- [ ] Mailbox shows under Recipients → Shared
- [ ] Delegate sees it in Outlook (auto-mapped) and can read
- [ ] Test Send As / Send on Behalf produces the expected From line
- [ ] Lowest right granted, the mailbox owner's approval named, and any end date in the ticket (rule b)
- [ ] (Converted) license removed only after confirming <50 GB

## 📝 Jira-ready note
> Resolved [date/time]. Shared-mailbox state: [conversion of `[UPN]` verified under this command's exact gate / creation of `[MAILBOX]` verified under a separate workflow / unchanged]. Delegation for `[UPN]`: [Full Access/Send As verified under separate actions / unchanged / not requested]. Auto-mapping and delegate access: [verified / not verified]. Time spent: [X] min.
