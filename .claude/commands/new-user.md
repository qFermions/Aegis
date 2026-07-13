---
description: Full new-user onboarding — AD → sync → license → MFA → mail/groups → apps → devices → site/facilities → wrap-up. Medium-depth GUI steps, why-footer, one-concept. Placeholders only.
---

# /new-user

CRITICAL: Do NOT ask for employee details, names, emails, departments, or any PII. Deliver the FULL checklist IMMEDIATELY using only placeholders. Never prompt for user information.

**Placeholders:** `[FIRST_NAME]` `[LAST_NAME]` `[UPN]` `[DEPARTMENT]` `[MANAGER_NAME]` `[TEMP_PASSWORD]` `[DEVICE_NAME]` `[EXTENSION]` `[DEPT_DL]` `[SHARED_MAILBOX]` `[PRODUCT_PROFILE]` `[LICENSE_TYPE]` `[ENROLLMENT_TOKEN_QR]` `[WORK_PHONE_DEVICE_GROUP]` — org values use the Koinon `[@Aegion_*]` dictionary.

Steps marked **[if applicable]** depend on role/department — skip with a note when they don't apply, never silently.

---

## Phase A — Identity & Licensing

### STEP 1 — Create user in on-prem AD

**Portal:** ADUC (`dsa.msc`) on a domain-joined machine

1. Correct OU → right-click → **New → User** → `[FIRST_NAME]` `[LAST_NAME]`, logon `[first.last]`
2. Temp password `[TEMP_PASSWORD]` → check **User must change password at next logon**
3. Properties → fill **Title, Department, Manager, Office** (these sync to Entra and drive dynamic groups)

<details>
<summary>PowerShell — the scale version</summary>

```powershell
# Prompts securely; the temporary password is never embedded in script text or shell history
$TemporaryPassword = Read-Host "Enter the temporary password" -AsSecureString

# Creates the AD user with all attributes in one shot
New-ADUser `
  -Name "[FIRST_NAME] [LAST_NAME]" -GivenName "[FIRST_NAME]" -Surname "[LAST_NAME]" `
  -SamAccountName "[first.last]" -UserPrincipalName "[UPN]" `
  -Title "[JOB_TITLE]" -Department "[DEPARTMENT]" -Manager "[MANAGER_SAM]" `
  -AccountPassword $TemporaryPassword `
  -ChangePasswordAtLogon $true -Enabled $true `
  -Path "OU=Staff,DC=[ORG],DC=[TLD]"   # OU must be inside Entra Connect sync scope

# Removes the in-memory variable after the account is created
Remove-Variable TemporaryPassword
```
</details>

✅ Verify: account appears in ADUC, enabled, in a synced OU.
**Why:** Hybrid identity — on-prem AD is the source of authority; everything downstream (Entra, license, mailbox) hangs off this object.

### STEP 2 — Sync to Entra ID

**Portal:** AD Connect server → forced delta sync lands in **3–5 min**; the natural cycle is **~30 min**.

<details>
<summary>PowerShell — force delta sync (run ON the AD Connect server)</summary>

```powershell
Start-ADSyncSyncCycle -PolicyType Delta   # pushes only changed objects (fast)
```
</details>

✅ Verify: admin.microsoft.com → Users → Active users → user shows as **Unlicensed**. Absent after 10 min post-force → OU sync scope (T-02).
**Why:** Entra Connect copies the AD object to the cloud; nothing in M365 exists until this lands.

### STEP 3 — Assign M365 Business Premium license

**Portal:** admin.microsoft.com → Users → Active users → user → **Licenses and apps** → check **Business Premium** → Save

✅ Verify: mailbox provisions within ~10 min (Exchange admin → Mailboxes).
**Why:** The license is what materializes the mailbox, OneDrive, Teams, and Intune enrollment rights. Direct OR group-based — never both (removal conflicts later).

### STEP 4 — MFA registration (admin side)

**Portal:** user self-registers at **aka.ms/mfasetup** (Microsoft Authenticator) at first sign-in.
SMS fallback: entra.microsoft.com → Users → `[UPN]` → **Authentication methods** → **+ Add method** → Phone.

✅ Verify: Authentication methods shows Authenticator (+ phone fallback) after first sign-in.
**Why:** CA policies block un-registered users from apps — registration before day one prevents the classic first-morning lockout ticket.

