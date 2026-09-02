# Systems Health Checks

## Execution boundary

This module is planning/reference only and never authorizes a state change. Read-only health checks remain available. Route connector/service actions to `/ad-connect`, identity-risk actions to `/security-alert-triage`, device cleanup to `/device-wipe`, compliance remediation to `/intune-compliance`, and license changes to `/license-audit`. The destination command must independently resolve the target and require its own action-specific exact confirmation.

Operational checks to run on a defined schedule. Each check includes the portal path,
what a healthy result looks like, and what to do if the check fails.

---

## Daily Checks

### HC-D01 — Entra Connect Sync Status

**What:** Confirm that on-prem AD is syncing successfully to Entra ID.

**Portal:**
1. Entra ID → Entra Connect → Connect sync
2. Check: `Last sync status` → should show `Succeeded`
3. Check: `Last sync time` → should be within the last 30–40 minutes

**Healthy:** `Sync completed successfully — X minutes ago`

**Unhealthy:** `Sync has not completed` or `Last sync > 2 hours ago`

**Action if unhealthy:**

> **PREVIEW ONLY [health-sync-remediation]:** Route any ADSync service restart or connector cycle to `/ad-connect`; this health check cannot perform either action.

- Log in to the AD Connect server
- Open Synchronization Service Manager → look for errors in Connector Operations
- Record whether a service restart or delta sync is proposed, then use `/ad-connect` for separate review

<details>
<summary>PowerShell — force sync and check status</summary>

```powershell
# Run on the AD Connect server
Import-Module ADSync  # Load the sync module

# Check last sync time
Get-ADSyncScheduler | Select-Object LastSyncCycleResult, LastSyncCycleStartedDate

# PREVIEW ONLY [health-delta-sync]: Start-ADSyncSyncCycle -PolicyType Delta

# After sync completes, verify result
Get-ADSyncScheduler | Select-Object LastSyncCycleResult
```
</details>

---

### HC-D02 — Entra Identity Protection — Risky Users

**What:** Check for any accounts flagged as high-risk by Entra Identity Protection.

**Portal:** entra.microsoft.com → ID Protection → Risky users → filter: Risk level = High

**Healthy:** 0 unreviewed high-risk users

**Action if flagged:**

> **PREVIEW ONLY [health-risky-user-action]:** Route risk dismissal or compromise containment to `/security-alert-triage`; this health check cannot change risk or account state.

- Click the user → review the risk detections (leaked credentials? atypical travel? malware-linked IP?)
- If confirmed compromise → follow IR-01 (incident_response.md)
- If false positive → dismiss the risk and document the reason

---

### HC-D03 — M365 Service Health

**What:** Check for any active Microsoft service incidents affecting your tenant.

**Portal:** admin.microsoft.com → Health → Service health

**Healthy:** All services show green / `Service is healthy`

**Action if incident:** Read the incident details — Microsoft provides estimated resolution times.
If an incident affects business-critical services (Exchange, Teams), notify affected staff proactively.

---

## Weekly Checks

### HC-W01 — Intune Non-Compliant Devices

**What:** Review devices that have fallen out of compliance with security policies.

**Portal:** Intune → Devices → Monitor → Noncompliant devices

**Healthy:** Count trending down or stable; all high-priority devices compliant

**Action:** For each non-compliant device:

> **PREVIEW ONLY [health-compliance-remediation]:** Route device remediation or a compliance sync to `/intune-compliance`; route any retire, wipe, or record deletion separately to `/device-wipe`.

- Check what policy it's failing (BitLocker, OS version, passcode, Defender)
- Contact the device owner to remediate (see troubleshooting.md T-10)
- If device has been abandoned → check with HR if user is still active

---

### HC-W02 — AD Replication Health

**What:** Confirm all domain controllers are replicating changes to each other.

**What to check:** On the primary domain controller, run:

<details>
<summary>PowerShell — replication health</summary>

```powershell
# Check replication status across all DCs
# Run on any domain-joined machine with RSAT
repadmin /replsummary  # Shows replication summary — look for failure counts

# Detailed per-DC status
repadmin /showrepl     # Shows last replication result for each DC partner

# PREVIEW ONLY [health-force-replication]: repadmin /syncall /AdeP
```
</details>

**Healthy:** All DCs show 0 failures in `/replsummary`

**Action if failures:** Check event viewer on failing DC → Directory Service log → look for NTDS errors

---

### HC-W03 — Orphaned / Stale Device Objects in Intune

**What:** Devices that were wiped, retired, or replaced but not cleaned up leave ghost objects.

**Portal:** Intune → Devices → All devices → sort by `Last check-in` date
- Flag any devices with last check-in > 60 days
- Cross-reference: is this user still active? Was the device replaced?

**Action:** Delete stale device records:

> **PREVIEW ONLY [health-stale-device-delete]:** Route the resolved device and record-only deletion intent to `/device-wipe`; this health check cannot delete, retire, or wipe a device.

Intune → [device] → Delete (this removes from Intune only, does not affect the physical device)

---

## Monthly Checks

### HC-M01 — License Utilization

**What:** Compare assigned licenses against active users. Identify wasted spend.

**Portal:** admin.microsoft.com → Billing → Licenses

**Healthy:** Utilization between 85–95% (buffer for new hires, not over-licensed)

**Action:**

> **PREVIEW ONLY [health-license-action]:** Route any purchase decision to the operator and any assignment/removal to `/license-audit`; this report cannot change subscriptions or users.

- Under-licensed (>95% used): purchase more seats before next hire
- Over-licensed (<80% used): review user list for inactive accounts consuming licenses

<details>
<summary>PowerShell — license utilization report</summary>

```powershell
Connect-MgGraph -Scopes "Organization.Read.All", "User.Read.All"

# Get all SKUs (license types) with available/consumed counts
Get-MgSubscribedSku | Select-Object SkuPartNumber,
    @{N='Total';    E={ $_.PrepaidUnits.Enabled }},
    @{N='Consumed'; E={ $_.ConsumedUnits }},
    @{N='Available';E={ $_.PrepaidUnits.Enabled - $_.ConsumedUnits }} |
    Format-Table -AutoSize
```
</details>

---

### HC-M02 — Admin Role Audit

Cross-reference with compliance_checks.md Check 4.

**Quick portal path:** Entra ID → Roles & admins → All roles → filter `Global Administrator`
→ confirm member list matches expected list on file.

---

### HC-M03 — Entra Connect Server OS + Module Health

**What:** The AD Connect server is a critical single point of failure. Keep it patched.

**Checks:**

> **PREVIEW ONLY [health-connect-maintenance]:** Route any server patch, service restart, or Entra Connect upgrade to `/ad-connect` for a separate maintenance plan. This health check cannot perform maintenance.

1. Windows Update status on AD Connect server — no pending critical updates
2. Entra Connect version: Entra ID → Entra Connect → version number
   - Compare against latest at: learn.microsoft.com/entra/identity/hybrid/connect/reference-connect-version-history
   - If > 6 months behind latest, schedule an upgrade
3. ADSync service is running: Services.msc → `Microsoft Azure AD Sync` → Status = Running

---

## Health Check Log

Use this table to track completion:

| Date | D01 Sync | D02 Risky | D03 SvcHealth | W01 NonCompliant | W02 ADRepl | M01 Licenses | Run by |
|------|----------|-----------|--------------|-----------------|-----------|-------------|--------|
| | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | — | [ADMIN_NAME] |
