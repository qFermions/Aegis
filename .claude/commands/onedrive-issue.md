---
description: Troubleshoot OneDrive sync — stuck files, sign-in failures, storage full, Files On-Demand, SharePoint library sync, and full reset. For file recovery/restore use /onedrive-restore. Windows GUI first. Placeholders only.
disable-model-invocation: true
---

# /onedrive-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** OneDrive sync problems almost always show a colored system tray icon with a specific error — read the icon first, it tells you exactly what's wrong. A reset clears 95% of stubborn sync issues. This command covers sync troubleshooting only. For recovering deleted or overwritten files, use **/onedrive-restore**.

## What to check first
- **How wide first** (answer-format section 2, "How wide before why"): when OneDrive or SharePoint files are reported down or unreachable, the first step fixes the scope and reads Microsoft's status together. One person or everyone? One site or all? OneDrive only, or other internet services too (does OneDrive on the web open; does a public website open on the same machine)? Then Microsoft 365 admin center → Health → Service health for OneDrive and SharePoint, and its **Issue history** tab for an incident that has just closed; when the admin center itself does not load, https://status.cloud.microsoft (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-30 to MB-32).
- With no Microsoft incident, the network and name-resolution path come before any account-level cause: the same sign-in on another network (a phone hotspot), then `nslookup` on the address the sync error names. Works elsewhere, or the name does not resolve: it is `/lan-wan` or DNS, not the account. For one person on a working network, go on to the icon and the error below.
- Right-click the OneDrive cloud icon in the system tray → what color/shape is it?
  - Blue cloud = personal OneDrive. White cloud = work OneDrive. Grey = paused/signed out. Red X = sync error. Yellow warning triangle = needs attention.
- Click the icon → open the OneDrive pane → read the error message at the top. It usually tells you exactly what's wrong.
- Is this one file/folder or the entire OneDrive? Entire sync stopped → account/auth issue. One item stuck → file conflict or path issue.
- **A smell of compromise** (answer-format section 2, rule a): thousands of files changing at once, files renamed with a strange extension, or a ransom note in a folder point to ransomware, not a sync fault. Name the escalation to the security lead or the security on-call (they need the account, the device, when the changes started, and one affected file name); no reset and no restore before they have looked, and recovery goes through `/onedrive-restore` with them.
- **Ask first** (rule d): a request to raise someone's storage quota, with no reading of what is using the space, gets one question first: "What does the storage page show as used, and which folders hold most of it?" A raised limit is for a need that reading shows.

## Step-by-step fix

**Not syncing — icon errors / sync paused**

