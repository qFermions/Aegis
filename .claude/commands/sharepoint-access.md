---
description: Grant or remove SharePoint Online access — internal users, external guests, library/folder scope, and the "access denied after granting" gotcha. Portal first. Placeholders only.
disable-model-invocation: true
---

# /sharepoint-access

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Prefer **group-based** access (add the user to the site's M365 group / a SharePoint group) over one-off direct sharing — it's auditable and survives offboarding. External access only works if **external sharing is enabled** at both tenant and site level.

## What to check first
- SharePoint admin center → Active sites → `[SITE_NAME]` → **Sharing** level (and tenant-level Sharing policy). External fails silently if either is "Only people in your org."
- What scope: whole site, a library, or a single folder?

## Step-by-step fix (portal first)

> **PREVIEW ONLY [sharepoint-grant-portal]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

**Internal user:**
1. Go to the site → **Settings (gear) → Site permissions**.
2. Add `[UPN]` to the right SharePoint group: **Visitors** (read), **Members** (edit), **Owners** (full control). Prefer adding to the **M365 group** for the team.

**Library/folder scope (not whole site):** open the library/folder → **⋯ → Manage access / Share** → add `[UPN]` with Can view / Can edit. Use **Stop sharing** to remove.

**External guest:**
1. SharePoint admin → Policies → **Sharing** → ensure external sharing allows guests (tenant + site).
2. Share the site/item → enter `[USER@DOMAIN.COM]` → set permission → they get an email + complete guest sign-in.

<!-- SAFETY GATE [sharepoint-access-revoke-portal] -->
- **Target:** [UPN] in [SITE_NAME] Members
- **Effect:** remove every site permission inherited from that group
- **Scope:** one user and one SharePoint site group
- **Reversibility:** R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by adding the user back to the same group
- **Required confirmation:** Type exactly `REMOVE [UPN] FROM [SITE_NAME] MEMBERS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [sharepoint-access-revoke-portal]:** Only after the exact match, remove `[UPN]` from `[SITE_NAME] Members`. **Stop sharing** and deleting an Entra guest have different scope and require their own action-specific confirmation.

<details>
<summary>PowerShell — for reference only (PnP / SPO module)</summary>

```powershell
Connect-PnPOnline -Url "https://[@Aegion_DOMAIN_SP]/sites/[SITE_NAME]" -Interactive  # connect to the site
# PREVIEW ONLY [sharepoint-member-grant] — non-executing site permission-grant reference.
# Add-PnPGroupMember -LoginName "[UPN]" -Group "[SITE_NAME] Members"
# PREVIEW ONLY [sharepoint-item-grant] — non-executing item-level permission-grant reference.
# Set-PnPListItemPermission -List "Documents" -Identity 1 -User "[UPN]" -AddRole "Edit"
# Remove a user from the site group
# SAFETY GATE [sharepoint-access-revoke]
# Target: [UPN] in [SITE_NAME] Members
# Effect: removes every site permission inherited from that group
# Scope: one user and one SharePoint site group
# Reversibility: R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible by adding the user back to the same group
$requiredConfirmation = "REMOVE [UPN] FROM [SITE_NAME] MEMBERS"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Remove-PnPGroupMember -LoginName "[UPN]" -Group "[SITE_NAME] Members" -ErrorAction Stop  # revoke access
    $remaining = @(Get-PnPGroupMember -Identity "[SITE_NAME] Members" -ErrorAction Stop | Where-Object { [string]$_.Email -ceq '[UPN]' -or [string]$_.LoginName -ceq '[UPN]' })
    if ($remaining.Count -ne 0) { throw "Removal returned but the user is still present on group read-back." }
} else {
    throw "Confirmation did not match. No change was made."
}
```
</details>

## ⚠️ Risk warning
- Broad "share with Everyone except external" or anonymous links leak data — avoid; use group-based, named access.
- Removing a user from a group also removes access to everything that group grants — confirm scope before removing.

## ✅ Verification checklist
- [ ] User can open `[SITE_NAME]` / the library / folder at the intended permission level
- [ ] External: guest accepted invite and appears in Entra → External Identities
- [ ] "Access denied after granting" → confirm external sharing enabled at tenant **and** site; allow propagation (a few min)
- [ ] Access removed cleanly when revoking

## 📝 Jira-ready note
> Resolved [date/time]. SharePoint action for `[UPN]` on `[SITE_NAME]`: [access removal verified under this command's exact gate / grant verified under a separate reviewed workflow / no change performed]. Scope: [site/library/folder/group]. External guest state: [separately invited and verified / unchanged / not applicable]. Read-back/user confirmation: [verified result]. Time spent: [X] min.
