---
description: Troubleshoot network printer issues — offline, stuck queue, driver, single-user failure, add by IP, VLAN/DHCP check. GUI first. Placeholders only.
disable-model-invocation: true
---

# /printer-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Most printer problems fall into four buckets: the Print Spooler service is stuck, the printer has a stale/wrong IP, a driver mismatch on one user's machine, or the printer is on the wrong VLAN and can't get a DHCP lease. Identify which bucket first, then follow the matching fix below.

## What to check first
- Can anyone print, or is it just one user? One user = driver/queue issue on their machine. No one = printer, network, or spooler issue
- Is the printer powered on and showing a ready light?
- Can you ping [PRINTER_IP] from your machine? If no ping = network/IP issue. If ping works = software issue
- Check the printer's own display panel for paper jams, low toner alerts, or error codes

## Step-by-step fix

---

**Network printer not showing up (can't find it to add)**

1. Confirm the printer has a valid IP — print a configuration page from the printer's front panel (usually Menu → Print Config Page)
2. Note the IP ([PRINTER_IP]) and confirm it's on the correct VLAN/subnet for your site
> **PREVIEW ONLY [printer-network-add-initial]:** The add-printer path below is reference material, not authorization to create a local queue. Route the exact machine, printer name/IP, port, and rollback through a separately reviewed runbook.
3. On Windows: `Settings → Bluetooth & devices → Printers & scanners → Add a printer or scanner`
4. If the printer doesn't appear in the auto-scan list, click **"The printer that I want isn't listed"**
5. Choose **"Add a printer using a TCP/IP address or hostname"** → enter [PRINTER_IP] → Next
> **PREVIEW ONLY [printer-driver-install-initial]:** Driver installation is a separate machine-level write. Verify the signed package, exact model, architecture, publisher, and rollback before using a separately gated installer workflow.
6. Windows will detect the port and suggest a driver — confirm or install the correct driver (see Driver issues below)

---

**Stuck print queue / spooler restart**

<!-- SAFETY GATE [print-queue-delete-portal] -->
- **Target:** the exact `$queueFileCount` files represented by `$queueSetHash` directly inside the resolved local PRINTERS spool directory
- **Effect:** stop the local Spooler, permanently delete those queue files, and restore the prior service state
- **Scope:** exactly the name/length/content-hash manifest represented by `$queueSetHash`; never the directory, subdirectories, reparse points, or a same-count replacement set
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): the prior Spooler state is restored; deleted jobs cannot be restored and must be resubmitted
- **Required confirmation:** Use the adjacent read-only manifest routine to render both values, then type exactly `STOP SPOOLER DELETE $queueFileCount LOCAL PRINT JOB FILES SET SHA256 $queueSetHash RESTORE SPOOLER RUNNING`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a local spool folder on one workstation: no connector, its own read is the proof)
**PORTAL ACTION [print-queue-delete-portal]:** Do not use File Explorer count alone. First run only the adjacent read-only resolution/manifest portion and review every name, length, file SHA-256, and the resulting `$queueSetHash`. Only after the exact match, stop the local Spooler, recompute and require the identical manifest, delete only those exact files, verify each absence, and restore Running even if deletion fails. Any drift or restoration failure stops the workflow and is reported as partial/unknown state.

