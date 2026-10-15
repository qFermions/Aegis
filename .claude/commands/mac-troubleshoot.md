---
description: Troubleshoot a managed Mac in an Okta + Jamf shop — login after an Okta password change, FileVault off or key not escrowed, office Wi-Fi on one Mac only, a configuration profile that never installs or a Jamf command stuck pending. Read-only checks first; every mutation gated. Placeholders only.
disable-model-invocation: true
---

# /mac-troubleshoot

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

**Placeholders:** `[DEVICE_NAME]` (the Mac's computer name as Jamf Pro records it) · `[SERIAL_NUMBER]` · `[UPN]` (the user's Okta username) · `[@Aegion_JAMF_URL]`, `[@Aegion_OKTA_ORG_URL]` and other org values from `modules/security/placeholder-dictionary.md`. Which Platform SSO method this shop deploys — Okta Desktop Password Sync, a Secure Enclave-backed key, or none — is an **[org gap]**; read it from the SSO profile in Jamf Pro before trusting Branch A.

## Verdict

Four tickets, one starting point: read the Jamf Pro inventory record — last check-in, FileVault state, pending commands, installed profiles — then branch.

- **A — "Cannot log in after changing the Okta password; the old password still works":** with Okta Desktop Password Sync this is documented, expected behavior. The Mac keeps the old local password until the user unlocks it with the new Okta password; an out-of-sync password is accepted and immediately followed by a prompt for the Okta password. Without Desktop Password Sync, the local password and the Okta password are simply two passwords.
- **B — "FileVault off / no recovery key escrowed":** deferred FileVault enablement needs a logout or login event; FileVault on without a valid escrowed key needs a new personal recovery key generated on the Mac and escrowed to Jamf Pro.
- **C — "Joins every network except the office Wi-Fi; other Macs in the room are fine":** a device-side fault — the Wi-Fi configuration profile is missing or stale, or a saved network is wrong. The AP and network side is `/wifi-issue`.
- **D — "Profile not in System Settings, Jamf says the command is pending":** the command is queued and the Mac has not checked in — asleep, off the network, or unable to reach Jamf Pro or APNs. Pending means "not yet"; failed is reset to pending after four hours.

## What to check first

1. **Jamf (R0):** Jamf Pro → Computers → Search inventory → `[DEVICE_NAME]` → read the last check-in and last inventory update.
2. **Commands (R0):** same record → **History** → **Management History** → read completed, pending and failed commands.
3. **Disk encryption (R0):** same record → **Inventory** → **Disk Encryption** → read FileVault 2 Enabled, the partition encryption state and Personal Recovery Key Validation.
4. **On the Mac (R0):** System Settings → General → Device Management → read the installed profiles (MDM, Wi-Fi, FileVault, SSO).
5. **Okta (R0):** Okta Admin Console → Directory → People → `[UPN]` → read Status, including whether the account is locked.

## Step-by-step fix

### Branch A — Login after an Okta password change

**Purpose** — separate documented password-sync behavior from a real fault, and never touch the keychain blindly.

**What Okta documents (Desktop Password Sync on Platform SSO):**
- After registration "the device password is replaced with the Okta password." If a user changes their Okta password, "they need to sync their password by locking the computer and then unlocking it with the updated password."
- When "the user enters an out-of-sync password to unlock or sign in to the computer", the computer unlocks and the user is immediately prompted for their Okta password to complete the sync — so the old password still working is the sync path, not a bug.
- Syncing at the macOS login window is supported once Desktop Password Sync runs on Platform SSO 2.0 (macOS 14 or later); macOS 15 added syncing at the FileVault window on physical Apple silicon Macs.
- macOS 15: after a sync the user is asked for their old Mac password to unlock the login keychain. If they have forgotten it, "the previous keychain and all protected data become inaccessible" — Okta states this cannot be reversed.
- A long random Okta password typed blind at the login window can lock the Okta account where failed-attempt limits apply; the registration prompt is suppressed while Focus is set to Do Not Disturb; a local password changed through the macOS password-expiration prompt breaks the sync (Okta says to disable macOS password expiration in the MDM before deploying).
- Apple's own description: with password authentication, "the local user password automatically syncs with the IdP whenever a user changes their password, either locally or remotely", and the registration status is visible in Users & Groups under Network account server, with a repair option.

