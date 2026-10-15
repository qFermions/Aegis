---
description: Enroll one Mac in Jamf Pro through Automated Device Enrollment — assign it in Apple Business, put it in a PreStage scope, boot it through Setup Assistant, re-run enrollment without erasing if the pane was skipped, then force the first check-in and inventory. Explicit WAIT UNTIL boundaries; placeholders only.
disable-model-invocation: true
---

# /jamf-enroll-mac

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[SERIAL_NUMBER]` (the Mac's serial — the key in Apple Business and in Jamf Pro) · `[FIRST_NAME]` / `[LAST_NAME]` (the new hire; never a real name) · `[START_DATE]` · `[@Aegion_JAMF_URL]` (the Jamf Pro server) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- Automated Device Enrollment (ADE) is the only enrollment method that can stop a user removing the MDM profile — this runbook never falls back to a user-initiated enrollment "to save time".
- Two portal changes carry gates: assigning the Mac to Jamf Pro in Apple Business (R1) and adding it to a PreStage scope (R1). The Terminal steps on the Mac are gated too (`profiles renew`, `jamf policy`, `jamf recon`): Apple rations `profiles` calls, and the jamf binary changes device state.
- Not done until the inventory record exists in Jamf Pro and the MDM profile shows on the Mac.

## Inputs needed

- `[SERIAL_NUMBER]`, and how the Mac was bought — Apple or a participating reseller feeds Apple Business automatically; anything else does not — **[org gap — confirm the purchase channel]**.
- Which PreStage enrollment new-hire Macs use, and which Automated Device Enrollment instance it is tied to — **[org gap — read it in Phase B]**.
- Whether that PreStage has **Automatically assign new devices** turned on (then the Phase B gate is not needed).
- `[START_DATE]`, so the Mac is enrolled and verified before `[FIRST_NAME]` `[LAST_NAME]` starts.

## How the systems hang together

- **Apple Business (formerly Apple Business Manager) owns the device; Jamf Pro manages it.** A Mac bought through Apple or a participating reseller appears in Apple Business inventory. It must be **assigned to a device management service** (your Jamf Pro) — Apple's wording: you assign a device so that Setup Assistant displays the pane to enroll it in that service. No Jamf setting can substitute for that assignment.
- **Jamf Pro side.** An Automated Device Enrollment instance holds the server token file from Apple; the token is valid for one year after it is uploaded and saved, and Jamf Pro syncs with Apple every two minutes. A **PreStage enrollment** carries the Setup Assistant experience; only devices associated with the PreStage's ADE instance can be in its scope, and the Mac enrolls with the PreStage whose scope contains it. Deleting an ADE instance in Jamf Pro does not change anything in Apple Business.
- **On the Mac.** During Setup Assistant the Mac needs internet access to check in with Jamf Pro and receive its initial configuration. If the pane was skipped (the Mac was set up before the assignment, or offline), `profiles renew -type enrollment` resets supervision and enrollment so ADE runs again without erasing; on macOS 14 or later the user sees a full-screen prompt and can choose "Not now" once, which dismisses it for eight hours. On macOS 13 or later Apple limits `profiles show`, `profiles validate` and `profiles renew` to 10 calls per 24 hours on organization-owned Macs.
- **The jamf binary** (`/usr/local/jamf/bin/jamf`, linked from `/usr/local/bin/jamf`) arrives with enrollment; `sudo jamf policy` starts a check-in with Jamf Pro and `sudo jamf recon` submits an inventory update. Jamf Pro's built-in "Update Inventory" policy otherwise collects inventory once a week.

## Fast path

1. Phase A — Apple Business: **WAIT UNTIL** `[SERIAL_NUMBER]` is listed in inventory, then assign it to Jamf Pro (R1 gate). **WAIT UNTIL** the assignment activity completes.
2. Phase B — Jamf Pro: read the ADE instance and its token expiry (R0); add the Mac to the PreStage scope (R1 gate) unless new devices are assigned automatically. **WAIT UNTIL** the Mac shows in the PreStage scope (two-minute sync).
3. Phase C — On the Mac: Setup Assistant with internet. **WAIT UNTIL** the enrollment pane appears, then **WAIT UNTIL** the inventory record exists in Jamf Pro.
4. Phase D — Only if the pane was skipped: re-run enrollment without erasing (gated Terminal step).
5. Phase E — First check-in and inventory (gated Terminal step), then the final read-backs.

## Phase A — Apple Business: make sure the Mac is owned and assigned

**Purpose** — assignment is what makes Setup Assistant show the enrollment pane.

**Read first (R0):** Apple Business → Devices → Inventory → search `[SERIAL_NUMBER]` → read the device management service column and the assignment status.

**WAIT UNTIL** the Mac is listed. A Mac that is not listed did not come through a channel that feeds Apple Business; adding it with Apple Configurator is a separate procedure — **[org gap — confirm the purchase channel]**.

<!-- SAFETY GATE [jamf-enroll-mac-assign-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** assign one Mac to the Jamf Pro device management service in Apple Business so Setup Assistant shows the enrollment pane
- **Scope:** one device in Apple Business; nothing changes on the Mac until it runs Setup Assistant or an enrollment renewal
- **Reversibility:** R1 — Unassign Device Management in the same menu, under its own phrase; Release from Organization is a different, irreversible action and is never part of this runbook
- **Required confirmation:** Type exactly `ASSIGN MAC [SERIAL_NUMBER] TO JAMF DEVICE MANAGEMENT`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-enroll-mac-assign-portal]:** Only after the exact match:
1. Apple Business → Devices → Inventory → select `[SERIAL_NUMBER]` → **Assign Device Management** → choose the Jamf Pro device management service.
2. Click **Continue**, read the dialog, then click **Confirm**. Apple Business creates an activity.

**WAIT UNTIL** the activity completes (view the activity, then Done); only then can Jamf Pro learn about the device.

**Verification checkpoint** — [ ] the inventory row for `[SERIAL_NUMBER]` shows the Jamf Pro device management service.

**Gotcha** — if every new Mac should go to Jamf Pro automatically, the Default Device Assignment under Devices → Management Services sets that per device type; it is a separate change.

## Phase B — Jamf Pro: the ADE instance and the PreStage scope

**Purpose** — the Mac only enrolls through the PreStage whose scope contains it, and only if that PreStage's ADE instance still has a valid token.

**Read first (R0):**
1. Jamf Pro → Settings → Global → Automated Device Enrollment → open the instance → read the token expiry (a server token is valid for one year after upload; replacing it is a separate change).
2. Jamf Pro → Computers → PreStage enrollments → open the new-hire PreStage → General payload → read which Automated Device Enrollment instance it uses and whether **Automatically assign new devices** is on.

**WAIT UNTIL** `[SERIAL_NUMBER]` is visible to Jamf Pro — up to two minutes after the Apple Business assignment.

<!-- SAFETY GATE [jamf-enroll-mac-prestage-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** add one Mac to the scope of the new-hire PreStage enrollment so it enrolls with that PreStage's Setup Assistant settings
- **Scope:** one PreStage enrollment, one device; skip this gate when Automatically assign new devices is on for that PreStage
- **Reversibility:** R1 — untick the device on the Scope tab and Save, under its own phrase; moving a Mac to another PreStage means removing it from the first scope, then adding it to the second
- **Required confirmation:** Type exactly `ADD MAC [SERIAL_NUMBER] TO PRESTAGE SCOPE`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-enroll-mac-prestage-portal]:** Only after the exact match:
1. Jamf Pro → Computers → PreStage enrollments → select the new-hire PreStage → **Edit**.
2. Scope tab → tick `[SERIAL_NUMBER]` → **Save**. The settings sync with Apple; device information in the PreStage updates after the next two-minute sync.

**WAIT UNTIL** the PreStage's Scope tab lists `[SERIAL_NUMBER]` as in scope.

**Verification checkpoint** — [ ] token expiry recorded · [ ] the Mac is in the new-hire PreStage's scope.

## Phase C — On the Mac: Setup Assistant enrollment

**Purpose** — the enrollment itself. The Mac must be online during Setup Assistant to check in with Jamf Pro and receive its initial configuration.

1. Power the Mac on and start Setup Assistant; choose language and region, then join Wi-Fi (or plug in Ethernet). Do not skip the network step.
2. **WAIT UNTIL** the enrollment pane appears — Setup Assistant shows it only for a device assigned to a device management service. If the PreStage automatically advances through Setup Assistant, most other panes are skipped.
3. Continue through the pane; the MDM profile and the PreStage settings arrive. Whether a local account is created, and for whom, comes from the PreStage payloads — **[org gap — the new-hire PreStage decides]**.
4. **WAIT UNTIL** Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` returns a record → read the General section (enrollment method and date, MDM capability, supervision) and the Management tab.
5. On the Mac: System Settings → General → Device Management → read the MDM profile entry; an ADE-enrolled Mac cannot have it removed by the user.

