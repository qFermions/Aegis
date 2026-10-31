---
description: Create and manage distribution lists / mail-enabled groups in Exchange Online — members, owners, external-sender allow, M365 Group vs DL choice. Portal first. Placeholders only.
disable-model-invocation: true
---

# /distribution-list

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Choose the right object: a **Distribution list** (email only, simple) vs a **Microsoft 365 Group** (email + shared calendar/files/Teams). For a plain "email everyone in [DEPARTMENT]," a DL is enough.

## What to check first
- EAC → Recipients → **Groups** → does `[DL_NAME]@[@Aegion_DOMAIN]` already exist?
- Does it need to receive **external** email? (Off by default.)

## Step-by-step fix (portal first — EAC: admin.exchange.microsoft.com)

> **PREVIEW ONLY [distribution-portal]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. **Create:** Recipients → Groups → **Add a group → Distribution list** → name `[DL_NAME]`, alias, owner.
2. **Members:** open the DL → **Members** → add/remove `[UPN]`s.
3. **Owners:** Settings → assign an owner who can manage membership.
<!-- SAFETY GATE [distribution-external-senders-portal] -->
- **Target:** [DL_NAME]
- **Effect:** allow unauthenticated external senders to address the distribution list
- **Scope:** one distribution list; moderation remains as displayed
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, the change of a sending control; it widens who may send to the list and fits no closer row, so the higher class): reversible by requiring authenticated senders again
- **Required confirmation:** Type exactly `ALLOW EXTERNAL SENDERS TO [DL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [distribution-external-senders-portal]:** Only after the exact match, open `[DL_NAME]` → Settings → enable **Allow external senders to email this group**, then verify moderation and delivery restrictions.
> **PREVIEW ONLY [distribution-delivery-management-portal]:** Restricting senders or requiring moderation is a separate mail-flow policy change with different scope. Prepare it in a separate reviewed runbook; the external-sender phrase cannot change moderation or delivery restrictions.
5. **Delivery management / moderation:** document the proposed sender restrictions or owner-approval rule for that separate review.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-ExchangeOnline                                              # connect to Exchange Online
# PREVIEW ONLY [distribution-create] — non-executing reference for creating one reviewed distribution list.
# New-DistributionGroup -Name "[DL_NAME]" -PrimarySmtpAddress "[DL_NAME]@[@Aegion_DOMAIN]"
# PREVIEW ONLY [distribution-member-add] — non-executing reference for adding one reviewed member.
# Add-DistributionGroupMember -Identity "[DL_NAME]" -Member "[UPN]"
# PREVIEW ONLY [distribution-external-senders] — non-executing security-policy reference; use the adjacent portal gate above for this effect.
# Set-DistributionGroup -Identity "[DL_NAME]" -RequireSenderAuthenticationEnabled $false
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
> Resolved [date/time]. Distribution-list state for `[DL_NAME]`: [read-only audit / creation verified under a separate authorized workflow / membership change verified under a separate authorized workflow]. Owner state: [verified value / unchanged]. External-sender state: [verified allowed/blocked / unchanged]. Test delivery: [verified / not performed]. Record only states actually read back. Time spent: [X] min.
