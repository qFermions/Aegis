---
description: Triage Intune device compliance — why a device shows non-compliant, which policy/setting failed, and how to remediate. Portal first. Placeholders only.
disable-model-invocation: true
---

# /intune-compliance

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** "Non-compliant" almost always traces to a **specific failed setting** in a specific policy. Open the device → Compliance, read which setting is red, fix that — don't guess. Non-compliant + Conditional Access "require compliant device" = the user gets blocked, so this is often urgent.

## What to check first
- Intune → Devices → All devices → `[DEVICE_NAME]` → **Device compliance** → which policy + which setting is failing.
- When did it flip? (Recent policy change vs. device drift.)
- **Ask first** (answer-format section 2, rule d): a request to exempt the device or the user from a compliance policy, or to loosen the policy, with no failed setting in the ticket gets one question first: "Which policy and which setting does the device's compliance page show as failing?" An exemption or a policy change is only for a cause that page shows.
- **A smell of compromise** (rule a): a device non-compliant because Defender rates its threat or risk level too high, malware found on it, or encryption turned off by someone other than IT. Name the escalation to the security lead or the security on-call (they need `[DEVICE_NAME]`, the user, the failing setting, when it flipped, and the Defender alert); the device stays blocked until they have looked.

## Step-by-step fix (portal first — intune.microsoft.com)

> **PREVIEW ONLY [intune-compliance-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Devices → All devices → `[DEVICE_NAME]` → **Device compliance** → expand the failing policy → read the **red setting**.
2. Common failures → fix:
   - **BitLocker/encryption not on** → enable BitLocker (Windows) / device encryption.
   - **OS version below minimum** → run updates: on the device, Settings → Windows Update → **Check for updates**; fleet-wide via intune.microsoft.com → Devices → Windows → **Update rings for Windows 10 and later**.
   - **Defender/AV not running or signatures stale** → start/update Microsoft Defender.
   - **Secure Boot / TPM / firewall off** → enable in settings/BIOS.
   - **Not encrypted within grace period** → complete encryption, then **Sync**.
3. Force a check-in: device → **Sync** (or Company Portal → Settings → Sync) and wait for re-evaluation.
4. If the policy itself is wrong (too strict / wrong scope) → Devices → Compliance policies → fix the policy (test on a pilot group first).
5. Read-back (R0): write the time of the Sync as `[NOT_BEFORE]` and the Intune device ID as `[DEVICE_ID]`, then prove the device synced (batch G3, read-only Microsoft Graph connector).

```bash
# HUMAN-RUN read-only read-back: passes only when Intune's lastSyncDateTime for the device is at or after [NOT_BEFORE]
node scripts/adapters/msgraph-client.js verify-device-synced --device [DEVICE_ID] --not-before [NOT_BEFORE] --execute
```

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "DeviceManagementManagedDevices.Read.All"        # read device compliance
$d = Get-MgDeviceManagementManagedDevice -Filter "deviceName eq '[DEVICE_NAME]'"  # locate device
$d | Select DeviceName,ComplianceState,OperatingSystem,OsVersion,LastSyncDateTime  # compliance snapshot
```
</details>

## ⚠️ Risk warning
- Loosening a compliance policy to "fix" one device weakens it for **every** device in scope — fix the device, not the policy, unless the policy is genuinely wrong. Test policy changes on a pilot group; route broad changes through independent plan review.
- A device blocked by CA "require compliant" can't reach resources until compliant — communicate ETA to the user.

## ✅ Verification checklist
- [ ] The specific failed setting now passes
- [ ] Device shows **Compliant** after Sync (allow a few min to re-evaluate); `verify-device-synced` passes
- [ ] User regained access (if CA was blocking)
- [ ] No other devices regressed (if a policy was changed)
- [ ] No exemption or policy change without the failing setting read first; a threat-level or malware failure went to the security lead or on-call (rules d and a)

## 📝 Jira-ready note
> Resolved [date/time]. `[DEVICE_NAME]` was non-compliant on [setting] in [policy]. Remediated by [action]; forced Sync; device re-evaluated **Compliant**. [User access restored.] Time spent: [X] min.
