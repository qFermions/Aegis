---
description: Audit Microsoft 365 license assignment and reclaim waste — who has what, unused/idle licenses, group-based licensing conflicts. Portal first. Placeholders only.
disable-model-invocation: true
---

# /license-audit

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Two wins: **reclaim** licenses on disabled/idle accounts, and **fix** group-based licensing conflicts (the usual cause of "license not applying"). Check before buying more seats.

## What to check first
- M365 admin → **Billing → Licenses**: assigned vs available per SKU (Business Premium).
- Entra → Sign-in logs / Reports → identify accounts inactive 30–90 days.

## Step-by-step fix (portal first)
1. **Inventory:** M365 admin → Billing → Licenses → see counts per product.
> **PREVIEW ONLY [license-column-view]:** Adding a portal display column changes only the operator's view and is not a license assignment/removal authorization.
2. **Per-user:** Users → Active users → add the **Licenses** column, or open `[UPN]` → Licenses and apps.
3. **Reclaim candidates:**
   - **Disabled/blocked** users still licensed → review as candidates (often shared-mailbox conversions left licensed — see `/shared-mailbox`).
   - **Idle** users (no sign-in 90d) → confirm with manager before removing.
<!-- SAFETY GATE [license-remove-portal] -->
- **Target:** [UPN] and [SKU]
- **Effect:** remove the license and start the service-data retention countdown
- **Scope:** one verified user and one license SKU
- **Reversibility:** license assignment is reversible before service-data retention expires
- **Required confirmation:** Type exactly `REMOVE LICENSE [SKU] FROM [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [license-remove-portal]:** Only after the mailbox/data retention check, manager authorization, and exact match, remove `[SKU]` from `[UPN]`. Repeat the full gate separately for every additional user or SKU.
> **PREVIEW ONLY [license-group-remediation-portal]:** Fixing group-based licensing changes a different target and potentially every member. Inspect errors read-only, then prepare a separately reviewed group action; the single-user license-removal phrase cannot change the group.
4. **Group-based licensing conflicts:** Entra → Groups → `[GROUP]` → **Licenses** → inspect errors ("conflicting service plans" / "not enough licenses") and record the proposed group-level remediation.
> **PREVIEW ONLY [license-audit-documentation-portal]:** Writing reclaimed-seat or savings results to Jira is a separate external write. Route the verified note through `/jira-update`; this command does not post it.
5. **Documentation:** prepare the verified reclaimed-seat and savings summary for that separate Jira action.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "User.Read.All","Organization.Read.All"     # read users + license SKUs
Get-MgSubscribedSku | Select SkuPartNumber,ConsumedUnits,@{n='Enabled';e={$_.PrepaidUnits.Enabled}}  # seats used/total
# Users who are blocked from sign-in but still hold a license (reclaim candidates)
Get-MgUser -All -Property DisplayName,UserPrincipalName,AccountEnabled,AssignedLicenses |
  Where-Object { -not $_.AccountEnabled -and $_.AssignedLicenses.Count -gt 0 } |
  Select UserPrincipalName                                           # ⚠️ review before removing any license
```
</details>

## ⚠️ Risk warning
- Removing a license **deletes that user's service data after the grace period** (e.g., mailbox after 30 days). Confirm before removing — this hits the destructive-action gate. For mailboxes you want to keep, convert to shared first (`/shared-mailbox`).
- Mass license changes (>10 users) require explicit confirmation; route through independent plan review.

## ✅ Verification checklist
- [ ] Per-SKU assigned vs available counts captured
- [ ] Reclaim candidates confirmed (disabled / idle, manager OK)
- [ ] Group-based licensing errors resolved (no conflict flags)
- [ ] Seats reclaimed; savings documented

## 📝 Jira-ready note
> Resolved [date/time]. License audit: [N] seats assigned of [M] ([SKU]). Direct reclamation: [X verified removals under per-user/SKU gates / none]. Group-based conflicts: [verified under a separate group workflow / identified only / none]. Estimated saving from verified removals: [$]. Time spent: [X] min.
