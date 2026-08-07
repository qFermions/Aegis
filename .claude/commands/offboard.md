---
description: Full offboarding — contain identity, preserve data, reclaim licenses, wipe devices, revoke site access, document. Medium-depth GUI steps, why-footer, one-concept. Placeholders only.
disable-model-invocation: true
---

# /offboard

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders. Never prompt for user information.

**Placeholders:** `[UPN]` `[first.last]` `[MANAGER_UPN]` `[DEVICE_NAME]` `[EXTENSION]` `[SHARED_MAILBOX]` `[PRODUCT_PROFILE]` `[WORK_PHONE_DEVICE_GROUP]` — org values use the native `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

⚠️ **This is a destructive multi-system plan — route it through independent plan review before executing.** Every disable/wipe/removal step below hits the destructive-action gate: confirm before running.
⚠️ **Involuntary termination?** Complete Steps 1–4 BEFORE the user is notified. Speed matters.

---

## Phase A — Contain the Identity

### STEP 1 — ⚠️ Disable the account (on-prem first — source of authority)

<!-- SAFETY GATE [offboard-ad-disable-portal] -->
- **Target:** [first.last] mapped to [UPN]
- **Effect:** disable the authoritative on-prem AD account
- **Scope:** one verified AD identity; no cloud or sync action
- **Reversibility:** reversible by separately re-enabling the AD account
- **Required confirmation:** Type exactly `DISABLE AD ACCOUNT [first.last] MAPPED TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-ad-disable-portal]:** Only after the exact match, disable `[first.last]` in ADUC and read back the disabled state.

<!-- SAFETY GATE [offboard-cloud-block-portal] -->
- **Target:** [UPN] and its displayed Entra object ID
- **Effect:** block Microsoft Entra sign-in while normal directory sync propagates
- **Scope:** one verified cloud identity
- **Reversibility:** reversible by separately re-enabling sign-in
- **Required confirmation:** Type exactly `BLOCK CLOUD SIGN-IN FOR [UPN] ID [USER_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-cloud-block-portal]:** Only after the separate exact match, block sign-in for the displayed `[UPN]` object and read back the state. A forced sync is not authorized here; use the normal cycle or a separate `/ad-connect` runbook.

<details>
<summary>PowerShell — disable + sync (for reference only)</summary>

```powershell
# These cross-system mutations are independent and intentionally inert.
# PREVIEW ONLY [offboard-ad-disable-ps]: Disable-ADAccount -Identity "[first.last]"
# PREVIEW ONLY [offboard-delta-sync-ps]: Start-ADSyncSyncCycle -PolicyType Delta
# PREVIEW ONLY [offboard-cloud-block-ps]: Update-MgUser -UserId "[UPN]" -AccountEnabled:$false
```
</details>

✅ Verify: Entra → user shows **Sign-in blocked**; ADUC shows account disabled.
**Why:** On-prem AD is the source of authority — a cloud-only block on a synced user can be overwritten by the next sync if the AD account is still enabled. AD disable is authoritative; the Entra block covers the sync gap.

### STEP 2 — Request Entra refresh-token and browser-cookie revocation

<!-- SAFETY GATE [offboard-revoke-sessions-portal] -->
- **Target:** [UPN]
- **Effect:** invalidate Microsoft Entra refresh tokens and browser session cookies
- **Scope:** Entra-managed refresh tokens and browser cookies for one user; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** not reversible; authentication is required again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-revoke-sessions-portal]:** Only after this separate exact match, Entra → Users → `[UPN]` → **Overview** → **Revoke sessions** → Confirm; verify after propagation.

✅ Verify: Sign-in logs show no new activity for `[UPN]` after the timestamp.
**Why:** Blocking sign-in stops new authentication. The revocation request invalidates Entra refresh tokens and browser cookies after propagation, but current access tokens and app-issued sessions can remain usable until their own expiry or enforcement.

### STEP 3 — Reset password to long random

<!-- SAFETY GATE [offboard-password-reset-portal] -->
- **Target:** [first.last] mapped to [UPN]
- **Effect:** replace the authoritative password with an unshared random value
- **Scope:** one verified hybrid identity
- **Reversibility:** not reversible; another verified reset is required
- **Required confirmation:** Type exactly `RESET AD PASSWORD FOR [first.last] MAPPED TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-password-reset-portal]:** Only after the exact match, reset `[first.last]` in ADUC to a long random value and do not record or share it. Forced sync is a separate action.

