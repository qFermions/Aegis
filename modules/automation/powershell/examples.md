# PowerShell Examples — M365, Intune, Active Directory

Reusable scripts for common IT operations tasks. Every script:
- Explains each line in plain English comments
- Uses `$DryRun` flag for bulk operations
- Uses placeholder variables — replace before running
- Includes a verification step at the end

---

## EX-01 — Get All Users Without MFA

```powershell
# Connect to Microsoft Graph with the required permissions
Connect-MgGraph -Scopes "UserAuthenticationMethod.Read.All", "User.Read.All"

# Get all users who have at least one license assigned
$users = Get-MgUser -All `
  -Filter "assignedLicenses/`$count ne 0" `
  -CountVariable licCount `
  -ConsistencyLevel eventual `
  -Property DisplayName, UserPrincipalName, Department, Id

$results = foreach ($user in $users) {
    # Get all authentication methods registered for this user
    $methods = Get-MgUserAuthenticationMethod -UserId $user.Id

    # Filter out password — we only care about MFA methods
    $mfaMethods = $methods | Where-Object {
        $_.AdditionalProperties['@odata.type'] -notmatch 'password'
    }

    # If no MFA methods found, add to results
    if (-not $mfaMethods) {
        [PSCustomObject]@{
            DisplayName = $user.DisplayName
            UPN         = $user.UserPrincipalName
            Department  = $user.Department
        }
    }
}

# Display results
$results | Format-Table -AutoSize
Write-Host "Total users without MFA: $($results.Count)"

# Export to CSV for review
$results | Export-Csv -Path "no-mfa-users-$(Get-Date -f yyyyMMdd).csv" -NoTypeInformation
Write-Host "Exported to no-mfa-users-[date].csv"
```

---

## EX-02 — Bulk License Assignment

```powershell
# ⚠️ Bulk operation — review $DryRun flag before running
$DryRun = $true  # Set to $false only after reviewing WhatIf output

Connect-MgGraph -Scopes "User.ReadWrite.All", "Directory.ReadWrite.All"

# Replace with the SKU ID for your license
# To find SKU IDs: Get-MgSubscribedSku | Select-Object SkuPartNumber, SkuId
$licenseSkuId = "[LICENSE_SKU_ID]"  # e.g., M365 Business Premium SKU ID

# List of UPNs to assign licenses to
$targetUsers = @(
    "[user1@YOUR_DOMAIN]",
    "[user2@YOUR_DOMAIN]"
    # Add more UPNs here
)

# Build the license assignment object
$licenseAssignment = @{
    addLicenses    = @(@{ skuId = $licenseSkuId })
    removeLicenses = @()
}

foreach ($upn in $targetUsers) {
    if ($DryRun) {
        # Dry run: show what would happen without making changes
        Write-Host "[DRY RUN] Would assign license $licenseSkuId to: $upn"
    } else {
        # Live run: actually assign the license
        Set-MgUserLicense -UserId $upn -BodyParameter $licenseAssignment
        Write-Host "Assigned license to: $upn"
    }
}

# Verification step (runs in both modes)
Write-Host "`nVerification:"
foreach ($upn in $targetUsers) {
    $user = Get-MgUser -UserId $upn -Property AssignedLicenses
    $hasLicense = $user.AssignedLicenses | Where-Object { $_.SkuId -eq $licenseSkuId }
    $status = if ($hasLicense) { "✓ Licensed" } else { "✗ No license" }
    Write-Host "  $upn — $status"
}
```

---

## EX-03 — Export All Group Members

```powershell
# Get all members of a specific security group
Connect-MgGraph -Scopes "Group.Read.All", "User.Read.All"

$groupName = "[GROUP_DISPLAY_NAME]"  # Replace with the group name

# Find the group by display name
$group = Get-MgGroup -Filter "displayName eq '$groupName'" -ConsistencyLevel eventual

if (-not $group) {
    Write-Host "Group not found: $groupName"
    exit
}

# Get all members of the group
$members = Get-MgGroupMember -GroupId $group.Id -All

# Get display details for each member
$output = foreach ($member in $members) {
    $user = Get-MgUser -UserId $member.Id -Property DisplayName, UserPrincipalName, Department
    [PSCustomObject]@{
        DisplayName = $user.DisplayName
        UPN         = $user.UserPrincipalName
        Department  = $user.Department
    }
}

