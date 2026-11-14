---
description: Audit Entra/AD group memberships — who's in a group, a user's full group list, nested/dynamic groups, and stale access (offboarding leftovers). Portal first. Placeholders only.
disable-model-invocation: true
---

# /group-membership-audit

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Two directions: **"who can do X?"** (members of `[GROUP]`) and **"what can [UPN] reach?"** (all of a user's groups). Watch for **nested** groups (members inherit access indirectly), **dynamic** groups (rule-based, can't edit members directly), and **stale** access left over from role changes/offboarding.

## What to check first
- Is it a security group (access), M365 group (collab), or DL (mail)? Synced from on-prem AD or cloud-only?
> **PREVIEW ONLY [group-dynamic-rule-reference]:** `Entra → Groups → [GROUP] → Membership type = Dynamic` is a read-only inspection path here. Changing the rule is a separate group-wide access mutation; route it to an action-specific runbook with a policy export, resolved group ID, exact rule digest, approval, and read-back.

## Step-by-step (portal first)

> **PREVIEW ONLY [group-membership-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. **Members of a group:** Entra → Groups → `[GROUP]` → **Members** (and **Owners**). Export the list for the audit.
2. **A user's groups:** Entra → Users → `[UPN]` → **Groups** → full list (direct + via nested where shown). This is the access-review view for offboarding/role change.
3. **Nested groups:** open member groups to see inherited access; map the effective access.
4. **Dynamic groups:** Membership type Dynamic → review/adjust the **membership rule**; you can't add/remove members manually.
5. **Synced groups:** if "On-premises sync" = Yes, edit membership in **ADUC**, not Entra (cloud edits get overwritten at sync).
6. **Remediate stale access:** remove users who no longer need it (confirm with owner/manager).
7. **Who else, and what left** (answer-format section 2; reads only, R0, no gate): when the audit finds a member who should never have been in `[GROUP]`, the removal in step 6 closes the path and the next step is the log. First Entra ID → Monitoring & health → Audit logs for the group: the "Added member to group" entry says who added them and when, and the same search shows who else was added the same way. Then the audit log in the Microsoft Purview portal, for the time the membership stood: what it opened for that person (Accessed file, Downloaded file and the sharing activities on the group's sites; Accessed mailbox items on a mailbox the group reaches). Until those reads are done the audit does not say how serious the finding is. Vendor facts: `docs/aegis/batch11/vendor-facts-microsoft.md` MB-20 to MB-25.

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
- [ ] A member who should never have been there: the logs were read for who added them, who else was added the same way, and what the membership let them open or download, before anyone said how serious it is
- [ ] Synced groups edited on-prem; change visible in Entra after sync

## 📝 Jira-ready note
> Resolved [date/time]. Group audit: [members of `[GROUP]` / `[UPN]`'s group access]. Found [N] candidate stale memberships. Changes: [none; audit only / X removals verified under a separate target-bound workflow authorized by [MANAGER_NAME]]. Noted [dynamic/nested/synced] specifics. Record no removal as complete without per-object read-back. Time spent: [X] min.
