# Infrastructure Reference

Server roles, domain controller procedures, and Entra Connect operations for the hybrid
on-premises / cloud identity environment.

---

## Server Inventory

| Server | Role | OS | Location |
|--------|------|----|---------|
| AD Connect server | Entra Connect sync, on-prem AD | Windows Server | Main office |
| [@Aegion_FINANCE_SERVER] | Finance/accounting applications | Windows Server | Main office |
| Third tower | Unknown — clarify with senior IT | Unknown | Main office |

**Rule:** Never reboot or modify the AD Connect server without:
1. Verifying no sync is in progress: `Get-ADSyncScheduler | Select-Object SyncCycleEnabled`
2. Scheduling during a low-activity window (after hours)
3. Confirming the sync service comes back up after reboot

---

## Active Directory Operations

### OU Structure (Standard)
```
[@Aegion_DOMAIN_SHORT].org
├── Users
│   ├── [DEPT_OU_1]
│   ├── [DEPT_OU_2]
│   └── Disabled Users        ← offboarded accounts go here
├── Computers
│   ├── Workstations
│   └── Servers
├── Groups
│   ├── Security Groups
│   └── Distribution Groups
└── Service Accounts
```

### Creating a New User (ADUC)
See [it_support/workflows.md WF-01](../it_support/workflows.md)

### Disabling an Account (Offboarding)
See [it_support/workflows.md WF-02 Step 10](../it_support/workflows.md)

### Resetting a Password (Hybrid)
1. ADUC → find user → right-click → Reset Password
2. Set temp password → check `User must change at next logon`
3. Force sync to propagate to Entra immediately:

<details>
<summary>PowerShell — force delta sync</summary>

```powershell
# Run on the AD Connect server
Import-Module ADSync
Start-ADSyncSyncCycle -PolicyType Delta
# Wait ~3 minutes, then verify in Entra
```
</details>

---

## Entra Connect — Operations

### What It Does
Entra Connect runs on the AD Connect server and syncs:
- User accounts and attributes (name, UPN, department, manager)
- Group memberships
- Password hashes (if Password Hash Sync is enabled)
- Device objects (for Hybrid Azure AD Join)

### Sync Intervals
| Type | Interval | When to Use |
|------|----------|------------|
| Delta | Every 30 min (automatic) | Picks up changes since last sync |
| Full | Manual only | After major OU/attribute changes |
| Force Delta | Manual (`Start-ADSyncSyncCycle -PolicyType Delta`) | After urgent changes (new hire, offboard) |

### Checking Sync Status

**Portal:** Entra → Identity → Hybrid management → Microsoft Entra Connect
- `Sync Status`: should show `Enabled`
- `Last Sync`: should be < 30 min ago
- `Provisioning errors`: should be 0

**PowerShell:**
<details>
<summary>Check sync health and errors</summary>

```powershell
# Run on the AD Connect server
Import-Module ADSync

# View current scheduler state
Get-ADSyncScheduler

# View recent sync operations
Get-ADSyncConnectorRunStatus | Select-Object ConnectorName, Result, StartDate, EndDate |
    Sort-Object StartDate -Descending | Select-Object -First 20

# View any sync errors (objects that failed to sync)
Get-ADSyncCSObject -ConnectorName "[@Aegion_DOMAIN]" |
    Where-Object { $_.ErrorState -ne $null } |
    Select-Object DistinguishedName, ErrorState
```
</details>

### Common Sync Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Duplicate UPN | Two on-prem accounts with same UPN | Change one UPN in ADUC |
| Duplicate proxy address | Two accounts share same email alias | Remove duplicate alias |
| AttributeValueMustBeUnique | Usually proxyAddresses conflict | Check Entra sync errors for details |
| Object not syncing | OU not in sync scope | Add OU in Entra Connect Sync wizard |
| Access denied | ADSync service account permissions changed | Restore ADSync account permissions in AD |

### Entra Connect Upgrade Procedure

⚠️ Schedule downtime. During upgrade, sync is paused.

1. Download latest from Microsoft: aka.ms/AADConnect
2. On AD Connect server: run installer → it detects existing install → upgrade in place
3. After upgrade: verify sync resumes — check Synchronization Service Manager
4. Verify in Entra portal: Last sync time updates within 30 min

---

## Domain Controller Procedures

### Forcing a Group Policy Update

When a GPO change needs to apply immediately (don't wait for 90-min refresh cycle):

<details>
<summary>PowerShell — remote GPO refresh</summary>

```powershell
# Force GPO update on a specific remote machine
# Run from an admin workstation (RSAT required)
Invoke-GPUpdate -Computer "[DEVICE_NAME]" -Force -RandomDelayInMinutes 0
# -RandomDelayInMinutes 0 makes it run immediately instead of within a random window

# Or run locally on the target machine
gpupdate /force
```
</details>

### Checking Domain Controller Health

<details>
<summary>PowerShell — DCDiag</summary>

```powershell
# Run comprehensive DC diagnostic (run on the DC itself or with RSAT)
dcdiag /test:replications /v  # Test replication specifically
dcdiag /test:netlogon /v      # Test Netlogon service
dcdiag /v                     # Full diagnostic (verbose — run for detailed troubleshooting)
```
</details>

### Checking AD Replication

<details>
<summary>PowerShell — replication status</summary>

```powershell
# Summary of replication health across all DCs
repadmin /replsummary

# Detailed replication status
repadmin /showrepl

# Force sync from a specific DC
repadmin /syncall /AdeP
# /A = all partitions, /d = identify source, /e = enterprise (cross-site), /P = push
```
</details>

---

## Backup and Recovery Notes

| Resource | Backup Method | Recovery Path |
|----------|-------------|--------------|
| On-prem AD | Windows Server Backup (System State) | Boot from WS install media → AD DS restore |
| AD Connect server | VM snapshot (if virtualized) | Restore snapshot; sync resumes automatically |
| M365 / Exchange Online | Microsoft-managed (recycle bin, litigation hold) | EAC → compliance or Contact Microsoft |
| Intune configs | Export config profiles to JSON (Intune → Export) | Re-import JSON |
| SharePoint / OneDrive | Microsoft-managed (30-day version history) | Admin → Restore |

**Recovery time objective (RTO) targets:**
- AD Connect failure: 2 hours (sync paused, no new accounts can be created in M365)
- DC failure (secondary): 4 hours (primary DC continues; replicate back when restored)
- DC failure (primary): CRITICAL — contact senior IT immediately, invoke disaster recovery plan
