# Incident Response Playbooks

M365 / Entra ID / Intune incident response procedures for common scenarios.
Each playbook follows: Detect → Contain → Eradicate → Recover → Document.

## Execution boundary

Detection and evidence collection are read-only. Every containment, credential, permission, device, deletion, restore, or security-policy action below is R3: capture evidence and rollback state first, show the exact target and scope, then require the action-specific phrase immediately beside that action. One phrase never authorizes a later phase. Empty, declined, generic `yes`, or any mismatch means stop without changing state. Any state-changing step without an immediately adjacent `SAFETY GATE` is planning-only and must not be executed from this playbook.

---

## IR-01 — Compromised Account (Credential Theft / Password Spray)

### Indicators
- Unusual sign-in from unfamiliar location or IP
- Multiple failed sign-ins followed by success (Entra Sign-in logs)
- Risky user flagged in Entra Identity Protection
- User reports unexpected MFA prompts

### Contain
> **PREVIEW ONLY [ir-account-block]:** Capture alert/sign-in evidence, resolve `OnPremisesSyncEnabled`, and route `[UPN]` to `/security-alert-triage`. Synchronized identities require authoritative AD disable plus a separately confirmed cloud propagation-gap block; cloud-only identities use the cloud-only gate. This playbook cannot block either path.

1. **Prepare source-authoritative sign-in containment immediately** in `/security-alert-triage`
<!-- SAFETY GATE [ir-session-revoke] -->
- **Target:** [UPN]
- **Effect:** invalidate Entra refresh tokens and browser session cookies after propagation
- **Scope:** one verified account; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** not reversible; the user must authenticate again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-session-revoke]:** From the user's **Overview** action bar, only the exact match authorizes Revoke sessions for `[UPN]`; verify after propagation.

2. **Request Entra session revocation**
   - Entra → Users → [UPN] → Revoke sessions
> **PREVIEW ONLY [ir-password-reset]:** Resolve whether `[UPN]` is synchronized from on-premises AD or is cloud-only, then route the exact identity to `/password-reset`. This incident playbook cannot reset a password; a cloud portal reset is never the authority path for a synchronized identity.
3. **Prepare the authoritative password reset** with a random temporary value and force-change behavior in `/password-reset`

### Eradicate
<!-- SAFETY GATE [ir-clear-mfa] -->
- **Target:** [UPN] and the exact sorted authentication-method ID set represented by `$methodSetHash`
- **Effect:** delete only the `$methodCount` authentication methods in that reviewed immutable-ID set
- **Scope:** exactly `$methodCount` IDs for one user; stop on set drift or the first failure
- **Reversibility:** not reversible; methods must be registered again
- **Required confirmation:** Render the displayed integer and SHA-256 set digest, then type exactly `DELETE $methodCount MFA METHODS FOR [UPN] SET $methodSetHash`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-clear-mfa]:** Read the exact method IDs/types, sort the IDs, and compute/display `$methodSetHash`. Immediately before deletion, re-query and stop unless count and digest match. Delete only the frozen IDs one at a time, reading back the exact remaining set after each; stop and report completed, possibly changed, and not-attempted IDs on any mismatch. Later read-only investigation remains usable without this gate.

4. **Clear all MFA methods**
   - Entra → Users → [UPN] → Authentication methods → Delete all
5. **Review sign-in logs** for lateral movement
   - Entra → Users → [UPN] → Sign-in logs → filter past 7 days
6. **Check mailbox rules** for forwarding or deletion rules
   - EAC → Recipients → Mailboxes → [MAILBOX] → Mailbox → Manage email apps + check rules
7. **Check OAuth app consents** for unknown app grants
   - Entra → Applications → Enterprise applications → filter by [UPN] activity

### Recover
> **PREVIEW ONLY [ir-account-unblock]:** Unblocking sign-in is a separate state change. Prepare evidence and a new action-local gate; this containment gate does not authorize it.
8. **Unblock sign-in** when investigation is complete
9. **Re-register MFA** — direct user to aka.ms/mfasetup
10. **Brief user** on what happened and how to recognize phishing

### Document
```
Incident: Compromised account — [UPN]
Detected: [date/time] via [method]
Contained: [date/time] — sign-in blocked, Entra session revocation requested
Root cause: [phishing / password spray / credential stuffing]
Access gained: [what attacker accessed — mail, OneDrive, apps]
Lateral movement: [yes/no — detail]
Remediation: password reset, MFA cleared, rules removed
User briefed: [yes/no]
Ticket: [JIRA-###]
```

---

## IR-02 — Malicious Email Campaign (Phishing / BEC)

### Indicators
- User reports suspicious email
- Multiple users receive same email
- Defender flags message in Quarantine or generates alert
- Finance reports unusual payment request

