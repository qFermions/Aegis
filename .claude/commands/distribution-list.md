---
description: Create and manage distribution lists / mail-enabled groups in Exchange Online — members, owners, external-sender allow, M365 Group vs DL choice. Portal first. Placeholders only.
---

# /distribution-list

**Verdict:** Choose the right object: a **Distribution list** (email only, simple) vs a **Microsoft 365 Group** (email + shared calendar/files/Teams). For a plain "email everyone in [DEPARTMENT]," a DL is enough.

## What to check first
- EAC → Recipients → **Groups** → does `[DL_NAME]@[@Aegion_DOMAIN]` already exist?
- Does it need to receive **external** email? (Off by default.)

## Step-by-step fix (portal first — EAC: admin.exchange.microsoft.com)
1. **Create:** Recipients → Groups → **Add a group → Distribution list** → name `[DL_NAME]`, alias, owner.
2. **Members:** open the DL → **Members** → add/remove `[UPN]`s.
3. **Owners:** Settings → assign an owner who can manage membership.
4. **Allow external senders:** open DL → Settings → **Allow external senders to email this group** (only if required).
5. **Delivery management / moderation:** restrict who can send to it, or require owner approval.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline                                              # connect to Exchange Online
New-DistributionGroup -Name "[DL_NAME]" -PrimarySmtpAddress "[DL_NAME]@[@Aegion_DOMAIN]"  # create DL
Add-DistributionGroupMember -Identity "[DL_NAME]" -Member "[UPN]"   # add a member
Set-DistributionGroup -Identity "[DL_NAME]" -RequireSenderAuthenticationEnabled $false     # allow external senders
Get-DistributionGroupMember -Identity "[DL_NAME]"                   # verify membership (read-only)
```
</details>

## ⚠️ Risk warning
- Allowing external senders can invite spam/spoofing — only enable when needed; consider moderation.
- Removing the last owner orphans management of the DL — always keep an owner.

## ✅ Verification checklist
- [ ] DL resolves and members receive a test message
- [ ] Owner can manage membership
- [ ] External-sender setting matches the requirement
- [ ] `Get-DistributionGroupMember` shows the expected roster

## 📝 Jira-ready note
> Resolved [date/time]. [Created DL `[DL_NAME]` / updated membership]. Owner: [set]. External senders: [allowed/blocked]. Verified test delivery. Time spent: [X] min.