**What is not documented, or is org-specific:**
- Whether this shop deploys Desktop Password Sync, the Secure Enclave-backed key (no password sync at all) or no Platform SSO — **[org gap]**. With no Platform SSO no official page describes any sync; the local password stays what it was — **[unverified: inferred from the absence of a documented mechanism, not from a vendor statement]**.
- A log predicate or Okta Verify diagnostic for the sync — not on any fetched Okta or Apple page.

**Steps:**
1. System Settings → Users & Groups → read the Network account server entry: Apple shows the Platform SSO registration status there (read only; the repair option is a change).
2. System Settings → General → Device Management → read whether the SSO extension profile is installed; Jamf Pro → Computers → Configuration profiles → the Platform SSO profile → read whether its scope includes `[DEVICE_NAME]`.
3. Okta Admin Console → Directory → People → `[UPN]` → read Status. A locked account is `/okta-user-lifecycle`'s job, not a Mac fix.
4. Have the user lock the screen from the Apple menu and unlock it with the new Okta password; if macOS asks for the old password for the keychain, they enter it once. Done when: the new password works at the lock screen and at the login window.
5. If the Mac is registered but never prompts for the Okta password: have the user turn off Do Not Disturb, then wait a few minutes or sign out and back in.

**Gotcha** — if the user cannot remember the old password at the keychain prompt, stop and escalate; a deleted keychain loses saved passwords and the Okta FastPass enrollment.

### Branch B — FileVault off, or the key is not escrowed

**Purpose** — get the disk encrypted and a valid personal recovery key into Jamf Pro without ever turning FileVault off.

1. Jamf Pro → Computers → Search inventory → `[DEVICE_NAME]` → **Inventory** → **Disk Encryption** → read **FileVault 2 Enabled** (collected through declarative device management on macOS 14 or later), **FileVault 2 Partition Encryption State**, **Personal Recovery Key Validation** (Valid, Invalid, or Unknown — Unknown also means there is no key in Jamf Pro to validate against) and **Device Recovery Key** (present only when the key was escrowed by a configuration profile).
2. Jamf Pro → Computers → Configuration profiles → the FileVault profile → read the Security & Privacy payload: Enable FileVault, Event to prompt = At Login, Personal recovery key, **Escrow Personal Recovery Key** selected, and a scope that includes `[DEVICE_NAME]`. No profile in scope means no escrow; widening the scope is its own change, done before anything on the Mac.
3. On the Mac: System Settings → Privacy & Security → FileVault → read On or Off; the Terminal read-back below confirms it.
4. **FileVault Off:** Apple's deferred enablement "requires a logout or login event from the user" — have the user log out and back in; the profile prompts at login. Done when: System Settings → Privacy & Security → FileVault reads On and Jamf Pro reads Enabled after the next inventory update. If the profile is in scope and the prompt never comes, the gated manual turn-on below is the fallback.
5. **FileVault On, key Invalid or Unknown:** Jamf documents generating a new personal recovery key on the Mac and escrowing it — the gated Terminal procedure in the scale version below (needs the escrow profile already installed and a local user with a secure token at the keyboard).

