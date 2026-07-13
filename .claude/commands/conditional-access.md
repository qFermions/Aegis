---
description: Conditional Access plain-English explainer and step-by-step guide — view policies, create new policies, Report-only testing, What-If tool, break-glass accounts. Portal first. Placeholders only.
---

# /conditional-access

**Verdict:** Conditional Access (CA) is Entra ID's if-this-then-that engine for sign-ins — if a user matches certain conditions (who, where, what device, what app), apply a control (require MFA, block, require compliant device). A misconfigured CA policy can lock out every user in the org including admins. Always test with Report-only first, and always confirm a break-glass account is excluded before enabling any policy.

> ⚠️ **LOCKOUT GATE — read before touching any CA policy:**
> A policy set to "On" that is scoped too broadly (e.g., "All users" with no exclusions) can prevent every person including Global Admins from signing in. Before setting ANY policy to "On":
> 1. Confirm your break-glass account exists and is excluded (see below).
> 2. Run Report-only for at least 24–48 hours and review the sign-in logs.
> 3. Route org-wide CA changes through Nova for a second opinion before enabling.
> 4. Have a second admin available to revert if needed.

## What to check first
- **Is there a sign-in failure you're troubleshooting?** Check `Entra → Monitoring → Sign-in logs → [UPN]` first — the failure reason will say which CA policy blocked it.
- **Are you creating a new policy or modifying an existing one?** Existing = check current scope and exclusions before touching it.
- **Is a break-glass account confirmed?** Never make an org-wide CA change without one. See break-glass section below.
- **What license tier?** CA requires Entra ID P1 (included in M365 Business Premium). Named Locations and compliant device conditions require P1. Continuous Access Evaluation requires P2.

## Conditional Access concepts (plain English)

**What CA does:** Every time a user signs in to any M365 app, Entra evaluates all enabled CA policies in order. If the user/device/location matches a policy's conditions, the policy's grant or block control fires.

| Component | What it means |
|-----------|--------------|
| **Assignments → Users** | Who the policy applies to (all users, a group, or specific users) |
| **Assignments → Target resources** | Which apps (All cloud apps, Exchange, SharePoint, specific SaaS) |
| **Conditions** | Filters that narrow when the policy fires (location, device platform, sign-in risk, client app type) |
| **Grant controls** | What happens if conditions match: Require MFA, Require compliant device, Block access, Require approved app |
| **Session controls** | Ongoing session restrictions: sign-in frequency (re-auth every N hours), app-enforced restrictions, persistent browser session |

**Policy evaluation:** Entra evaluates ALL enabled policies. If any policy says Block, the user is blocked — even if another policy grants access. Report-only policies log what WOULD happen without affecting actual sign-ins.

## View existing policies
`Entra portal (entra.microsoft.com) → Protection → Conditional Access → Policies`

You'll see all policies with their state: On / Off / Report-only.

To understand what a policy covers: click it → read Assignments (users, apps, conditions) and Grant controls side by side.

To see what fired for a specific sign-in:
`Entra → Monitoring → Sign-in logs → [UPN] → click the sign-in event → Conditional Access tab`
Each policy shows: Applied / Not applied / Report-only, and the grant result.

## Common policies — what they do and how to create them

### Policy 1 — Block legacy authentication
**Why:** Legacy auth protocols (SMTP AUTH, POP3, IMAP, MAPI over HTTP, ActiveSync) don't support MFA. Attackers use them to bypass MFA entirely. This is the highest-value CA policy to enable first.

`Entra → Protection → Conditional Access → Policies → + New policy`
- Name: `Block legacy authentication`
- Users: **All users** | Exclude: break-glass account + any service accounts that need legacy auth (document them)
- Target resources: **All cloud apps**
- Conditions → Client apps: check **Exchange ActiveSync clients** and **Other clients** (uncheck Modern authentication clients)
- Grant: **Block access**
- Enable policy: **Report-only first → enable after 48h review**

---

