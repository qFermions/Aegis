# Systems Health Checks

Operational checks to run on a defined schedule. Each check includes the portal path,
what a healthy result looks like, and what to do if the check fails.

---

## Daily Checks

### HC-D01 — Entra Connect Sync Status

**What:** Confirm that on-prem AD is syncing successfully to Entra ID.

**Portal:**
1. Entra → Identity → Hybrid management → Microsoft Entra Connect
2. Check: `Last sync status` → should show `Succeeded`
3. Check: `Last sync time` → should be within the last 30–40 minutes

**Healthy:** `Sync completed successfully — X minutes ago`

**Unhealthy:** `Sync has not completed` or `Last sync > 2 hours ago`

**Action if unhealthy:**
- Log in to the AD Connect server
- Open Synchronization Service Manager → look for errors in Connector Operations
- Common fix: restart the ADSync service or re-run delta sync

<details>
<summary>PowerShell — force sync and check status</summary>

```powershell
# Run on the AD Connect server
Import-Module ADSync  # Load the sync module

# Check last sync time
Get-ADSyncScheduler | Select-Object LastSyncCycleResult, LastSyncCycleStartedDate

# Force a delta sync (only syncs changes)
Start-ADSyncSyncCycle -PolicyType Delta

# After sync completes, verify result
Get-ADSyncScheduler | Select-Object LastSyncCycleResult
```
</details>

---

### HC-D02 — Entra Identity Protection — Risky Users

**What:** Check for any accounts flagged as high-risk by Entra Identity Protection.

**Portal:** Entra → Protection → Identity Protection → Risky users → filter: Risk level = High

**Healthy:** 0 unreviewed high-risk users

**Action if flagged:**
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

# If failures found — force replication
repadmin /syncall /AdeP  # Sync all partitions from all DCs
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
Intune → [device] → Delete (this removes from Intune only, does not affect the physical device)

---

## Monthly Checks

### HC-M01 — License Utilization

**What:** Compare assigned licenses against active users. Identify wasted spend.

**Portal:** admin.microsoft.com → Billing → Licenses

**Healthy:** Utilization between 85–95% (buffer for new hires, not over-licensed)

**Action:**
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

**Quick portal path:** Entra → Identity → Roles & admins → All roles → filter `Global Administrator`
→ confirm member list matches expected list on file.

---

### HC-M03 — Entra Connect Server OS + Module Health

**What:** The AD Connect server is a critical single point of failure. Keep it patched.

**Checks:**
1. Windows Update status on AD Connect server — no pending critical updates
2. Entra Connect version: Entra → Hybrid management → Entra Connect → version number
   - Compare against latest at: learn.microsoft.com/entra/identity/hybrid/connect/reference-connect-version-history
   - If > 6 months behind latest, schedule an upgrade
3. ADSync service is running: Services.msc → `Microsoft Azure AD Sync` → Status = Running

---

## Health Check Log

Use this table to track completion:

| Date | D01 Sync | D02 Risky | D03 SvcHealth | W01 NonCompliant | W02 ADRepl | M01 Licenses | Run by |
|------|----------|-----------|--------------|-----------------|-----------|-------------|--------|
| | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | — | [ADMIN_NAME] |