✅ Verify: old password fails on a test protocol (or just confirm reset + sync landed).
**Why:** Invalidates the old password when password-based protocols next authenticate. It does not erase device caches, current access tokens, browser cookies, or app-issued sessions; those require the separate containment and revocation steps above plus propagation/read-back evidence.

### STEP 4 — Clear ALL MFA methods

<!-- SAFETY GATE [offboard-clear-mfa-portal] -->
- **Target:** [UPN] and the exact sorted authentication-method ID set represented by `$methodSetHash`
- **Effect:** delete only the `$methodCount` authentication methods in that reviewed immutable-ID set
- **Scope:** exactly `$methodCount` reviewed IDs for one user; stop on set drift or the first failure
- **Reversibility:** not reversible; methods must be registered again
- **Required confirmation:** Render the displayed integer and SHA-256 set digest, then type exactly `DELETE $methodCount MFA METHODS FOR [UPN] SET $methodSetHash`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-clear-mfa-portal]:** Read the exact method IDs and types, sort the IDs, and compute/display `$methodSetHash` before approval. Immediately before the first deletion, re-query and stop unless both count and digest match. Delete only the frozen IDs one at a time; after each deletion, read back and require the remaining IDs to equal the frozen set minus verified completions. Stop on the first mismatch and report completed, possibly changed, and not-attempted IDs. Verify the final list is empty.

✅ Verify: Authentication methods list is empty.
**Why:** A registered Authenticator on a personal phone is a standing approval channel — clearing it severs SSPR and any future re-auth path.

---

## Phase B — Preserve the Data (before touching licenses)

### STEP 5 — Convert mailbox to shared + delegate

<!-- SAFETY GATE [offboard-mailbox-convert-portal] -->
- **Target:** [UPN]
- **Effect:** convert one reviewed mailbox to Shared without changing delegation
- **Scope:** one mailbox after size/archive and retention review
- **Reversibility:** reversible by separately converting it back to User
- **Required confirmation:** Type exactly `CONVERT OFFBOARD MAILBOX [UPN] TO SHARED`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-mailbox-convert-portal]:** After checking size/archive requirements, only the exact match authorizes converting `[UPN]` to Shared. It does not authorize delegation or license removal.

