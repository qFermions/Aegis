---
description: Set up a new Windows device — Entra ID join, Autopilot or manual Intune enrollment, policy/app deployment, naming convention, and post-setup verification. GUI first. Placeholders only.
---

# /new-device-setup

**Verdict:** For a new Windows device at [@Aegion], the goal is Entra ID join + Intune auto-enrollment in one shot during OOBE. Autopilot handles this automatically if the device is pre-registered; otherwise join manually during setup, then verify enrollment in Intune before handing off.

## What to check first
- **Assignment model — decide BEFORE touching the device:** dedicated (one user) or shared (2+ named users)? This drives naming, Intune primary user, and how many verification passes you owe (see Step 0).
- **Hardware facts from the device or vendor spec page only** — record model, serial/service tag, asset tag. Never infer platform (ARM vs x86), driver model, or compatibility warnings from a model code or name; verify the spec sheet (2026-06-10 lesson).
- Is the device registered in Autopilot? Check: `Intune admin center → Devices → Enrollment → Windows → Windows Autopilot devices` — search by serial number
- Is the device for a specific user already created in AD? New hire onboarding requires the AD account to exist and be synced to Entra before the device setup
- Is the device Wi-Fi only or wired? For OOBE Entra join, network connectivity is required from the first screen

## Step-by-step fix

**0. Decide the assignment model (branch point)**

| | **A — Dedicated (one user)** | **B — Shared (2+ named users)** |
|---|---|---|
| Naming | `DT-FirstName,LastName` / `LT-` | `DT-[DEPT],Shared` (or org shared standard) |
| Intune primary user | Stays = the assigned user | Don't leave the first enroller as implied owner — removing the primary user is *appropriate but not magic*: true shared-device behavior also depends on Shared PC / shared-device policy and app-assignment design. For a normal office PC shared by two named users, removing primary user + testing both profiles is usually enough; full Shared PC mode is a separate decision. |
| App assignments | User- or device-targeted | Prefer **device-targeted** so apps don't depend on who signed in first |
| Verification | One full user pass | **One full pass PER user** — the device isn't done until every assigned profile passes |

**1. Unbox + connect to network**
- Record serial/service tag, asset tag, model → inventory + ticket (offboarding and warranty start from this row)
- Plug in power and connect to the network (wired preferred for a stable first-boot experience; Wi-Fi works but may slow policy download)
- Power on — Windows will begin the Out-of-Box Experience (OOBE)

**2a. Autopilot path (device is pre-registered)**
If the device hash is already in Autopilot, OOBE will automatically detect it:
1. On the "Let's set things up for your work or school" screen, sign in with the user's Entra/M365 account: [UPN]
2. Autopilot kicks in — screen will show your org's branded setup screen (if Enrollment Status Page is configured)
3. Device joins Entra ID, enrolls in Intune, and begins downloading policies and apps automatically
4. Wait for the Enrollment Status Page to complete — do NOT skip or cancel; this ensures all required apps and policies are applied before the desktop appears
5. Device will land at the Windows desktop signed in as [FIRST_NAME] [LAST_NAME]