---

## Phase B — Groups, Mail & Collaboration

### STEP 5 — Security groups

**Portal:** on-prem-synced groups → add in **ADUC** (cloud edits get overwritten). Cloud groups → entra.microsoft.com → Groups → `[DEPT]` group → Members → Add.

✅ Verify: Entra → user → Groups shows the full set after sync.
**Why:** Groups drive shares, app access, and Intune assignments — wrong source = membership silently reverts at next sync.

### STEP 6 — Distribution lists + M365 groups

**Portal:** Exchange admin (admin.exchange.microsoft.com) → **Groups** → `[DEPT_DL]` → Members → Add `[UPN]`. On-prem-synced DLs → add in ADUC instead.

✅ Verify: send a test message to `[DEPT_DL]`; user receives it.
**Why:** DLs/M365 groups are mail-routing objects — distinct from security groups even when names match.

### STEP 7 — Shared-mailbox delegation **[if dept uses one]**

**Portal:** Exchange admin → Mailboxes → `[SHARED_MAILBOX]` → **Delegation** → **Full Access** → Add `[UPN]` (+ **Send As** if the dept sends from it).

✅ Verify: mailbox auto-maps in user's Outlook within ~1 hr.
**Why:** Full Access = read; Send As = outbound identity. Granting both when only read is needed over-privileges.

### STEP 8 — SharePoint / Teams department access

**Portal:** check which mechanism drives membership FIRST — if the dept Team/site is group-connected, Step 5/6 already granted it. Otherwise: `[DEPT]` site → Settings → **Site permissions** → Add members.

✅ Verify: user opens the dept site/Team. **Never double-grant** (direct + group) — orphaned direct grants survive offboarding.
**Why:** Group-connected sites inherit membership; direct grants are invisible to group audits.

### STEP 9 — Email signature

**Portal:** apply the org-standard signature (template in the IT intro doc) — user pastes into Outlook → Settings → Signatures, or it deploys via the org's signature mechanism.

✅ Verify: test email shows the standard block.
**Why:** Outbound mail is org-branded from message one — retrofitting signatures after externals have the wrong one is a losing game.

---

## Phase C — Comms & Per-Role Apps

### STEP 10 — [@Aegion_VOIP] extension

**Portal:** [@Aegion_VOIP_URL] → Users → **Add user** → name, `[UPN]`, `[EXTENSION]`, voicemail PIN.

⚠️ Check the user's **site migration status** first — [@Aegion_SITE_2] / [@Aegion_SITE_3] are still mid-migration; confirm the site is live on [@Aegion_VOIP] before provisioning.

✅ Verify: test call in and out of `[EXTENSION]`.
**Why:** [@Aegion_VOIP] = the **phone system**. Zoom (next step) = **meetings**. Different systems, both needed.

### STEP 11 — Zoom account

**Portal:** Zoom admin → **User Management** → Add user → `[UPN]` → assign `[LICENSE_TYPE]`.

✅ Verify: user accepts the invite email and signs in.
**Why:** Meetings ride Zoom, not the VoIP platform — provisioning one doesn't create the other.

### STEP 12 — Adobe **[if role needs it]**

**Portal:** adminconsole.adobe.com → Users → **Add user** → `[UPN]` → assign `[PRODUCT_PROFILE]`. User installs apps via **Creative Cloud** after the invite email.

✅ Verify: user signs into Creative Cloud and the profile's apps are installable.
**Why:** Adobe licensing is per product profile — the invite without a profile gives a login with no apps.

### STEP 13 — Conditional per-role accounts **[if applicable at your org]**

- **1Password** — confirm rollout state (dept heads vs all staff) before seating.
- **Timesheet / HR app** — confirm whether IT or HR provisions; if IT, create the account per that system's admin guide.
- **Department LOB / program apps** — per-dept conditional; check the dept's app list with the manager.
- **Room/resource mailbox access** — Exchange admin → Resources → booking permissions, if the dept books rooms.

✅ Verify: each provisioned account gets a first-login test; each skipped one gets a "N/A — [reason]" note in the ticket.
**Why:** Per-role apps are where onboarding checklists rot — explicit skip-notes keep the ticket auditable.

---

## Phase D — Devices

### STEP 14 — Windows device (Intune)

**Steps:** sign into the PC with `[UPN]` during OOBE (Entra join → auto-enroll), or Settings → Accounts → **Access work or school** → Connect.

