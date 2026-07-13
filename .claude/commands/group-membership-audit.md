---
description: Audit Entra/AD group memberships — who's in a group, a user's full group list, nested/dynamic groups, and stale access (offboarding leftovers). Portal first. Placeholders only.
---

# /group-membership-audit

**Verdict:** Two directions: **"who can do X?"** (members of `[GROUP]`) and **"what can [UPN] reach?"** (all of a user's groups). Watch for **nested** groups (members inherit access indirectly), **dynamic** groups (rule-based, can't edit members directly), and **stale** access left over from role changes/offboarding.

## What to check first
- Is it a security group (access), M365 group (collab), or DL (mail)? Synced from on-prem AD or cloud-only?
- Dynamic membership? (Entra → Groups → `[GROUP]` → Membership type = Dynamic → fix the **rule**, not members.)

## Step-by-step (portal first)
1. **Members of a group:** Entra → Groups → `[GROUP]` → **Members** (and **Owners**). Export the list for the audit.
2. **A user's groups:** Entra → Users → `[UPN]` → **Groups** → full list (direct + via nested where shown). This is the access-review view for offboarding/role change.
3. **Nested groups:** open member groups to see inherited access; map the effective access.
4. **Dynamic groups:** Membership type Dynamic → review/adjust the **membership rule**; you can't add/remove members manually.
5. **Synced groups:** if "On-premises sync" = Yes, edit membership in **ADUC**, not Entra (cloud edits get overwritten at sync).
6. **Remediate stale access:** remove users who no longer need it (confirm with owner/manager).

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "Group.Read.All","User.Read.All","GroupMember.Read.All"  # read groups + members
# Members of a group
$g = Get-MgGroup -Filter "displayName eq '[GROUP]'"; Get-MgGroupMember -GroupId $g.Id -All | Select AdditionalProperties  # roster
# All groups a user belongs to (direct + transitive/nested)
Get-MgUserTransitiveMemberOf -UserId "[UPN]" | Select AdditionalProperties   # effective group access
```
</details>

## ⚠️ Risk warning
- Removing someone from a security group **revokes everything that group grants** — confirm scope with the owner before removing (could cut access to apps/files/SharePoint).
- For **synced** groups, change membership on-prem (ADUC) — cloud changes are overwritten at the next Entra Connect sync.
- Dynamic group "wrong members" = fix the rule; manual edits won't stick.

## ✅ Verification checklist
- [ ] Member list / user's group list exported for the record
- [ ] Nested + dynamic memberships accounted for (effective access mapped)
- [ ] Stale access removed (owner/manager confirmed)
- [ ] Synced groups edited on-prem; change visible in Entra after sync

## 📝 Jira-ready note
> Resolved [date/time]. Group audit: [members of `[GROUP]` / `[UPN]`'s group access]. Found [N] stale memberships; removed [X] (confirmed with [MANAGER_NAME]). Noted [dynamic/nested/synced] specifics. Time spent: [X] min.