**2b. Manual Entra ID join (no Autopilot)**
If Autopilot is not configured, join during OOBE:
1. On the "How would you like to set up?" screen → choose **"Set up for an organization"**
2. Sign in with [UPN] — this triggers Entra ID join and Intune auto-enrollment simultaneously (if your Intune MDM scope includes "All users" or the user's group)
3. Complete OOBE — reach the Windows desktop
4. If Intune enrollment didn't auto-trigger, proceed to Step 3 (manual enrollment)

**3. Manual Intune enrollment (if not auto-enrolled)**
`Settings → Accounts → Access work or school → Connect`
1. Click **Connect** → enter [UPN] → sign in with M365 credentials
2. Choose **"Join this device to Microsoft Entra ID"** if prompted
3. Complete sign-in — device is now enrolled in Intune
4. Intune policies and required apps will begin downloading in the background (allow 15-30 min for initial sync)

**4. Wait for Intune policies + apps to deploy**
- Required apps (security tools, Office, VPN client, etc.) deploy automatically via Intune
- Allow 15-30 minutes for the full policy sync — do not hand off the device until this completes
- To manually trigger a sync: `Settings → Accounts → Access work or school → [account] → Info → Sync`

**5. Verify enrollment in Intune admin center**
`intune.microsoft.com → Devices → All devices`
- Search for the device by name or serial number
- Confirm:
  - **Compliance status:** Compliant (may show "Pending" briefly — wait up to 30 min)
  - **Enrolled by:** shows [UPN]
  - **Last check-in:** recent timestamp
  - **Management type:** MDM

**6. Install additional software**
- Required apps should be deployed via Intune automatically — check the device's Company Portal app if anything is missing
- For any manual installs not in Intune: install now before handing off
- Do not install unlicensed or unapproved software

**7. Apply the naming convention**
[@Aegion] device naming standard:
- Desktop: `DT-FirstName,LastName` (e.g., `DT-[FIRST_NAME],[LAST_NAME]`)
- Laptop: `LT-FirstName,LastName` (e.g., `LT-[FIRST_NAME],[LAST_NAME]`)

Check the current name: `Settings → System → About → Device name`

If the name is wrong, rename it — two options:

**Option A — GUI rename:**
`Settings → System → About → Rename this PC` → enter the correct name → Restart now

**Option B — PowerShell rename (faster):**

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Rename the computer to match naming convention (run as Administrator on the device)
# Replace [DEVICE_NAME] with the correct name, e.g. DT-John,Smith or LT-Jane,Doe
Rename-Computer -NewName "[DEVICE_NAME]" -Force -Restart  # renames and immediately reboots to apply the change
```

</details>

**8. Test post-setup functionality**
After the device is named and policies applied, verify the following before handoff:

- **Email:** Open Outlook — confirm mailbox loads for [UPN], no sign-in prompt
- **Teams:** Open Microsoft Teams — confirm presence shows as Available, not signed out
- **VPN:** Connect to VPN client if required for remote/branch access — confirm connection and internal resource access
- **Printers:** Add the office network printer by IP [PRINTER_IP] via `Settings → Printers & scanners → Add device`
- **OneDrive:** Confirm OneDrive is syncing the user's files (should auto-configure from Intune policy)
- **Windows Update:** `Settings → Windows Update → Check for updates` — install any pending updates before handoff

## ⚠️ Risk warning
- Do NOT skip the Enrollment Status Page during Autopilot — bypassing it can leave the device without required security policies (BitLocker, Defender, Conditional Access compliance)
- Renaming a device requires a reboot — warn the user if they're already logged in
- If Intune shows the device as "Not compliant," do not hand it off — compliance failure may block M365 access (Conditional Access enforcement). Resolve the compliance gap first
- For shared devices: "remove primary user" alone does NOT equal shared-device mode — app/policy behavior also rides Intune shared-device design (Shared PC policy, device-targeted assignments). For lab/kiosk devices, use device-only enrollment, not a personal account join

## ✅ Verification checklist
- [ ] Device visible in `Intune → All devices` with correct [DEVICE_NAME]
- [ ] Compliance status: Compliant
- [ ] Device name matches convention: `DT-[FIRST_NAME],[LAST_NAME]` or `LT-[FIRST_NAME],[LAST_NAME]`
- [ ] [UPN] can sign in to Windows without prompts
- [ ] Outlook loads and syncs mail for [UPN]
- [ ] Microsoft Teams shows [UPN] as signed in and Available
- [ ] OneDrive syncing (look for the OneDrive icon in the system tray — no red X)
- [ ] Required Intune apps installed (check Company Portal for any pending required apps)
- [ ] Windows Update: no critical updates pending
- [ ] Printer added and test page printed successfully
- [ ] Serial/service tag + asset tag logged in inventory, matches Intune
- [ ] **Shared device only:** full sign-in/MFA/OneDrive/Outlook/share/printer pass completed for EVERY assigned user, not just the first

## 📝 Jira-ready note
> Set up new Windows [desktop/laptop] for [UPN] at [@Aegion]. Steps completed: Entra ID join via [OOBE / Autopilot / manual enrollment], Intune enrollment confirmed (compliant), device renamed to [DEVICE_NAME] per naming convention, Intune policies + required apps deployed, email/Teams/OneDrive/printer tested and verified. Device handed off to user. Time spent: [X] min.