<!-- SAFETY GATE [mac-troubleshoot-filevault-enable-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** enable FileVault on the Mac; the user's login password becomes the disk unlock password
- **Scope:** one Mac's startup disk; no data is deleted
- **Reversibility:** R1 — FileVault can be turned off again from the same pane under its own phrase, and only with a documented reason, because an unencrypted Mac fails compliance
- **Required confirmation:** Type exactly `ENABLE FILEVAULT ON [DEVICE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mac-troubleshoot-filevault-enable-portal]:** Only when the escrow profile is installed (so the key goes to Jamf Pro, not to a sticky note) and after the exact match:
1. On the Mac: System Settings → Privacy & Security → FileVault → **Turn On** → authenticate as the local user.
2. Read-back in Jamf Pro after the next inventory update: Personal Recovery Key Validation = Valid.

**Gotcha** — Apple's warning stands: lose the password and the recovery key and "your files and settings will be lost forever". Apple silicon and T2 Macs are already encrypted; FileVault adds the password protection and the escrowable key.

### Branch C — Office Wi-Fi: this Mac only

**Purpose** — the room's other Macs prove the network; isolate what this Mac lacks.

1. System Settings → Wi-Fi → read whether the office network is listed, its status, and (via **Details**) the saved settings.
2. System Settings → General → Device Management → read whether the Wi-Fi configuration profile is installed; if it is missing, this is Branch D.
3. Jamf Pro → Computers → Configuration profiles → the Wi-Fi profile → read the Network payload (SSID, Auto Join, Security Type) and the scope. An enterprise network needs the 802.1X configuration Jamf documents separately, and a profile carrying an old password keeps failing silently — Jamf's own advice is a secondary profile during a password change.
4. Terminal read-backs below: which network the Mac is on and which interface is Wi-Fi.
5. Network side (AP, PoE, client count, RADIUS): `/wifi-issue`.

<!-- SAFETY GATE [mac-troubleshoot-wifi-forget-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** remove the saved office Wi-Fi network from the Mac so it joins fresh with the current password or profile
- **Scope:** one saved network on one Mac; other networks and the profile in Jamf Pro are untouched
- **Reversibility:** R1 — the Mac rejoins with the password, or the Wi-Fi profile re-adds the network at the next Jamf check-in
- **Required confirmation:** Type exactly `REMOVE SAVED OFFICE WIFI NETWORK FROM [DEVICE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mac-troubleshoot-wifi-forget-portal]:** Only after steps 1–3 point at a stale saved network and the exact match:
1. On the Mac: System Settings → Wi-Fi → the office network → **Details** → **Forget This Network** → confirm.
2. Join the network again; if a profile supplies it, **WAIT UNTIL** the next Jamf check-in re-adds it. Done when: System Settings → Wi-Fi shows the office network connected and the read-back below names it.

### Branch D — Profile not installed, Jamf command pending

**Purpose** — a pending command is a check-in problem, not a profile problem.

1. Jamf Pro → Computers → Search inventory → `[DEVICE_NAME]` → **History** → **Management History** → read the command. Pending runs "the next time the computer checks in with Jamf Pro"; a failed command is reset to pending after four hours and retried at increasing intervals of up to one hour.
2. Same record → read the last check-in. A stale check-in means the Mac is asleep, off the network, or cannot reach Jamf Pro or APNs — fix connectivity (Branch C) first.
3. Jamf Pro → Computers → Configuration profiles → the profile → read its scope, including exclusions and limitations, for `[DEVICE_NAME]`.
4. On the Mac: System Settings → General → Device Management → read the installed profiles; the Terminal read-backs below show the enrollment profile and the recent MDM client log lines.
5. Same record → **History** → **Pending Commands** → read the queue. Cancelling a command there is a change in its own right and is not part of this runbook.
6. If the Mac is online and checked in but the command still waits, nudge it: the gated blank push (portal) or the gated check-in (Terminal, below).

<!-- SAFETY GATE [mac-troubleshoot-blank-push-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** request a check-in from the Mac by sending a blank push through APNs and the declarative status channel
- **Scope:** one Mac; no setting, profile or data changes — the Mac only contacts Jamf Pro for its queued instructions
- **Reversibility:** R1 — nothing to undo; the commands that then run are the ones already visible under Pending Commands
- **Required confirmation:** Type exactly `SEND BLANK PUSH TO [DEVICE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mac-troubleshoot-blank-push-portal]:** Only after step 2 shows the Mac online and the exact match:
1. Jamf Pro → Computers → Search inventory → `[DEVICE_NAME]` → **Management** → **Send Blank Push**.
2. **WAIT UNTIL** History → Management History moves the command from pending to completed; then System Settings → General → Device Management shows the profile.

<details>
<summary>Terminal on the Mac — the scale version (HUMAN-RUN; read-only first, gated mutations after)</summary>

```zsh
# HUMAN-RUN — read-only diagnostics; nothing here changes anything
sudo fdesetup status   # prints whether FileVault is On or Off (Branch B)
networksetup -listallhardwareports   # maps the Wi-Fi port to its interface name, usually en0 (Branch C)
networksetup -getairportnetwork en0   # names the Wi-Fi network en0 is joined to, or says it is not associated (Branch C)
sudo profiles show -type enrollment   # shows the Automated Device Enrollment configuration (Apple documents profiles show and its 10-per-24-hours limit on organization-owned Macs; the -type enrollment filter is [unverified: the profiles man page is not hosted on support.apple.com]) (Branch D)
log show --last 1h --info --predicate 'process == "mdmclient"'   # reads the last hour of the MDM client's unified-log lines (a generic macOS log read; the filter is not from a vendor page) (Branch D)
```

```zsh
# HUMAN-RUN — Branch B, generate and escrow a new personal recovery key (the Jamf-documented procedure)
# Needs the FileVault escrow configuration profile already installed and a local user with a secure token at the keyboard
# SAFETY GATE [mac-troubleshoot-prk-replace]
# Target: [DEVICE_NAME]
# Effect: replace the FileVault personal recovery key on the Mac and escrow the new key to Jamf Pro at the next inventory update
# Scope: one Mac; the disk stays encrypted and no data is touched; the previous key stops working
# Reversibility: R2 — not reversible — the previous key is invalidated; the new key is the only one Jamf Pro holds
# Required confirmation: type exactly `REPLACE FILEVAULT RECOVERY KEY ON [DEVICE_NAME]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="REPLACE FILEVAULT RECOVERY KEY ON [DEVICE_NAME]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  sudo /usr/bin/fdesetup changerecovery -personal   # asks for the secure-token user's name and password, then shows the new key
  sudo /usr/local/bin/jamf recon   # submits an inventory update so Jamf Pro receives the escrowed key
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
sudo fdesetup status   # read-back on the Mac; then read Personal Recovery Key Validation = Valid in Jamf Pro
```

```zsh
# HUMAN-RUN — Branch D, force a check-in so queued policies run now
# SAFETY GATE [mac-troubleshoot-jamf-checkin]
# Target: [DEVICE_NAME]
# Effect: request an immediate check-in with Jamf Pro from the Mac so every policy pending for it runs now
# Scope: one Mac; only policies already scoped to it run — nothing new is created
# Reversibility: R1 — nothing to undo for the check-in itself; whatever a policy installs is governed by that policy's own undo
# Required confirmation: type exactly `SEND JAMF CHECK-IN REQUEST FROM [DEVICE_NAME]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="SEND JAMF CHECK-IN REQUEST FROM [DEVICE_NAME]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  sudo /usr/local/bin/jamf policy   # starts a check-in with Jamf Pro (Jamf 100 course wording)
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
sudo profiles show   # read-back on the Mac; the expected configuration profile now appears (counts toward the 10-per-24-hours profiles limit)
```
</details>

## ⚠️ Risk warning

- **Never turn FileVault off to "re-escrow", and never reset a keychain to "fix" a login.** Both destroy data; a lost password plus a lost key is unrecoverable, and a deleted keychain loses saved passwords and the Okta FastPass enrollment.
- A random Okta password typed blind at the login window can lock the Okta account; have the user set a memorable Okta password before syncing.
- `profiles show` and `profiles renew` are limited to 10 calls per 24 hours on organization-owned Macs — do not loop them while "waiting" for a command.
- The gated check-in runs every policy pending for the Mac, not only the one you want; read Pending Commands and the policy list first.
- Cancelling pending commands, widening a profile's scope and repairing the Platform SSO registration are each their own change; this runbook reads them and does not edit them.

## ✅ Verification checklist

- [ ] Branch A: the user signs in at the login window with the new Okta password; Okta Admin Console → Directory → People → `[UPN]` reads Active and not locked; Reports → System Log shows the sign-in.
- [ ] Branch B: Jamf Pro → Computers → `[DEVICE_NAME]` → Inventory → Disk Encryption reads FileVault 2 Enabled = Enabled and Personal Recovery Key Validation = Valid; `sudo fdesetup status` on the Mac reads On.
- [ ] Branch C: `networksetup -getairportnetwork en0` names the office network; System Settings → Wi-Fi shows it connected; the Wi-Fi profile is listed under Device Management.
- [ ] Branch D: Jamf Pro → Computers → `[DEVICE_NAME]` → History → Management History shows the command completed; System Settings → General → Device Management lists the profile.

## 📝 Jira-ready note

> Resolved [date/time]. Mac `[DEVICE_NAME]` (`[SERIAL_NUMBER]`), user `[UPN]`: [login rejected after an Okta password change / FileVault off or key not escrowed / office Wi-Fi not joining / profile pending in Jamf]. Cause: [password not yet synced through Desktop Password Sync / FileVault deferred until next login / no valid escrowed key / stale saved network or Wi-Fi profile out of scope / Mac not checking in with Jamf Pro]. Fix: [lock-unlock sync with the new Okta password / login cycle, FileVault on / new personal recovery key generated and escrowed, confirmed by the exact phrase / saved network forgotten and rejoined / blank push or check-in, confirmed by the exact phrase]. Verified: [Jamf inventory read-back / System Settings read-back / Okta System Log]. Time spent: [X] min.

## Aha moment

Pending, out-of-sync and Off are each statements about *when*, not *whether* — the next check-in, the next unlock, the next login. Find the event the system is waiting for before you force anything.

## Career upgrade

Reading the control plane first (Jamf history, Okta logs) before touching the endpoint is the same habit as reading the reconciler's state before restarting a pod — it turns "try a reboot" into a diagnosis.

## Next action

Open the Jamf Pro inventory record for `[DEVICE_NAME]`, record last check-in, FileVault state and pending commands, then pick the branch.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/oda/macos-pw-sync/troubleshoot-macos-password-sync.htm ("Support your macOS users") · help.okta.com/oie/en-us/content/topics/oda/macos-pw-sync/about-psso.htm · help.okta.com/oie/en-us/content/topics/oda/macos-pw-sync/configure-macos-psso-jamf.htm · help.okta.com/oie/en-us/content/topics/oda/device-logout.htm (Reports → System Log) · support.apple.com/guide/deployment/platform-sso-for-mac-dep7bbb05313/web · support.apple.com/guide/mac-help/change-users-groups-settings-mtusr001/mac · support.apple.com/guide/mac-help/protect-data-on-your-mac-with-filevault-mh11785/mac · support.apple.com/guide/deployment/manage-filevault-with-device-management-dep0a2cb7686/web · support.apple.com/guide/mac-help/configuration-profiles-standardize-settings-mh35561/mac · support.apple.com/guide/mac-help/wi-fi-settings-on-mac-mh11935/mac · support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Disk_Encryption_Category · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Viewing_the_FileVault_Recovery_Key_for_a_Computer · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Generating_and_Escrowing_a_New_Personal_Recovery_Key_Using_Terminal · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Activating_FileVault_Disk_Encryption_using_a_Configuration_Profile · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Sending_a_Remote_Command_to_a_Computer · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Remote_Commands_for_Computers · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Inventory_Information · learn.jamf.com/r/en-US/jamf-pro-documentation-current/configuring_wi-fi_for_macos_computers · learn.jamf.com/r/en-US/jamf-pro-documentation-current/Viewing_History_Information_for_a_Computer · learn.jamf.com Jamf 100 Course, Lesson 24 (jamf policy and jamf recon) (learn.jamf.com topics read through the site's content API because the page URLs serve only an app shell).