### Contain
<!-- SAFETY GATE [ir-phish-quarantine] -->
- **Target:** [USER@DOMAIN.COM] and the exact staged message-identity export rendered as `$campaignCheckpointId`
- **Effect:** move only the reviewed campaign messages to quarantine
- **Scope:** the immutable message set in `$campaignCheckpointId` and displayed `$messageCount`
- **Reversibility:** quarantined items can be reviewed and separately released
- **Required confirmation:** Render the displayed integer as `$messageCount` and the stable exported-set identifier as `$campaignCheckpointId`, then type exactly `QUARANTINE $messageCount MESSAGES FROM [USER@DOMAIN.COM] USING CHECKPOINT $campaignCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-phish-quarantine]:** Export the exact Message Trace identities outside the repository, assign that immutable set `$campaignCheckpointId`, and count it. Re-run the query and stop on identity/count drift. Only the exact match authorizes Step 1 for that one staged set; stop on the first failure and report completed, failed, and not-attempted messages.

1. **Quarantine the message** across all recipients
   - security.microsoft.com → Email & collaboration → Explorer → search by sender or subject
   - Select all instances → Actions → Move to quarantine
<!-- SAFETY GATE [ir-sender-domain-block] -->
- **Target:** the exact external malicious sender domain rendered from evidence as `$senderDomain`
- **Effect:** add one reviewed malicious domain to the blocked-senders policy
- **Scope:** every message from that exact domain under the selected policy
- **Reversibility:** reversible by separately removing the same policy entry
- **Required confirmation:** Render the evidence-derived external domain as `$senderDomain`, verify it is not the tenant's own domain, then type exactly `BLOCK SENDER DOMAIN $senderDomain`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-sender-domain-block]:** Export the current policy and compare `$senderDomain` with the tenant domain; equality or ambiguity means stop. Only this separate exact phrase authorizes adding that evidence-derived domain to the reviewed policy.

2. **Block sender domain** if clearly malicious
   - Defender → Policies → Anti-spam → Blocked senders → add domain

### Eradicate
3. **Check if anyone clicked** — Defender → Threat investigation → URL click data
4. **Check affected accounts** for signs of compromise → run IR-01 if any account shows activity
5. **Identify full recipient list** via Message Trace
   - EAC → Mail flow → Message trace → search by sender

### Recover
> **PREVIEW ONLY [ir-release-overblocked-message]:** Release is a separate recipient-scoped action. Route each reviewed item through `/email-quarantine`; this playbook does not authorize release.
6. **Release any legitimate quarantined messages** if sender domain was over-blocked
> **PREVIEW ONLY [ir-submit-message-to-microsoft]:** External submission is a separate disclosure/write. Prepare the sanitized evidence and obtain its own authorization before submission.
7. **Submit to Microsoft** if not caught by Defender — security.microsoft.com → Submissions

### Document
```
Incident: Phishing campaign
Sender: [sender address/domain]
Subject: [subject line]
Recipients: [count]
Clicked: [yes/no — count]
Accounts compromised: [yes/no]
Action: quarantined / sender blocked / submitted to Microsoft
Ticket: [JIRA-###]
```

---

## IR-03 — Lost or Stolen Device

### Triage Questions
- Work-owned or personal (BYOD)?
- Was the device encrypted?
- Was it Intune-enrolled?
- What data could be on it?

### Work-Owned Device
<!-- SAFETY GATE [ir-work-device-wipe] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID
- **Effect:** factory-reset the verified work-owned device and erase its data
- **Scope:** one corporate managed device
- **Reversibility:** irreversible; data requires a separate backup
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `FULL WIPE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-work-device-wipe]:** Verify ownership, managed-device ID, serial, and backup evidence. Only the exact match authorizes Full Wipe.

1. **Full Wipe** — Intune → Devices → All devices → [DEVICE_NAME] → Wipe
   - ⚠️ This factory resets the device. Confirm with operator before proceeding.
<!-- SAFETY GATE [ir-intune-device-delete] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID
- **Effect:** delete the completed-wipe device record from Intune
- **Scope:** one verified stale Intune object after wipe completion
- **Reversibility:** not directly reversible; the device must enroll again
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `DELETE INTUNE DEVICE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-intune-device-delete]:** Only after wipe completion and the separate exact match, delete that one Intune record. Wipe approval does not authorize deletion.
2. **Delete from Intune** after wipe completes → Devices → [DEVICE_NAME] → Delete
3. **Request Entra session revocation** only through `REVOKE ENTRA SESSIONS FOR [UPN]` in IR-01; a wipe phrase does not authorize identity changes.
4. **Document** device name, serial, last sync date, data exposure risk

### BYOD (Personal Device)
<!-- SAFETY GATE [ir-byod-retire] -->
- **Target:** [DEVICE_NAME] and its displayed managed-device ID
- **Effect:** remove managed company data, apps, and policy from the personal device
- **Scope:** one verified personally owned managed device
- **Reversibility:** not directly reversible; company access must be enrolled again
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `RETIRE BYOD DEVICE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-byod-retire]:** Verify Personal ownership and the displayed device ID. Only the exact match authorizes Retire; it never authorizes Full Wipe.