<!-- SAFETY GATE [offboard-mailbox-delegate-portal] -->
- **Target:** [MANAGER_UPN] on mailbox [UPN]
- **Effect:** grant Full Access without Send As or forwarding
- **Scope:** one reviewed mailbox and one authorized manager
- **Reversibility:** reversible by removing that Full Access grant
- **Required confirmation:** Type exactly `GRANT [MANAGER_UPN] FULL ACCESS TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-mailbox-delegate-portal]:** Only after conversion read-back and the separate exact match, grant Full Access and verify the single permission entry.

<details>
<summary>PowerShell — convert + delegate (for reference only)</summary>

```powershell
# Conversion and delegation are distinct mutations and intentionally inert.
# PREVIEW ONLY [offboard-mailbox-convert-ps]: Set-Mailbox -Identity "[UPN]" -Type Shared
# PREVIEW ONLY [offboard-mailbox-delegate-ps]: Add-MailboxPermission -Identity "[UPN]" -User "[MANAGER_UPN]" -AccessRights FullAccess -InheritanceType All
```
</details>

✅ Verify: mailbox type = Shared; manager can open it; inbound mail still flows.
**Why:** A shared mailbox needs no license — converting BEFORE license removal keeps the mail and the address alive for free.

### STEP 6 — Transfer OneDrive to the manager

<!-- SAFETY GATE [offboard-onedrive-portal] -->
- **Target:** [UPN] and [MANAGER_UPN]
- **Effect:** grant the manager access to the departing user OneDrive
- **Scope:** one OneDrive site and one authorized manager
- **Reversibility:** reversible by removing the manager site permission
- **Required confirmation:** Type exactly `GRANT [MANAGER_UPN] ACCESS TO [UPN] ONEDRIVE`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-onedrive-portal]:** Only after business authorization and the exact match, create the OneDrive access link for `[MANAGER_UPN]`; record how to remove that permission.

⚠️ **Retention window:** a deleted/unlicensed user's OneDrive is kept **30 days by default** — flag the deadline to the manager in writing.

✅ Verify: manager opens the link and confirms the files they need.
**Why:** OneDrive is license-bound personal storage, not a shared site — without an explicit transfer it silently expires with the retention window.

### STEP 7 — Remove ALL licenses

<!-- SAFETY GATE [offboard-license-remove-portal] -->
- **Target:** [UPN], the exact sorted direct-license SKU-ID set represented by `$licenseSetHash`, and checkpoint `$licenseCheckpointId`
- **Effect:** remove every displayed license and start service-data retention timers
- **Scope:** one user and exactly `$licenseCount` frozen direct assignments; group-based licensing is excluded
- **Reversibility:** restore the exact captured assignments and disabled-plan state from `$licenseCheckpointId` before service-data retention expires
- **Required confirmation:** Render the reviewed count, full set digest, and checkpoint ID, then type exactly `REMOVE $licenseCount LICENSES SET SHA256 $licenseSetHash FROM [UPN] USING CHECKPOINT $licenseCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-license-remove-portal]:** Capture each direct SKU ID plus disabled-plan state in no-clobber checkpoint `$licenseCheckpointId`; sort the SKU IDs and display full SHA-256 `$licenseSetHash`. Verify Steps 5–6, then re-query immediately before the first removal and stop unless count and digest are identical. Remove only frozen SKU IDs one at a time; after each, require read-back to equal the frozen set minus verified completions. On failure report completed IDs, current ID as UNKNOWN/POSSIBLY CHANGED, and not-attempted IDs. Group-based licensing requires a separate group-membership action and is not authorized here.

✅ Verify: license count freed in admin center → Billing → Licenses; shared mailbox still works.
**Why:** Licenses are the recurring cost — but only after Steps 5–6, because the license is what's holding the mailbox and OneDrive data.

---

## Phase C — Strip the Access

### STEP 8 — Remove from groups, DLs, and shared-mailbox delegation

<!-- SAFETY GATE [offboard-group-strip-portal] -->
- **Target:** [UPN], the exact sorted immutable group-ID set represented by `$groupSetHash`, and checkpoint `$groupCheckpointId`
- **Effect:** remove the user from each reviewed access group
- **Scope:** exactly `$groupCount` frozen group IDs for one user; Domain Users is excluded
- **Reversibility:** restore the captured immutable memberships from `$groupCheckpointId`
- **Required confirmation:** Render the reviewed count, full set digest, and checkpoint ID, then type exactly `REMOVE [UPN] FROM $groupCount ACCESS GROUPS SET SHA256 $groupSetHash USING CHECKPOINT $groupCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-group-strip-portal]:** Export immutable group IDs and pre-state to no-clobber `$groupCheckpointId`, sort the IDs, and display full SHA-256 `$groupSetHash`. Re-query immediately before the first change and stop on count or digest drift. Remove frozen IDs one at a time; after each, require the remaining set to equal frozen minus verified completions. On failure report completed IDs, current ID as UNKNOWN/POSSIBLY CHANGED, and not-attempted IDs.

<!-- SAFETY GATE [offboard-dl-strip-portal] -->
- **Target:** [UPN], the exact sorted distribution-list object-ID set represented by `$distributionListSetHash`, and checkpoint `$distributionListCheckpointId`
- **Effect:** remove the user from each reviewed distribution list
- **Scope:** exactly `$distributionListCount` frozen list IDs for one user
- **Reversibility:** restore the captured immutable memberships from `$distributionListCheckpointId`
- **Required confirmation:** Render the reviewed count, full set digest, and checkpoint ID, then type exactly `REMOVE [UPN] FROM $distributionListCount DISTRIBUTION LISTS SET SHA256 $distributionListSetHash USING CHECKPOINT $distributionListCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-dl-strip-portal]:** Capture immutable list IDs and membership pre-state in no-clobber `$distributionListCheckpointId`, sort IDs, and display full SHA-256 `$distributionListSetHash`. Re-query before the first removal and stop on any drift. Remove frozen IDs one at a time with exact remaining-set read-back; report completed, UNKNOWN/POSSIBLY CHANGED current, and not-attempted IDs on the first failure.

