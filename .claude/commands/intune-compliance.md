---
description: Triage Intune device compliance — why a device shows non-compliant, which policy/setting failed, and how to remediate. Portal first. Placeholders only.
---

# /intune-compliance

**Verdict:** "Non-compliant" almost always traces to a **specific failed setting** in a specific policy. Open the device → Compliance, read which setting is red, fix that — don't guess. Non-compliant + Conditional Access "require compliant device" = the user gets blocked, so this is often urgent.

## What to check first
- Intune → Devices → All devices → `[DEVICE_NAME]` → **Device compliance** → which policy + which setting is failing.
- When did it flip? (Recent policy change vs. device drift.)

## Step-by-step fix (portal first — intune.microsoft.com)
1. Devices → All devices → `[DEVICE_NAME]` → **Device compliance** → expand the failing policy → read the **red setting**.
2. Common failures → fix:
   - **BitLocker/encryption not on** → enable BitLocker (Windows) / device encryption.
   - **OS version below minimum** → run updates (`/push-updates` via Update Rings).
   - **Defender/AV not running or signatures stale** → start/҅update Microsoft Defender.
   - **Secure Boot / TPM / firewall off** → enable in settings/BIOS.
   - **Not encrypted within grace period** → complete encryption, then **Sync**.
3. Force a check-in: device → **Sync** (or Company Portal → Settings → Sync) and wait for re-evaluation.
4. If the policy itself is wrong (too strict / wrong scope) → Devices → Compliance policies → fix the policy (test on a pilot group first).

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "DeviceManagementManagedDevices.Read.All"        # read device compliance
$d = Get-MgDeviceManagementManagedDevice -Filter "deviceName eq '[DEVICE_NAME]'"  # locate device
$d | Select DeviceName,ComplianceState,OperatingSystem,OsVersion,LastSyncDateTime  # compliance snapshot
```
</details>

## ⚠️ Risk warning
- Loosening a compliance policy to "fix" one device weakens it for **every** device in scope — fix the device, not the policy, unless the policy is genuinely wrong. Test policy changes on a pilot group; route broad changes through Nova.
- A device blocked by CA "require compliant" can't reach resources until compliant — communicate ETA to the user.

## ✅ Verification checklist
- [ ] The specific failed setting now passes
- [ ] Device shows **Compliant** after Sync (allow a few min to re-evaluate)
- [ ] User regained access (if CA was blocking)
- [ ] No other devices regressed (if a policy was changed)

## 📝 Jira-ready note
> Resolved [date/time]. `[DEVICE_NAME]` was non-compliant on [setting] in [policy]. Remediated by [action]; forced Sync; device re-evaluated **Compliant**. [User access restored.] Time spent: [X] min.