1. **Retire** (removes company data only, preserves personal) — Intune → [DEVICE_NAME] → Retire
2. **Request Entra session revocation** only through the separate `REVOKE ENTRA SESSIONS FOR [UPN]` gate in IR-01; propagation and app-specific limitations still apply.
3. No wipe of personal data — do not Full Wipe a BYOD device

### Document
```
Incident: Lost/stolen device
Device: [DEVICE_NAME]
Owner: [UPN]
Type: Work-owned / BYOD
Last sync: [date from Intune]
Action: Full Wipe / Retire
Data at risk: [assessment]
Ticket: [JIRA-###]
```

---

## IR-04 — Ransomware or Malware Detection

### Indicators
- Defender for Endpoint alert
- Files with unfamiliar extensions appearing on OneDrive / SharePoint
- User cannot open files
- Unusual process activity on endpoint

### Contain — Immediate
<!-- SAFETY GATE [ir-endpoint-isolate] -->
- **Target:** [DEVICE_NAME] and its displayed Defender device ID
- **Effect:** isolate only the reviewed endpoint from the network
- **Scope:** one verified endpoint; account containment is a separate action
- **Reversibility:** reversible through a separately reviewed release-from-isolation action
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `ISOLATE [DEVICE_NAME] WITH ID $deviceId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-endpoint-isolate]:** Capture Defender evidence and verify the displayed ID. Only the exact match authorizes Step 1.

1. **Isolate the device** from the network if Defender for Endpoint is licensed
   - security.microsoft.com → Endpoints → Devices → [DEVICE_NAME] → Isolate device
2. **Prepare source-authoritative sign-in containment** by resolving `OnPremisesSyncEnabled` and routing `[UPN]` to `/security-alert-triage`; synchronized and cloud-only identities use different action-local gates.
3. **Request Entra session revocation** only through `REVOKE ENTRA SESSIONS FOR [UPN]` in IR-01; verify after propagation.
4. **Identify blast radius** — which shares/OneDrive folders were mapped at time of infection?

### Eradicate
> **PREVIEW ONLY [ir-defender-remediation]:** A remote scan/remediation job is a separate endpoint mutation. Prepare the device ID and action-local authorization first.
5. **Run full Defender scan** or initiate remediation from security.microsoft.com
6. **Review OneDrive version history** and identify a candidate point; do not start restore from this playbook.
   > **PREVIEW ONLY [ir-onedrive-restore]:** Restoring rewrites data. Route the reviewed account and restore point through `/onedrive-restore` with its own checkpoint and gate.
   - OneDrive → Restore OneDrive → select restore point before infection
7. **Check SharePoint** for affected libraries — restore from version history per-library

### Recover
<!-- SAFETY GATE [ir-device-reimage] -->
- **Target:** [DEVICE_NAME] and its displayed Defender/managed-device ID rendered as `$deviceId`
- **Effect:** erase and rebuild the endpoint from the verified baseline
- **Scope:** one isolated corporate endpoint after evidence capture
- **Reversibility:** irreversible; user data requires a separate verified backup
- **Required confirmation:** Render the displayed ID as `$deviceId`, then type exactly `REIMAGE [DEVICE_NAME] WITH ID $deviceId FROM VERIFIED BASELINE`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-device-reimage]:** Confirm evidence retention, backup status, baseline identity, and that `$deviceId` matches both the incident evidence and management record for `[DEVICE_NAME]`. Only the exact match authorizes Step 8; restoration later needs its own restore-point approval.

8. **Re-image the device** — do not attempt to clean, reimage from known-good baseline
> **PREVIEW ONLY [ir-device-reenroll]:** Re-enrollment creates a new management relationship and is not authorized by the reimage phrase. Route the rebuilt device and expected tenant/profile through `/new-device-setup` with a separate gate.
9. **Re-enroll in Intune** after reimaging
> **PREVIEW ONLY [ir-file-restore]:** File restoration is separately scoped to the reviewed paths and restore point; the reimage phrase does not authorize it.
10. **Restore files** from OneDrive version history or backup

### Document
```
Incident: Ransomware/malware
Device: [device name]
User: [UPN]
Detected: [date/time] via [Defender alert / user report]
Blast radius: [shares/OneDrive folders affected]
Files encrypted: [yes/no — count if known]
Action: device isolated, account blocked, files restored from [date] restore point
Recovery time: [X hours]
Ticket: [JIRA-###]
```

---

## IR-05 — Unauthorized Admin Access / Privilege Escalation

### Indicators
- Audit log shows admin role assigned without change ticket
- New Global Admin or Privileged Role Admin appears in Entra
- Conditional Access policy was modified unexpectedly
- Sign-in log shows admin portal access from unfamiliar location

### Contain
1. **Review all admin role assignments** immediately
   - Entra ID → Roles & admins → All roles → sort by recent assignment
<!-- SAFETY GATE [ir-admin-role-remove] -->
- **Target:** [UPN], the exact staged role-assignment IDs represented by `$roleSetHash`, and verified rollback checkpoint `$roleCheckpointId`
- **Effect:** remove only the reviewed unauthorized role assignments
- **Scope:** one account and exactly `$roleCount` immutable assignment IDs; stop on set drift or first failure
- **Reversibility:** reversible by separately restoring the same role assignments
- **Required confirmation:** Render the count, digest, and checkpoint ID, then type exactly `REMOVE $roleCount UNAUTHORIZED ROLE ASSIGNMENTS FOR [UPN] SET $roleSetHash USING CHECKPOINT $roleCheckpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-admin-role-remove]:** Use a separately authorized collision-resistant, no-clobber checkpoint `$roleCheckpointId` containing the exact assignment IDs and rollback fields; sort the IDs and display `$roleSetHash`. Immediately before removal, re-query and stop unless count and digest match. Remove only the frozen IDs one at a time, read back the remaining exact set after each, and stop on the first mismatch while reporting completed, possibly changed, and not-attempted IDs.
2. **Remove unauthorized assignments**
   - Entra → Roles & admins → [role] → Assignments → remove unauthorized entry
