# PowerShell Safety Patterns

Defensive patterns for writing IT automation scripts that are safe to run in production.
These patterns prevent the most common causes of accidental bulk damage in M365 and AD.

---

## Pattern 1 — WhatIf Before Every Destructive Operation

PowerShell's built-in `-WhatIf` parameter shows what a command *would* do without
executing it. Use it on the first run of any destructive operation.

```powershell
# Show what would be disabled — does nothing
Disable-ADAccount -Identity "[USERNAME]" -WhatIf

# Show what would be removed — does nothing
Remove-ADGroupMember -Identity "[GROUP]" -Members "[USERNAME]" -WhatIf

# Only after reviewing WhatIf output, run for real:
Disable-ADAccount -Identity "[USERNAME]"
```

**Rule:** If the cmdlet supports `-WhatIf`, use it on the first run. If it doesn't,
write a dry-run guard (see Pattern 2).

---

## Pattern 2 — Dry Run Flag for Bulk Operations

For scripts that loop over multiple objects, use a `$DryRun` flag that defaults to `$true`.
The operator must explicitly change it to `$false` to execute.

```powershell
# ---- CONFIGURATION ----
$DryRun = $true  # ← Change to $false only after reviewing dry-run output

# ---- OPERATION ----
$usersToDisable = Get-ADUser -Filter "Department -eq '[DEPARTMENT]'" -SearchBase "OU=Users,DC=..."

foreach ($user in $usersToDisable) {
    if ($DryRun) {
        Write-Host "[DRY RUN] Would disable: $($user.SamAccountName)"
    } else {
        # ⚠️ Disable-ADAccount — disables user from signing in
        Disable-ADAccount -Identity $user.SamAccountName
        Write-Host "Disabled: $($user.SamAccountName)"
    }
}

Write-Host "Total affected: $($usersToDisable.Count)"
if ($DryRun) {
    Write-Host "`n[DRY RUN COMPLETE] Set `$DryRun = `$false to execute."
}
```

---

## Pattern 3 — Export Before Modify (Audit Trail + Rollback)

Before any bulk modification, export the current state to a CSV. This serves two purposes:
1. Audit trail — proves what state things were in before the script ran
2. Rollback input — can be fed back into a rollback script if needed

```powershell
$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$exportPath = "C:\ITOps-Exports\pre-change-$timestamp.csv"

# Step 1: Export current state BEFORE making changes
$currentState = Get-MgGroupMember -GroupId "[GROUP_ID]" -All | ForEach-Object {
    Get-MgUser -UserId $_.Id -Property DisplayName, UserPrincipalName
}
$currentState | Export-Csv -Path $exportPath -NoTypeInformation
Write-Host "Pre-change state exported to: $exportPath"

# Step 2: Make the changes
# ... (your modification logic here)

# Step 3: Export post-change state
$postPath = "C:\ITOps-Exports\post-change-$timestamp.csv"
# ... export again
Write-Host "Post-change state exported to: $postPath"
Write-Host "Compare the two files to verify the change applied correctly."
```

---

## Pattern 4 — Confirmation Gate for Dangerous Operations

For operations that cannot be undone (user deletion, device wipe, license removal),
require the operator to type an explicit confirmation string — not just press Enter.

```powershell
$targetUser = "[USER_UPN]"

# Show what will happen
Write-Host ""
Write-Host "⚠️  About to PERMANENTLY DELETE user: $targetUser"
Write-Host "    This will remove the mailbox, OneDrive, and all data."
Write-Host "    This CANNOT be undone without a backup."
Write-Host ""

# Require explicit confirmation — not just Enter
$confirm = Read-Host "Type 'DELETE $targetUser' to confirm"

if ($confirm -ne "DELETE $targetUser") {
    Write-Host "Confirmation did not match. Operation cancelled."
    exit
}

# ⚠️ Remove-MgUser — permanently deletes the user (soft delete — recoverable for 30 days)
Remove-MgUser -UserId $targetUser
Write-Host "User deleted. Soft-deleted — recoverable in Entra for 30 days."
```

---

## Pattern 5 — Scope Limiter (Fail-Safe on Large Batches)

If a script is expected to affect a bounded number of objects (e.g., "disable accounts in
the Disabled OU"), add a count check. If the count is unexpectedly large, stop and alert
rather than proceeding.

```powershell
$maxExpected = 10  # How many objects you expect to affect — adjust per task

