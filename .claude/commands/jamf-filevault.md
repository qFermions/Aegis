---
description: FileVault with Jamf Pro. Turn FileVault on with a profile that escrows the personal recovery key (pilot, then rollout), show one Mac's key to unlock it after a forgotten password (a gated disclosure a person reads in the console; the adapter never reads keys), issue a new key afterwards, and handle a request to turn FileVault off as planning only. Names the View Disk Encryption Recovery Key privilege. Placeholders only.
disable-model-invocation: true
---

# /jamf-filevault

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[SERIAL_NUMBER]` (the Mac, as searched in Jamf Pro) · `[DEVICE_ID]` (the Jamf Pro computer ID that the inventory record and `computer` show; `history` takes it) · `[PROFILE_NAME]` / `[PROFILE_ID]` (the FileVault configuration profile) · `[PROFILE_IDENTIFIER]` (that profile's own PayloadIdentifier: `payloadSummary[0].profile.PayloadIdentifier` in the `profile --id` read) · `[POLICY_NAME]` / `[POLICY_ID]` (the new-key policy) · `[SMART_GROUP]` (the pilot group, or the rollout group where a gate says so) · `[SMART_GROUP_ID]` and `[MEMBER_COUNT]` (that group's ID and the member count recorded before the change) · `[ISSUE_ID]` (the Linear issue) · `[ADMIN_NAME]` · `[@Aegion_JAMF_URL]` (the Jamf Pro server, `JAMF_URL` for the adapter) · org values from `modules/security/placeholder-dictionary.md`. The recovery key itself never gets a placeholder: it is never written down.

## ⚠️ Admin / safety gate

- Four gated actions and one planning-only request: a FileVault profile for the pilot group (R3, a security control), the same profile widened to the rollout group (R3, after independent review), showing one Mac's recovery key (R3, a disclosure), issuing a new recovery key (R2), and turning FileVault off (planning only here, Phase E).
- **Showing a key is a gated disclosure.** A person reads it on the Jamf Pro screen for the one Mac in the ticket, after the requester is verified **[org gap]**. It never goes into Linear, Slack, chat, a file or a screenshot, and Phase D replaces it once the Mac is back with its user. The read-only adapter never reads a key: it refuses the FileVault key paths and strips key-like fields from every response.
- **Never export FileVault keys.** A Jamf support article's title describes exporting keys through the portal; that bulk disclosure is out of scope for Aegis.
- Turning FileVault off removes a security control (R3). This runbook does not carry it out (Phase E).
- Not done until the read-back proves it: Disk Encryption shows FileVault enabled and Personal Recovery Key Validation reads Valid.

**Roles needed:** View Disk Encryption Recovery Key for Phase C (the privilege that shows the key) · the configuration profile privileges for Phase B and the policy privileges for Phase D (their English names were not in this batch's sources; a custom privilege set needs privileges on both the computer and the object the task changes). The adapter's own API client holds read privileges only and must never hold View Disk Encryption Recovery Key.

**Stop conditions:** the requester for a key cannot be verified · Personal Recovery Key Validation is not Valid before Phase C (the shown key may not unlock the Mac) · the group's member count differs from the count in the ticket (`verify-group-count` exits 2) · the new-key policy logs "Authentication error" (the escrowed key is invalid; fix escrow first).

## Inputs needed

- `[SERIAL_NUMBER]` and the ticket's goal: encrypt Macs that are not encrypted (Phase B), unlock a Mac whose user forgot the password (Phase C, then Phase D), replace a shown, Invalid or missing key (Phase D), or a request to turn FileVault off (Phase E).
- How a person asking for a key proves who they are, and how the key reaches the person at the Mac (in person, or read aloud on a verified call): **[org gap]**.
- For a profile: the pilot group `[SMART_GROUP]` (exists, 10 Macs or fewer), the rollout group and the independent reviewer: **[org gap]**.
- Whether the shop also uses an institutional recovery key: **[org gap]**. This runbook uses the personal recovery key Jamf recommends.

## How the systems hang together

- Jamf recommends turning FileVault on with a configuration profile that uses a **personal recovery key** (PRK). The Mac escrows the key to Jamf Pro at its next inventory update, which can take one or two inventory submissions; Jamf Pro's built-in Update Inventory policy submits inventory once a week by default. `/jamf-enroll-mac` Phase E holds the gated on-Mac inventory submission.
- Institutional recovery keys carry more risk, and one that includes its private key cannot turn FileVault on through a configuration profile (a policy is needed).
- The inventory record's **Disk Encryption** section shows the FileVault state and **Personal Recovery Key Validation**; Jamf's guidance is to check that it reads Valid before relying on the escrowed key.
- The key is shown only in the Jamf Pro console, to an account holding **View Disk Encryption Recovery Key**, by a person clicking Show Key. Accounts without the privilege may not see the key field at all. The read-only adapter refuses the Jamf Pro API's FileVault key reads (the per-computer and the bulk path, listed in `docs/aegis/lanes/g2.md`) before credentials or network.
- A policy whose Disk Encryption payload has the action **Issue New Recovery Key** replaces the key at the Mac's next check-in (macOS 10.14 or later). It prompts the FileVault user for their password and needs a valid escrowed key or a FileVault-enabled user with a secure token; with an invalid escrowed key it fails with "Authentication error". The old key cannot be brought back.
- A new hire's Mac gets FileVault during setup (`/mac-new-hire-laptop`); a lost or stolen Mac is `/jamf-lock-erase`, where FileVault is what protects the data until a wipe lands; on-Mac checks and the Terminal key replacement are `/mac-troubleshoot` Branch B.

## Fast path

1. Phase A: read the Disk Encryption state, Personal Recovery Key Validation and whether your account sees Show Key (R0).
2. Not encrypted: Phase B, profile to the pilot group (R3 gate). **WAIT UNTIL** each pilot Mac reads enabled and Valid, then widen to the rollout group (R3 gate, after review).
3. Forgotten password: Phase C shows the key to unlock one Mac (R3 disclosure gate), then Phase D replaces it (R2 gate).
4. Key Invalid or missing: Phase D, once the escrow profile from Phase B is in scope.
5. "Turn FileVault off for the repair shop": Phase E, planning only.

## Phase A: Read the encryption state and your own access (R0)

**Purpose:** know whether the Mac is encrypted, whether Jamf Pro holds a valid key for it, and whether your account may see that key.

**GUI steps:**
1. Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Inventory → Disk Encryption → read the FileVault state and Personal Recovery Key Validation.
2. Same record → note the Jamf Pro computer ID (`[DEVICE_ID]`) and the last inventory update.
3. Same Disk Encryption section → see whether Show Key is offered next to Personal Recovery Key. Do not use it here.
4. No Show Key on screen: your account lacks the privilege. Stop and escalate (below); there is no workaround.

**Role needed (to see a key):** the Jamf Pro privilege View Disk Encryption Recovery Key on the signed-in account (Jamf's support article on permission to view FileVault recovery keys; read as a search excerpt). An account without it may not see the key field at all.

**Escalate, never work around:** ask the Jamf Pro administrator who manages accounts (Jamf Pro → Settings → System → User accounts and groups; labels unverified) to grant View Disk Encryption Recovery Key to your account or to a Jamf Pro group you belong to, whose members inherit its privileges. The grant is that administrator's own change, recorded in their ticket. Do not borrow another account, call the API for the key, or ask anyone to send a key in chat.

<details>
<summary>Jamf Pro read-only adapter: the scale version (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN, read-only, nothing here changes anything, and no read returns a key
# reads the Disk Encryption section of one Mac with key-like fields stripped by the adapter
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section DISK_ENCRYPTION --execute
# proves FileVault is enabled and the personal recovery key is Valid; exit 2 means it is not
node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER] --execute
# finds a smart group by name and prints its ID, for a group-wide read
node scripts/adapters/jamf-client.js smart-groups --name [SMART_GROUP] --execute
# lists the members of that group, so each one can be checked with verify-filevault
node scripts/adapters/jamf-client.js group-members --id [SMART_GROUP_ID] --execute
```
</details>