3. **Prepare source-authoritative sign-in containment** by resolving `OnPremisesSyncEnabled` and routing `[UPN]` to `/security-alert-triage`; synchronized and cloud-only identities use different action-local gates.
4. **Request Entra session revocation** only through `REVOKE ENTRA SESSIONS FOR [UPN]` in IR-01; verify after propagation.

### Eradicate
5. **Audit Conditional Access changes** — Entra ID → Monitoring & health → Audit logs → filter by CA
6. **Audit MFA policy changes** — Entra ID → Monitoring & health → Audit logs → filter by Authentication methods
7. **Check if any backdoor app** was registered → Entra → App registrations → filter recent
8. **Review Exchange mail flow rules** for any added forwarding → EAC → Mail flow → Rules

### Recover
<!-- SAFETY GATE [ir-ca-restore] -->
- **Target:** [POLICY_NAME], its displayed `$policyId`, and the reviewed `$checkpointId`
- **Effect:** replace the current Conditional Access definition with the reviewed known-good checkpoint
- **Scope:** one policy after break-glass and affected-user review
- **Reversibility:** reversible from the separately captured current-policy checkpoint
- **Required confirmation:** Render both reviewed identifiers, then type exactly `RESTORE CONDITIONAL ACCESS POLICY [POLICY_NAME] WITH ID $policyId FROM $checkpointId`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [ir-ca-restore]:** Export the current policy, verify break-glass access, and obtain second-admin review. Only the exact match authorizes applying the reviewed settings from `$checkpointId` to the one policy with displayed ID `$policyId`; stop and report on the first read-back mismatch.
9. **Restore the reviewed policy fields** from `$checkpointId`, then read back the policy before any later recovery action.
10. **Break-glass account review** — verify emergency access accounts are still controlled

### Document
```
Incident: Unauthorized admin access
Scope: [roles affected]
Actor: [account that made changes]
Changes made: [list of changes found in audit log]
Contained: [date/time]
Restored: [policies restored, accounts removed]
Gap identified: [how it happened — MFA gap, compromised admin account, etc.]
Ticket: [JIRA-###]
```

---

## Escalation Contacts

| Scenario | Contact |
|----------|---------|
| Active breach, unknown scope | Microsoft Incident Response (via support ticket, Severity A) |
| Ransomware | Cyber insurance provider first, then Microsoft |
| BEC / financial fraud | Finance + legal notification before remediation |
| Defender alert, unclear severity | security.microsoft.com → Incidents → review full incident tree |

### Microsoft Support Escalation Template
```
Tenant: [@Aegion_DOMAIN]
Admin UPN: [USER@DOMAIN.COM]
Issue: [incident type]
Impact: [X users / devices / data at risk]
Started: [date/time]
Steps already taken: [contain steps completed]
Severity requested: A (active breach) / B (high impact) / C (monitoring)
```
