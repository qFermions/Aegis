# IT Support Workflows

Complete end-to-end procedures for the highest-frequency IT support tasks.

---

## WF-01 — New User Onboarding (Hybrid AD)

### Prerequisites
- Full name, job title, department, manager, start date confirmed
- Device type and license type decided

### Step 1 — Create Account in On-Prem Active Directory

**ADUC (GUI):**
1. Open `Active Directory Users and Computers` on the domain controller or RSAT machine
2. Navigate to the correct OU for the department
3. Right-click → New → User
4. First name: `[FIRST_NAME]` · Last name: `[LAST_NAME]`
5. User logon name: `[first.last]@[@Aegion_DOMAIN]`
6. Set a temporary password → check `User must change password at next logon`
7. Click Finish → right-click the new account → Properties → fill in:
   - General: Display name, description
   - Organization: Title, Department, Manager

<details>
<summary>PowerShell (for reference)</summary>

```powershell
# Create user in on-prem Active Directory
# Run on a machine with the RSAT AD module installed
Import-Module ActiveDirectory  # Load the AD management module

# Prompts securely; the temporary password is never embedded in script text or shell history
$TemporaryPassword = Read-Host "Enter the temporary password" -AsSecureString

New-ADUser `
  -Name "[FIRST_NAME] [LAST_NAME]" `
  -GivenName "[FIRST_NAME]" `
  -Surname "[LAST_NAME]" `
  -SamAccountName "[first.last]" `
  -UserPrincipalName "[first.last]@[@Aegion_DOMAIN]" `
  -Title "[JOB_TITLE]" `
  -Department "[DEPARTMENT]" `
  -Manager "[MANAGER_USERNAME]" `
  -Path "OU=[DEPARTMENT],DC=[@Aegion_DOMAIN_SHORT],DC=org" `
  -AccountPassword $TemporaryPassword `
  -ChangePasswordAtLogon $true `
  -Enabled $true

# Removes the in-memory variable after the account is created
Remove-Variable TemporaryPassword
```
</details>

### Step 2 — Sync to Entra ID

1. On the AD Connect server, run:

<details>
<summary>PowerShell — Force sync</summary>

```powershell
# Force Entra Connect to sync immediately (only changes, not full sync)
Import-Module ADSync           # Load the AD sync module
Start-ADSyncSyncCycle -PolicyType Delta  # Delta = only sync recent changes
```
</details>

2. Wait 3–5 minutes
3. Verify: Entra → Identity → Users → All users — confirm new account appears

### Step 3 — Assign License

1. admin.microsoft.com → Users → Active users → find `[FIRST_NAME] [LAST_NAME]`
2. Click the user → **Licenses and apps** tab
3. Check `Microsoft 365 Business Premium` (or appropriate license)
4. Click **Save changes**
5. Verify: Licenses tab shows license as `Assigned`

### Step 4 — Add to Groups

1. Entra → Identity → Groups → All groups
2. Find the department security group → Members → Add members → search `[FIRST_NAME]`
3. Add to distribution lists: EAC → Recipients → Groups → [DL name] → Members → Add

### Step 5 — Set Up MFA

1. Direct user to `aka.ms/mfasetup` after first sign-in
2. User registers Microsoft Authenticator app
3. Verify: Entra → Users → [UPN] → Authentication methods — should show at least one method

### Step 6 — Enroll Device in Intune

- **Windows:** Sign in with work account during setup → auto-enrolls if Azure AD Join is configured
- **iPhone:** See `.claude/commands/enroll-ios.md`
- **Android:** See `.claude/commands/enroll-android.md`
- Verify: Intune → Devices → All devices — device appears with user as owner
- Rename device: Intune → [device] → Rename → use format `DT-[FirstName],[LastName]` or `LT-`

### Step 7 — Assign Phone Extension (if needed)

1. [@Aegion_VOIP] admin portal → Users → Manage users → Add user
2. Assign extension number and voicemail PIN
3. Assign to user's device

### Verification Checklist
```
[ ] User appears in Entra ID
[ ] License assigned — M365 apps showing as active
[ ] User can sign in at office.com
[ ] MFA registered
[ ] Device enrolled and visible in Intune
[ ] Correct groups/DLs assigned
[ ] Phone extension active (if applicable)
[ ] Welcome email sent with temp credentials
```

---