$output | Sort-Object Department, DisplayName | Format-Table -AutoSize
Write-Host "Total members in '$groupName': $($output.Count)"

# Export
$output | Export-Csv -Path "group-members-$(Get-Date -f yyyyMMdd).csv" -NoTypeInformation
```

---

## EX-04 — Revoke All Sessions for a User (Incident Response)

```powershell
# ⚠️ Destructive — revokes all active sessions immediately
# User will be signed out of all apps, browsers, and mobile devices
Connect-MgGraph -Scopes "User.ReadWrite.All"

$upn = "[USER_UPN]"  # Replace with the target user's UPN

# Confirm before proceeding
$confirm = Read-Host "Revoke all sessions for $upn? This signs them out of everything. (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Cancelled."
    exit
}

# Revoke all refresh tokens (signs out all current sessions)
Invoke-MgInvalidateUserRefreshToken -UserId $upn
Write-Host "Sessions revoked for: $upn"

# Verification — check sign-in logs for recent activity
Write-Host "`nTo verify, check sign-in logs:"
Write-Host "Entra → Users → $upn → Sign-in logs"
```

---

## EX-05 — Find Inactive Users (No Sign-In in 90 Days)

```powershell
# Requires Entra ID P1 or P2 for signInActivity
Connect-MgGraph -Scopes "User.Read.All", "AuditLog.Read.All"

# Calculate cutoff date (90 days ago)
$cutoffDate = (Get-Date).AddDays(-90).ToString("yyyy-MM-ddTHH:mm:ssZ")

# Get all licensed users with their last sign-in date
$users = Get-MgUser -All `
  -Filter "assignedLicenses/`$count ne 0" `
  -CountVariable c -ConsistencyLevel eventual `
  -Property DisplayName, UserPrincipalName, AccountEnabled, SignInActivity

$inactive = $users | Where-Object {
    # Flag if no sign-in on record, or last sign-in before cutoff
    -not $_.SignInActivity.LastSignInDateTime -or
    $_.SignInActivity.LastSignInDateTime -lt $cutoffDate
} | Select-Object DisplayName, UserPrincipalName, AccountEnabled,
    @{N='LastSignIn'; E={ $_.SignInActivity.LastSignInDateTime ?? "Never" }}

$inactive | Sort-Object LastSignIn | Format-Table -AutoSize
Write-Host "Inactive users (no sign-in in 90+ days): $($inactive.Count)"

# Export for review
$inactive | Export-Csv -Path "inactive-users-$(Get-Date -f yyyyMMdd).csv" -NoTypeInformation
Write-Host "Exported. Review before taking any action on these accounts."
```

---

## EX-06 — Assign Intune Compliance Policy to a Group

```powershell
Connect-MgGraph -Scopes "DeviceManagementConfiguration.ReadWrite.All", "Group.Read.All"

$policyName  = "[COMPLIANCE_POLICY_NAME]"  # Name of the Intune compliance policy
$groupName   = "[TARGET_GROUP_NAME]"        # Entra group to assign it to
$DryRun      = $true                        # Review before executing

# Find the compliance policy
$policy = Get-MgDeviceManagementDeviceCompliancePolicy -All |
    Where-Object { $_.DisplayName -eq $policyName }

# Find the group
$group = Get-MgGroup -Filter "displayName eq '$groupName'" -ConsistencyLevel eventual

if (-not $policy) { Write-Host "Policy not found: $policyName"; exit }
if (-not $group)  { Write-Host "Group not found: $groupName";  exit }

if ($DryRun) {
    Write-Host "[DRY RUN] Would assign policy '$policyName' to group '$groupName'"
    Write-Host "  Policy ID: $($policy.Id)"
    Write-Host "  Group ID:  $($group.Id)"
} else {
    # Create the assignment
    $assignment = @{
        target = @{
            "@odata.type" = "#microsoft.graph.groupAssignmentTarget"
            groupId       = $group.Id
        }
    }
    New-MgDeviceManagementDeviceCompliancePolicyAssignment `
        -DeviceCompliancePolicyId $policy.Id `
        -BodyParameter $assignment

    Write-Host "Assigned '$policyName' to '$groupName'"
}
```
