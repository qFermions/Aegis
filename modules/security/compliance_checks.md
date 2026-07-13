# Compliance Checks

Automated and manual checks for M365 tenant security posture. Run these monthly or
after any significant identity or policy change.

---

## Check 1 — MFA Coverage

**What:** Every licensed user must have MFA registered. No exceptions.

### Portal Steps
1. Entra → Identity → Users → All users
2. Filter: `Per user MFA status = Disabled`
   (This finds users who have not set up MFA via legacy per-user enforcement)
3. Also check via Conditional Access report:
   - Entra → Protection → Conditional Access → Insights and reporting
   - Look for sign-ins where `MFA result = Not required`

### PowerShell Verification
<details>
<summary>Get all users without MFA registered</summary>

```powershell
# Connect to Microsoft Graph
Connect-MgGraph -Scopes "UserAuthenticationMethod.Read.All", "User.Read.All"

# Get all licensed users and check their auth methods
$users = Get-MgUser -All -Filter "assignedLicenses/`$count ne 0" `
  -CountVariable licCount -ConsistencyLevel eventual

$noMFA = foreach ($user in $users) {
    $methods = Get-MgUserAuthenticationMethod -UserId $user.Id
    # Exclude password — check if only method is password (no MFA registered)
    $mfaMethods = $methods | Where-Object {
        $_.AdditionalProperties['@odata.type'] -notmatch 'password'
    }
    if (-not $mfaMethods) {
        [PSCustomObject]@{
            DisplayName = $user.DisplayName
            UPN         = $user.UserPrincipalName
            Department  = $user.Department
        }
    }
}

$noMFA | Format-Table -AutoSize
Write-Host "Users without MFA: $($noMFA.Count)"
```
*Outputs a list of licensed users with no MFA method registered.*
</details>

**Pass criteria:** 0 licensed users without MFA registered.

---

## Check 2 — Guest Account Hygiene

**What:** Guest accounts accumulate over time. Review quarterly for stale or unauthorized guests.

### Portal Steps
1. Entra → Identity → Users → All users
2. Filter: `User type = Guest`
3. Review: Last sign-in date, invited by, what groups/apps they belong to
4. Remove guests with no sign-in in 90+ days or unknown invite source

### PowerShell — Export Guest List
<details>
<summary>Export all guests with last sign-in date</summary>

```powershell
Connect-MgGraph -Scopes "User.Read.All", "AuditLog.Read.All"

# Get all guest accounts
$guests = Get-MgUser -All -Filter "userType eq 'Guest'" `
  -Property DisplayName,UserPrincipalName,CreatedDateTime,SignInActivity

$guests | Select-Object DisplayName, UserPrincipalName, CreatedDateTime,
    @{N='LastSignIn'; E={ $_.SignInActivity.LastSignInDateTime }} |
    Export-Csv -Path "guest-audit-$(Get-Date -f yyyyMMdd).csv" -NoTypeInformation

Write-Host "Guest count: $($guests.Count). Exported to CSV."
```
*Exports guest list with last sign-in. Review for stale accounts (no sign-in in 90 days).*
</details>

**Pass criteria:** No guest accounts older than 90 days without a business justification on file.

---

## Check 3 — License Hygiene

**What:** Disabled / offboarded accounts should not hold licenses. Each unused license
wastes budget and represents a potential attack surface (dormant account with active access).

### Portal Steps
1. admin.microsoft.com → Users → Active users
2. Filter: `Sign-in status = Blocked`
3. Check that all blocked users have 0 licenses assigned

### PowerShell
<details>
<summary>Find blocked accounts that still have licenses</summary>

```powershell
Connect-MgGraph -Scopes "User.Read.All"

# Get all accounts where sign-in is blocked AND they have a license
$blockedLicensed = Get-MgUser -All `
  -Filter "accountEnabled eq false" `
  -Property DisplayName,UserPrincipalName,AccountEnabled,AssignedLicenses |
  Where-Object { $_.AssignedLicenses.Count -gt 0 }

$blockedLicensed | Select-Object DisplayName, UserPrincipalName,
    @{N='LicenseCount'; E={ $_.AssignedLicenses.Count }} |
    Format-Table -AutoSize

Write-Host "Blocked accounts with licenses: $($blockedLicensed.Count)"
```
*Finds disabled accounts that are still consuming licenses.*
</details>

