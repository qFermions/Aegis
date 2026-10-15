---
description: Lock, wipe or unmanage a Mac from Jamf Pro — Lock Computer (reversible with the six-digit PIN), Wipe Computer (permanent, record stays), Remove MDM Profile plus removeFramework (unmanage before a sale) and Managed Lost Mode for a supervised iPhone or iPad — each under its own exact-phrase gate, with the Jamf Pro API scale version. Placeholders only.
disable-model-invocation: true
---

# /jamf-lock-erase

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[SERIAL_NUMBER]` (the Mac, as searched in Jamf Pro) · `[DEVICE_ID]` (the Jamf Pro management ID of the Mac — or the supervised iPhone/iPad record for Lost Mode) · `[LOCK_PIN]` (the six-digit lock PIN: generated in and kept by the password manager, never written in the ticket) · `[PHONE_NUMBER]` (the return number shown on the lock screen) · `[@Aegion_JAMF_URL]` (the Jamf Pro server) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- Five commands, five undo stories, five separate gates: **Lock Computer** is reversible with `[LOCK_PIN]`; **Wipe Computer** (that is Jamf's name for the command — never the older erase wording) is permanent and immediate; **Remove MDM Profile** leaves a partially managed Mac unless the framework goes too; **removeFramework then Remove MDM Profile** is the unmanage; **Lost Mode** is for supervised iPhone and iPad only.
- Wipe, Remove MDM Profile and unmanage are R3 and, for a stolen or sold Mac, part of a multi-system plan (Apple Business, Okta, Google) — independent out-of-session review before the wipe or unmanage gates run.
- Every command runs at the Mac's next check-in; a queued command can still be cancelled under the computer's History tab (Pending Commands) until then. Not done until the History read-back shows the command completed.

## Inputs needed

- `[SERIAL_NUMBER]` and the ticket's goal: left somewhere (lock), stolen with sensitive data (wipe), leaving the fleet for sale (unmanage, then the holder erases it), or a supervised iPhone/iPad (Lost Mode).
- From the inventory record (Phase A): macOS version, Apple silicon or T2, whether a bootstrap token is escrowed, MDM capability and supervision, last check-in time.
- The password-manager entry where `[LOCK_PIN]` will live — **[org gap — confirm the vault and who may read it]**.
- For a sale: whether the Mac must also be released from Apple Business (formerly Apple Business Manager) afterwards — irreversible — **[org gap — asset-disposal policy]**.

## How the systems hang together

- **Lock Computer** logs the user out, restarts the Mac and locks it; to unlock, the user must enter the passcode you specified when you sent the command. Apple's MDM lock is a six-digit PIN with an optional short message, and the Mac will not start macOS until the PIN is entered and validated — the data is untouched. On Apple silicon with macOS 11.4 or earlier the passcode is not set and the Mac boots to the Activation screen in macOS Recovery instead, where an administrator with a secure token has to activate it.
- **Wipe Computer** permanently and immediately erases the Mac with the macOS EraseDevice command; it removes the MDM profile, the Jamf management framework and everything Jamf Pro installed. On macOS 12.0.1 or later the Mac tries Erase All Content and Settings first; if that preflight fails, the fallback (obliteration) erases the Mac and macOS must be reinstalled before it can be used. An Apple silicon Mac needs a bootstrap token escrowed with Jamf Pro to receive the EACS wipe. Wiping does not remove the computer record from Jamf Pro or change its inventory information.
- **Remove MDM Profile** removes the MDM profile and every configuration profile Jamf Pro distributed; MDM commands, configuration profiles and APNs-based settings stop. The Jamf management framework (the jamf binary) stays, so the Mac keeps updating inventory, receiving policies and enforcing restricted software — partially managed. **Unmanage** is Jamf's documented order: `sudo /usr/local/bin/jamf removeFramework` on the Mac first, then Remove MDM Profile from Jamf Pro if the profile is non-removable, then optionally delete the record so inventory and licence counts stay accurate.
- **Lost Mode** (supervised iOS and iPadOS only) locks the device, shows your message and phone number on the Lock Screen and reports GPS coordinates; with a passcode set, Data Protection can cut network access after 48 hours or a restart, and a device that cannot receive Disable Lost Mode may have to be erased before it works again.
- Every command is queued and runs at the next check-in; a failed command is reset to pending after four hours and retried at increasing intervals, up to one hour.

If `[@Aegion]` also runs Fleet, its Hosts page offers the same idea (Actions, then Lock or Wipe; a macOS unlock shows a PIN in Fleet that someone types on the Mac) — Fleet is not used in this runbook.

## Fast path

1. Phase A — read the record: management ID, macOS, chip, bootstrap token, last check-in (R0).
2. Phase B — left in a taxi: Lock Computer (R2 gate — the PIN is pre-state); `[LOCK_PIN]` goes to the password manager first. **WAIT UNTIL** History shows the command completed.
3. Phase C — stolen with sensitive data: Wipe Computer (R3 gate, after review). **WAIT UNTIL** History shows the command completed; the record stays.
4. Phase D — sold or leaving the fleet: removeFramework on the Mac (R3 gate), then Remove MDM Profile (R3 gate); the holder erases the Mac afterwards. Releasing it from Apple Business is a separate decision.
5. Phase E — supervised iPhone/iPad: Lost Mode (R1 gate).

## Phase A — Read the record (R0)

**Purpose** — which command you can send, and whether it will land, depends on what the record says.

1. Jamf Pro → Computers → Search inventory → search `[SERIAL_NUMBER]` → open the computer → read the General section (management ID, MDM capable, supervised, last check-in), the Operating System and Hardware sections (macOS version, Apple silicon or T2) and the Security section (bootstrap token escrowed, FileVault).
2. Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → read the Management History: anything still pending or failed changes the plan.
3. Decide the smallest command that solves the ticket: lock (a device that may come back), wipe (data that must not survive), unmanage (a device that leaves the fleet), Lost Mode (iPhone or iPad).

**Verification checkpoint** — [ ] management ID, macOS version, chip, bootstrap token state and last check-in are in the ticket · [ ] no pending or failed commands.

## Phase B — Left in a taxi: Lock Computer (R2, reversible only with the PIN)

**Purpose** — stop anyone using the Mac while it may still come back; nothing is deleted.

<!-- SAFETY GATE [jamf-lock-erase-lock-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** lock one Mac; the user is logged out, the Mac restarts and stays locked until the six-digit [LOCK_PIN] is entered
- **Scope:** one Mac; data is untouched; the command runs at the next check-in and the record stays in Jamf Pro
- **Reversibility:** R2 — one Mac, but unlocking needs [LOCK_PIN], data that must be captured before the command is sent (it is the pre-state): reversible by typing [LOCK_PIN] on the Mac; the PIN lives in the password manager, never in the ticket; on Apple silicon with macOS 11.4 or earlier the passcode is not set and the Mac boots to Recovery's Activation screen instead
- **Required confirmation:** Type exactly `LOCK MAC [SERIAL_NUMBER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-lock-erase-lock-portal]:** Only after `[LOCK_PIN]` is stored in the password manager and the exact match:
1. Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → Management → **Lock Computer**.
2. Enter the six-digit `[LOCK_PIN]` and an optional message with `[PHONE_NUMBER]`, then click **Lock Computer**.