1. Rename to convention: intune.microsoft.com → Devices → `[DEVICE_NAME]` → **Rename** → `DT-[FirstName],[LastName]` / `LT-[FirstName],[LastName]`
2. Confirm required apps (Outlook, Teams, Company Portal) deploy from existing group assignments

✅ Verify: device shows **Compliant** in Intune; **OneDrive Known Folder Move** is redirecting Desktop/Documents (OneDrive icon → Settings → Sync and backup → Manage backup, all three ON).
**Why:** Compliance gates CA access; KFM is the difference between "device died, restored from cloud" and "device died, files gone."

### STEP 15 — Mobile phone setup — **required for EVERY hire**

Every staff member runs MFA from a phone — pick the path, never skip the step:

**Path A — Corporate work phone (Android/MDM) [if role gets one]. Order matters — enroll FIRST, group SECOND:**

1. Factory-fresh (or factory-reset) device → during setup, scan `[ENROLLMENT_TOKEN_QR]` → device enrolls to Intune as corporate-owned
2. **THEN** add the device to `[WORK_PHONE_DEVICE_GROUP]` — this membership is what triggers assigned apps to auto-deploy via **managed Google Play**

**Path B — BYOD personal phone (everyone else):**

1. Install **Microsoft Authenticator** from the public store FIRST (Step 4's MFA registration happens on it)
2. Install **Outlook** (+ Teams if the role needs it) → sign in with `[UPN]` → Intune app-protection (MAM) policies apply to the work account automatically
3. Full BYOD enrollment via **Company Portal** only if org policy requires it for the role (deep flow: `/enroll-device`)

✅ Verify: Authenticator registered + Outlook loads mail on the phone. Path A additionally: assigned apps present + device **Compliant** in Intune.
**Why:** A hire with no mobile setup hits the first CA prompt with nowhere to approve it — that's the day-one lockout ticket. Corp phones get full MDM; personal phones get MAM so work data is containerized without managing the whole device. App assignments target the device group; a device added before it exists in Intune gets nothing — group-after-enroll is what fires the pushes.

---

## Phase E — Site & Facilities

### STEP 16 — Network drives / file shares

**Steps:** map the `[DEPARTMENT]` shares per the drive-mapping standard (GPO or manual).
**Finance hires:** [@Aegion_FINANCE_SERVER] access goes through **senior IT approval** — request it, don't grant directly.

✅ Verify: user opens each mapped drive.
**Why:** Share ACLs ride the security groups from Step 5 — if a drive won't map, check group membership before NTFS permissions.

### STEP 17 — Printers (per site)

**Steps:** add the user's site printers (print server or direct-IP per site standard).

✅ Verify: test page from the user's profile.
**Why:** Printers are per-site/VLAN — a profile copied from another site prints into the void.

### STEP 18 — Wi-Fi (staff SSID)

**Steps:** join the device to the staff SSID at the user's site (credentials per site standard — never write the PSK in the ticket).

✅ Verify: device on staff VLAN (Meraki dashboard → Clients shows it on the right network).
**Why:** Guest SSID is internet-only — a "can't reach the share" ticket on day one is usually this.

### STEP 19 — Client VPN **[remote-capable roles only]**

**Steps:** provision Meraki client VPN access per the remote-access standard. **Do NOT provision the legacy remote tool — it is being retired.**

✅ Verify: user connects from off-site and reaches the dept share.
**Why:** Remote access is role-gated, not default — every standing VPN account is attack surface.

### STEP 20 — Alarm code ([@Aegion_ALARM])

**Steps:** request a per-site user code via the **office manager** (provisioning is coordinated there, not direct). ⚠️ System is **mid-upgrade** (landline → internet monitoring) — confirm the site's current state before promising a working code.

✅ Verify: office manager confirms the code is active for the user's site.
**Why:** Physical security changes are coordinated, never assumed — the vendor relationship runs through facilities.

### STEP 21 — Badge / door access **[if applicable at your org]**

**Steps:** request via the owning party (facilities/office manager) for the user's site(s).

✅ Verify: user badges in on day one.
**Why:** Door access usually lives outside IT's systems — the step exists so the handoff is explicit, not assumed.

---

## Phase F — Wrap-Up

### STEP 22 — Jira Service Management customer

**Portal:** JSM → the [@Aegion_JIRA_SPACE] service desk → **Customers** → Add `[UPN]` (required — every staff member must be able to submit tickets).

✅ Verify: user can open the help portal and raise a test request.
**Why:** A new hire who can't file a ticket reports problems by hallway — the queue only works if everyone's in it.

### STEP 23 — Asset inventory

**Steps:** log `[DEVICE_NAME]`, serial, asset tag, and assigned user in the inventory (even if it's a spreadsheet today — the habit is the point).

✅ Verify: inventory row exists and matches Intune.
**Why:** Offboarding, warranty, and insurance all start from "what do they have" — unlogged assets never come back.

### STEP 24 — Welcome email + credentials

Send to the user's **personal email**: work email `[UPN]`, first sign-in at office.com, MFA instructions (install **Microsoft Authenticator** first), `[EXTENSION]` + Unite app note.
⚠️ Deliver `[TEMP_PASSWORD]` via a **separate channel** (phone/SMS) — never username and password in one message.

✅ Verify: user confirms receipt before day one.
**Why:** One intercepted email containing both halves of a credential is a full compromise.

### STEP 25 — Manager notification + day-1 IT intro

**Steps:** notify `[MANAGER_NAME]` the account is live; send/attach the IT intro doc (how to reach IT, JSM portal, signature template, MFA expectations).

✅ Verify: manager acknowledges; intro doc delivered.
**Why:** The manager is the first escalation path on day one — they need to know what "ready" includes.

### STEP 26 — First sign-in verification

- [ ] User signs in at office.com → password change + MFA registration succeed
- [ ] Outlook + Teams load mail/chat
- [ ] Dept share, printer, and SharePoint site reachable
- [ ] Test call to `[EXTENSION]` rings through; Zoom sign-in works
- [ ] Device(s) **Compliant** in Intune; KFM redirecting

**Why:** "Provisioned" and "working" are different claims — only the user's first session proves the second.

---

## ✅ Completion checklist

- [ ] AD account created (synced OU, attributes filled) → synced to Entra
- [ ] License assigned · MFA registered (+ SMS fallback)
- [ ] Security groups · DLs/M365 groups · shared-mailbox delegation [or N/A]
- [ ] SharePoint/Teams access (mechanism verified, no double-grant)
- [ ] Signature · [@Aegion_VOIP] `[EXTENSION]` · Zoom · Adobe [or N/A] · per-role apps [or N/A noted]
- [ ] Windows device enrolled, named, compliant, KFM on · mobile set up (corp: enrolled→grouped / BYOD: Authenticator + Outlook MAM) — never N/A
- [ ] Drives · printers · Wi-Fi · VPN [role-gated] · alarm code · badge [or N/A]
- [ ] JSM customer added · asset logged · welcome email + split-channel credentials · manager notified
- [ ] First sign-in verified end-to-end · Jira ticket logged

## 📝 Jira-ready note

> Onboarding completed for [FIRST_NAME] [LAST_NAME] ([DEPARTMENT]), start [START_DATE]. Identity: AD→Entra synced, Business Premium, MFA registered. Access: groups/DLs/[SHARED_MAILBOX]/SharePoint per dept. Comms: [@Aegion_VOIP] ext [EXTENSION], Zoom, [Adobe/per-role apps or N/A]. Devices: [DEVICE_NAME] compliant + KFM; mobile [corp phone enrolled + app-grouped / BYOD Authenticator + Outlook MAM]. Site: drives/printers/Wi-Fi[/VPN], alarm code via office manager. JSM customer added; asset logged; credentials delivered split-channel. First sign-in verified.

---

🧠 **Why this order:** identity (A) must exist before anything can attach to it; the license (A) materializes the mailbox and OneDrive that groups and delegation (B) point at; groups (B) come before devices (D) because compliance policies and app assignments target group membership; the work-phone group add comes **after** enrollment because that membership change is the app-deployment trigger; facilities (E) run in parallel but close before day one; wrap-up (F) is what makes the work provable. Skipping ahead doesn't fail loudly — it fails as day-one tickets.

🎓 **One new concept — source of authority:** in a hybrid tenant, every synced attribute has exactly one writable home (here: on-prem AD). Anything you edit on the wrong side looks fixed until the next sync cycle silently reverts it. Before editing any synced object, ask "who owns this attribute?"
