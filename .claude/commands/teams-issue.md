---
description: Troubleshoot Microsoft Teams — won't open, audio/mic, video/camera, screen share, meeting join, chat, and admin policy checks. Windows GUI first. Placeholders only.
disable-model-invocation: true
---

# /teams-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Most Teams desktop issues resolve with a cache clear or app reset. Policy-related issues (can't share screen, missing meeting features) require an admin center check. Always confirm whether the user is on new Teams (default 2024+) or classic Teams — cache paths and reset steps differ.

## What to check first
- New Teams or classic Teams? New Teams shows a toggle in the top-right. New Teams uses different cache paths and has no `/reset` flag.
- Is it affecting one user or everyone? Multiple users → check M365 Service Health: admin.microsoft.com → Health → Service health → Teams.
- Is the device compliant in Intune? A non-compliant device can silently break Teams features if a Conditional Access policy is enforcing device compliance.

## Step-by-step fix

**Won't open / crashes**

> **PREVIEW ONLY [teams-local-reset]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Kill stale Teams processes: Task Manager → end all `ms-teams.exe` (new) or `Teams.exe` (classic) processes.
2. Clear Teams cache:
   - **New Teams:** Settings → General → scroll to bottom → "Clear cache" button → restart Teams.
   - **Classic Teams:** Close Teams → open Run (Win+R) → `%appdata%\Microsoft\Teams` → delete contents of these folders: `Cache`, `blob_storage`, `databases`, `GPUCache`, `IndexedDB`, `Local Storage`, `tmp`. Restart Teams.
3. Repair / reset the app: Settings → Apps → Microsoft Teams → Advanced options → Repair (preserves data). If Repair doesn't help, use Reset (clears local data — user will need to sign in again).
4. Reinstall: uninstall Teams from Apps, then download the latest installer from teams.microsoft.com. For new Teams on managed devices, deploy via Intune if needed.

**Audio / mic not working**
1. Windows sound check: right-click the speaker icon in taskbar → Sound settings → confirm the correct Input device is selected and not muted.
2. Teams device settings: in a call or via Settings → Devices → confirm the correct microphone and speaker are selected. Test using the "Make a test call" option.
3. App permissions: Settings (Windows) → Privacy & security → Microphone → confirm "Microsoft Teams" has access enabled.
4. In-call: check the mute button in the Teams call toolbar — confirm the mic icon is not crossed out.
5. If the mic works in other apps but not Teams: sign out of Teams, clear cache (see above), sign back in.

**Video / camera not working**
1. Windows permissions: Settings → Privacy & security → Camera → confirm Teams has access.
2. Teams device settings: Settings → Devices → Camera → select the correct camera. Preview should appear.
3. Check no other app is using the camera (Zoom, Skype, etc.) — only one app can own the camera at a time.
4. Driver issue: Device Manager → Cameras → right-click → Update driver. Reboot.
5. In a meeting: confirm video is not turned off (camera icon in call toolbar).