### Policy 2 — Require MFA for all users
**Why:** Every sign-in from any device/location requires MFA. Stops credential-stuffing attacks cold.

`Entra → Protection → Conditional Access → + New policy`
- Name: `Require MFA — all users`
- Users: **All users** | Exclude: break-glass account
- Target resources: **All cloud apps**
- Conditions: none (catch all)
- Grant: **Require multi-factor authentication**
- Enable policy: **Report-only first → enable after 48h review**

---

### Policy 3 — Require MFA for admins (separate policy, higher priority awareness)
**Why:** Admin accounts are the highest-value targets. Require MFA even if the main MFA policy has broad exclusions.

- Users: **Directory roles** → select Global Admin, Exchange Admin, SharePoint Admin, User Admin, Security Admin (all privileged roles)
- Target resources: **All cloud apps**
- Grant: **Require multi-factor authentication**
- This should be enabled BEFORE the org-wide MFA policy — admins first.

---

### Policy 4 — Require compliant device
**Why:** Ensures users can only access M365 from Intune-enrolled and compliant devices.

- Users: **All users** (or a pilot group first) | Exclude: break-glass
- Target resources: **All cloud apps** (or scope to specific high-risk apps first)
- Grant: **Require device to be marked as compliant** | Check "Require one of the selected controls" if combining with MFA
- ⚠️ Do NOT enable this org-wide until Intune compliance policies are configured and all devices are enrolled. Run Report-only for a week and check the sign-in log impact first.

---

### Policy 5 — Block sign-ins from outside allowed countries
**Why:** If your org only operates in specific countries, block sign-ins from everywhere else. Reduces attack surface significantly.

Step 1 — Create a Named Location:
`Entra → Protection → Conditional Access → Named locations → + Countries location`
- Name: `Allowed countries — [@Aegion]`
- Select countries your staff legitimately sign in from
- Save

Step 2 — Create the CA policy:
- Users: **All users** | Exclude: break-glass
- Target resources: **All cloud apps**
- Conditions → Locations: **Include: Any location** | **Exclude: [your named location]**
- Grant: **Block access**
- Enable: Report-only first, then On after reviewing travel/VPN sign-ins

---

## Create a new policy — step by step

`Entra portal (entra.microsoft.com) → Protection → Conditional Access → Policies → + New policy`

1. **Name:** use a descriptive name (`Require MFA — all users`, `Block legacy auth`, etc.) — this is what shows in sign-in logs
2. **Users and groups:** select users/groups in scope → add exclusions (break-glass, service accounts)
3. **Target resources:** select apps (All cloud apps is safest default; narrow to specific apps only if intentional)
4. **Conditions:** set only what you need — leave unused conditions unconfigured
5. **Grant:** choose your control (Require MFA / Require compliant device / Block)
6. **Session:** configure if needed (sign-in frequency, persistent browser)
7. **Enable policy:** set to **Report-only**
8. Click **Create**
9. Wait 24–48 hours → review sign-in logs for the policy impact
10. If impact looks correct → return to the policy → change state to **On** → Save

---

## Test with Report-only and What-If

**Report-only mode:** The policy evaluates every sign-in and logs what it WOULD have done — but takes no action. Zero user impact. This is mandatory before setting any policy to On.

`Entra → Monitoring → Sign-in logs → filter by date → click a sign-in → Conditional Access tab`
- Look for your policy in Report-only state
- Check "Would have granted" or "Would have blocked" for representative sign-ins
- Look for unexpected blocks (e.g., service accounts, external partners, break-glass)

**What-If tool:** Simulates policy evaluation for a specific user/app/location without waiting for a real sign-in.

`Entra → Protection → Conditional Access → What If`
- User: `[UPN]`
- Application: select the app
- IP address / Country: test a location
- Click **What If** → see which policies fire and what they would do

Use What-If to test edge cases before enabling a policy.

---

## Break-glass (emergency access) accounts

A break-glass account is a cloud-only Global Admin that is **excluded from ALL CA policies**. It exists so you can sign in and fix a misconfigured CA policy even if every other admin is locked out.

