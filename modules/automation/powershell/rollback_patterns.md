# PowerShell Rollback-State Patterns

Execution patterns for the R2/R3 blast-radius classes in CLAUDE.md's Zero-Trust Execution
Contract. Companion to [safety_patterns.md](safety_patterns.md) (WhatIf, dry-run guards).
Core idea: **Entra, Intune, and Exchange do not keep your before-state.** If you didn't
capture it, you can't roll back — you can only reconstruct from memory and hope.

All examples use placeholders. Every line is commented in plain English.

---

## Pattern 1 — Checkpoint before change (the R2 minimum)

Capture the exact pre-state to a timestamped JSON file **before** touching anything.

```powershell
# Build a checkpoint folder path — one file per change, named by date + task
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"                        # timestamp for the filename
$ckpt  = "tasks/checkpoints/$stamp-license-change-[JIRA-###].json" # what + which ticket

# Capture the user's CURRENT licenses and groups — this IS the rollback data
$pre = [ordered]@{
    user     = "[UPN]"                                                              # who we're about to change
    licenses = (Get-MgUserLicenseDetail -UserId "[UPN]").SkuPartNumber              # licenses BEFORE the change
    groups   = (Get-MgUserMemberOf -UserId "[UPN]").AdditionalProperties.displayName # groups BEFORE the change
}
$pre | ConvertTo-Json -Depth 4 | Out-File $ckpt -Encoding utf8     # write the checkpoint to disk

# ONLY NOW make the change. If anything goes wrong, $ckpt says exactly what "back" means.
```

**Rule:** the checkpoint file is written and confirmed on disk *before* step 1 of the change.
A checkpoint you write "after, if needed" is not a checkpoint.

## Pattern 2 — Paired change + rollback function

Never write a change block without writing its inverse next to it.

```powershell
function Invoke-Change {
    # The forward operation — add the user to the department group
    New-MgGroupMember -GroupId "[GROUP_ID]" -DirectoryObjectId "[USER_ID]"   # the change
}
function Invoke-Rollback {
    # The exact inverse — remove the same membership. ⚠️ Remove-* cmdlet: destructive by class
    Remove-MgGroupMemberByRef -GroupId "[GROUP_ID]" -DirectoryObjectId "[USER_ID]"  # the undo
}

Invoke-Change                                                       # run the change
# Verify read-back — Zero-Trust rule 2: prove the new state, per step
$now = Get-MgGroupMember -GroupId "[GROUP_ID]" |
       Where-Object { $_.Id -eq "[USER_ID]" }                       # is the user actually in the group now?
if (-not $now) { Invoke-Rollback; throw "Verification failed — rolled back." }  # auto-revert on failed verify
```

## Pattern 3 — Batch with count gate and stop-on-first-failure

The pattern that prevents tenant-wide accidents. Never pipe `Get-X | Action-Y`.

```powershell
# STAGE — collect targets into a variable; nothing has happened yet
$targets = Get-MgUser -Filter "department eq '[DEPARTMENT]'"        # narrowest filter that does the job

# COUNT GATE — state the predicted count BEFORE acting; a surprise count = stop
$targets.Count                                                      # expected: [N]. If it isn't [N], STOP here.

# EXECUTE — one at a time, stop on first failure, log every success for partial-state reporting
$done = @()                                                         # successes so far (= rollback worklist)
foreach ($u in $targets) {
    try {
        Set-MgUser -UserId $u.Id -UsageLocation "[COUNTRY_CODE]" -ErrorAction Stop  # the per-object change
        $done += $u.UserPrincipalName                               # record success only after it worked
    } catch {
        # Zero-Trust rule 5: partial failure = inconsistent state. Stop and report, don't push through.
        Write-Host "FAILED at $($u.UserPrincipalName). Changed so far: $($done.Count) of $($targets.Count):"
        $done | ForEach-Object { Write-Host "  changed: $_" }       # exact list of what needs rollback
        throw                                                        # surface the real error — no silent-fail
    }
}
```

## Pattern 4 — Policy objects: export before edit (CA, compliance, config)

Conditional Access and Intune policies are single objects with many settings — one wrong
edit is invisible later. Export the full JSON first.

```powershell
# Export the ENTIRE policy definition before touching it — this is the rollback artifact
Get-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId "[POLICY_ID]" |
    ConvertTo-Json -Depth 10 |                                      # depth 10: CA policies nest deep
    Out-File "tasks/checkpoints/$stamp-ca-policy-[POLICY_NAME].json" -Encoding utf8

# Prefer Report-only mode over live edits when testing CA changes (see /conditional-access)
```

## Pattern 5 — Irreversible operations (no rollback exists)

Device wipe, mailbox purge, permanent deletes: there is **no** rollback state to capture.
The entire control is front-loaded:

1. R3 gate (SR-2): ⚠️ flag, exact blast radius, who's affected, typed confirmation.
2. Evidence capture instead of state capture: record device ID/serial/user/ticket in the
   checkpoint file — you can't undo, but you must be able to prove exactly what was done.
3. Prefer the reversible sibling when one exists: `Retire` (removes work data, BYOD-safe)
   before `Wipe`; soft-delete (30-day recycle) before hard-delete; disable before delete.

**If a step has no undo and no reversible sibling, it gets the strongest gate in the file —
never batch it, never script it into a loop with other steps.**

## Related

- `CLAUDE.md` → Zero-Trust Execution Contract — when each pattern is mandatory (R2/R3)
- [safety_patterns.md](safety_patterns.md) — WhatIf and dry-run guards (run those FIRST)
- [../../security/threat_model.md](../../security/threat_model.md) — probe T7 tests Pattern 3's failure path
