---
description: Wipe or retire a device in Intune — choose Full Wipe (work-owned) vs Retire/selective (BYOD), with a destructive-action confirmation gate. Placeholders only.
disable-model-invocation: true
---

# /device-wipe

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Pick the right action for ownership. **Full Wipe** = factory reset (work-owned). **Retire** (selective wipe) = removes only company data/apps, leaves personal data (BYOD). **Fresh Start** = reinstall Windows, keep user data. Wrong choice on a personal phone wipes someone's photos — confirm ownership first.

## ⚠️ Destructive — confirm before proceeding
This **erases data and cannot be undone**. Before any wipe, confirm with the operator:
- Device: `[DEVICE_NAME]` · Owner: work-owned or BYOD? · Action: Wipe / Retire / Fresh Start?
- For offboarding, this is part of `/offboard` — coordinate so you wipe the right device.
Generic approval never authorizes a device action. Use only the action-specific exact gate below.

## What to check first
- Intune admin center → Devices → All devices → `[DEVICE_NAME]` → **Managed by** + **Ownership** (Corporate vs Personal).
- Is the user still active? (If offboarding, follow `/offboard` order.)

## Step-by-step fix (portal first)
1. **Intune admin center** (intune.microsoft.com) → Devices → All devices → `[DEVICE_NAME]`.
<!-- SAFETY GATE [device-full-wipe-portal] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID
- **Effect:** factory-reset the verified corporate device and erase its data
- **Scope:** one work-owned managed device
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "Wipe"): irreversible; data requires a separate backup
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `FULL WIPE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (Intune wipe: no verify-* command reads a wipe, verify-device-synced reads a sync time and Fleet verify-wipe reads a Fleet host, not the Intune device this gate wipes)
**PORTAL ACTION [device-full-wipe-portal]:** The exact phrase authorizes **Wipe** only for the displayed corporate device. Retire, Fresh Start, later object deletion, and Autopilot deregistration are separate actions and need separate approval.
2. Choose the action on the device blade:
   - **Wipe** (work-owned, full factory reset). Optionally "Retain enrollment state" for Autopilot re-provisioning.
> **PREVIEW ONLY [device-alternatives]:** Retire and Fresh Start are not authorized by the Wipe gate. Move either choice to its own reviewed runbook and exact device/action gate.
   - **Retire** (BYOD — removes company data/apps/policies only; personal data stays).
   - **Fresh Start** (Windows — reinstall, keep user data).
3. **Monitor** → device blade → **Device actions status** until it shows Complete.
> **PREVIEW ONLY [device-record-removal]:** Object deletion and Autopilot deregistration are separate R3 actions and must not be performed from this command.
4. After completion (if decommissioning): remove the stale object — Intune → delete device; Entra → Devices → delete; Autopilot → Devices → deregister the hardware hash if not re-provisioning.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "DeviceManagementManagedDevices.PrivilegedOperations.All"  # wipe rights
$deviceName = "[DEVICE_NAME]"
if ([string]::IsNullOrWhiteSpace($deviceName) -or $deviceName -match '[\x00-\x1F\x7F]') { throw "Device name is empty or contains control characters. No change was made." }
$escapedDeviceName = $deviceName.Replace("'", "''")
$matches = @(Get-MgDeviceManagementManagedDevice -Filter "deviceName eq '$escapedDeviceName'")
if ($matches.Count -ne 1) { throw "Expected exactly one managed device named '$deviceName'; found $($matches.Count). No change was made." }
$d = $matches[0]
if ([string]$d.DeviceName -cne $deviceName -or [string]::IsNullOrWhiteSpace([string]$d.Id)) { throw "The returned device name did not exactly match the requested name, or its immutable ID was empty. No change was made." }
Write-Host "Resolved device: $($d.DeviceName); ID: $($d.Id); serial: $($d.SerialNumber); ownership: $($d.ManagedDeviceOwnerType)"
if ($d.ManagedDeviceOwnerType -ne 'company') { throw "The resolved device is not verified Corporate ownership. No wipe was sent." }
# SAFETY GATE [device-full-wipe]
# Target: the resolved corporate device $($d.DeviceName) and managed-device ID $($d.Id)
# Effect: factory-resets the corporate device and erases its data
# Scope: one verified work-owned managed device
# Reversibility: R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "Wipe"): irreversible; data must be restored from a separate backup
# Read-back: none, Intune wipe: no verify-* command reads a wipe, verify-device-synced reads a sync time and Fleet verify-wipe reads a Fleet host, not the Intune device this gate wipes
$requiredConfirmation = "FULL WIPE $($d.DeviceName) WITH ID $($d.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Clear-MgDeviceManagementManagedDevice -ManagedDeviceId $d.Id -ErrorAction Stop  # ⚠️ irreversible wipe request (work-owned)
    $actionReadBack = Get-MgDeviceManagementManagedDevice -ManagedDeviceId $d.Id -Property Id,DeviceName,DeviceActionResults -ErrorAction Stop
    if ([string]$actionReadBack.Id -cne [string]$d.Id -or [string]$actionReadBack.DeviceName -cne [string]$d.DeviceName) { throw "Wipe request returned but device read-back did not match the approved name and ID. Treat action state as UNKNOWN." }
    Write-Host "Wipe request accepted for $($d.DeviceName) [$($d.Id)]. Completion is not proven until Intune reports the expected device-action status."
} else {
    throw "Confirmation did not match. No change was made."
}
# Retire (selective wipe) instead — company data only:
# PREVIEW ONLY [device-retire]: Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $d.Id
```
> ⚠️ SCRIPT SAFETY SCAN — `Clear-MgDeviceManagementManagedDevice` is a destructive factory reset. Confirm the device id + ownership before running.
</details>

## ⚠️ Risk warning
- **Full Wipe on a BYOD device erases the user's personal data** — only Wipe work-owned hardware; use **Retire** for personal.
- Irreversible. No "undo." Double-check `[DEVICE_NAME]` is the right device (naming `DT-`/`LT-First,Last`).

## ✅ Verification checklist
- [ ] Correct action chosen for ownership (Wipe=corporate, Retire=BYOD)
- [ ] Device action status = Complete in Intune
- [ ] (Decommission) device removed from Intune + Entra + Autopilot deregistered
- [ ] User notified if BYOD (company data removed)

## 📝 Jira-ready note
> Resolved [date/time]. `[DEVICE_NAME]` ([corporate/BYOD]): [Full Wipe verified under this command's exact gate / Retire verified under a separate reviewed action / Fresh Start verified under a separate reviewed action / no device action performed]. Management status: [verified value]. Object removal/deregistration: [verified under separate actions / not performed]. Time spent: [X] min.
