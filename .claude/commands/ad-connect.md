---
description: Troubleshoot Entra Connect (AD Connect) sync — check sync status, user not appearing in M365, force delta or full sync, common errors, password hash sync, and server health. GUI first. Placeholders only.
---

# /ad-connect

**Verdict:** AD Connect is the source of authority for synced users — if a user isn't appearing in M365 or attributes are wrong, check the Entra admin center sync status first, then look at the Synchronization Service Manager on the AD Connect server for the specific error before touching anything.

## What to check first
- When did the last sync run? `Entra admin center → Identity → Hybrid management → Microsoft Entra Connect → Sync status` — check "Last sync" timestamp. If it's more than 40 minutes ago, sync may be stuck
- Is this a new user who never appeared, or an existing user who disappeared / has wrong attributes? New = check OU scoping. Disappeared = check for errors or accidental move in AD
- Is the AD Connect server online? It needs network access to both on-prem AD and the Microsoft 365 endpoints

## Step-by-step fix

---

**1. Check sync status in the Entra admin center (portal first)**

`entra.microsoft.com → Identity → Hybrid management → Microsoft Entra Connect`
- **Sync status panel:** shows last successful sync time and whether sync is enabled
- **Sync errors:** any objects with errors appear as a count — click through to see which users/groups have attribute conflicts
- **Password hash sync:** confirm it shows "Enabled" if password writeback or hash sync is in use

`entra.microsoft.com → Identity → Hybrid management → Microsoft Entra Connect → Connect sync`
- Check the health of the connector — green = healthy, amber/red = error state

---

**2. User not appearing in M365 after creation in AD**

Most likely causes (check in order):
1. **Sync hasn't run yet** — default interval is ~30 min. Force a delta sync (Step 4 below) if urgent
2. **User's OU is not in the sync scope** — AD Connect only syncs OUs you've selected during setup. If the user is in a new or excluded OU, they won't sync
3. **Missing required attribute** — `userPrincipalName` must match the verified domain in M365. Check the user's UPN in ADUC: it must end in `@[@Aegion_DOMAIN]` (not the internal .local domain)
4. **Attribute conflict** — if a cloud-only user with the same UPN or ProxyAddress already exists in M365, the sync will silently fail for that object

**Fix for OU scoping:**
- Open **Azure AD Connect wizard** on the AD Connect server → **Customize synchronization options** → **Domain/OU Filtering** → check that the new user's OU is ticked → save → run a delta sync

**Fix for UPN mismatch:**
- In ADUC: right-click the user → Properties → **Account** tab → User Logon Name — ensure it reads `[UPN]@[@Aegion_DOMAIN]`, not `[UPN]@[internal-domain.local]`

---

**3. Check Synchronization Service Manager (on the AD Connect server)**

Log onto the AD Connect server → open **Synchronization Service Manager** (`Start → Synchronization Service`)

- **Operations tab:** shows the last 100 sync runs with status (Success / Warning / Error)
  - Click any failed run → view the error detail pane at the bottom
  - Common status values: `success` · `stopped-extension-dll-exception` · `stopped-server-down` · `export-attribute-flow-precondition-error`
- **Connectors tab:** two connectors — the on-prem AD connector and the Azure AD (M365) connector. Both should show a recent successful run time

---

**4. Force a manual delta sync (run this for urgent user additions)**

`Start → Windows PowerShell (as Administrator)` on the AD Connect server:

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Import the ADSync module so the cmdlets are available in this session
Import-Module ADSync  # loads the AD Connect PowerShell module installed on the sync server

# Run a delta sync — only processes objects changed since the last sync (fast, ~1-5 min)
Start-ADSyncSyncCycle -PolicyType Delta  # use this for 99% of cases: new users, attribute changes, group updates

# Check the current sync scheduler settings (shows last run time and next scheduled run)
Get-ADSyncScheduler  # output shows: SyncCycleEnabled, NextSyncCyclePolicyType, LastSyncTime
```

</details>

Allow 2-5 minutes for the delta sync to complete. Then check Entra admin center → Users for the new user. If the user still doesn't appear after a delta sync, check the Synchronization Service Manager for errors (Step 3).

---

**5. Force a full / initial sync (use sparingly)**

A full sync re-evaluates ALL objects in scope — it is slow (can take 30-60+ min on large directories) and should only be used when:
- The AD Connect configuration has changed (new OU added to scope, connector reconfigured)
- Persistent sync errors that delta syncs aren't clearing
- After a disaster recovery / rebuild of the AD Connect server

**Do NOT run a full sync** to fix a single missing user — a delta sync is always sufficient and far faster.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Import-Module ADSync  # load the AD Connect module

# Run a full initial sync — processes EVERY object in the sync scope (slow; use only when needed)
Start-ADSyncSyncCycle -PolicyType Initial  # re-evaluates all users, groups, contacts in scope; expect 30-60+ min on large directories
```

</details>

---

**6. Common sync errors and fixes**