> **PREVIEW ONLY [onedrive-sync-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Click the OneDrive tray icon → confirm it says "Up to date" or an error. If paused: click "Resume syncing."
2. Check for file-level errors: OneDrive tray icon → open the pane → look for items listed with a red icon. Hover for the error.
3. Common file errors:
   - File name too long or has illegal characters (`\ / : * ? " < > |`) → rename the file.
   - File path > 260 characters → move it to a shorter folder path.
   - File locked by another application → close the app using the file.
4. Sign out and back in: OneDrive tray icon → Settings (gear) → Settings → Account tab → Unlink this PC → sign back in with [USER@DOMAIN.COM].

**Files stuck "sync pending" / spinning arrows**

> **PREVIEW ONLY [onedrive-file-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Pause and resume: OneDrive tray → Pause syncing (2 hours) → then Resume syncing. This often unsticks the queue.
2. Check if the file is open: a file open in Word/Excel/etc. cannot sync. Close the app first.
3. Check for conflicted copies: look for files named `[filename] ([FIRST_NAME]'s conflicted copy)` — OneDrive created a second copy because of a conflict. Keep the one you want, delete the other.
4. If many files are stuck: sign out and back in (see above), or proceed to Full Reset below.

**Not signing in / grey icon (signed out)**

> **PREVIEW ONLY [onedrive-signin-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Click the OneDrive icon → Sign in → use [USER@DOMAIN.COM] → complete MFA.
2. If sign-in fails with an error: check that the M365 account is active and licensed. entra.microsoft.com → Users → [UPN] → confirm account enabled and has a license with OneDrive.
3. Reset OneDrive (see below) if sign-in still fails after confirming the account is fine.

**Storage full — can't sync new files**

> **PREVIEW ONLY [onedrive-storage-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Check quota: OneDrive tray → Settings → Account tab → shows current usage vs. limit (1 TB for Business Premium).
2. Free up space: go to onedrive.com → sign in as [USER@DOMAIN.COM] → check what's consuming storage. Empty the Recycle Bin (deleted files still count toward quota for 93 days).
3. If the user genuinely needs more than 1 TB: admin.microsoft.com → Users → [UPN] → OneDrive → Storage → set a custom value (up to 5 TB for Business Premium tenants with 5+ licensed users). Changes take up to 24 hours to reflect.

**Files On-Demand issues (files show as cloud-only, won't open offline)**

> **PREVIEW ONLY [onedrive-files-on-demand]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
- Enable Files On-Demand: OneDrive tray → Settings → Settings tab → "Save space and download files as you use them" — confirm it is checked.
- Make a file always available offline: right-click the file/folder in File Explorer → "Always keep on this device." The icon changes from a cloud to a green circle checkmark.
- Free up local space (move back to cloud-only): right-click → "Free up space." File remains accessible but downloads on demand.
- If cloud-only files won't open: confirm internet is connected. OneDrive must download the file first — allow a moment.

**SharePoint / shared library not syncing (Add shortcut to OneDrive)**

> **PREVIEW ONLY [onedrive-library-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. In a browser, go to the SharePoint library (sharepoint.com or via the Teams Files tab).
2. Click "Sync" (toolbar button) — this launches the OneDrive client and adds the library.
   - Alternatively: click "Add shortcut to OneDrive" — adds a shortcut in OneDrive/File Explorer instead of a full sync.
3. If Sync button is missing or greyed out: the SharePoint admin may have disabled external sync. admin.microsoft.com → SharePoint → Settings → OneDrive sync → confirm "Allow syncing" is enabled.
4. To stop syncing a library: OneDrive tray → Settings → Account tab → find the SharePoint library under "Folders" → "Stop sync."

**Full reset / unlink-relink (nuclear option)**

> **PREVIEW ONLY [onedrive-full-reset]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
Use when: persistent sync errors after trying everything above, or the OneDrive client is in a broken state.
1. Close OneDrive completely (tray icon → Quit OneDrive).
2. Run the reset command: Win+R → type `%localappdata%\Microsoft\OneDrive\onedrive.exe /reset` → Enter. The icon disappears — wait 60 seconds.
3. If OneDrive doesn't restart automatically: Win+R → `%localappdata%\Microsoft\OneDrive\onedrive.exe` → Enter.
4. Sign in with [USER@DOMAIN.COM] and let it re-sync. Files already on the device remain — OneDrive will reconcile them.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# PREVIEW ONLY [onedrive-client-reset] — non-executing local sync-state reset reference.
# Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\onedrive.exe" -ArgumentList "/reset"

# PREVIEW ONLY [onedrive-client-restart] — non-executing process-launch reference.
# Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\onedrive.exe"

# Check OneDrive sync status for a specific folder via the Graph API (admin check)
Connect-MgGraph -Scopes "Files.Read.All"                                                   # connect to Microsoft Graph

# Get a user's OneDrive storage quota
Get-MgUserDrive -UserId "[UPN]" | Select-Object -ExpandProperty Quota | Select-Object Used, Remaining, Total  # shows quota in bytes

# Set a user's OneDrive storage quota via SharePoint admin (run in SharePoint Online Management Shell)
# PREVIEW ONLY [onedrive-sharepoint-module-install] — a local module install needs its own concrete module/scope gate.
# Install-Module Microsoft.Online.SharePoint.PowerShell -Scope CurrentUser
Connect-SPOService -Url "https://[@Aegion_DOMAIN]-admin.sharepoint.com"                    # connect to SharePoint admin
# PREVIEW ONLY [onedrive-quota-change] — non-executing tenant storage-setting reference.
# Set-SPOSite -Identity "https://[@Aegion_DOMAIN]-my.sharepoint.com/personal/[UPN_sanitized]" -StorageQuota 5120
```
</details>

## ⚠️ Risk warning
- The full reset (`/reset`) forces OneDrive to re-inventory all files. On large OneDrives (50 GB+), this can take 30–60 minutes before sync status is accurate — warn the user not to panic if it looks empty at first.
- "Free up space" moves files to cloud-only on the device. If the user loses internet access before downloading them, the files are temporarily inaccessible locally. They are NOT deleted from OneDrive.
- Stopping sync on a SharePoint library removes the local copy from the device. The files remain in SharePoint — but the user loses offline access to them.
- For file recovery (deleted files, overwritten versions, folder restore): use **/onedrive-restore**, not this command.

## ✅ Verification checklist
- [ ] OneDrive tray icon is white cloud (work) or blue cloud (personal) and shows "Up to date"
- [ ] A test file created in the OneDrive folder syncs within 60 seconds
- [ ] User can open a cloud-only file (Files On-Demand download triggered)
- [ ] SharePoint library appears in File Explorer under OneDrive
- [ ] Storage quota shows sufficient space remaining
- [ ] Sign-in is persistent — no re-authentication prompt on next login

## 📝 Jira-ready note
> Resolved [date/time]. Troubleshot OneDrive sync for [UPN]. Action state: [read-only diagnosis / local reset separately authorized and verified / conflicted-file action separately authorized and verified / library re-add separately authorized and verified]. OneDrive read-back: ["Up to date" verified / remaining error]. Data-loss assessment: [no loss verified / unknown—escalated]. Time spent: [X] min.