**Screen share not working**
1. Windows permissions: Settings → Privacy & security → Screen capture (Windows 11) → confirm Teams is allowed. On Windows 10, this setting does not exist — go straight to step 2.
2. In the meeting: click Share content (rectangle with arrow icon) → confirm the window or screen appears in the list.
3. Policy block (most likely for missing share options): Teams admin center → Meetings → Meeting policies → [user's assigned policy] → confirm "Screen sharing mode" is set to "Entire screen" or "Single application." See admin center section below.
4. If sharing starts then goes black: GPU driver issue. Update display drivers via Device Manager.

**Can't join meetings**
1. Confirm the meeting link is valid — open it in a browser (Edge/Chrome) first to rule out a client issue.
2. Clear Teams cache (see Won't open section above) and retry.
3. Check lobby settings if the user keeps hitting "Someone will let you in": the meeting organizer must admit them, or a policy change is needed. Teams admin center → Meetings → Meeting policies → [policy] → "Who can bypass the lobby."
4. Time zone mismatch: confirm the user's Windows clock and Teams calendar show the meeting at the correct local time.

**Chat not sending**
1. Check network: open a browser and confirm internet access. Teams chat requires outbound HTTPS to Microsoft endpoints.
2. Clear cache (see above) — stale cache frequently causes chat delivery failures.
3. If messages appear to send but the other person doesn't receive them: sign out and back in to refresh the auth token.
4. Check if the conversation is in a channel vs. a chat — permissions differ. Channel posts may require membership.

**Admin center policy checks (admin.teams.microsoft.com)**

> **PREVIEW ONLY [teams-policy-change]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
- Meeting policies: Teams admin center → Meetings → Meeting policies → check which policy is assigned to [UPN] → review: screen sharing, recording, lobby bypass, external access.
- Messaging policies: Teams admin center → Messaging policies → check policy assigned to [UPN] → review: chat enabled, Giphy, memes, external chat.
- App permission policies: Teams admin center → Teams apps → Permission policies → confirm third-party or LOB apps are not blocked if the user is missing a specific app.
- External/guest access: Teams admin center → Users → External access — if the user can't chat with external users, check this toggle and the sender's org's settings.
- Assign policy to user: Teams admin center → Users → Manage users → [UPN] → Policies tab → Edit → assign the correct policy.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Resolve one exact Teams module version from the canonical PowerShell Gallery endpoint.
$moduleName = 'MicrosoftTeams'
$repositoryName = 'PSGallery'
$expectedRepositorySource = 'https://www.powershellgallery.com/api/v2'
$repository = Get-PSRepository -Name $repositoryName -ErrorAction Stop
if ($repository.SourceLocation.TrimEnd('/') -cne $expectedRepositorySource) { throw "PSGallery source mismatch. No module was installed." }
$moduleVersionText = Read-Host "Enter the independently reviewed exact $moduleName version (for example, 6.0.0)"
if ($moduleVersionText -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') { throw "An exact stable module version is required. No module was installed." }
$candidate = Find-Module -Name $moduleName -Repository $repositoryName -RequiredVersion $moduleVersionText -ErrorAction Stop
if ([string]$candidate.Name -cne $moduleName -or [string]$candidate.Version -cne $moduleVersionText) { throw "Module preflight did not resolve the exact requested package. No module was installed." }
# SAFETY GATE [install-teams-module]
# Target: exact $moduleName version $moduleVersionText from canonical $repositoryName
# Effect: installs one local PowerShell module without changing Teams policy
# Scope: CurrentUser on this workstation
# Reversibility: R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible through a separately reviewed Uninstall-Module action
# Read-back: none, R1: no change record
$requiredConfirmation = "INSTALL POWERSHELL MODULE $moduleName VERSION $moduleVersionText FROM $repositoryName"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm the local CurrentUser install"
if ($confirmation -ceq $requiredConfirmation) {
    Install-Module -Name $moduleName -Repository $repositoryName -RequiredVersion $moduleVersionText -Scope CurrentUser -ErrorAction Stop
    $installed = Get-InstalledModule -Name $moduleName -RequiredVersion $moduleVersionText -ErrorAction Stop
    if ([string]$installed.Version -cne $moduleVersionText) { throw "Installed-module read-back did not match the approved version." }
} else {
    throw "Confirmation did not match. No change was made."
}

# Connect to Teams
Connect-MicrosoftTeams                                                           # sign in to Microsoft Teams admin

# Check what meeting policy is assigned to a user
Get-CsOnlineUser -Identity "[UPN]" | Select-Object DisplayName, TeamsMeetingPolicy, TeamsMessagingPolicy  # shows the user's current policy assignments

# List all meeting policies in the tenant
Get-CsTeamsMeetingPolicy | Select-Object Identity, ScreenSharingMode, AllowCloudRecording  # shows all policies and key settings

# PREVIEW ONLY [teams-policy-grant] — non-executing policy-assignment reference; bind the resolved user and policy ID in a separate runbook.
# Grant-CsTeamsMeetingPolicy -Identity "[UPN]" -PolicyName "Global"

# Check if a user is enabled for Teams
Get-CsOnlineUser -Identity "[UPN]" | Select-Object DisplayName, TeamsUpgradeMode, HostingProvider  # confirms Teams mode and account status
```
</details>

## ⚠️ Risk warning
- Clearing the Teams cache logs the user out of all Teams sessions on that device — they will need to sign back in. Normal and expected.
> **PREVIEW ONLY [teams-app-reset-warning]:** The Settings → Apps → Reset action is a separate destructive local-data change; this warning does not authorize it. Capture unsent work and route the exact device/profile through the remediation preview above.
- Resetting the Teams app (Settings → Apps → Reset) clears local data including draft messages not yet sent.
- Changing meeting or messaging policies in the admin center affects all users assigned to that policy — create a new policy rather than editing the Global default if you only need to change settings for one user or department.

## ✅ Verification checklist
- [ ] Teams opens without crashing
- [ ] User can send and receive a test chat message
- [ ] Test call shows mic audio and camera preview working
- [ ] Screen share starts and displays correctly to another participant
- [ ] User can join a test meeting without hitting an unexpected lobby block
- [ ] Admin center shows the correct meeting and messaging policies assigned to [UPN]

## 📝 Jira-ready note
> Resolved [date/time]. Troubleshot Teams issue for [UPN]. Change state: [read-only diagnosis / cache or app reset separately authorized and verified / device-permission change separately authorized and verified / meeting-policy assignment separately authorized and verified]. Verification: [test call result / screen-share result / remaining failure]. Record only actions and read-backs that actually occurred. Time spent: [X] min.
