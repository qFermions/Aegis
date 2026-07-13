---
description: Audit Microsoft 365 license assignment and reclaim waste — who has what, unused/idle licenses, group-based licensing conflicts. Portal first. Placeholders only.
---

# /license-audit

**Verdict:** Two wins: **reclaim** licenses on disabled/idle accounts, and **fix** group-based licensing conflicts (the usual cause of "license not applying"). Check before buying more seats.

## What to check first
- M365 admin → **Billing → Licenses**: assigned vs available per SKU (Business Premium).
- Entra → Sign-in logs / Reports → identify accounts inactive 30–90 days.

## Step-by-step fix (portal first)
1. **Inventory:** M365 admin → Billing → Licenses → see counts per product.
2. **Per-user:** Users → Active users → add the **Licenses** column, or open `[UPN]` → Licenses and apps.
3. **Reclaim candidates:**
   - **Disabled/blocked** users still licensed → remove (often shared-mailbox conversions left licensed — see `/shared-mailbox`).
   - **Idle** users (no sign-in 90d) → confirm with manager before removing.
4. **Group-based licensing conflicts:** Entra → Groups → `[GROUP]` → **Licenses** → check for errors ("conflicting service plans" / "not enough licenses"). Fix the group, not the user.
5. **Document** reclaimed seats and savings.

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
- Mass license changes (>10 users) require explicit confirmation; route through Nova.

## ✅ Verification checklist
- [ ] Per-SKU assigned vs available counts captured
- [ ] Reclaim candidates confirmed (disabled / idle, manager OK)
- [ ] Group-based licensing errors resolved (no conflict flags)
- [ ] Seats reclaimed; savings documented

## 📝 Jira-ready note
> Resolved [date/time]. License audit: [N] seats assigned of [M] ([SKU]). Reclaimed [X] from disabled/idle accounts (confirmed). Fixed [Y] group-based licensing conflicts. Est. monthly saving: [$]. Time spent: [X] min.