1. On the affected machine, use the validated manifest routine below; stop if the Spooler is not currently Running or any file is a reparse point.
2. Review the exact manifest and copy the generated confirmation phrase without editing it.
3. Execute the gated branch below. It owns the Stop, exact deletions, read-backs, and Start as one transaction-shaped workflow.
4. Retry the print job only after the final service read-back says Running and the approved manifest files are absent.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Resolve the one trusted local queue directory and build a deterministic name/length/content-hash manifest.
$windowsRoot = [IO.Path]::GetFullPath([string]$env:WINDIR).TrimEnd('\')
$queuePath = [IO.Path]::GetFullPath((Join-Path $windowsRoot 'System32\spool\PRINTERS'))
$expectedQueuePath = "$windowsRoot\System32\spool\PRINTERS"
if ($queuePath -cne $expectedQueuePath -or -not (Test-Path -LiteralPath $queuePath -PathType Container)) { throw "The canonical local queue directory was not resolved. No change was made." }

function Get-LocalPrintQueueManifest {
    param([Parameter(Mandatory)][string]$LiteralQueuePath)
    $records = @(Get-ChildItem -LiteralPath $LiteralQueuePath -File -Force -ErrorAction Stop | Sort-Object Name | ForEach-Object {
        if (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "A queue entry is a reparse point. No change may proceed." }
        if ([IO.Path]::GetFullPath($_.DirectoryName).TrimEnd('\') -cne $LiteralQueuePath.TrimEnd('\')) { throw "A queue entry escaped the trusted directory. No change may proceed." }
        [PSCustomObject]@{
            Name = [string]$_.Name
            Length = [long]$_.Length
            SHA256 = [string](Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        }
    })
    if ($records.Count -eq 0) { throw "No queued files were found. No change was made." }
    $manifestJson = ConvertTo-Json -InputObject @($records) -Depth 3 -Compress
    $manifestHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($manifestJson))).Replace('-', '').ToLowerInvariant()
    [PSCustomObject]@{ Records = $records; Json = $manifestJson; SHA256 = $manifestHash }
}

$spooler = Get-Service -Name Spooler -ErrorAction Stop
if ($spooler.Status -ne 'Running') { throw "This workflow requires a prior Running state so restoration is exact. Diagnose the stopped service separately." }
$queueManifest = Get-LocalPrintQueueManifest -LiteralQueuePath $queuePath
$queueFileCount = $queueManifest.Records.Count
$queueSetHash = $queueManifest.SHA256
Write-Host "Target: $queuePath; queued files: $queueFileCount; set SHA256: $queueSetHash"
$queueManifest.Records | ForEach-Object { Write-Host "  $($_.Name); bytes=$($_.Length); SHA256=$($_.SHA256)" }

# SAFETY GATE [print-queue-delete]
# Target: exact $queueFileCount local queue files represented by $queueSetHash
# Effect: stops the Spooler, permanently deletes the displayed files, and restores its prior state
# Scope: exactly the approved name/length/content hashes directly inside PRINTERS; never subdirectories or a drifted set
# Reversibility: R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): prior service state is restored; deleted jobs cannot be restored
# Read-back: none, a local spool folder on one workstation: no connector, its own read is the proof
$requiredConfirmation = "STOP SPOOLER DELETE $queueFileCount LOCAL PRINT JOB FILES SET SHA256 $queueSetHash RESTORE SPOOLER RUNNING"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    $approvedTargets = @($queueManifest.Records | ForEach-Object {
        [PSCustomObject]@{
            Name = [string]$_.Name
            Label = "$($_.Name) bytes=$($_.Length) SHA256=$($_.SHA256)"
        }
    })
    $attemptedNames = [System.Collections.Generic.List[string]]::new()
    $operationError = $null
    $restorationErrors = [System.Collections.Generic.List[string]]::new()
    $serviceTarget = "LOCAL SERVICE Spooler prior-state=Running"
    $serviceRestored = $false
    try {
        Stop-Service -Name Spooler -Force -ErrorAction Stop
        if ((Get-Service -Name Spooler -ErrorAction Stop).Status -ne 'Stopped') { throw "Spooler did not reach Stopped. No file was deleted." }

        $finalManifest = Get-LocalPrintQueueManifest -LiteralQueuePath $queuePath
        if ($finalManifest.SHA256 -cne $queueSetHash -or $finalManifest.Records.Count -ne $queueFileCount) { throw "Queue manifest drifted after approval. No file was deleted." }

        foreach ($record in $finalManifest.Records) {
            $queueFile = [IO.Path]::GetFullPath((Join-Path $queuePath $record.Name))
            if ([IO.Path]::GetDirectoryName($queueFile).TrimEnd('\') -cne $queuePath.TrimEnd('\')) { throw "Queue target escaped the trusted directory." }
            $attemptedNames.Add([string]$record.Name)
            Remove-Item -LiteralPath $queueFile -Force -ErrorAction Stop
            if (Test-Path -LiteralPath $queueFile -ErrorAction Stop) { throw "Deletion returned but the approved target is still present." }
        }
    } catch {
        $operationError = $_
    } finally {
        try {
            $serviceBeforeRestore = Get-Service -Name Spooler -ErrorAction Stop
            if ($serviceBeforeRestore.Status -ne 'Running') {
                Start-Service -Name Spooler -ErrorAction Stop
            }
            $serviceAfterRestore = Get-Service -Name Spooler -ErrorAction Stop
            if ($serviceAfterRestore.Status -ne 'Running') { throw "Final service read-back did not prove Running." }
            $serviceRestored = $true
        } catch {
            $restorationErrors.Add("$serviceTarget => UNKNOWN/POSSIBLY CHANGED during restart/read-back: $($_.Exception.Message)")
        }
    }

    $completedTargets = [System.Collections.Generic.List[string]]::new()
    $failedTargets = [System.Collections.Generic.List[string]]::new()
    $notAttemptedTargets = [System.Collections.Generic.List[string]]::new()
    if ($serviceRestored) { $completedTargets.Add($serviceTarget) }
    foreach ($approvedTarget in $approvedTargets) {
        if (-not $attemptedNames.Contains($approvedTarget.Name)) {
            $notAttemptedTargets.Add($approvedTarget.Label)
            continue
        }
        try {
            $approvedPath = [IO.Path]::GetFullPath((Join-Path $queuePath $approvedTarget.Name))
            if (Test-Path -LiteralPath $approvedPath -ErrorAction Stop) {
                $failedTargets.Add("$($approvedTarget.Label) => FAILED; still present after attempted removal")
            } else {
                $completedTargets.Add("$($approvedTarget.Label) => removal verified by absence read-back")
            }
        } catch {
            $failedTargets.Add("$($approvedTarget.Label) => UNKNOWN/POSSIBLY CHANGED; absence read-back failed: $($_.Exception.Message)")
        }
    }

    if ($restorationErrors.Count -gt 0) { $restorationErrors | ForEach-Object { $failedTargets.Add($_) } }
    if ($null -ne $operationError -or $failedTargets.Count -gt 0 -or $notAttemptedTargets.Count -gt 0) {
        $operationDetail = if ($null -ne $operationError) { $operationError.Exception.Message } else { 'none' }
        throw "Queue cleanup ended in UNKNOWN/PARTIAL STATE for immutable set SHA256 $queueSetHash. Verified completed targets: [$($completedTargets -join '; ')]. Failed/UNKNOWN targets: [$($failedTargets -join '; ')]. Not-attempted targets: [$($notAttemptedTargets -join '; ')]. Operation error: $operationDetail"
    }
    Write-Host "Completed targets: $($completedTargets -join '; '). Failed/UNKNOWN targets: none. Not-attempted targets: none."
} else {
    throw "Confirmation did not match. No change was made."
}
```

</details>

---

**Driver issues (reinstall / update driver)**

1. `Settings → Bluetooth & devices → Printers & scanners → [PRINTER_NAME] → Printer properties → Advanced tab`
2. Note the current driver name
3. Download the latest driver from the printer manufacturer's website for your exact model
> **PREVIEW ONLY [printer-driver-update]:** The driver-update wizard is a machine-level write and is not authorized by this troubleshooting reference. Record the current package, verify the signed replacement, and use a separate target-bound change.
4. `Control Panel → Devices and Printers → right-click [PRINTER_NAME] → Printer properties → Advanced → New Driver` → run the wizard with the downloaded driver
> **PREVIEW ONLY [printer-driver-remove-readd]:** Removing/re-adding a printer and running an installer are distinct state changes. Prepare them separately with the exact queue/port/package and rollback; do not execute them here.
5. Alternatively: remove the printer entirely, run the downloaded driver installer, then re-add via TCP/IP (see "Add new printer" below)

---

**Printer shows offline but is powered on**

1. On Windows: `Settings → Bluetooth & devices → Printers & scanners → [PRINTER_NAME] → Open print queue`
> **PREVIEW ONLY [printer-offline-toggle]:** Changing the queue's offline flag is not authorized here. Resolve the exact local queue and route the single reversible setting change through a reviewed action.
2. In the print queue window: `Printer menu → uncheck "Use Printer Offline"`
> **PREVIEW ONLY [printer-default-change]:** Setting the default printer changes the user's local configuration and requires a separate exact queue/user target.
3. If that doesn't work: `Printer menu → Set as Default Printer` and re-test
4. Confirm the printer's IP hasn't changed — print a config page from the printer to verify current IP vs what Windows has configured
> **PREVIEW ONLY [printer-ip-remove-readd]:** Removing/re-adding the queue for a new IP is not authorized here. Capture the current port/driver/default state and use a separate reviewed change.
5. If the IP has changed: remove and re-add the printer using the new [PRINTER_IP] (see Add new network printer below)
6. As a last resort: remove the printer, reboot the machine, and re-add

---

**One user can't print but others can (user-side issue)**

1. On the affected machine: `Settings → Bluetooth & devices → Printers & scanners` — confirm the printer appears and is not in error state
> **PREVIEW ONLY [printer-user-job-delete]:** Inspect stuck jobs read-only, then use the count-bound queue-deletion gate above; this checklist does not authorize deletion.
2. Open the print queue and identify any stuck jobs with error status; do not delete them from this preview.
> **PREVIEW ONLY [printer-user-spooler-restart]:** A standalone service restart affects every local queue and is not authorized here. Capture the prior service state and route it through a separate reversible action.
3. Review whether a Spooler restart is warranted (see the gated Stuck queue section above)
4. Compare the driver version against a working machine: `Printers & scanners → [PRINTER_NAME] → Printer properties → Advanced tab → Driver`
> **PREVIEW ONLY [printer-user-driver-reinstall]:** A driver reinstall is a separate signed-package change; route it through the driver workflow above with exact machine/queue/package targets.
5. If the driver version differs, prepare the verified driver reinstall; do not run it from this checklist
6. Check that the user has print permissions: some printers are access-controlled via Active Directory printer deployment — confirm the user is in the correct group in ADUC or Entra

---

**Add a new network printer (by IP)**

> **PREVIEW ONLY [printer-network-add-by-ip]:** The sequence below illustrates the UI path only. It cannot create a queue, port, driver assignment, or default-printer setting; move those resolved actions to a separately reviewed runbook.

1. On the target machine: `Settings → Bluetooth & devices → Printers & scanners → Add device`
2. Wait for auto-scan; if the printer doesn't appear: **"The printer that I want isn't listed"**
3. Select **"Add a printer using a TCP/IP address or hostname"**
4. Enter [PRINTER_IP] → Next → Windows detects the port
5. Select or install the driver: choose from the Windows built-in list, or click **"Have Disk"** and browse to the downloaded driver .INF file
6. Name the printer clearly (e.g., `[SITE]-[FLOOR]-[MODEL]`) → set as default if appropriate → Finish
7. Print a test page to confirm

---

**Meraki VLAN/DHCP check (printer has wrong IP or can't be reached)**

`Meraki dashboard → [Site Network] → Switch → DHCP`
1. Confirm the printer's MAC address has a DHCP lease on the correct VLAN
   - Navigate to: `Network-wide → Clients` → search for the printer by MAC or IP
   - Check "VLAN" column — printer should be on the correct staff or device VLAN, not the guest VLAN
2. If the printer is on the wrong VLAN: check the switch port it's connected to
   - `Switch → Switches → [Switch name] → Ports` → find the port by MAC → inspect its access VLAN
   > **PREVIEW ONLY [printer-switch-port-vlan]:** Changing the access VLAN is a network write with a connectivity blast radius. Route the exact network, switch serial, port, old/new VLAN, and rollback to a separate reviewed network change.
3. If no DHCP lease is showing: the printer may have a static IP outside the DHCP range — print a config page to confirm
> **PREVIEW ONLY [printer-dhcp-reservation]:** Creating a DHCP reservation is not authorized here. Verify the exact network/VLAN, MAC, IP uniqueness, existing reservation state, and rollback in a separate action.
4. Reference path for a reviewed reservation: `Security & SD-WAN → DHCP → [VLAN] → Fixed IP assignments`

## ⚠️ Risk warning
- Restarting the Print Spooler drops all active print jobs — warn users before doing it on a shared print server
- Deleting files from `C:\Windows\System32\spool\PRINTERS` removes all pending jobs permanently — there is no undo
- Changing a printer's VLAN assignment on a Meraki switch port will briefly disconnect the printer from the network (~5 seconds)
- Driver changes affect only the machine you're on; if the printer is deployed via Group Policy, a driver update there affects all machines that receive the policy

## ✅ Verification checklist
- [ ] Printer shows "Ready" status in Windows Printers & scanners
- [ ] Print queue is empty and no jobs are stuck
- [ ] Test page prints successfully from the affected machine
- [ ] Ping [PRINTER_IP] succeeds from the user's machine
- [ ] Meraki client list shows the printer on the correct VLAN with a stable IP
- [ ] If driver was changed: other users on different machines can still print normally

## 📝 Jira-ready note
> Investigated printer issue reported at [@Aegion] — [BRIEF_SYMPTOM e.g. "printer offline / queue stuck / one user can't print"]. Root cause: [CAUSE]. Fix applied: [ACTION — e.g. "restarted Print Spooler, cleared queue, reinstalled driver, re-added printer by IP [PRINTER_IP]"]. Verified: test page printed successfully. Time spent: [X] min.