<!-- SAFETY GATE [offboard-mailbox-delegation-strip-portal] -->
- **Target:** [UPN], the exact sorted mailbox-ID/permission-type/trustee-ID set represented by `$delegationSetHash`, and checkpoint `$delegationCheckpointId`
- **Effect:** remove the user's reviewed shared-mailbox permissions
- **Scope:** exactly `$delegationCount` frozen delegation tuples for one user
- **Reversibility:** restore captured permission tuples from `$delegationCheckpointId`
- **Required confirmation:** Render the reviewed count, full set digest, and checkpoint ID, then type exactly `REMOVE $delegationCount MAILBOX DELEGATIONS SET SHA256 $delegationSetHash FOR [UPN] USING CHECKPOINT $delegationCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-mailbox-delegation-strip-portal]:** Capture immutable mailbox/trustee IDs, permission type, and inheritance state in no-clobber `$delegationCheckpointId`; sort canonical tuples and display full SHA-256 `$delegationSetHash`. Re-query before the first removal and stop on drift. Remove frozen tuples one at a time with exact remaining-set read-back; report completed, UNKNOWN/POSSIBLY CHANGED current, and not-attempted tuples on failure.

<details>
<summary>PowerShell — strip AD groups (for reference only)</summary>

```powershell
# Removes the user from every AD group except Domain Users — run on a domain-joined machine
$user   = Get-ADUser -Identity "[first.last]"
$groups = @(Get-ADPrincipalGroupMembership $user | Where-Object { $_.Name -ne "Domain Users" })
Write-Host "Target: $($user.SamAccountName); group removals: $($groups.Count)"
$groups | ForEach-Object { Write-Host "  preview group: $($_.Name)" }
# PREVIEW ONLY [offboard-group-removal] — no removal executes here; export/checkpoint this list in a separately reviewed runbook.
# foreach ($g in $groups) { Remove-ADGroupMember -Identity $g -Members $user -Confirm:$false -ErrorAction Stop }
```
</details>

✅ Verify: group list empty (bar Domain Users); delegation lists clean — this is what `/group-membership-audit` exists for.
**Why:** Stale memberships are the #1 offboarding leftover — they re-grant access the moment anything re-enables the account.

### STEP 9 — ⚠️ Wipe or Retire the computer

<!-- SAFETY GATE [offboard-device-wipe-portal] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID
- **Effect:** factory-reset the verified corporate computer and erase its data
- **Scope:** one work-owned managed device
- **Reversibility:** irreversible; data requires a separate backup
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `FULL WIPE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-device-wipe-portal]:** Use `/device-wipe` and only the exact Full Wipe phrase for the displayed corporate device. Retire is a different action; neither choice authorizes later object deletion.

- **Wipe** (factory reset) — corporate-owned devices
> **PREVIEW ONLY [offboard-device-retire-portal]:** Retire is a distinct BYOD action. Route the resolved device and immutable managed-device ID to `/device-wipe`; the Full Wipe phrase cannot authorize Retire and this step cannot perform it.
- **Retire proposal** (remove work data only) — BYOD; execute only through that separate reviewed action.

⚠️ **Confirm which ownership applies BEFORE clicking** — a Wipe on a personal device destroys personal data. Destructive gate: explicit confirmation required.

✅ Verify: device status shows the action completed; device drops from compliant list.
**Why:** Wipe vs Retire is an ownership question, not a security preference — the inventory log from onboarding is what answers it.

### STEP 10 — Work phone: wipe, then separately remove deployment targeting