## WF-02 — User Offboarding

⚠️ Confirm with manager and HR before proceeding. Sequence matters — follow in order.

### Step 1 — Block Sign-In (Immediate)
1. Entra → Identity → Users → `[UPN]` → Edit properties
2. `Block sign in` = Yes → Save
3. Verifies: user cannot authenticate to any M365 service

### Step 2 — Revoke Active Sessions
1. Entra → Users → `[UPN]` → Revoke sessions
2. Any active sessions (browser, Teams, Outlook) are terminated immediately

### Step 3 — Reset Password
- admin.microsoft.com → Users → `[UPN]` → Reset password → Auto-generate
- Do not share this password — it is a lockout action, not a handoff

### Step 4 — Clear MFA Methods
1. Entra → Users → `[UPN]` → Authentication methods
2. Delete all registered methods

### Step 5 — Convert or Close Mailbox
- **Convert to shared (if manager needs access):**
  EAC → Recipients → Mailboxes → `[UPN]` → Convert to shared mailbox
  Then: Delegation tab → Full Access → Add manager
- **Or set auto-reply:**
  EAC → Mailboxes → `[UPN]` → Automatic replies → enable + set message

### Step 6 — Remove Licenses
⚠️ Warning — shared mailbox remains accessible without license only up to 50 GB.
1. admin.microsoft.com → Users → `[UPN]` → Licenses and apps
2. Uncheck all licenses → Save changes

### Step 7 — Remove from Groups
1. Entra → Users → `[UPN]` → Groups → remove from all security groups and M365 groups
2. EAC → Distribution groups — remove from all DLs

### Step 8 — Transfer OneDrive
1. admin.microsoft.com → Users → `[UPN]` → OneDrive → Create link to files
2. Share link with manager or grant manager access via SharePoint admin

### Step 9 — Handle Device
⚠️ Full Wipe is irreversible. Confirm device is work-owned before wiping.
- **Work-owned:** Intune → Devices → `[device]` → Wipe → confirm
- **BYOD:** Intune → Devices → `[device]` → Retire (removes work data only)

### Step 10 — Disable On-Prem AD Account
1. ADUC → find user → right-click → Disable Account
2. Move to `Disabled Users` OU

### Verification
```
[ ] Sign-in blocked in Entra
[ ] Sessions revoked
[ ] Password reset (unknown to anyone)
[ ] MFA methods deleted
[ ] Mailbox converted/forwarded/closed
[ ] Licenses removed
[ ] Groups and DLs cleared
[ ] OneDrive transferred
[ ] Device wiped or retired in Intune
[ ] On-prem AD account disabled and moved to Disabled OU
[ ] Jira ticket updated with all steps and timestamps
```

---

## WF-03 — MFA Reset (Lost/New Phone)

1. Entra → Identity → Users → `[UPN]` → Authentication methods
2. Delete all registered methods
3. Tell user: go to `aka.ms/mfasetup` → register Authenticator on new device
4. If user can't sign in due to CA policy blocking before MFA setup:
   - Entra → Protection → Conditional Access → `[MFA policy]` → Exclusions → add user temporarily
   - Remove exclusion after MFA is re-registered (same session — do not leave open)

**Verify:** Entra → Users → `[UPN]` → Authentication methods — new method shows registered

---

## WF-04 — Password Reset

**Cloud-only user:**
1. admin.microsoft.com → Users → Active users → `[UPN]` → Reset password
2. Auto-generate → Force change at next sign-in

**Hybrid AD user (synced from on-prem):**
1. ADUC (on-prem) → find user → right-click → Reset Password
2. Set new temp password → check `User must change password at next logon`
3. Entra Connect syncs the change automatically (up to 30 min) or force sync:
   `Start-ADSyncSyncCycle -PolicyType Delta`

**User also locked out of MFA:** Run WF-03 after password reset.

---

## WF-05 — Shared Mailbox Access Grant

1. EAC → Recipients → Mailboxes → find `[SHARED_MAILBOX]`
2. Click mailbox → **Delegation** tab
3. Under **Full Access** → Add → search for `[USER_UPN]` → Save
4. Under **Send As** → Add → same user (if needed)

User will see the mailbox in Outlook within 20–30 minutes (no re-login needed after delegation syncs).

**Verify:** Have user open Outlook → File → Add account or check left nav for the shared mailbox name