**Pass criteria:** 0 blocked accounts with active license assignments.

---

## Check 4 — Admin Role Review

**What:** Minimize standing admin privileges. Only required accounts should hold elevated roles.

### Portal Steps
1. Entra → Identity → Roles & admins → All roles
2. Review: Global Administrator, Privileged Role Administrator, Exchange Administrator,
   Intune Administrator, Security Administrator
3. For each: verify each member has a documented business reason
4. Remove any service/shared accounts or former employee accounts

### PowerShell — Export All Role Assignments
<details>
<summary>Export privileged role assignments</summary>

```powershell
Connect-MgGraph -Scopes "RoleManagement.Read.Directory", "User.Read.All"

# Get all role assignments (active, not eligible PIM)
$roles = Get-MgRoleManagementDirectoryRoleAssignment -All `
  -ExpandProperty "principal,roleDefinition"

$roles | Select-Object `
    @{N='Role';     E={ $_.RoleDefinition.DisplayName }},
    @{N='Member';   E={ $_.Principal.AdditionalProperties['displayName'] }},
    @{N='UPN';      E={ $_.Principal.AdditionalProperties['userPrincipalName'] }},
    @{N='Type';     E={ $_.Principal.AdditionalProperties['@odata.type'] }} |
    Sort-Object Role | Format-Table -AutoSize
```
*Lists every active admin role assignment across the tenant.*
</details>

**Pass criteria:**
- Global Administrator: 2–4 accounts maximum (break-glass + named admins)
- No service accounts in Privileged Role Admin or Security Admin
- All role members have a current business justification

---

## Check 5 — Conditional Access Coverage

**What:** Verify that CA policies cover the critical use cases: MFA required for all users,
block legacy auth, require compliant device for sensitive apps.

### Portal — Policy Review
1. Entra → Protection → Conditional Access → Policies
2. Verify these policies exist and are **On** (not Report-only):

| Policy | State | Covers |
|--------|-------|--------|
| Require MFA for all users | On | All users, all cloud apps, any location |
| Block legacy authentication | On | All users — blocks Basic Auth clients |
| Require compliant device (admin portals) | On/Report-only | Admin portal URLs |
| Block sign-in from high-risk countries | On | Specific location exclusions |

3. Check for policy gaps: Entra → CA → Insights and reporting → Coverage tab

**Pass criteria:**
- No user can sign in to any M365 app without MFA (excluding named trusted locations if justified)
- Legacy auth is blocked for all users
- No policies set to "Off" that should be active

---

## Check 6 — External Sharing Limits

**What:** SharePoint and OneDrive external sharing should be scoped to business need.

### Portal Steps
1. admin.microsoft.com → SharePoint → Policies → Sharing
2. Verify:
   - External sharing for SharePoint: `New and existing guests` or more restrictive
   - OneDrive sharing: same or more restrictive than SharePoint
   - `Require guests to sign in with same account` = enabled
3. Review active external shares:
   - SharePoint admin → Reports → Sharing

**Pass criteria:**
- No tenant-level sharing set to `Anyone (no sign-in required)` unless explicitly approved

---

## Monthly Compliance Run Checklist

```
[ ] MFA coverage — 0 licensed users without MFA
[ ] Guest accounts — stale guests (90+ days) reviewed and removed
[ ] License hygiene — 0 blocked accounts with active licenses
[ ] Admin roles — all privileged members reviewed and documented
[ ] Conditional Access — all critical policies On (not Report-only)
[ ] External sharing — no anonymous sharing enabled without approval
[ ] Secure Score — reviewed in security.microsoft.com → Secure Score
[ ] Risky users — Entra → Identity Protection → Risky users → 0 unreviewed High-risk users
```

Run date: ________ | Completed by: [ADMIN_NAME] | Ticket: [JIRA-###]
