# Incident Response Playbooks

M365 / Entra ID / Intune incident response procedures for common scenarios.
Each playbook follows: Detect → Contain → Eradicate → Recover → Document.

---

## IR-01 — Compromised Account (Credential Theft / Password Spray)

### Indicators
- Unusual sign-in from unfamiliar location or IP
- Multiple failed sign-ins followed by success (Entra Sign-in logs)
- Risky user flagged in Entra Identity Protection
- User reports unexpected MFA prompts

### Contain
1. **Block sign-in immediately**
   - Entra → Identity → Users → [UPN] → Edit properties → Block sign-in = Yes
2. **Revoke all active sessions**
   - Entra → Users → [UPN] → Revoke sessions
3. **Reset password** to a random string (force change on next login)
   - admin.microsoft.com → Users → [UPN] → Reset password → Auto-generate

### Eradicate
4. **Clear all MFA methods**
   - Entra → Users → [UPN] → Authentication methods → Delete all
5. **Review sign-in logs** for lateral movement
   - Entra → Users → [UPN] → Sign-in logs → filter past 7 days
6. **Check mailbox rules** for forwarding or deletion rules
   - EAC → Recipients → Mailboxes → [mailbox] → Mailbox → Manage email apps + check rules
7. **Check OAuth app consents** for unknown app grants
   - Entra → Applications → Enterprise applications → filter by [UPN] activity

### Recover
8. **Unblock sign-in** when investigation is complete
9. **Re-register MFA** — direct user to aka.ms/mfasetup
10. **Brief user** on what happened and how to recognize phishing

### Document
```
Incident: Compromised account — [UPN]
Detected: [date/time] via [method]
Contained: [date/time] — sign-in blocked, sessions revoked
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
1. **Quarantine the message** across all recipients
   - security.microsoft.com → Email & collaboration → Explorer → search by sender or subject
   - Select all instances → Actions → Move to quarantine
2. **Block sender domain** if clearly malicious
   - Defender → Policies → Anti-spam → Blocked senders → add domain

### Eradicate
3. **Check if anyone clicked** — Defender → Threat investigation → URL click data
4. **Check affected accounts** for signs of compromise → run IR-01 if any account shows activity
5. **Identify full recipient list** via Message Trace
   - EAC → Mail flow → Message trace → search by sender

### Recover
6. **Release any legitimate quarantined messages** if sender domain was over-blocked
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
1. **Full Wipe** — Intune → Devices → All devices → [device] → Wipe
   - ⚠️ This factory resets the device. Confirm with operator before proceeding.
2. **Delete from Intune** after wipe completes → Devices → [device] → Delete
3. **Revoke user sessions** if there is any concern about credentials on device → IR-01 steps 1–2
4. **Document** device name, serial, last sync date, data exposure risk

### BYOD (Personal Device)
1. **Retire** (removes company data only, preserves personal) — Intune → [device] → Retire
2. **Revoke sessions** → Entra → [UPN] → Revoke sessions
3. No wipe of personal data — do not Full Wipe a BYOD device

### Document
```
Incident: Lost/stolen device
Device: [DT/LT-FirstName,LastName] — [serial]
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
1. **Isolate the device** from the network if Defender for Endpoint is licensed
   - security.microsoft.com → Endpoints → Devices → [device] → Isolate device
2. **Disable the user account** as a precaution → Entra → Block sign-in
3. **Revoke sessions** → Entra → [UPN] → Revoke sessions
4. **Identify blast radius** — which shares/OneDrive folders were mapped at time of infection?

### Eradicate
5. **Run full Defender scan** or initiate remediation from security.microsoft.com
6. **Review OneDrive version history** — files can be restored up to 30 days
   - OneDrive → Restore OneDrive → select restore point before infection
7. **Check SharePoint** for affected libraries — restore from version history per-library

### Recover
8. **Re-image the device** — do not attempt to clean, reimage from known-good baseline
9. **Re-enroll in Intune** after reimaging
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
   - Entra → Identity → Roles & admins → All roles → sort by recent assignment
2. **Remove unauthorized assignments**
   - Entra → Roles & admins → [role] → Assignments → remove unauthorized entry
3. **Block sign-in** for any account involved in unauthorized escalation
4. **Revoke sessions**

### Eradicate
5. **Audit Conditional Access changes** — Entra → Monitoring → Audit logs → filter by CA
6. **Audit MFA policy changes** — Entra → Monitoring → Audit logs → filter by Authentication methods
7. **Check if any backdoor app** was registered → Entra → App registrations → filter recent
8. **Review Exchange mail flow rules** for any added forwarding → EAC → Mail flow → Rules

### Recover
9. **Restore Conditional Access policies** to last known-good state
10. **Enable break-glass account** review — verify emergency access accounts are still controlled

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
Admin UPN: [admin@YOUR_DOMAIN]
Issue: [incident type]
Impact: [X users / devices / data at risk]
Started: [date/time]
Steps already taken: [contain steps completed]
Severity requested: A (active breach) / B (high impact) / C (monitoring)
```
