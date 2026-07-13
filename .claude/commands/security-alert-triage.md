---
description: Triage a security alert (Defender / Entra Identity Protection / suspicious sign-in or email) — assess → contain → investigate → remediate → document. Portal first. Placeholders only.
---

# /security-alert-triage

**Verdict:** Work it as an incident: **assess severity → contain the account/device → investigate scope → remediate → document.** For a likely account compromise, containment (block sign-in + revoke sessions + reset) comes before deep investigation — stop the bleeding first.

## What to check first
- **Source:** Defender (defender.microsoft.com → Incidents & alerts), Entra → Protection → **Risky users / Risky sign-ins**, or a quarantine/phish report.
- **Severity + scope:** one user or many? Any successful risky sign-in / inbox rule / mass send?

## Step-by-step (portal first)

**1. Assess** — open the alert: who, what, when, from where (IP/country/device), success or blocked.

**2. Contain (if account likely compromised):**
- Entra → Users → `[UPN]` → **Block sign-in**.
- **Revoke sessions** (kills stolen tokens).
- Reset password (`/password-reset`), re-register MFA (`/mfa-issue`).
- Check for attacker persistence: Outlook **inbox rules** (auto-forward/delete), **mail forwarding** (EAC), new **app passwords** / OAuth consents.

**3. Investigate scope:**
- Entra → **Sign-in logs** for `[UPN]` (other successful risky logins?).
- Defender → **Explorer / Threat hunting** for the phish — who else received it? clicked?
- Message trace (EAC) for spread.

**4. Remediate:**
- Purge the phish (`/email-quarantine` / Defender → soft/hard delete), block sender/domain.
- Confirm no forwarding/rules remain; tighten CA if a gap was used.

**5. Document** — incident report (`/incident-report`): timeline, scope, actions, root cause.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All","AuditLog.Read.All"     # contain + read sign-ins
Update-MgUser -UserId "[UPN]" -AccountEnabled:$false                 # ⚠️ block sign-in (contain)
Revoke-MgUserSignInSession -UserId "[UPN]"                           # ⚠️ kill active tokens
Connect-ExchangeOnline
Get-InboxRule -Mailbox "[UPN]"                                       # look for malicious auto-forward/delete rules
Get-Mailbox "[UPN]" | Select ForwardingSmtpAddress,DeliverToMailboxAndForward  # check hidden forwarding
```
</details>

## ⚠️ Risk warning
- Blocking sign-in / revoking sessions locks the user out — correct for a real compromise; confirm it's not a false positive for a VIP first. These hit the confirmation gate.
- Don't delete evidence before capturing it (screenshots/log export) — you'll need it for the incident report.
- Genuine breach with business/legal impact → escalate to leadership; cross-domain cyber depth → `/ask-hermes`.

## ✅ Verification checklist
- [ ] Account contained (blocked, sessions revoked, password + MFA reset) if compromised
- [ ] No malicious inbox rules / forwarding / OAuth grants remain
- [ ] Scope confirmed (other affected users handled)
- [ ] Phish purged + sender blocked; CA gap closed
- [ ] Incident documented (timeline + root cause)

## 📝 Jira-ready note
> Resolved [date/time]. Security alert: [type] on `[UPN]`. Severity [low/med/high]. Contained ([blocked/revoked/reset]); removed [N] malicious rules/forwarding; scope [N users]. Phish purged + sender blocked. Root cause: [cause]. Full incident report attached. Time spent: [X] min.