$targets = Get-ADUser -Filter "Enabled -eq $true" -SearchBase "OU=Disabled Users,DC=..."

if ($targets.Count -gt $maxExpected) {
    Write-Host "⚠️  STOP: Found $($targets.Count) objects — expected $maxExpected or fewer."
    Write-Host "    Possible filter issue. Review the query before proceeding."
    Write-Host "    Re-run with -WhatIf if you want to see what would be affected."
    exit 1
}

Write-Host "Count check passed: $($targets.Count) objects within expected range."
# Proceed with operation...
```

---

## Pattern 6 — Error Handling with Rollback State

If a bulk script fails mid-run, you need to know what was already changed.
Use `try/catch` with state tracking so partial runs are recoverable.

```powershell
$changed   = [System.Collections.Generic.List[string]]::new()  # Track what was modified
$failed    = [System.Collections.Generic.List[string]]::new()  # Track what errored

foreach ($upn in $targetUsers) {
    try {
        # ⚠️ Set-MgUserLicense — modifies license assignment
        Set-MgUserLicense -UserId $upn -BodyParameter $licenseChange
        $changed.Add($upn)
        Write-Host "✓ $upn"
    } catch {
        $failed.Add($upn)
        Write-Host "✗ $upn — Error: $($_.Exception.Message)"
    }
}

# Summary
Write-Host "`nCompleted: $($changed.Count) succeeded, $($failed.Count) failed"

if ($failed.Count -gt 0) {
    Write-Host "Failed accounts:"
    $failed | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "⚠️  Script ended with errors. Review failed accounts manually."
    Write-Host "    Changed accounts are listed in: changed-accounts.txt"
    $changed | Set-Content "changed-accounts-$(Get-Date -f yyyyMMdd-HHmmss).txt"
}
```

---

## Pattern 7 — Avoid Aliases and One-Liners

Scripts should be readable by someone who did not write them. Avoid:

```powershell
# BAD — cryptic alias, compressed logic
gm -f "dept -eq 'IT'" | %{ set-mg... }

# GOOD — full cmdlet names, one operation per line
$itUsers = Get-ADUser -Filter "Department -eq 'IT'"
foreach ($user in $itUsers) {
    Set-MgUser -UserId $user.UserPrincipalName -Property ...
}
```

**Rule:** Use full cmdlet names. One pipeline operation per line. Comment anything
that isn't obvious from the cmdlet name alone.

---

## Pattern 8 — Module Pre-Check

Always verify required modules are installed and connected before starting a script.
Fail fast with a clear message rather than crashing mid-operation.

```powershell
# Check that Microsoft.Graph is installed
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph)) {
    Write-Host "Required module not installed. Run:"
    Write-Host "  Install-Module Microsoft.Graph -Scope CurrentUser"
    exit 1
}

# Check that we're connected to Graph (catches expired sessions)
try {
    $ctx = Get-MgContext
    if (-not $ctx) { throw "Not connected" }
    Write-Host "Connected as: $($ctx.Account)"
} catch {
    Write-Host "Not connected to Microsoft Graph. Run:"
    Write-Host "  Connect-MgGraph -Scopes `"User.Read.All`""
    exit 1
}

# --- Safe to proceed ---
```

---

## Pre-Commit Scan Coverage

The pre-commit hook (`scripts/pre-commit-check.js`) will catch these automatically:

| Pattern | Scan class | Action |
|---------|-----------|--------|
| `$password = "..."` | Credential scan | BLOCK |
| `Remove-Item -Recurse -Force` | Dangerous cmdlet | WARN |
| `Invoke-Expression` or `IEX` | Dangerous cmdlet | WARN |
| Real email address | PII scan | BLOCK |
| Phone number pattern | PII scan | BLOCK |
| `ConvertTo-SecureString -AsPlainText` | Dangerous cmdlet | WARN |

See [pre_commit_hooks.md](../pre_commit_hooks.md) for full pattern list and how to extend it.
