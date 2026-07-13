---
description: Wipe or retire a device in Intune — choose Full Wipe (work-owned) vs Retire/selective (BYOD), with a destructive-action confirmation gate. Placeholders only.
---

# /device-wipe

**Verdict:** Pick the right action for ownership. **Full Wipe** = factory reset (work-owned). **Retire** (selective wipe) = removes only company data/apps, leaves personal data (BYOD). **Fresh Start** = reinstall Windows, keep user data. Wrong choice on a personal phone wipes someone's photos — confirm ownership first.

## ⚠️ Destructive — confirm before proceeding
This **erases data and cannot be undone**. Before any wipe, confirm with the operator:
- Device: `[DEVICE_NAME]` · Owner: work-owned or BYOD? · Action: Wipe / Retire / Fresh Start?
- For offboarding, this is part of `/offboard` — coordinate so you wipe the right device.
**Get an explicit "yes, proceed" before executing.**

## What to check first
- Intune admin center → Devices → All devices → `[DEVICE_NAME]` → **Managed by** + **Ownership** (Corporate vs Personal).
- Is the user still active? (If offboarding, follow `/offboard` order.)

## Step-by-step fix (portal first)
1. **Intune admin center** (intune.microsoft.com) → Devices → All devices → `[DEVICE_NAME]`.
2. Choose the action on the device blade:
   - **Wipe** (work-owned, full factory reset). Optionally "Retain enrollment state" for Autopilot re-provisioning.
   - **Retire** (BYOD — removes company data/apps/policies only; personal data stays).
   - **Fresh Start** (Windows — reinstall, keep user data).
3. **Monitor** → device blade → **Device actions status** until it shows Complete.
4. After completion (if decommissioning): remove the stale object — Intune → delete device; Entra → Devices → delete; Autopilot → Devices → deregister the hardware hash if not re-provisioning.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "DeviceManagementManagedDevices.PrivilegedOperations.All"  # wipe rights
# Find the managed device id from the name (read-only lookup)
$d = Get-MgDeviceManagementManagedDevice -Filter "deviceName eq '[DEVICE_NAME]'"   # locate device
# ⚠️ FULL WIPE — factory reset, irreversible:
Clear-MgDeviceManagementManagedDevice -ManagedDeviceId $d.Id                        # ⚠️ wipe (work-owned)
# Retire (selective wipe) instead — company data only:
# Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $d.Id              # BYOD selective wipe
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
> Resolved [date/time]. [Wiped/Retired/Fresh Start] `[DEVICE_NAME]` ([corporate/BYOD]) via Intune — confirmed ownership and got go-ahead before executing. Action status: Complete. [Removed from Intune/Entra/Autopilot if decommissioned.] Time spent: [X] min.