<!-- SAFETY GATE [offboard-work-phone-wipe-portal] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID rendered as `$deviceId`
- **Effect:** wipe the verified corporate phone
- **Scope:** one work-owned managed device; no group or object removal
- **Reversibility:** irreversible; data requires a separate verified backup
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `WIPE WORK PHONE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-work-phone-wipe-portal]:** Capture evidence/backup state and verify corporate ownership, name, and `$deviceId`. Only after the exact match, issue the wipe and verify its status. This phrase does not authorize group removal or device-object deletion.

<!-- SAFETY GATE [offboard-work-phone-group-remove-portal] -->
- **Target:** the work phone with ID `$deviceId` in [WORK_PHONE_DEVICE_GROUP]
- **Effect:** remove that device's one deployment-group membership
- **Scope:** one verified device object and one exact group after wipe status is recorded
- **Reversibility:** reversible by restoring the captured group membership
- **Required confirmation:** Type exactly `REMOVE DEVICE $deviceId FROM [WORK_PHONE_DEVICE_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-work-phone-group-remove-portal]:** Re-resolve `$deviceId`, confirm the wipe status and current group membership, then require this separate exact phrase. Remove only that membership and read it back; do not delete the device object.

✅ Verify separately: the wipe action reaches its expected state; then the exact device ID is absent from the reviewed group.
**Why:** The group membership is the app-deployment trigger from onboarding — leaving the dead device in it skews targeting and counts.

### STEP 11 — [@Aegion_VOIP]: reclaim the extension

<!-- SAFETY GATE [offboard-voip-deactivate-portal] -->
- **Target:** [UPN] as the exact displayed VoIP identity
- **Effect:** deactivate the VoIP user without reclaiming the extension or deleting voicemail
- **Scope:** one VoIP identity
- **Reversibility:** reversible by reactivating the identity from captured pre-state
- **Required confirmation:** Type exactly `DEACTIVATE VOIP USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-voip-deactivate-portal]:** Capture identity, routing, extension, and voicemail pre-state. Only after the exact match, deactivate `[UPN]` and read back the new state. This phrase authorizes no later action.

<!-- SAFETY GATE [offboard-voip-reclaim-extension-portal] -->
- **Target:** [EXTENSION] currently assigned to [UPN]
- **Effect:** remove that assignment and return the extension to the available pool
- **Scope:** one exact extension after the user's deactivation is verified
- **Reversibility:** reversible by reassigning the captured extension/routing state
- **Required confirmation:** Type exactly `RECLAIM VOIP EXTENSION [EXTENSION] FROM [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-voip-reclaim-extension-portal]:** Re-resolve the owner and routing state. Only after this separate exact match, reclaim `[EXTENSION]` and verify its pool/routing state.

<!-- SAFETY GATE [offboard-voicemail-clear-portal] -->
- **Target:** the displayed voicemail box for [UPN] / [EXTENSION], exact sorted message-ID set represented by `$voicemailSetHash`, and export checkpoint `$voicemailCheckpointId`
- **Effect:** permanently delete exactly the exported voicemail messages
- **Scope:** exactly `$voicemailCount` frozen immutable message IDs in one voicemail box
- **Reversibility:** irreversible; recovery depends on verified export `$voicemailCheckpointId`
- **Required confirmation:** Render the count, full set digest, and export checkpoint ID, then type exactly `DELETE $voicemailCount VOICEMAIL MESSAGES SET SHA256 $voicemailSetHash FOR [UPN] EXTENSION [EXTENSION] USING CHECKPOINT $voicemailCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-voicemail-clear-portal]:** Verify `$voicemailCheckpointId` opens, sort exported immutable message IDs, and display full SHA-256 `$voicemailSetHash`. Re-query before the first deletion and stop unless count and digest match. Delete only frozen IDs one at a time with exact remaining-set read-back; on failure report completed IDs, current ID as UNKNOWN/POSSIBLY CHANGED, and not-attempted IDs.

✅ Verify: calls to `[EXTENSION]` hit the intended new target (reassignment or general line), not a dead end.
**Why:** Extensions are a finite, paid pool — and an unmonitored voicemail box quietly eats messages from people who don't know the person left.

### STEP 12 — Zoom: deactivate

> **PREVIEW ONLY [offboard-zoom-transfer-portal]:** Transferring meetings or recording ownership changes different source and destination identities. Complete it only through a separately reviewed transfer action; the Zoom-deactivation phrase cannot authorize a transfer.

<!-- SAFETY GATE [offboard-zoom-portal] -->
- **Target:** [UPN] as the exact displayed Zoom identity
- **Effect:** deactivate the Zoom account without deleting recordings
- **Scope:** one Zoom identity after meeting and recording ownership review
- **Reversibility:** reversible by reactivating the user
- **Required confirmation:** Type exactly `DEACTIVATE ZOOM FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-zoom-portal]:** Verify that any separately authorized meeting/recording transfer is complete or documented as unnecessary. Only after the exact match, deactivate `[UPN]`. Account deletion and ownership transfer are not authorized by this phrase.