| Error | Cause | Fix |
|-------|-------|-----|
| `AttributeValueMustBeUnique` — duplicate `proxyAddresses` | Two AD objects have the same email alias | Find and remove the duplicate alias from one object in ADUC → Attribute Editor |
| `InvalidSoftMatch` / `ObjectTypeMismatch` | Cloud-only user and synced user have the same UPN | Hard-match using `ImmutableID`; or delete the cloud-only user if it was a placeholder |
| `Export-AttributeFlow-Precondition-Error` | Required M365 attribute missing (often UPN or `mail` attribute) | Populate the missing attribute in ADUC |
| `stopped-server-down` | AD Connect can't reach on-prem AD or M365 endpoints | Check AD Connect server network; confirm outbound HTTPS to `*.microsoftonline.com` is not blocked |
| `DataValidationFailed` — UPN not in a verified domain | User's UPN uses an unverified domain suffix | Change UPN in ADUC to `@[@Aegion_DOMAIN]` (the verified domain) |

---

**7. Password hash sync issues**

If users can't sign in to M365 with their AD password despite sync being healthy:

1. Confirm Password Hash Sync is enabled: `Entra admin center → Hybrid management → Entra Connect → Password hash sync` → should show "Enabled"
2. Force a password hash sync cycle on the AD Connect server:

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Import-Module ADSync  # load the AD Connect module

# Force an immediate password hash sync for all users (safe, non-destructive)
Invoke-ADSyncCSObjectPasswordHashSync -ConnectorName "[@Aegion_DOMAIN]"  # replace the connector name with your on-prem AD connector name as shown in Synchronization Service Manager

# Alternatively — check the Password Hash Sync status
Get-ADSyncAADPasswordSyncConfiguration -SourceConnector "[@Aegion_DOMAIN]"  # shows whether PHS is enabled on the connector
```

</details>

3. If PHS shows enabled but passwords still fail: check that the AD Connect service account has the **Replicating Directory Changes** and **Replicating Directory Changes All** permissions on the domain root in Active Directory

---

**8. AD Connect server health checks**

Check these directly on the AD Connect server:

- **Windows Event Viewer → Application log:** filter by Source = "ADSync" — look for Error or Warning events
- **Windows Event Viewer → System log:** check for service failures (`Microsoft Azure AD Sync` service should be Running at all times)
- **Services.msc:** confirm `Microsoft Azure AD Sync` service is Running and set to Automatic start
- **Disk space:** AD Connect stores sync logs — confirm the server has sufficient free disk space (low disk can stop the service)
- **Connectivity test:** from the server, browse to `https://login.microsoftonline.com` — if it fails, there's a network/firewall issue blocking the sync

**Sync log locations:**
- Application Event Log (Event Viewer → Windows Logs → Application)
- `C:\ProgramData\AADConnect\` — verbose trace logs (useful for deep diagnostics; only needed when Microsoft Support requests them)

---

**9. Checking sync scope (which OUs are included)**

If you suspect a new OU is missing from sync:
- On the AD Connect server: open the **Azure AD Connect** wizard → **Configure** → **Customize synchronization options** → **Domain/OU Filtering**
- Confirm all OUs containing staff accounts are ticked
- Add any missing OU → save → run a delta sync (Step 4)

## ⚠️ Risk warning
- **Full sync (Initial) during business hours** will generate significant load on AD and the sync server — schedule during off-hours or low-traffic periods
- **Do not stop the `Microsoft Azure AD Sync` service** mid-cycle — it can leave the sync connectors in an inconsistent state
- **Deleting objects in Entra** that should be synced from AD will cause re-creation issues — always fix at the AD source, not in Entra
- Modifying the AD Connect configuration (connector rules, OU scoping) should go through a change-control plan — route through Nova before making rule changes in production

## ✅ Verification checklist
- [ ] Entra admin center → Hybrid management shows: Last sync < 40 min ago, no sync errors
- [ ] Synchronization Service Manager → Operations tab: latest run shows "Success" on both AD and Azure AD connectors
- [ ] New user appears in `entra.microsoft.com → Users` with correct display name, UPN, and attributes
- [ ] User's UPN ends in `@[@Aegion_DOMAIN]` (not `.local` or unverified domain)
- [ ] `Get-ADSyncScheduler` shows `SyncCycleEnabled = True` and `NextSyncCyclePolicyType = Delta`
- [ ] `Microsoft Azure AD Sync` Windows service is Running and set to Automatic
- [ ] No Event Viewer errors in the Application log for source "ADSync" in the last 24 hours

## 📝 Jira-ready note
> Investigated AD Connect sync issue at [@Aegion]. Checked: Entra admin center sync status, Synchronization Service Manager operations/error log, AD connector health. Root cause: [CAUSE e.g. "user OU excluded from sync scope / duplicate proxyAddresses / PHS not enabled"]. Fix applied: [ACTION e.g. "added OU to sync scope, ran delta sync via Start-ADSyncSyncCycle -PolicyType Delta"]. Verified: user [UPN] now visible in Entra, last sync timestamp current, no errors in Sync Service Manager. Time spent: [X] min.