**Verification checkpoint** — [ ] the inventory record exists · [ ] the Mac shows the MDM profile.

**Gotcha** — a Mac set up before the assignment, or offline during Setup Assistant, shows no pane and creates no record. Do not erase it; use Phase D.

## Phase D — The pane was skipped: re-run enrollment without erasing

**Purpose** — `profiles renew -type enrollment` resets supervision and enrollment on a Mac whose serial is in Apple Business and assigned, so Automated Device Enrollment runs again without a wipe. Use it only once the Phase A and Phase B read-backs pass; each call counts toward Apple's limit of 10 `profiles` show, validate and renew calls per 24 hours.

System Settings → General → Device Management → read whether an MDM profile is already present before renewing.

<details>
<summary>Terminal on the Mac — re-run enrollment (HUMAN-RUN)</summary>

```zsh
# HUMAN-RUN — the administrator runs this in Terminal on the Mac; Aegis never does
# macOS 14 or earlier needs sudo; on macOS 15 or later the same command runs without it
# SAFETY GATE [jamf-enroll-mac-renew]
# Target: [SERIAL_NUMBER]
# Effect: reset the device enrollment on one Mac so it re-runs Automated Device Enrollment without erasing
# Scope: one Mac; counts as one of the 10 profiles calls Apple allows per 24 hours on an organization-owned Mac
# Reversibility: R1 — nothing is deleted; on macOS 14 or later the user sees a full-screen prompt and may choose Not now once
# Required confirmation: type exactly `RESET ENROLLMENT ON MAC [SERIAL_NUMBER]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="RESET ENROLLMENT ON MAC [SERIAL_NUMBER]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  sudo profiles renew -type enrollment   # asks Apple for the device enrollment again; the enrollment prompt follows
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
sudo profiles show   # read-back: lists the installed profiles (also one of the rationed profiles calls)
```
</details>

**WAIT UNTIL** the enrollment prompt appears on the Mac and the user (or you) completes it, then **WAIT UNTIL** the inventory record exists — Phase C step 4.

## Phase E — First check-in and inventory

**Purpose** — prove the Jamf management framework works and get a full inventory record before `[START_DATE]`.

Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → History → read the Management History for pending or failed commands first.

<details>
<summary>Terminal on the Mac — check in and submit inventory (HUMAN-RUN)</summary>

```zsh
# HUMAN-RUN — the administrator runs this in Terminal on the enrolled Mac; Aegis never does
# SAFETY GATE [jamf-enroll-mac-checkin]
# Target: [SERIAL_NUMBER]
# Effect: submit a fresh inventory from one Mac after a policy check-in
# Scope: one Mac; policies scoped to it run during the check-in, exactly as they would at the next scheduled one
# Reversibility: R1 — nothing is deleted; whatever a policy changes is that policy's own change, not this gate's
# Required confirmation: type exactly `SUBMIT INVENTORY FROM MAC [SERIAL_NUMBER]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="SUBMIT INVENTORY FROM MAC [SERIAL_NUMBER]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  sudo jamf policy   # starts a check-in; policies scoped to this Mac run now
  sudo jamf recon   # submits a fresh inventory record
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
jamf help   # read-back: the binary's manual page answers, so the management framework is installed
```
</details>

<details>
<summary>Jamf Pro API — read-back for the scale version (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN — read-only; JAMF_TOKEN is exported in the shell first, from a bearer token (POST /api/v1/auth/token with basic auth, 20-minute expiry) or from API client credentials, and never pasted into a ticket
curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v1/computers-inventory?section=GENERAL&filter=hardware.serialNumber==%22[SERIAL_NUMBER]%22"   # read-back: the record's General section (enrollment via ADE, supervision, management ID, last contact)
```
</details>

