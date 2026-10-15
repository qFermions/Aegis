---
description: Work a managed ChromeOS device ticket in the Google Admin console — the "disabled by the admin" screen (re-enable), lost or stolen (disable), broken profile or start-over (Reset: Clear User Profiles or Factory Reset / powerwash) and retirement (deprovision) — each under its own exact-phrase gate, because powerwash and deprovision have different undo stories. Placeholders only.
disable-model-invocation: true
---

# /gws-chromeos-device

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[DEVICE_ID]` (the device's Admin console ID — the row you open by clicking its serial number) · `[SERIAL_NUMBER]` (printed on the device; Alt + V on the sign-in screen shows it) · `[OU_PATH]` (the organizational unit the device sits in) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- Four device actions live on the same Admin console page and they are **not interchangeable**: **Disable** is reversible (Re-enable); **Reset** — Clear User Profiles or Factory Reset (the powerwash) — removes data and, in Google's own dialog wording, cannot be undone; **Deprovision** takes the device out of management, and it only comes back by wiping it and enrolling it by hand.
- Every state change has its own exact-phrase gate; a phrase never carries into another phase and "yes" is never a confirmation. Reset and Deprovision are R3 — a deprovision for resale or donation goes through the independent out-of-session review first.
- Not done until the status read-back in the final checklist passes.

## Inputs needed

- `[DEVICE_ID]` (or `[SERIAL_NUMBER]`) and its `[OU_PATH]`.
- What the ticket actually needs: let people sign in again (the device was disabled), fix a broken local profile (Clear User Profiles), start the device over (Factory Reset / powerwash), or retire it (Deprovision, with a reason).
- Whether **forced re-enrollment** is on for `[OU_PATH]` — **[org gap — read it in Phase A before any Reset]**; it decides whether a wiped device comes back managed.
- An available Chrome upgrade for the device: Google requires one before a device is re-enabled or re-enrolled.

## How the systems hang together

- **Status drives the menu.** A device is Provisioned, Pre-provisioned, Disabled, Deprovisioned or Suspended. The status filter at the top of the device list decides which actions the console offers: a Provisioned device can be deprovisioned or disabled; a Disabled device can be re-enabled or deprovisioned; a Deprovisioned device has no direct action left (wipe it and enroll it again).
- **Disable** is for a lost or stolen device: with a lock screen (nobody can sign in) or with a factory reset (the data goes too). The device stays enrolled and keeps using its Chrome upgrade. Google warns that a device might not disable successfully unless forced re-enrollment is on, and that a device enrolled into another organization can no longer be disabled.
- **Reset** is the remote wipe. **Clear User Profiles** removes the user profiles on the device; **Factory Reset** is the powerwash — all data goes, including user profiles, device policies, enrollment data and anything never synced with Chrome Sync (photos, downloaded files, saved networks). Google's dialog says it cannot be undone. Reset never deprovisions: the device still belongs to your fleet. A powerwashed device keeps the knowledge of which enterprise domain it belongs to, so with forced re-enrollment on (Google's default) it re-enrolls automatically; with it off, it comes back unmanaged and has to be enrolled by hand.
- **Deprovision** removes every policy, device-level printers and the ability to run as a kiosk, and ends management; the device stays listed in its OU with status Deprovisioned. Reasons: Retiring from fleet (resale, donation, permanent removal), Different model replacement, Same model replacement, ChromeOS Flex upgrade transfer. The only way back is to wipe the device (if it was not factory reset during deprovisioning) and enroll it manually, with an available upgrade.
- Disable and deprovision only land once the device is online — it has to report its status to Google.

## Fast path

1. Phase A — read the device status and the forced re-enrollment setting (R0). **WAIT UNTIL** both are recorded.
2. Phase B — "device is disabled by the admin" screen: re-enable under its gate (R1).
3. Phase C — lost or stolen: disable under its gate (R1, reversible).
4. Phase D — broken profile or start-over: Reset under its gate — Clear User Profiles, or Factory Reset / powerwash (both R3). **WAIT UNTIL** the device reports back.
5. Phase E — retirement: deprovision with a reason (R3), after the independent review.

## Phase A — Read the device (R0)

**Purpose** — know the status, the OU and the forced re-enrollment setting before touching anything; the status also tells you which action the console will even offer.

1. Admin console → Devices → Chrome → Devices → **All devices** (or the child OU) → click the serial number of `[DEVICE_ID]` → read **Status**, **Enrollment time**, **Last policy sync**, **Asset ID** and the user.
2. Admin console → Devices → Chrome → Settings → Device settings → `[OU_PATH]` → **Enrollment and access** → read the **Forced re-enrollment** value (Google's default re-enrolls wiped devices automatically, without the user entering credentials).
3. Admin console → Reporting → Audit and investigation → Admin log events → filter on the device → read who disabled, reset or deprovisioned it and when (events appear in near real time and are kept for 6 months).
4. On the device: Alt + V on the sign-in screen shows the serial number and the ChromeOS version. A "disabled by the admin" screen means status **Disabled** — go to Phase B. A consumer sign-in screen on a device that should be managed means it was wiped with forced re-enrollment off — it has to be enrolled manually before anyone signs in, or policies will not apply.

**Verification checkpoint** — [ ] status, OU and last policy sync recorded · [ ] forced re-enrollment value recorded · [ ] the Admin log events entry (who, when, which action) is in the ticket.

```bash
# read-only: status, serial, OU, last sync and annotated user of one device
gam info cros "[DEVICE_ID]" fields status,serialnumber,orgunitpath,lastsync,annotateduser   # prints the record; nothing changes
# read-only: every disabled device, for when the ticket only gives you a screen and no ID
gam print cros query "status:disabled" fields deviceid,serialnumber,orgunitpath,annotateduser   # lists the disabled devices
```

## Phase B — "Disabled by the admin" screen: re-enable (R1)

**Purpose** — that screen is the lock-screen flavour of Disable. Someone disabled the device (usually the lost-or-stolen flow); find out who in the Admin log events first, then re-enable only when the device is accounted for.

<!-- SAFETY GATE [gws-chromeos-device-reenable-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** enable one disabled ChromeOS device again (Re-enable selected devices); users can sign in as soon as it is online
- **Scope:** one device; it stays in `[OU_PATH]` with its policies and needs an available upgrade
- **Reversibility:** R1 — the Phase C gate disables it again (Disable selected devices) under its own phrase
- **Required confirmation:** Type exactly `RE-ENABLE CHROMEBOOK [DEVICE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-chromeos-device-reenable-portal]:** Only after the Admin log events read and the exact match:
1. Admin console → Devices → Chrome → Devices → filter by status **Disabled** → check the box next to `[DEVICE_ID]`.
2. At the top, click **Re-enable selected devices**, then click **Enable** to confirm.