**Verification checkpoint:** [ ] FileVault state, Personal Recovery Key Validation and `[DEVICE_ID]` are in the ticket · [ ] you know whether your account sees Show Key.

## Phase B: Turn FileVault on with an escrowing profile (R3)

**Purpose:** encrypt Macs that are not encrypted and get each Mac's personal recovery key into Jamf Pro, pilot first.

Before the gate: `verify-group-count` passes for the pilot group, and the payload fields to set are the ones `/mac-troubleshoot` Branch B reads (this batch's sources did not name the payloads).

**Role needed:** a Jamf Pro account with the privileges for computer configuration profiles and for the computers in scope (English names not in this batch's sources).

<!-- SAFETY GATE [jamf-filevault-pilot-profile-portal] -->
- **Target:** [PROFILE_NAME] scoped to [SMART_GROUP]
- **Effect:** create one FileVault configuration profile [PROFILE_NAME] that turns on FileVault with a personal recovery key escrowed to Jamf Pro; scope it to the pilot group [SMART_GROUP]
- **Scope:** the pilot Macs counted in Phase A, 10 or fewer; each installs the profile at its next check-in
- **Reversibility:** R3: a security control on every pilot Mac; whether taking the profile away decrypts the disk was not confirmed in this batch's sources (safer reading: it does not, and it only stops enforcement)
- **Required confirmation:** Type exactly `CREATE AND SCOPE FILEVAULT PROFILE [PROFILE_NAME] TO [SMART_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-filevault-pilot-profile-portal]:** Only after `verify-group-count` passes and the exact match:
1. Jamf Pro → Computers → Configuration Profiles → New → General: name `[PROFILE_NAME]`, computer level.
2. In the FileVault payload, turn FileVault on with a personal recovery key and escrow it to Jamf Pro (payload labels unverified in this batch; the fields `/mac-troubleshoot` Branch B reads are the ones to set).
3. Scope → Targets → `[SMART_GROUP]` → Save.

**WAIT UNTIL** each pilot Mac has checked in (the profile installs) and has submitted inventory once or twice (the key is escrowed at an inventory update).

<details>
<summary>Read-back through the adapter (HUMAN-RUN, read-only)</summary>

```bash
# the new profile's own identifier is payloadSummary[0].profile.PayloadIdentifier - write it in the ticket as [PROFILE_IDENTIFIER]
node scripts/adapters/jamf-client.js profile --id [PROFILE_ID] --execute
# proves one pilot Mac lists this FileVault profile, by its id and its identifier
node scripts/adapters/jamf-client.js verify-profile --serial [SERIAL_NUMBER] --profile-id [PROFILE_ID] --profile-identifier [PROFILE_IDENTIFIER] --execute
# proves FileVault is enabled on that Mac and its escrowed key is Valid
node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER] --execute
```
</details>

GUI read-back: Jamf Pro → Computers → Configuration Profiles → read the Complete, Remaining and Failed counts on the `[PROFILE_NAME]` row (a count opens the list of Macs behind it); Remaining falls to 0 and Failed stays at 0.

Rollout stage, after the pilot read-back passed for every pilot Mac and an independent out-of-session review is recorded: `verify-group-count` passes for the rollout group first.

**Role needed:** the same configuration profile privileges as the pilot gate.

<!-- SAFETY GATE [jamf-filevault-widen-profile-portal] -->
- **Target:** [PROFILE_NAME] scoped to [SMART_GROUP]
- **Effect:** scope FileVault profile [PROFILE_NAME] to the rollout group [SMART_GROUP]; distribute it to newly assigned Macs only; turn on FileVault on each new member at its next check-in
- **Scope:** every member of the rollout group at the recorded count, more than 10 Macs or all computers; Macs that already have the profile are left as they are
- **Reversibility:** R3: a security control across the fleet; narrowing the scope again is its own change, and decryption is not confirmed to follow
- **Required confirmation:** Type exactly `SCOPE AND DISTRIBUTE FILEVAULT PROFILE [PROFILE_NAME] TO [SMART_GROUP] TO TURN ON FILEVAULT`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-filevault-widen-profile-portal]:** Only after the pilot read-back, the independent review, `verify-group-count` on the rollout group and the exact match:
1. Jamf Pro → Computers → Configuration Profiles → `[PROFILE_NAME]` → Edit → Scope → Targets → `[SMART_GROUP]` → Save.
2. When Jamf Pro asks how to distribute the change, choose **Distribute to Newly Assigned Devices Only**. The other choice sends a remove command and then reinstalls the profile on every Mac that already has it.

**WAIT UNTIL** the new members have checked in and submitted inventory; then the status counts read Remaining 0 and Failed 0, and the pilot read-back fence above (`verify-profile`, then `verify-filevault`) passes on a sample of serials.

**Verification checkpoint:** [ ] every pilot Mac reads FileVault enabled and Personal Recovery Key Validation Valid · [ ] the rollout sample does too, and Failed is 0.

## Phase C: Forgotten password: show the key to unlock one Mac (R3 disclosure)

**Purpose:** let the user back into one encrypted Mac with its recovery key, without the key leaving the Jamf Pro screen.

Before the gate: the requester is verified **[org gap]**, Phase A read Personal Recovery Key Validation = Valid, and the person at the Mac is ready to type.

**Role needed:** View Disk Encryption Recovery Key, the Jamf Pro privilege that shows a FileVault key, on the account that opens Show Key.

<!-- SAFETY GATE [jamf-filevault-show-key-portal] -->
- **Target:** [SERIAL_NUMBER]
- **Effect:** show the FileVault personal recovery key of one Mac on the Jamf Pro screen to the signed-in administrator
- **Scope:** one Mac's key, read by one person in the console; never copied into Linear, Slack, chat, a file or a screenshot
- **Reversibility:** R3: a disclosure cannot be undone; the only remedy is Phase D, which replaces the key once the Mac is back with its user and the new password is set
- **Required confirmation:** Type exactly `SHOW FILEVAULT KEY FOR [SERIAL_NUMBER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-filevault-show-key-portal]:** Only after the requester is verified and the exact match:
1. Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Inventory → Disk Encryption → Personal Recovery Key → **Show Key**.
2. Read the key to the person at the Mac through the channel set in Inputs needed; they type it where the Mac asks for the recovery key and set a new password. The on-Mac steps are in Jamf's support article "How to Reset Passwords with the FileVault Recovery Key in Jamf Pro" (this batch read only its search excerpt). Then close the record.

Read-back: the adapter never reads the key, and whether Jamf Pro logs who viewed it was not confirmed, so the ticket is the record: who viewed it, when, for which serial, and that the user is signed in again. Phase D follows the same day.

**Verification checkpoint:** [ ] the user is signed in with a new password · [ ] the ticket records who viewed the key and when, and holds no key.

## Phase D: Issue a new recovery key (R2)

**Purpose:** retire a key that was shown, or replace a key that reads Invalid or is missing.

Prerequisites: macOS 10.14 or later; the Mac has a valid escrowed key or a FileVault-enabled user with a secure token. With an invalid escrowed key this policy fails with "Authentication error": put the Mac in the Phase B profile's scope first, or use the Terminal procedure in `/mac-troubleshoot` Branch B.

**Role needed:** a Jamf Pro account with the privileges for policies and for the computer in scope (English names not in this batch's sources).

<!-- SAFETY GATE [jamf-filevault-new-key-portal] -->
- **Target:** [SERIAL_NUMBER] through policy [POLICY_NAME]
- **Effect:** create one policy [POLICY_NAME] that issues a new FileVault personal recovery key on one Mac at its next check-in; the previous key is superseded
- **Scope:** one Mac; the disk stays encrypted and no data is touched; the FileVault user is prompted for their password
- **Reversibility:** R2: the previous key cannot be restored; a failed run is fixed (escrow first) and run again under this same gate
- **Required confirmation:** Type exactly `CREATE POLICY [POLICY_NAME] TO ISSUE NEW FILEVAULT KEY FOR [SERIAL_NUMBER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-filevault-new-key-portal]:** Only after the prerequisites read true and the exact match:
1. Jamf Pro → Computers → Policies → New → General: name `[POLICY_NAME]`, trigger Recurring Check-in, execution frequency Once per computer.
2. Disk Encryption payload → Configure → Action: Issue New Recovery Key (Individual) → Scope → `[SERIAL_NUMBER]` → Save.

**WAIT UNTIL** the Mac checks in (the user enters their password at the prompt) and then submits inventory once or twice, which escrows the new key.

<details>
<summary>Read-back through the adapter (HUMAN-RUN, read-only)</summary>

```bash
# proves the new-key policy is enabled on Recurring Check-in, Once per computer, as the gate created it; exit 2 means it is not
node scripts/adapters/jamf-client.js verify-policy --id [POLICY_ID] --trigger checkin --frequency "Once per computer" --enabled true --execute
# reads the policy logs of the Mac; the new-key policy should show as completed, not as an authentication error
node scripts/adapters/jamf-client.js history --id [DEVICE_ID] --subset PolicyLogs --execute
# proves the new escrowed key is Valid after the next inventory update
node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER] --execute
```
</details>

GUI read-back: Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Inventory → Disk Encryption → Personal Recovery Key Validation reads Valid. Once per computer keeps the policy from running again; turning it off afterwards is its own change.

**Verification checkpoint:** [ ] the policy log shows the run completed · [ ] `verify-filevault` passes after the next inventory update.

## Phase E: A request to turn FileVault off (planning only)

**Purpose:** answer "turn FileVault off so the repair shop can work on it" without removing the control from this runbook.

> **PREVIEW ONLY [jamf-filevault-turn-off-preview]:** Planning only: nothing here authorizes turning FileVault off, taking the FileVault profile off a Mac or decrypting a disk. Turning FileVault off removes a security control (R3). This batch's Jamf sources describe turning FileVault on and replacing keys, not a Jamf Pro action that turns it off, and whether taking the profile away decrypts the disk is unverified (safer reading: it does not, and enforcement simply stops). A real need goes to a separately reviewed change: the repair provider's written reason, a "Temporary exception (high risk)" record with approver and expiry, the revert path (the Mac back in the Phase B profile's scope and Valid in Disk Encryption), and an independent out-of-session review.

What to offer instead, from this runbook: the user unlocks the Mac in front of the provider; or, when the user cannot, Phase C shows the key under its own gate and Phase D replaces it the day the Mac comes back.

**Verification checkpoint:** [ ] the ticket records the decision (declined, or routed to a reviewed change) · [ ] Disk Encryption still reads FileVault enabled for `[SERIAL_NUMBER]`.

## ⚠️ Risk warning

- **A shown key is a spent key.** Show it only for the Mac in the ticket, to a verified requester, and replace it with Phase D. A key in a ticket, chat or screenshot is a disclosure to everyone who can read it.
- **No privilege, no key.** If Show Key is missing, the fix is an access request for View Disk Encryption Recovery Key, never another account, the API or a colleague's screenshot.
- **Never turn FileVault off to fix escrow or to please a repair queue.** Escrow is fixed with the profile and Phase D; FileVault and the escrowed key are what protect a lost Mac until `/jamf-lock-erase` lands.
- **Issue New Recovery Key needs a valid starting point.** With an invalid escrowed key it fails with "Authentication error"; fix escrow first.
- **Distribute to All on a deployed FileVault profile** removes and reinstalls it on every Mac that has it; widen with Newly Assigned Devices Only.
- Exporting keys, granting privileges and changing a smart group are each their own change; this runbook does none of them.

## ✅ Verification checklist

- [ ] Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Inventory → Disk Encryption reads FileVault enabled and Personal Recovery Key Validation Valid.
- [ ] `node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER] --execute` exits 0.
- [ ] Profile stages: `verify-profile` passes on sampled Macs, the profile's status counts read Remaining 0 and Failed 0, and the rollout stage has a review record dated before its gate.
- [ ] Key shown: the ticket names who viewed it and when, holds no key, and Phase D's policy log shows the new key issued.
- [ ] Turn-off request: the decision is recorded and FileVault still reads enabled.

## 📝 Linear-ready note

Use the completed form only when every read-back passed; otherwise use the partial-state form, which names what is verified, what is pending and the next owner. Neither form ever carries a key.

> **Completed:** `[ISSUE_ID]`: Mac `[SERIAL_NUMBER]` (Jamf Pro computer ID `[DEVICE_ID]`): [FileVault profile `[PROFILE_NAME]` scoped to [pilot / rollout] group `[SMART_GROUP]` / recovery key shown by `[ADMIN_NAME]` at [timestamp] to unlock the Mac for its verified user / new recovery key issued by policy `[POLICY_NAME]`], confirmed by the exact phrase[, after independent review by [reviewer] on [date]]. Read-back: Disk Encryption reads FileVault enabled and Personal Recovery Key Validation Valid at [timestamp]; verify-filevault passed[; verify-profile passed on [count] Macs]. Time spent: [X] min.
>
> **Partial state:** `[ISSUE_ID]`: verified: [what the read-backs proved]. Pending: [inventory update not yet submitted / new-key policy not yet run / review not yet recorded], WAIT UNTIL [event]. Next owner: `[ADMIN_NAME]`, who re-runs verify-filevault on [date].

An administrator posts the note as a comment on [ISSUE_ID] in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the note's SHA-256 digest ([NOTE_SHA256]); Aegis never posts it. The read-back below proves the comment on the issue is the prepared note, posted after [NOT_BEFORE].

```bash
# read-back: proves the posted comment matches the prepared note digest and was posted after the start time
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