✅ Verify: license freed in Zoom admin → Account Management → Billing.
**Why:** Zoom seats are per-license spend; deactivate-before-delete preserves recordings until ownership is decided.

### STEP 13 — Adobe: remove from product profile

<!-- SAFETY GATE [offboard-adobe-portal] -->
- **Target:** [UPN] and [PRODUCT_PROFILE]
- **Effect:** remove the user from the Adobe product profile
- **Scope:** one Adobe identity and one reviewed product profile
- **Reversibility:** reversible by assigning the product profile again
- **Required confirmation:** Type exactly `REMOVE [UPN] FROM [PRODUCT_PROFILE]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-adobe-portal]:** Only after the exact match, remove `[UPN]` from `[PRODUCT_PROFILE]` and verify the seat count. Adobe user deletion is a separate action and is not authorized here.

✅ Verify: seat count freed on the profile.
**Why:** Adobe bills by profile seat — an offboarded user holding one is pure waste.

### STEP 14 — Remote access: revoke VPN + legacy tools

<!-- SAFETY GATE [offboard-vpn-portal] -->
- **Target:** [UPN], the exact sorted remote-access entry-ID set represented by `$remoteAccessSetHash`, and checkpoint `$remoteAccessCheckpointId`
- **Effect:** revoke client VPN and documented legacy remote-access rights
- **Scope:** one user and exactly `$remoteAccessCount` frozen provider/object IDs
- **Reversibility:** restore only captured entries from `$remoteAccessCheckpointId`
- **Required confirmation:** Render the count, full set digest, and checkpoint ID, then type exactly `REVOKE $remoteAccessCount REMOTE ACCESS ENTRIES SET SHA256 $remoteAccessSetHash FOR [UPN] USING CHECKPOINT $remoteAccessCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-vpn-portal]:** Capture provider, immutable entry/group/credential ID, and pre-state in no-clobber `$remoteAccessCheckpointId`; sort canonical IDs and display full SHA-256 `$remoteAccessSetHash`. Re-query immediately before the first revocation and stop on drift. Revoke frozen entries one at a time with provider read-back; report completed, UNKNOWN/POSSIBLY CHANGED current, and not-attempted IDs on failure. Do not uninstall unrelated software.

✅ Verify: VPN auth fails for the account; no remote tool answers on their devices.
**Why:** Remote access is the path that works AFTER badge collection — it dies with the account or it doesn't die at all.

### STEP 15 — Physical/site: alarm code + badge