**WAIT UNTIL** the device is online: the status reads **Provisioned** again and the user can sign in.

**Verification checkpoint** — [ ] status reads Provisioned · [ ] Admin log events shows the re-enable with your admin account and time.

## Phase C — Lost or stolen: disable (R1, reversible)

**Purpose** — block use of a device you cannot get back yet, without wiping it. Disabled devices stay enrolled.

<!-- SAFETY GATE [gws-chromeos-device-disable-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** disable one ChromeOS device with a lock screen; nobody can sign in or use it until it is re-enabled
- **Scope:** one device; it stays enrolled and keeps its upgrade and its policies; the "Disable with factory reset" option also wipes the device — that is Phase D's blast radius, not this gate's
- **Reversibility:** R1 — Phase B (Re-enable selected devices) under its own phrase; a device enrolled into another organization in the meantime can no longer be disabled or re-enabled by you
- **Required confirmation:** Type exactly `DISABLE CHROMEBOOK [DEVICE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-chromeos-device-disable-portal]:** Only after the exact match:
1. Admin console → Devices → Chrome → Devices → filter by the current status → check the box next to `[DEVICE_ID]`.
2. At the top, click **Disable selected devices** → choose **Disable with lock screen** → click **Disable**.

**WAIT UNTIL** the device is online and the status reads **Disabled**. Google recommends showing a return address and phone number on the disabled screen — the **Disabled device return instructions** device setting is a separate, OU-level change.

**Gotcha** — a device in an OU with forced re-enrollment off might not disable successfully; a device in developer mode should sit in its own OU with forced re-enrollment off.

## Phase D — Broken profile or start-over: Reset (R3)

**Purpose** — the remote wipe. Pick the smallest option that fixes the ticket: a corrupted or stuck profile needs **Clear User Profiles**; only a device that must start from zero needs **Factory Reset** (the powerwash). Capture the pre-state first: the Phase A read, and whether anything unsynced on the device still matters to its user.

<!-- SAFETY GATE [gws-chromeos-device-clear-profiles-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** reset one ChromeOS device by clearing every user profile on it; local data that was never synced with Chrome Sync is deleted while the device stays in your fleet
- **Scope:** one device; the device is not deprovisioned
- **Reversibility:** R3 — Google's dialog states the removed data cannot be undone; no re-enrollment is needed afterwards
- **Required confirmation:** Type exactly `RESET CHROMEBOOK [DEVICE_ID] AND CLEAR USER PROFILES`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-chromeos-device-clear-profiles-portal]:** Only after the pre-state is recorded and the exact match:
1. Admin console → Devices → Chrome → Devices → click the serial number of `[DEVICE_ID]` → Device details → **Reset**.
2. Select **Clear User Profiles**, tick **I understand this will remove data from the device and cannot be undone**, then click **Reset** again.

**WAIT UNTIL** the device restarts and the user can sign in with a fresh profile; the status stays **Provisioned**.

<!-- SAFETY GATE [gws-chromeos-device-powerwash-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** powerwash one ChromeOS device (Factory Reset); all data including user profiles, device policies and enrollment data is removed, the device re-enrolls automatically only if forced re-enrollment is on for its OU
- **Scope:** one device; photos, downloaded files and saved networks that were never synced are gone, and the device has to be reconnected to Wi-Fi by hand
- **Reversibility:** R3 — cannot be undone; with forced re-enrollment off the device comes back unmanaged and must be enrolled manually (physical access needed)
- **Required confirmation:** Type exactly `POWERWASH CHROMEBOOK [DEVICE_ID] BY FACTORY RESET`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-chromeos-device-powerwash-portal]:** Only after the forced re-enrollment value and the pre-state are recorded and the exact match:
1. Admin console → Devices → Chrome → Devices → click the serial number of `[DEVICE_ID]` → Device details → **Reset**.
2. Select **Factory Reset**, tick **I understand this will remove data from the device and cannot be undone**, then click **Reset** again.

**WAIT UNTIL** the device restarts and comes back: with forced re-enrollment on it re-enrolls into `[@Aegion]`'s account without anyone typing credentials and the Admin console shows a fresh **Last policy sync**; with it off, the consumer sign-in screen appears and the device must be enrolled manually before any user signs in.

**Verification checkpoint** — [ ] the device reports a fresh Last policy sync (re-enrolled) or has been enrolled manually · [ ] a user signs in and policies apply · [ ] the Admin log events entry for the Reset is in the ticket.

## Phase E — Retirement: deprovision (R3, after independent review)

**Purpose** — end management when the device leaves the fleet or is replaced. Deprovisioning is the wrong tool for "the device is broken, fix it" — that is Phase D.

<!-- SAFETY GATE [gws-chromeos-device-deprovision-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** deprovision one ChromeOS device; every policy, device-level printer and kiosk capability is removed and the device leaves management
- **Scope:** one device; it stays listed in `[OU_PATH]` with status Deprovisioned; choosing "Yes, factory reset" also wipes it, which is right for resale or donation; the upgrade count can change
- **Reversibility:** R3 — no undo; to manage it again, wipe it (if it was not factory reset) and enroll it manually with an available upgrade — physical access, every time
- **Required confirmation:** Type exactly `DEPROVISION CHROMEBOOK [DEVICE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-chromeos-device-deprovision-portal]:** Only after the independent review and the exact match:
1. Admin console → Devices → Chrome → Devices → filter by the current status → check the box next to `[DEVICE_ID]` (devices with different reasons go in separate batches).
2. At the top, click **Deprovision selected devices** → choose **Yes, factory reset** (resale, donation) or **No, keep existing data** (repair, RMA) → tick the box confirming you understand what re-enrolling takes.
3. Pick the reason — **Retiring from fleet** (resale, donation, permanent removal), **Different model replacement**, **Same model replacement** or **ChromeOS Flex upgrade transfer** — then click **Deprovision**.

**WAIT UNTIL** the device is online and the status reads **Deprovisioned**; a device that was factory reset shows the consumer sign-in screen.

**Verification checkpoint** — [ ] status reads Deprovisioned · [ ] the reason and the disposal (resale / donation / RMA) are in the ticket · [ ] the upgrade count was checked.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal; Aegis never does
# SAFETY GATE [gws-chromeos-device-reenable]
# Target: [DEVICE_ID]
# Effect: enable one disabled ChromeOS device again
# Scope: one device; it stays in its OU with its policies and needs an available upgrade
# Reversibility: R1 — the separate disable procedure under its own phrase
# Required confirmation: type exactly `RE-ENABLE CHROMEBOOK [DEVICE_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="RE-ENABLE CHROMEBOOK [DEVICE_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam cros "[DEVICE_ID]" update action reenable   # re-enables the device; it has to be online for the change to land
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info cros "[DEVICE_ID]" fields status,lastsync   # read-back: the status is no longer disabled
```

```bash
# HUMAN-RUN — lost or stolen: disable with a lock screen
# SAFETY GATE [gws-chromeos-device-disable]
# Target: [DEVICE_ID]
# Effect: disable one ChromeOS device; nobody can sign in until it is re-enabled
# Scope: one device; it stays enrolled with its upgrade and its policies
# Reversibility: R1 — the separate re-enable procedure under its own phrase
# Required confirmation: type exactly `DISABLE CHROMEBOOK [DEVICE_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="DISABLE CHROMEBOOK [DEVICE_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam cros "[DEVICE_ID]" update action disable   # disables the device; it has to be online for the change to land
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info cros "[DEVICE_ID]" fields status,lastsync   # read-back: the status reads disabled
```

```bash
# HUMAN-RUN — broken profile: clear the user profiles, device stays enrolled
# SAFETY GATE [gws-chromeos-device-wipe-users]
# Target: [DEVICE_ID]
# Effect: clear every user profile from one ChromeOS device; unsynced local data is deleted and the device stays in the fleet
# Scope: one device, through the wipe_users remote command
# Reversibility: R3 — the removed data cannot be recovered; no re-enrollment is needed
# Required confirmation: type exactly `CLEAR USER PROFILES ON CHROMEBOOK [DEVICE_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="CLEAR USER PROFILES ON CHROMEBOOK [DEVICE_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam cros "[DEVICE_ID]" issuecommand command wipe_users times_to_check_status 10 doit   # queues wipe_users (doit acknowledges the data loss) and polls its status up to 10 times
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info cros "[DEVICE_ID]" fields status,lastsync,recentusers   # read-back: still enrolled; the recent-users list restarts once the device reports in
```

```bash
# HUMAN-RUN — start over: remote powerwash (Factory Reset); read the forced re-enrollment value first
# SAFETY GATE [gws-chromeos-device-powerwash]
# Target: [DEVICE_ID]
# Effect: powerwash one ChromeOS device remotely; all local data including user profiles is removed and the device re-enrolls automatically only if forced re-enrollment is on
# Scope: one device, through the remote_powerwash remote command; the device must be reconnected to Wi-Fi by hand
# Reversibility: R3 — cannot be undone; with forced re-enrollment off the device comes back unmanaged and must be enrolled manually
# Required confirmation: type exactly `POWERWASH CHROMEBOOK [DEVICE_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="POWERWASH CHROMEBOOK [DEVICE_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam cros "[DEVICE_ID]" issuecommand command remote_powerwash times_to_check_status 10 doit   # queues the powerwash (doit acknowledges data and management loss) and polls its status up to 10 times
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info cros "[DEVICE_ID]" fields status,lastsync,lastenrollmenttime   # read-back: a new enrollment time appears once the device re-enrolls
```

```bash
# HUMAN-RUN — retirement: deprovision as "retiring from fleet", only after the independent review
# SAFETY GATE [gws-chromeos-device-deprovision]
# Target: [DEVICE_ID]
# Effect: deprovision one ChromeOS device as retiring from fleet; every policy is removed and the device leaves management
# Scope: one device (the default max_to_deprov of one refuses a wider selection); the device stays listed in its OU
# Reversibility: R3 — no undo; wipe the device and enroll it manually to manage it again
# Required confirmation: type exactly `DEPROVISION CHROMEBOOK [DEVICE_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="DEPROVISION CHROMEBOOK [DEVICE_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam cros "[DEVICE_ID]" update action deprovision_retiring_device acknowledge_device_touch_requirement   # deprovisions with reason "retiring from fleet"; the acknowledgement flag is mandatory because the action is not reversible
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info cros "[DEVICE_ID]" fields status,deprovisionreason,lastdeprovisiontimestamp   # read-back: status deprovisioned, with the reason and timestamp
```
</details>

## ⚠️ Risk warning

- **Reset is not Disable, and Disable is not Deprovision.** Clear User Profiles and Factory Reset delete data and cannot be undone; Disable is the only reversible action here; Deprovision is permanent in practice (wipe plus manual enrollment to come back).
- **Read forced re-enrollment before any Reset.** With it off, a powerwashed device comes back as a consumer device, someone can sign in before it is enrolled, policies do not apply, and the device has to be wiped again.
- **One device per gate.** GAM serial-number queries match partial serials, and the console's checkboxes select whole lists — every gate above names one `[DEVICE_ID]`, and GAM's default refuses to deprovision more than one device at a time. Keep it that way.
- Disable and deprovision only land when the device is online; an offline device keeps working until it next syncs.

## ✅ Verification checklist

- [ ] Admin console → Devices → Chrome → Devices → `[DEVICE_ID]` shows the expected status: Provisioned after a re-enable, Disabled after a disable, Provisioned with a fresh Last policy sync after a Reset (forced re-enrollment on), Deprovisioned after a deprovision.
- [ ] `gam info cros "[DEVICE_ID]" fields status,lastsync` agrees with the console.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the action with your admin account and time.
- [ ] After a Reset: the device re-enrolled automatically or was enrolled manually, and a user signed in with policies applied.
- [ ] After a deprovision: the reason, the disposal path and the upgrade count are recorded in the ticket.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] ChromeOS device `[DEVICE_ID]` (`[SERIAL_NUMBER]`, OU `[OU_PATH]`): [re-enabled after a "disabled by the admin" screen / disabled with lock screen — lost or stolen / Reset with Clear User Profiles / Factory Reset (powerwash) / deprovisioned, reason: Retiring from fleet] at [timestamp], confirmed by the exact phrase. Forced re-enrollment for the OU: [on/off]. Pre-state: status [X], last policy sync [date]. Result: status now [Provisioned / Disabled / Deprovisioned]; [re-enrolled automatically / enrolled manually / n/a]. Admin log events shows the action under [ADMIN_NAME]. Time spent: [X] min.

## Aha moment

A Chromebook's status is the whole story: Disabled, wiped and Deprovisioned look identical to the user (a device nobody can use) but sit at three different distances from management — one click back, a wipe-and-enroll back, or already back by itself if forced re-enrollment is on.

## Career upgrade

Reasoning about the device lifecycle (enrolled → disabled → wiped → deprovisioned) and what each state costs to reverse is the same model MDM architects apply to Intune, Jamf and ChromeOS alike.

## Next action

Run Phase A and record the status and the forced re-enrollment value before choosing a gate.

**Sources (checked 2026-10-15):** support.google.com/chrome/a/answer/3523633 (deprovision, disable, re-enable, reasons, status view) · support.google.com/chrome/a/answer/1360642 (Reset: Clear User Profiles / Factory Reset, "cannot be undone") · support.google.com/chrome/a/answer/16966499 (powerwash keeps the enterprise-domain knowledge for forced re-enrollment) · support.google.com/chrome/a/answer/6352858 (forced re-enrollment default and setting path) · support.google.com/chrome/a/answer/1698333 (device list and details, Alt + V) · knowledge.workspace.google.com/admin/reports/admin-log-events · knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (ChromeOS-Devices page; GAM is an open-source tool, not a Google product).