A recovery key is a break-glass credential: escrow makes it recoverable, the privilege decides who may see it, and the moment a person has seen it, it is spent and gets replaced.

## Career upgrade

Treating secret access as a gated, recorded and rotated event is the same practice as break-glass accounts in cloud IAM; being able to explain that loop is what security-minded endpoint and identity roles ask for.

## Next action

Open Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Inventory → Disk Encryption, record the FileVault state and Personal Recovery Key Validation, and pick the phase.

**Sources (checked 2026-10-27):** every Jamf page below was read as a search excerpt, because the vendor documentation hosts could not be opened from this session (`docs/aegis/lanes/g2.md`, "How the vendor documentation was read"): https://learn.jamf.com/r/de-DE/jamf-pro-documentation-current/FileVault (search excerpt, German page) · https://learn.jamf.com/r/de-DE/jamf-pro-documentation-11.21.0/Issuing_a_new_FileVault_Recovery_Key (search excerpt, German page) · https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Creating_and_Exporting_an_Institutional_Recovery_Key (search excerpt, French page) · https://support.jamf.com/en/articles/11016710-how-to-reset-passwords-with-the-filevault-recovery-key-in-jamf-pro (search excerpt) · https://support.jamf.com/en/articles/11016698-allow-users-in-jamf-pro-permission-to-view-filevault-recovery-keys (search excerpt, View Disk Encryption Recovery Key) · https://support.jamf.com/en/articles/11016722-issues-using-the-issue-new-recovery-key-policy-option (search excerpt, Authentication error) · https://support.jamf.com/en/articles/11016721-filevault-personal-recovery-key-is-not-showing-in-jamf-pro (search excerpt, one or two inventory submissions) · https://support.jamf.com/en/articles/11024623-deploy-jamf-pro-configuration-profile-changes-to-computers-with-the-profile-installed-already (search excerpt, the distribute prompt) · https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.28.0/Viewing-the-Status-of-a-Configuration-Profile (search excerpt) · https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Computer_Inventory_Information (search excerpt, French page, weekly Update Inventory) · https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.21.0/Execution_Frequency_for_Policies (search excerpt) · https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups (search excerpt, French page, privilege inheritance) · https://developer.jamf.com/jamf-pro/docs/privileges-and-deprecations (search excerpt) · https://developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory-id-filevault (search excerpt, the key path the adapter refuses) · `docs/aegis/lanes/g2.md`, Jamf Pro section (this repository: the adapter's read-only surface and refused paths).