<!-- SAFETY GATE [offboard-physical-portal] -->
- **Target:** [UPN], exact sorted site/owner/access-object tuples represented by `$siteAccessSetHash`, and request checkpoint `$siteAccessCheckpointId`
- **Effect:** request alarm-code and badge deactivation from the named site owners
- **Scope:** one user and exactly `$siteCount` frozen named-owner requests
- **Reversibility:** reversible only through the physical-access owners using `$siteAccessCheckpointId`
- **Required confirmation:** Render the count, full set digest, and checkpoint ID, then type exactly `SEND $siteCount SITE ACCESS REVOCATIONS SET SHA256 $siteAccessSetHash FOR [UPN] USING CHECKPOINT $siteAccessCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-physical-portal]:** Capture site, named owner, access-object identifier, destination, and request body in no-clobber `$siteAccessCheckpointId`; sort canonical tuples and display full SHA-256 `$siteAccessSetHash`. Revalidate destinations/bodies immediately before sending. Send frozen requests one at a time, retain delivery receipts, and stop/report completed, UNKNOWN/POSSIBLY SENT current, and not-attempted request IDs on failure. Do not call the access revoked until each owner supplies completion evidence.

✅ Verify: office manager confirms code deactivated; badge returns/deactivates.
**Why:** Alarm codes don't expire on their own — they outlive employment until someone explicitly removes them.

---

## Phase D — Close It Out

### STEP 16 — Document + AD disposal

<!-- SAFETY GATE [offboard-disabled-ou-portal] -->
- **Target:** [first.last]
- **Effect:** move the disabled AD account to the Disabled Users OU
- **Scope:** one disabled AD object after sync-scope impact review
- **Reversibility:** reversible by moving the object back to its recorded source OU
- **Required confirmation:** Type exactly `MOVE [first.last] TO DISABLED USERS OU`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [offboard-disabled-ou-portal]:** Record the source OU and verify whether the target is outside sync scope. Only after the exact match, move the disabled account; this does not authorize account deletion.
> **PREVIEW ONLY [offboard-jira-closure-portal]:** Posting the closure trail is a separate Jira write. Prepare verified timestamps and route the note through `/jira-update`; the OU-move phrase cannot post or close a ticket.
2. Prepare the verified step/timestamp closure note for that separate Jira action.
> **PREVIEW ONLY [offboard-disposal-schedule-portal]:** Calendaring a disposal reminder is a separate external write, and later account deletion is a separate destructive action. This workflow cannot schedule or delete either one.
3. Prepare a proposed **AD account disposal review date after the retention window** for separately authorized scheduling; do not pre-authorize deletion.

✅ Verify: ticket closed with the full trail; disposal date scheduled.
**Why:** The disabled account is the audit anchor during retention — deleting too early breaks mailbox/OneDrive holds; never deleting accumulates risk.

---

## ✅ Completion checklist

- [ ] AD disabled (authoritative) + Entra sign-in blocked · Entra refresh-token/browser-cookie revocation requested and checked after propagation · password randomized · MFA methods cleared
- [ ] Mailbox → shared + manager delegated · OneDrive transferred (30-day window flagged) · all licenses removed (after conversion)
- [ ] Groups/DLs/shared-mailbox delegation stripped
- [ ] Computer wiped/retired (ownership confirmed) · work phone wiped + removed from `[WORK_PHONE_DEVICE_GROUP]`
- [ ] [@Aegion_VOIP] extension reclaimed + voicemail cleared · Zoom deactivated · Adobe seat freed
- [ ] VPN + legacy remote tools revoked · alarm code + badge removed (coordinated)
- [ ] AD account moved to Disabled OU · any separately authorized disposal reminder and Jira closure verified

## 📝 Jira-ready note

Use the completed form only after every named state has its required read-back/receipt. Otherwise use a partial-state note that lists verified completions, UNKNOWN/POSSIBLY CHANGED current items, not-attempted items, and the next owner; never paste an unverified completion claim.

> [Only if all cited checks passed] Offboarding completed for `[UPN]` ([voluntary/involuntary], last day [DATE]). Identity contained [timestamp]: AD disabled, sign-in blocked, Entra refresh-token/browser-cookie revocation accepted and checked after propagation (current access tokens/app-issued sessions may persist until expiry), password reset accepted, exact MFA set deletion verified. Data-preservation checks passed: mailbox Shared + delegation read-back; OneDrive manager access confirmed and retention deadline recorded. Reclaimed items were individually verified: license set, [@Aegion_VOIP] extension/voicemail set, Zoom, and Adobe. Device action statuses: `[DEVICE_NAME]` [verified status]; work-phone wipe and group-removal read-backs [verified status]. Access-set removals and physical-access owner receipts passed. AD OU read-back passed. [Only if separately authorized and verified: Jira closure and disposal reminder references.]

---

🧠 **Why this order:** contain (A) before anything else — every minute an active session survives is live access; preserve (B) before reclaiming, because the license you want back is what's holding the mailbox and OneDrive; strip (C) only after the data is safe, working from cloud access down to physical site; document (D) last because the ticket is the proof and the retention clock is the real finish line. Run the sequence backwards and you get data loss with the access still live.

🎓 **One new concept — license-bound data:** in M365, a user's mailbox and OneDrive exist only as long as a license (or a shared-mailbox conversion / retention hold) sustains them. Remove the license first and the data starts a silent countdown — which is why offboarding is sequenced around the data, not the cost savings.