**Requirements:**
- Cloud-only account (not synced from on-prem AD)
- Not assigned to a real person — it's an org-owned emergency credential
- Excluded from ALL CA policies by user exclusion (not group exclusion — group membership can change)
- Password stored offline (physical secure location) and rotated periodically
- MFA: use a FIDO2 key or a dedicated authenticator device (not the same phone as the admin's personal account)
- Monitored: set an alert when it signs in — `Entra → Monitoring → Diagnostic settings → send sign-in logs to Log Analytics` + alert rule on break-glass UPN

**To verify your break-glass is correctly excluded:**
`Entra → Protection → Conditional Access → Policies → click each enabled policy → Assignments → Users → Exclude`
Confirm the break-glass UPN (not just a group) appears in every policy's exclusion list.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Install the Microsoft Graph module if not already present
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect with Conditional Access read permissions
Connect-MgGraph -Scopes "Policy.Read.All", "Policy.ReadWrite.ConditionalAccess"   # sign in as CA admin

# List all CA policies and their enabled state
Get-MgIdentityConditionalAccessPolicy |
    Select-Object DisplayName, State, Id   # State: enabled / disabled / enabledForReportingButNotEnforced (report-only)

# Get full details on a specific policy (replace [POLICY_ID] from above)
Get-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId "[POLICY_ID]" |
    ConvertTo-Json -Depth 10   # full JSON output showing all conditions, grants, and exclusions

# Check sign-in logs for CA policy impact on a specific user
Connect-MgGraph -Scopes "AuditLog.Read.All"   # reconnect with audit log permission
Get-MgAuditLogSignIn -Filter "userPrincipalName eq '[UPN]'" -Top 20 |   # last 20 sign-ins for this user
    Select-Object CreatedDateTime, AppDisplayName, ConditionalAccessStatus, Status   # show CA result per sign-in

# List all named locations
Get-MgIdentityConditionalAccessNamedLocation |
    Select-Object DisplayName, Id, OdataType   # confirm your allowed-countries location exists
```
</details>

## ⚠️ Risk warning
- **A misconfigured CA policy set to "On" can lock out every user in the org** — including all Global Admins — immediately. There is no grace period and no auto-rollback. This is why Report-only + break-glass + plan review are non-negotiable.
- **Never set a new policy directly to "On."** Report-only mode exists precisely to prevent lockouts.
- **Break-glass accounts must be excluded by UPN, not by group.** If you exclude a group and the break-glass account is removed from that group, you lose emergency access.
- **"Block legacy auth" will break any device or app still using SMTP AUTH, POP3, IMAP, or basic auth.** Run Report-only for 48 hours and check the logs for service accounts, MFPs, line-of-business apps, and any shared mailbox scripts before enabling.
- **Requiring compliant device before Intune is fully rolled out** will lock out non-enrolled devices immediately. Pilot with a small group first.
- **Any org-wide CA change should be routed through Nova for plan review before setting to On.**

## ✅ Verification checklist
- [ ] Break-glass account exists, is cloud-only, and is explicitly excluded from ALL CA policies by UPN
- [ ] New policy started in Report-only mode
- [ ] Sign-in logs reviewed after 24–48 hours — no unexpected blocks (service accounts, external partners, break-glass)
- [ ] What-If tool tested with representative user + app + location combinations
- [ ] Policy enabled (set to On) and confirmed active in sign-in logs
- [ ] No admin lockout after enabling — at least two admins can still sign in
- [ ] Break-glass sign-in alert confirmed active in Entra Monitoring

## 📝 Jira-ready note
> Resolved [date/time]. [Created / Modified] Conditional Access policy "[POLICY_NAME]" in Entra. Policy scope: [users/groups] → [apps] → [conditions] → [grant control]. Tested in Report-only for [X] hours with no unexpected blocks confirmed in sign-in logs. Break-glass account [UPN] excluded and verified. Policy enabled and confirmed active. Time spent: [X] min.
