---
description: Grant or remove SharePoint Online access — internal users, external guests, library/folder scope, and the "access denied after granting" gotcha. Portal first. Placeholders only.
---

# /sharepoint-access

**Verdict:** Prefer **group-based** access (add the user to the site's M365 group / a SharePoint group) over one-off direct sharing — it's auditable and survives offboarding. External access only works if **external sharing is enabled** at both tenant and site level.

## What to check first
- SharePoint admin center → Active sites → `[SITE_NAME]` → **Sharing** level (and tenant-level Sharing policy). External fails silently if either is "Only people in your org."
- What scope: whole site, a library, or a single folder?

## Step-by-step fix (portal first)

**Internal user:**
1. Go to the site → **Settings (gear) → Site permissions**.
2. Add `[UPN]` to the right SharePoint group: **Visitors** (read), **Members** (edit), **Owners** (full control). Prefer adding to the **M365 group** for the team.

**Library/folder scope (not whole site):** open the library/folder → **⋯ → Manage access / Share** → add `[UPN]` with Can view / Can edit. Use **Stop sharing** to remove.

**External guest:**
1. SharePoint admin → Policies → **Sharing** → ensure external sharing allows guests (tenant + site).
2. Share the site/item → enter `[USER@DOMAIN.COM]` → set permission → they get an email + complete guest sign-in.

**Remove access:** Site permissions → remove from group; or item → Manage access → **Stop sharing** / remove the guest from Entra → External Identities if fully offboarding.

<details>
<summary>PowerShell — for reference only (PnP / SPO module)</summary>

```powershell
Connect-PnPOnline -Url "https://[@Aegion_DOMAIN_SP]/sites/[SITE_NAME]" -Interactive  # connect to the site
# Add internal user to the Members (edit) group
Add-PnPGroupMember -LoginName "[UPN]" -Group "[SITE_NAME] Members"   # grant edit via group
# Grant access to a specific folder (item-level)
Set-PnPListItemPermission -List "Documents" -Identity 1 -User "[UPN]" -AddRole "Edit"  # folder-scoped edit
# Remove a user from the site group
Remove-PnPGroupMember -LoginName "[UPN]" -Group "[SITE_NAME] Members"  # revoke access
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
> Resolved [date/time]. Granted `[UPN]` [view/edit/full] access to `[SITE_NAME]` [site/library/folder] via [SharePoint group / M365 group]. [External: guest invited + accepted.] User confirmed access. Time spent: [X] min.
