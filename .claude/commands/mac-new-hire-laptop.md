---
description: Set up a new hire's MacBook end to end in an Apple Business + Jamf + Okta + Google shop — Apple Business assignment, Jamf PreStage, first boot and Setup Assistant, FileVault and key escrow, then Okta and Google sign-in — with a WAIT UNTIL at every hand-off. Placeholders only.
disable-model-invocation: true
---

# /mac-new-hire-laptop

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[FIRST_NAME]` `[LAST_NAME]` (the new hire) · `[START_DATE]` · `[SERIAL_NUMBER]` (the Mac's serial, from the box label) · `[DEVICE_NAME]` (the computer name Jamf Pro will record) · `[UPN]` (their Okta username) · `[USER@DOMAIN.COM]` (their Google address) · `[@Aegion_JAMF_URL]`, `[@Aegion_OKTA_ORG_URL]` and other org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- **The order is the point.** The Apple Business assignment must exist BEFORE the Mac is powered on, the Mac must be in the PreStage scope BEFORE Setup Assistant reaches the enrollment pane, and the identity accounts must be active BEFORE the hand-off. A Mac that completes Setup Assistant unassigned is not enrolled, and this runbook cannot repair that.
- Two state changes carry their own exact-phrase gates: the Apple Business device-management assignment and a PreStage scope edit. Everything else here is read-only, or happens on the device inside Setup Assistant.
- Never use **Release from Organization** in Apple Business while working this ticket — Apple's dialog makes you confirm it cannot be undone, and a released Mac can no longer be assigned to Jamf.
- Not done until every read-back in the final checklist passes.

## Inputs needed

- `[SERIAL_NUMBER]` of the Mac (box label, or the Apple Business inventory row).
- `[START_DATE]`, `[UPN]` and `[USER@DOMAIN.COM]` for `[FIRST_NAME] [LAST_NAME]`.
- The name of the Jamf device management service as Apple Business lists it, and the name of the new-hire PreStage enrollment — **[org gap — confirm before Phase A]**.
- Which first-login flow this shop uses: Platform SSO with Okta (Desktop Password Sync or a Secure Enclave-backed key) or a plain local account with Okta Verify afterwards — **[org gap]**.
- Whether the Google account is provisioned from Okta or created in the Admin console — **[org gap]**.
- The Mac naming convention for `[DEVICE_NAME]` — **[org gap]** (the Windows `LT-FirstName,LastName` rule is not documented for Macs).

## How the systems hang together

- **Apple Business (formerly Apple Business Manager)** owns the device record. Apple's rule: "You need to assign a device to a device management service so that Setup Assistant displays the pane to enroll the device in that service." A Mac bought from Apple, an Apple Authorized Reseller or an authorized carrier under the organization's account is already in the inventory; one bought anywhere else is added with Apple Configurator first.
- **Jamf Pro** holds an Automated Device Enrollment instance (a server token from Apple Business, valid for one year after upload) and a PreStage enrollment that decides what Setup Assistant does: which instance, which panes are skipped, which configuration profiles and packages land before Setup Assistant finishes. Jamf syncs with Apple every two minutes. Automated Device Enrollment is the only enrollment method that stops the user removing the MDM profile.
- **FileVault** is turned on during Setup Assistant by default on a Mac with macOS 26.4 or later; the device management service can hold the Mac in Setup Assistant until FileVault is on and the personal recovery key is escrowed. Jamf escrows the key through a FileVault configuration profile with **Escrow Personal Recovery Key** selected; a profile that forces FileVault in Setup Assistant must ship inside the PreStage and needs macOS 14 or later.
- **Okta** is the identity source; the Google account is a service-provider account that Okta may provision. If Platform SSO is deployed, an Okta sign-in window replaces the Create a Computer Account step at first boot (Okta requires Automated Device Enrollment for that on macOS 26 or later).

## Fast path

1. Phase A — Apple Business: **WAIT UNTIL** the Mac is visible, then assign it to the Jamf device management service (R1 gate). **WAIT UNTIL** the assignment shows on the row.
2. Phase B — Jamf Pro: read the token and the PreStage. **WAIT UNTIL** the Mac is in the PreStage scope (automatic, or an R1 gated scope edit).
3. Phase C — on the Mac: Setup Assistant. **WAIT UNTIL** the enrollment pane appears, then **WAIT UNTIL** Setup Assistant finishes with FileVault on.
4. Phase D — Jamf read-backs: **WAIT UNTIL** the inventory record exists, then **WAIT UNTIL** FileVault reads Enabled with a Valid escrowed key.
5. Phase E — identity: **WAIT UNTIL** the Okta account is Active and the Google account exists, hand the Mac over, and **WAIT UNTIL** the user signs in.

## Phase A — Apple Business: device visible, then assigned (BEFORE the Mac is powered on)

**Purpose** — without this assignment Setup Assistant never shows the enrollment pane, and the Mac becomes a consumer laptop that merely looks set up.

**Read first (R0):** Apple Business → Devices → Inventory → search `[SERIAL_NUMBER]` → read the device row and its current device management assignment.

**WAIT UNTIL** the Mac is visible in Apple Business. If it was bought outside Apple, an Apple Authorized Reseller or an authorized carrier, it has to be added with Apple Configurator for iPhone or Apple Configurator for Mac first — that intake is the jamf-enroll-mac runbook's job, not this one's (Apple gives such a device a 30-day provisional period in which the user can release it). Do not power the Mac on until it is listed.

If the row already names the Jamf device management service, skip the gate and go to Phase B.

<!-- SAFETY GATE [mac-new-hire-laptop-assign-portal] -->
- **Target:** [SERIAL_NUMBER] in Apple Business
- **Effect:** assign the Mac to the Jamf device management service so Setup Assistant shows the enrollment pane
- **Scope:** one device record; nothing changes on the Mac itself until it boots
- **Reversibility:** R1 — Apple Business → Devices → Inventory → the same device → Unassign Device Management, or reassign it to another service, under its own phrase; never Release from Organization, which cannot be undone
- **Required confirmation:** Type exactly `ASSIGN [SERIAL_NUMBER] TO JAMF DEVICE MANAGEMENT`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mac-new-hire-laptop-assign-portal]:** Only after the exact match:
1. Apple Business → Devices → Inventory → select `[SERIAL_NUMBER]` → **Assign Device Management** → choose the Jamf device management service → **Continue** → **Confirm**.
2. Read the row back: the device management column now names the Jamf service.

**WAIT UNTIL** Apple Business shows the Jamf service on the device row. Only then move to Phase B.

**Verification checkpoint** — [ ] `[SERIAL_NUMBER]` listed in Apple Business · [ ] the row names the Jamf device management service.

## Phase B — Jamf Pro: token alive, Mac in the PreStage scope

**Purpose** — the PreStage turns "enrolled" into "configured": it chooses the Automated Device Enrollment instance, the Setup Assistant panes, the FileVault profile and (if used) the Platform SSO profile.

**Read first (R0):**
- Jamf Pro → Settings → Global → Automated Device Enrollment → read the instance and its token expiry. A server token is valid for one year after it is uploaded and saved; an expired token stops new enrollments.
- Jamf Pro → Computers → PreStage enrollments → the new-hire PreStage → read the General payload: the Automated Device Enrollment instance, whether **Automatically assign new devices** is selected, and which Setup Assistant panes are skipped.
- Same PreStage → read the Configuration profiles payload: the FileVault profile (Force Enable In Setup Assistant needs macOS 14 or later and must be delivered through a PreStage) and the Platform SSO profile if this shop uses one — **[org gap]**.
- Same PreStage → **Scope** → read whether `[SERIAL_NUMBER]` is listed.

**WAIT UNTIL** `[SERIAL_NUMBER]` appears in the PreStage's device list. Jamf Pro syncs with Apple every two minutes, so allow a few minutes after Phase A. With **Automatically assign new devices** selected the Mac is in scope as soon as it syncs — skip the gate.

<!-- SAFETY GATE [mac-new-hire-laptop-prestage-scope-portal] -->
- **Target:** [SERIAL_NUMBER] in the new-hire PreStage enrollment
- **Effect:** add the Mac to the PreStage enrollment scope so it receives this PreStage at first boot
- **Scope:** one device in one PreStage; other devices and the PreStage payloads are untouched
- **Reversibility:** R1 — Jamf Pro → Computers → PreStage enrollments → the same PreStage → Edit → Scope → untick the device → Save, under its own phrase; the next Apple sync reflects it within minutes
- **Required confirmation:** Type exactly `ADD [SERIAL_NUMBER] TO PRESTAGE SCOPE`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mac-new-hire-laptop-prestage-scope-portal]:** Only after the exact match:
1. Jamf Pro → Computers → PreStage enrollments → the new-hire PreStage → **Edit** → **Scope** → tick `[SERIAL_NUMBER]` → **Save**.
2. Read the Scope tab back: `[SERIAL_NUMBER]` is listed. Saving syncs the settings with Apple.

**Gotcha** — Jamf warns that continuously editing and saving a PreStage causes syncing delays. Save once.

**Verification checkpoint** — [ ] token not expired · [ ] `[SERIAL_NUMBER]` in the PreStage scope · [ ] FileVault profile present in the PreStage's Configuration profiles payload.

## Phase C — On the Mac: first boot and Setup Assistant

**Purpose** — the enrollment pane is the proof that Phases A and B worked; everything after it is driven by the PreStage.

1. Unbox, power on, and connect to a network with internet access. Jamf's requirement: the Mac must have internet access during Setup Assistant so it can check in with Jamf Pro and receive the initial configuration. Use Ethernet or the office Wi-Fi password — the Wi-Fi configuration profile is not on the Mac yet.
2. Advance through the language and region panes the PreStage did not skip.
3. **WAIT UNTIL** the Remote Management pane appears, naming the organization and the Jamf service. Done when: the Mac states it will be managed and continues into enrollment.
   - If it never appears: STOP. Do not create a local account. Power the Mac off and go back to Phases A and B — not assigned, not in scope, token expired, or no internet. A Mac that leaves Setup Assistant unenrolled is re-enrolled through the jamf-enroll-mac runbook (Apple documents resetting enrollment with the `profiles` tool's renew option for a Mac already in Apple Business, limited to 10 such calls per 24 hours on organization-owned Macs).
4. Account creation — one of two paths, **[org gap — confirm which]**:
   - **Platform SSO with Okta:** an Okta sign-in window replaces the Create a Computer Account pane; the user authenticates with their Okta email, password and MFA, and a local account linked to Okta is created.
   - **Local account:** the user, or the technician per the PreStage's Account Settings payload, creates the first account; Okta Verify registration comes after the hand-off.
5. FileVault: on macOS 26.4 or later it is turned on during Setup Assistant by default. If the PreStage holds the Mac in Setup Assistant, it continues only after FileVault is on and the key escrowed. **WAIT UNTIL** Setup Assistant finishes and the desktop appears.

**Verification checkpoint** — [ ] enrollment pane seen · [ ] Setup Assistant completed · [ ] on the Mac, System Settings → General → Device Management → read the MDM profile from Jamf Pro.

## Phase D — Jamf read-backs: inventory record, FileVault, escrowed key

**Purpose** — "enrolled" is a Jamf Pro statement, not a Setup Assistant statement; prove it in the console before the hand-off.

1. Jamf Pro → Computers → Search inventory → search `[SERIAL_NUMBER]` → read the record.
2. **WAIT UNTIL** the inventory record exists with a recent last check-in. If the PreStage did not name the Mac, naming it `[DEVICE_NAME]` is its own change — note it in the ticket, do not do it from this runbook.
3. Same record → **History** → **Management History** → read completed, pending and failed commands. A pending command runs at the next check-in; a failed one is reset to pending after four hours.
4. Same record → **Inventory** → **Disk Encryption** → read **FileVault 2 Enabled**, **FileVault 2 Partition Encryption State** and **Personal Recovery Key Validation**.
5. **WAIT UNTIL** FileVault 2 Enabled reads Enabled and Personal Recovery Key Validation reads Valid. If FileVault is off, or the key reads Invalid or Unknown after the first logout-login cycle, work it with `/mac-troubleshoot` before the hand-off — a Mac without an escrowed key is a data-loss risk the day the user forgets their password.
6. On the Mac: System Settings → General → Device Management → read that the Wi-Fi, FileVault and (if used) Platform SSO profiles are installed.

**Gotcha** — viewing a recovery key in Jamf Pro is itself audited and Jamf recommends issuing a new key after one is viewed; Validation = Valid is the proof of escrow, so do not open the key to "check" it.

**Verification checkpoint** — [ ] inventory record exists · [ ] FileVault Enabled · [ ] Personal Recovery Key Validation Valid · [ ] expected profiles installed.

## Phase E — Identity: Okta active, Google provisioned, user signs in

**Purpose** — the laptop is useless until the accounts behind it exist; account creation lives in its own runbooks and is only read here.

1. Okta Admin Console → Directory → People → `[UPN]` → read **Status**. **WAIT UNTIL** it reads Active (created and activated through the okta-user-lifecycle runbook; activating emails the user).
2. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the account and its status. **WAIT UNTIL** the account exists and is active. How it gets there is **[org gap]**: Okta provisions it when the Google Workspace app is assigned, or an admin creates it with the gws-new-user runbook (Google services can take up to 24 hours to become available, and the welcome email's password-reset link expires in 48 hours).
3. Hand the Mac to `[FIRST_NAME] [LAST_NAME]` on `[START_DATE]`. **WAIT UNTIL** the user signs in: with Platform SSO, with their Okta credentials at the login window; otherwise with the local account, then Okta Verify registration and the Okta dashboard in the browser, then Google through Okta.
4. Read-back: Okta Admin Console → Reports → System Log → read the user's sign-in events; Admin console → Reporting → Audit and investigation → User log events → read the first Google sign-in (user account events can take tens of minutes to appear).

**Verification checkpoint** — [ ] Okta Active · [ ] Google account active · [ ] first sign-in visible in both logs.

<details>
<summary>Terminal on the Mac — read-only checks (HUMAN-RUN, for reference)</summary>

```zsh
# HUMAN-RUN — read-only; the technician runs this on the Mac after Setup Assistant; nothing here changes anything
system_profiler SPHardwareDataType   # prints the serial number to compare with Apple Business and Jamf Pro
sudo profiles show -type enrollment   # shows the Automated Device Enrollment configuration (Apple documents profiles show and its 10-per-24-hours limit on organization-owned Macs; the -type enrollment filter is [unverified: the profiles man page is not hosted on support.apple.com])
sudo fdesetup status   # prints whether FileVault is On or Off
```
</details>

## ⚠️ Risk warning

- **Release from Organization is irreversible.** A released Mac cannot be assigned to Jamf again from Apple Business and its Activation Lock can no longer be managed there; it comes back only through Apple Configurator or the reseller. Do not touch that menu while fixing an assignment.
- An unassigned Mac, an out-of-scope Mac or an expired token all produce the same symptom: a Mac that finishes Setup Assistant looking fine and is not managed. Do not let a new hire start on it.
- Do not skip the FileVault and escrow wait. Apple's warning: lose both the password and the recovery key and the files and settings are lost forever.
- A Mac added with Apple Configurator carries a 30-day provisional period in which the user can release it from Apple Business, supervision and management — record that date in the ticket for such devices.

## ✅ Verification checklist

- [ ] Apple Business → Devices → Inventory → `[SERIAL_NUMBER]` → the row names the Jamf device management service.
- [ ] Jamf Pro → Computers → PreStage enrollments → the new-hire PreStage → Scope lists `[SERIAL_NUMBER]`; Settings → Global → Automated Device Enrollment → the token is not expired.
- [ ] Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → record exists with a recent check-in; Inventory → Disk Encryption reads FileVault 2 Enabled = Enabled and Personal Recovery Key Validation = Valid.
- [ ] On the Mac: System Settings → General → Device Management shows the Jamf MDM profile and the expected configuration profiles; `sudo fdesetup status` reads On.
- [ ] Okta Admin Console → Directory → People → `[UPN]` reads Active; Admin console → Directory → Users → `[USER@DOMAIN.COM]` is active; the first sign-in appears in Okta Reports → System Log and in Google User log events.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] New-hire Mac `[SERIAL_NUMBER]` (`[DEVICE_NAME]`) set up for `[FIRST_NAME] [LAST_NAME]`, start `[START_DATE]`. Apple Business: assigned to the Jamf device management service [timestamp]. Jamf Pro: in PreStage scope [timestamp]; enrolled through Automated Device Enrollment at first boot; inventory record created [timestamp]. FileVault Enabled, personal recovery key escrowed (Validation = Valid). Okta `[UPN]` Active; Google `[USER@DOMAIN.COM]` [provisioned by Okta / created in Admin console]. First sign-in verified in Okta System Log and Google User log events [timestamp]. Time spent: [X] min.

## Aha moment

Enrollment is decided before the power button: Apple Business says *which* service, the PreStage says *what happens*, and Setup Assistant only renders the decision — if the pane is missing, the fault is upstream, never on the Mac.

## Career upgrade

Zero-touch deployment is a supply chain — serial in Apple Business → token in the MDM → scope → first boot — and reasoning about where a device is in that chain is the same discipline as tracing a build through a CI pipeline.

## Next action

Read the Apple Business inventory row for `[SERIAL_NUMBER]` and confirm the Jamf device management service name and the PreStage name before Phase A.

**Sources (checked 2026-10-15):** support.apple.com/guide/business/assign-reassign-or-unassign-devices-axmf500c0851/web · support.apple.com/guide/business/add-devices-using-apple-configurator-axm200a54d59/web · support.apple.com/guide/business/release-devices-axmec4d28461/web · support.apple.com/guide/deployment/automated-device-enrollment-management-dep73069dd57/web · support.apple.com/guide/deployment/manage-filevault-with-device-management-dep0a2cb7686/web · support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web · support.apple.com/guide/mac-help/protect-data-on-your-mac-with-filevault-mh11785/mac · support.apple.com/guide/mac-help/configuration-profiles-standardize-settings-mh35561/mac · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Configuring_a_Computer_PreStage_Enrollment · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_PreStage_Enrollment_Payload_Reference · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Automated_Device_Enrollment_Integration · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Uploading_the_Server_Token_File_to_Configure_Automated_Device_Enrollment · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Activating_FileVault_Disk_Encryption_using_a_Configuration_Profile · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Disk_Encryption_Category · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Viewing_the_FileVault_Recovery_Key_for_a_Computer · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Sending_a_Remote_Command_to_a_Computer · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Performing_a_Simple_Computer_Search · help.okta.com/oie/en-us/content/topics/oda/macos-pw-sync/about-psso.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-activate-user-account.htm · help.okta.com/oie/en-us/content/topics/oda/device-logout.htm (Reports → System Log) · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm · knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user · knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times (learn.jamf.com topics read through the site's content API because the page URLs serve only an app shell).