**WAIT UNTIL** Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → Management History shows the command completed (it runs at the next check-in; until then it sits under Pending Commands, where it can still be cancelled).

**Verification checkpoint** — [ ] the command reads completed · [ ] `[LOCK_PIN]` is in the password manager and nowhere else.

## Phase C — Stolen with sensitive data: Wipe Computer (R3, after independent review)

**Purpose** — make the data unrecoverable. The record stays in Jamf Pro; the MDM profile and framework do not.

<!-- SAFETY GATE [jamf-lock-erase-wipe-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** wipe one Mac permanently and immediately (macOS EraseDevice); every local file, the MDM profile and the Jamf management framework are removed
- **Scope:** one Mac; the computer record stays in Jamf Pro; on macOS 12.0.1 or later Erase All Content and Settings runs first and, if its preflight fails, the fallback erases with obliteration (macOS must be reinstalled); an Apple silicon Mac needs a bootstrap token escrowed with Jamf Pro
- **Reversibility:** R3 — not reversible; the data is gone unless it lives elsewhere; Activation Lock may still block reuse, and on a Mac the bypass code is entered through Recovery Assistant's "Activate with MDM key" option when Jamf Pro holds it
- **Required confirmation:** Type exactly `WIPE MAC [SERIAL_NUMBER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-lock-erase-wipe-portal]:** Only after the independent review, the Phase A read-back and the exact match:
1. Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → Management → **Wipe Computer**.
2. If the Remote Wipe Passcode field appears, enter six random digits on a T2 or Apple silicon Mac (no passcode is set on those; the field only applies to Macs that do not support Activation Lock), then click **Wipe Computer**.

**WAIT UNTIL** Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → Management History shows the command completed. A Mac that never comes online never receives it — FileVault and Activation Lock are what protect the data until then.

**Verification checkpoint** — [ ] the command reads completed · [ ] the record still exists and is marked in the ticket as wiped.

## Phase D — Sold or leaving the fleet: unmanage (R3, after independent review)

**Purpose** — stop Jamf Pro managing the Mac without erasing it from here. Jamf's order: remove the management framework on the Mac first, then remove the MDM profile from Jamf Pro if it is non-removable, then (optionally) delete the record. Erasing the Mac for its next owner happens on the Mac, by the holder, afterwards.

Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → General → read whether the MDM profile is removable (an ADE-enrolled Mac's is not).

<details>
<summary>Terminal on the Mac — remove the Jamf management framework (HUMAN-RUN)</summary>

```zsh
# HUMAN-RUN — the administrator runs this in Terminal on the Mac, or over SSH — Aegis never does
# SAFETY GATE [jamf-lock-erase-unmanage]
# Target: [SERIAL_NUMBER]
# Effect: unmanage one Mac by removing every Jamf management framework component from it
# Scope: one Mac — the MDM profile stays until the portal gate below removes it — the inventory record stays in Jamf Pro
# Reversibility: R3 — only by enrolling the Mac again — Automated Device Enrollment or user-initiated enrollment
# Required confirmation: type exactly "UNMANAGE MAC [SERIAL_NUMBER]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="UNMANAGE MAC [SERIAL_NUMBER]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # removes every Jamf management framework component, including the jamf binary
  sudo /usr/local/bin/jamf removeFramework
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the MDM profile is still listed until the portal gate removes it
sudo profiles show
```
</details>

<!-- SAFETY GATE [jamf-lock-erase-remove-mdm-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** remove the MDM profile and every configuration profile Jamf Pro distributed from one Mac; MDM commands and APNs-based settings stop
- **Scope:** one Mac; only after the framework is gone (otherwise the Mac stays partially managed); the inventory record stays unless deleted separately
- **Reversibility:** R3 — only by enrolling the Mac again; the settings those profiles carried are gone with them
- **Required confirmation:** Type exactly `REMOVE MDM PROFILE FROM MAC [SERIAL_NUMBER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-lock-erase-remove-mdm-portal]:** Only after the framework-removal read-back and the exact match:
1. Jamf Pro → Computers → Search inventory → `[SERIAL_NUMBER]` → Management → **Remove MDM Profile**.
2. Confirm the dialog. The profile is removed at the next check-in; read it back on the Mac under System Settings → General → Device Management.

**WAIT UNTIL** Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → Management History shows the command completed and the Mac no longer lists the MDM profile.

> **PREVIEW ONLY [jamf-lock-erase-handover-preview]:** Planning only — nothing here authorizes an erase, a record deletion or a release. Before the Mac changes hands: the holder erases it on the Mac (System Settings → General → Transfer or Reset → Erase All Content and Settings); the Jamf Pro record may be deleted so inventory and licence counts stay accurate; and whether to release it from Apple Business (Devices → Inventory → the Mac → Release from Organization — cannot be undone; a released Mac cannot be assigned to a device management service again, its Activation Lock can no longer be managed from Apple Business, and it only comes back through Apple Configurator or the reseller) is an asset-disposal decision outside this runbook. Never release a Mac that is going to Apple for repair.

**Verification checkpoint** — [ ] removeFramework ran and the MDM profile is gone from the Mac · [ ] the record's fate (kept or deleted) and the Apple Business decision are in the ticket.

## Phase E — Supervised iPhone or iPad: Lost Mode (R1)

**Purpose** — lock a lost mobile device, show a return message and get its location.

<!-- SAFETY GATE [jamf-lock-erase-lost-mode-portal] -->
- **Target:** [DEVICE_ID]
- **Effect:** enable Managed Lost Mode on one supervised iPhone or iPad; the device is unusable, shows your message and its location appears in Jamf Pro
- **Scope:** one supervised iOS or iPadOS device; if you display a phone number, that is the only number the iPhone can call
- **Reversibility:** R1 — the Disable Lost Mode command in the same place; with a passcode set, Data Protection can cut network access after 48 hours or a restart, and a device that cannot receive the disable command may have to be erased
- **Required confirmation:** Type exactly `ENABLE LOST MODE ON DEVICE [DEVICE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-lock-erase-lost-mode-portal]:** Only after the exact match:
1. Jamf Pro → Devices → Search inventory → `[DEVICE_ID]` → Management → **Enable/Disable Lost Mode**.
2. Choose the displayed information, enter the message and `[PHONE_NUMBER]`, optionally tick **Always enforce Lost Mode** and **Lost Mode Sound**, then click **Enable Lost Mode**.

**WAIT UNTIL** the device shows the message and its coordinates appear under Inventory → Security in Jamf Pro.

**Verification checkpoint** — [ ] the Lock Screen shows the message · [ ] coordinates are recorded in the ticket.

<details>
<summary>Jamf Pro API — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — read-only lookup; JAMF_TOKEN is exported in the shell first, from a bearer token (POST /api/v1/auth/token with basic auth, 20-minute expiry, extended with /api/v1/auth/keep-alive) or from API client credentials, and never pasted into a ticket
curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v1/computers-inventory?section=GENERAL&filter=hardware.serialNumber==%22[SERIAL_NUMBER]%22"   # read-only: returns the record; general.managementId is the [DEVICE_ID] the commands below need
```

```bash
# HUMAN-RUN — lock one Mac through the Jamf Pro API — the administrator runs this, Aegis never does
# SAFETY GATE [jamf-lock-erase-lock-api]
# Target: [SERIAL_NUMBER], management ID [DEVICE_ID]
# Effect: lock one Mac with the six-digit [LOCK_PIN] — the user is logged out and the Mac restarts into the lock screen
# Scope: one Mac — the DEVICE_LOCK command is queued and runs at the next check-in
# Reversibility: R2 — reversible only by typing [LOCK_PIN] on the Mac — the PIN is pre-state: store it in the password manager first
# Required confirmation: type exactly "LOCK MAC [SERIAL_NUMBER] MANAGEMENT ID [DEVICE_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="LOCK MAC [SERIAL_NUMBER] MANAGEMENT ID [DEVICE_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # queues DEVICE_LOCK for the next check-in
  curl -sS -X POST "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands" -H "Authorization: Bearer ${JAMF_TOKEN}" -H "Content-Type: application/json" -d '{"clientData":[{"managementId":"[DEVICE_ID]"}],"commandData":{"commandType":"DEVICE_LOCK","pin":"[LOCK_PIN]","message":"Property of [@Aegion] - call [PHONE_NUMBER]"}}'
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the command list for this Mac with each command’s status
curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands?filter=clientManagementId==[DEVICE_ID]"
```

```bash
# HUMAN-RUN — wipe one Mac through the Jamf Pro API, only after the independent review
# SAFETY GATE [jamf-lock-erase-wipe-api]
# Target: [SERIAL_NUMBER], management ID [DEVICE_ID]
# Effect: wipe one Mac permanently with the ERASE_DEVICE command — every local file is destroyed and the Mac leaves management
# Scope: one Mac — obliterationBehavior Default means Erase All Content and Settings first, then the erase fallback — the record stays in Jamf Pro
# Reversibility: R3 — not reversible — the data is gone unless it lives elsewhere
# Required confirmation: type exactly "WIPE MAC [SERIAL_NUMBER] MANAGEMENT ID [DEVICE_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="WIPE MAC [SERIAL_NUMBER] MANAGEMENT ID [DEVICE_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # queues ERASE_DEVICE — it runs at the next check-in
  curl -sS -X POST "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands" -H "Authorization: Bearer ${JAMF_TOKEN}" -H "Content-Type: application/json" -d '{"clientData":[{"managementId":"[DEVICE_ID]"}],"commandData":{"commandType":"ERASE_DEVICE","obliterationBehavior":"Default"}}'
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the command list for this Mac with each command’s status
curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands?filter=clientManagementId==[DEVICE_ID]"
```
</details>

## ⚠️ Risk warning

- **Lock is recoverable, Wipe is not.** Lock when the Mac may come back; wipe only when the data must not survive, after the independent review. The wipe keeps the Jamf Pro record but removes the MDM profile and the framework.
- **Apple silicon needs an escrowed bootstrap token** for the EACS wipe, and on macOS 11.4 or earlier the lock passcode is not set (the Mac boots to Recovery's Activation screen). Read the record first.
- **`[LOCK_PIN]` lives in the password manager** — not in the ticket, not in chat, not in a shell history.
- **Remove MDM Profile alone leaves a partially managed Mac.** For a sale: removeFramework first, then the profile, then the holder erases the Mac. Releasing from Apple Business is irreversible and a separate decision.
- Commands wait for the next check-in; a stolen Mac that never reconnects never receives the wipe — FileVault and Activation Lock are the real protection.

## ✅ Verification checklist

- [ ] Jamf Pro → Computers → `[SERIAL_NUMBER]` → History → Management History shows the Lock Computer / Wipe Computer / Remove MDM Profile command completed, with the admin and time.
- [ ] After a lock: `[LOCK_PIN]` is in the password manager; the Mac shows the lock screen with the message.
- [ ] After a wipe: the record still exists in Jamf Pro and is marked wiped in the ticket; the API read-back lists ERASE_DEVICE as completed.
- [ ] After an unmanage: `profiles show` on the Mac no longer lists the MDM profile, the jamf binary is gone, and the record's fate (kept or deleted) is recorded.
- [ ] After Lost Mode: the device shows the message and Jamf Pro → Devices → `[DEVICE_ID]` → Inventory → Security shows coordinates.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Mac `[SERIAL_NUMBER]` (Jamf Pro management ID `[DEVICE_ID]`): [Lock Computer / Wipe Computer / unmanaged — removeFramework then Remove MDM Profile / Lost Mode on `[DEVICE_ID]`] sent [timestamp] from Jamf Pro, confirmed by the exact phrase[, after independent review]. Pre-state: macOS [version], [Apple silicon / T2], bootstrap token [escrowed / not], last check-in [date]. Management History shows the command completed [timestamp]. [Lock PIN stored in the password manager entry [name].] [Record kept in Jamf Pro / deleted.] [Apple Business: released / kept — per asset-disposal policy.] Time spent: [X] min.

## Aha moment

Every Jamf remote command is a promise kept at the next check-in — the console only queues it, and the Mac has to come online to honor it; that is why FileVault and Activation Lock, not the wipe button, are what protect a stolen Mac.

## Career upgrade

Knowing which device actions are reversible (lock, with a PIN) and which are not (wipe, release), and sequencing unmanage → profile → erase → release correctly, is the device-lifecycle judgment Apple-platform and security roles test for.

## Next action

Run Phase A on `[SERIAL_NUMBER]` and pick the smallest command that solves the ticket; store `[LOCK_PIN]` before any lock.

**Sources (checked 2026-10-15):** learn.jamf.com/r/en-US/jamf-pro-documentation-current/Remote_Commands_for_Computers (Lock Computer, Wipe Computer, Remove MDM Profile, EACS and fallback, record kept) · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Sending_a_Remote_Command_to_a_Computer (Management tab, next check-in, Pending Commands, four-hour retry) · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Performing_a_Simple_Computer_Search · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Unmanaging_Computers · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Wiping_and_Unmanaging_Computers · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Enabling_Lost_Mode · developer.jamf.com/jamf-pro/reference/post_v2-mdm-commands (DEVICE_LOCK, ERASE_DEVICE, clientData/managementId, obliterationBehavior) · developer.jamf.com/jamf-pro/reference/get_v2-mdm-commands (filter clientManagementId, status) · developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory (filter hardware.serialNumber, general.managementId) · developer.jamf.com/jamf-pro/docs/jamf-pro-api-overview (bearer token, 20 minutes, keep-alive) · developer.jamf.com/jamf-pro/docs/client-credentials · support.apple.com/guide/deployment/lock-and-locate-devices-depb980a0be4/web (six-digit PIN, Managed Lost Mode) · support.apple.com/guide/deployment/erase-devices-dep0a819891e/web (EACS, obliteration, bootstrap token, local erase path) · support.apple.com/guide/deployment/activation-lock-depf4ab94ef1/web · support.apple.com/guide/business/release-devices-axmec4d28461/web · fleetdm.com/guides/lock-wipe-hosts — the learn.jamf.com topics were read through the site's content API because the page URLs return only an app shell.