## ⚠️ Risk warning

- Never fall back to user-initiated enrollment for a corporate Mac: only Automated Device Enrollment makes the MDM profile non-removable.
- `profiles` calls are rationed (10 per 24 hours on organization-owned Macs, macOS 13 or later) — do not loop `profiles renew` while troubleshooting; fix the assignment or the scope first.
- A PreStage that automatically advances through Setup Assistant leaves the Mac in the Pacific time zone unless the PreStage configures language and region — check it before a wave of new hires.
- An expired ADE server token stops every PreStage tied to that instance; replacing the token is its own change.

## ✅ Verification checklist

- [ ] Apple Business → Devices → Inventory → `[SERIAL_NUMBER]` shows the Jamf Pro device management service.
- [ ] Jamf Pro → Computers → PreStage enrollments → the new-hire PreStage's Scope tab lists `[SERIAL_NUMBER]`.
- [ ] Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → General reads enrolled through Automated Device Enrollment, supervised and MDM capable; the API read-back returns the same record.
- [ ] System Settings → General → Device Management on the Mac shows the MDM profile.
- [ ] Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → Management History shows no failed commands, and `jamf help` answers in Terminal.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Mac `[SERIAL_NUMBER]` for `[FIRST_NAME]` `[LAST_NAME]` (start `[START_DATE]`) enrolled through Automated Device Enrollment on [date]. Apple Business: assigned to Jamf Pro [timestamp], activity completed. Jamf Pro: PreStage [name], ADE token valid until [date]. Setup Assistant showed the enrollment pane; inventory record created [timestamp]; MDM profile present on the Mac; first check-in and inventory submitted. [Enrollment re-run with profiles renew: yes/no.] Time spent: [X] min.

## Aha moment

Enrollment is an ownership chain, not a Jamf setting: Apple Business says who owns the Mac and which service manages it; Jamf's PreStage only decides what the enrollment looks like once Apple has pointed the Mac at Jamf.

## Career upgrade

Being able to explain the Apple ownership → device management service → PreStage chain, and why ADE is the only non-removable path, is the Apple-platform depth MDM and endpoint-engineering roles screen for.

## Next action

Start Phase A: confirm `[SERIAL_NUMBER]` is in Apple Business inventory, then run the assign gate.

**Sources (checked 2026-10-15):** support.apple.com/guide/business/assign-reassign-or-unassign-devices-axmf500c0851/web (Assign Device Management, why assignment matters, default assignment) · support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web (profiles renew -type enrollment, Not now, 10-per-24-hours limit) · support.apple.com/guide/mac-help/configuration-profiles-standardize-settings-mh35561/mac (System Settings → General → Device Management) · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Automated_Device_Enrollment_Integration · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Uploading_the_Server_Token_File_to_Configure_Automated_Device_Enrollment · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_PreStage_Enrollments · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Configuring_a_Computer_PreStage_Enrollment · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Inventory_Information · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Components_Installed_on_Managed_Computers · learn.jamf.com Jamf 100 Course, "Jamf Binary and Commands" (map rwZ~TKTGRZdL7OMZbgJ7sg, topic P3svwDRwlP6cy_8ihgR41g) · learn.jamf.com Jamf School documentation, "Re-enrolling a Computer Using Automated Device Enrollment" (sudo by macOS version) · learn.jamf.com technical article "Re-enrolling a Computer with a Removable MDM Profile" · developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory · developer.jamf.com/jamf-pro/docs/jamf-pro-api-overview · developer.jamf.com/jamf-pro/docs/client-credentials — the learn.jamf.com topics were read through the site's content API because the page URLs return only an app shell.
