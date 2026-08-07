---
description: Triage a security alert (Defender / Entra Identity Protection / suspicious sign-in or email) — assess → contain → investigate → remediate → document. Portal first. Placeholders only.
disable-model-invocation: true
---

# /security-alert-triage

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Work it as an incident: **assess severity → contain the account/device → investigate scope → remediate → document.** For a likely account compromise, containment (block sign-in + revoke sessions + reset) comes before deep investigation — stop the bleeding first.

## What to check first
- **Source:** Defender (defender.microsoft.com → Incidents & alerts), Entra → Protection → **Risky users / Risky sign-ins**, or a quarantine/phish report.
- **Severity + scope:** one user or many? Any successful risky sign-in / inbox rule / mass send?

## Step-by-step (portal first)

**1. Assess** — open the alert: who, what, when, from where (IP/country/device), success or blocked.

> **PREVIEW ONLY [security-account-block-portal]:** First resolve `OnPremisesSyncEnabled` and the source-of-authority identity. A synchronized identity requires the authoritative AD disable and a separately confirmed cloud gap block; a cloud-only identity uses the cloud-only gate below. This portal checklist cannot block either identity type.

<!-- SAFETY GATE [security-session-revoke-portal] -->
- **Target:** [UPN]
- **Effect:** invalidate Microsoft Entra refresh tokens and browser session cookies
- **Scope:** Entra-managed refresh tokens and browser cookies for one user; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** not reversible; the user must authenticate again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [security-session-revoke-portal]:** Only the separate exact match authorizes Entra → Users → `[UPN]` → **Overview** → **Revoke sessions**. Verify after propagation.

**2. Contain (if account likely compromised):**
> **PREVIEW ONLY [security-account-block-followup-portal]:** Source-authoritative sign-in containment is a separate effect. Resolve `OnPremisesSyncEnabled` and route `[UPN]` to `/security-alert-triage`; this checklist cannot block either the synchronized or cloud-only path.
- Prepare source-authoritative sign-in containment in the separately reviewed command above.
- Treat the separately gated session-revocation action above as independent; a block approval never authorizes revocation, and a revocation approval never authorizes a block.
> **PREVIEW ONLY [security-credential-remediation]:** Password reset and MFA method changes require their own exact gates in `/password-reset` and `/mfa-issue`; containment approval does not authorize them.
- Proposed follow-up: reset password and re-register MFA through those commands.
- Check for attacker persistence: Outlook **inbox rules** (auto-forward/delete), **mail forwarding** (EAC), new **app passwords** / OAuth consents.

**3. Investigate scope:**
- Entra → **Sign-in logs** for `[UPN]` (other successful risky logins?).
- Defender → **Explorer / Threat hunting** for the phish — who else received it? clicked?
- Message trace (EAC) for spread.

**4. Remediate:**
> **PREVIEW ONLY [security-message-policy-remediation]:** Purge, sender blocking, and Conditional Access changes are separate effects requiring separate reviewed commands and gates.
- Purge the phish (`/email-quarantine` / Defender → soft/hard delete), block sender/domain.
- Confirm no forwarding/rules remain; tighten CA if a gap was used.

**5. Document** — incident report (`/incident-report`): timeline, scope, actions, root cause.

<details>
<summary>PowerShell — block one verified cloud-only account</summary>

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All"
$upn = "[UPN]"
$user = Get-MgUser -UserId $upn -Property Id,UserPrincipalName,AccountEnabled,OnPremisesSyncEnabled -ErrorAction Stop
Write-Host "Resolved user: $($user.UserPrincipalName); ID: $($user.Id); AccountEnabled: $($user.AccountEnabled); Synced: $($user.OnPremisesSyncEnabled)"
if ($user.OnPremisesSyncEnabled -eq $true) { throw "This identity is synchronized. Stop and use the authoritative AD containment path below." }
if (-not $user.AccountEnabled) { throw "The account is already blocked. No change was made." }
# SAFETY GATE [security-account-block]
# Target: the resolved cloud-only user ID and UPN in $user
# Effect: blocks Microsoft Entra sign-in for that cloud-only account
# Scope: one verified cloud-only user account
# Reversibility: reversible by a separate reviewed re-enable action
$requiredConfirmation = "BLOCK CLOUD-ONLY SIGN-IN FOR $($user.UserPrincipalName) ID $($user.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Update-MgUser -UserId $user.Id -AccountEnabled:$false -ErrorAction Stop
    $verified = Get-MgUser -UserId $user.Id -Property AccountEnabled -ErrorAction Stop
    if ($verified.AccountEnabled) { throw "Block request returned but read-back still shows enabled. Stop and investigate partial state." }
} else {
    throw "Confirmation did not match. Sign-in was not blocked."
}
```
</details>

<details>
<summary>PowerShell — contain one verified synchronized identity</summary>

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All"
$upn = "[UPN]"
$cloudUser = Get-MgUser -UserId $upn -Property Id,UserPrincipalName,AccountEnabled,OnPremisesSyncEnabled -ErrorAction Stop
if ($cloudUser.OnPremisesSyncEnabled -ne $true) { throw "The resolved identity is not synchronized. Stop and use the cloud-only path." }
$authoritativeUpn = [string]$cloudUser.UserPrincipalName
$adUsers = @(Get-ADUser -Filter { UserPrincipalName -eq $authoritativeUpn } -Properties Enabled,ObjectGuid,UserPrincipalName -ErrorAction Stop)
if ($adUsers.Count -ne 1) { throw "Expected exactly one authoritative AD identity for $upn; found $($adUsers.Count). No change was made." }
$adUser = $adUsers[0]
if ($adUser.UserPrincipalName -cne $cloudUser.UserPrincipalName) { throw "AD and Entra UPNs do not match exactly. No change was made." }
if (-not $adUser.Enabled) { throw "The authoritative AD account is already disabled. No change was made." }

# SAFETY GATE [security-synced-ad-disable]
# Target: the resolved authoritative AD account UPN and ObjectGuid
# Effect: disables the synchronized identity at its on-premises source of authority
# Scope: one exact AD identity; no cloud write is authorized by this phrase
# Reversibility: reversible through a separately reviewed Enable-ADAccount action
$requiredConfirmation = "DISABLE AUTHORITATIVE AD USER $($adUser.UserPrincipalName) GUID $($adUser.ObjectGuid)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Disable-ADAccount -Identity $adUser.ObjectGuid -ErrorAction Stop
    $verifiedAdUser = Get-ADUser -Identity $adUser.ObjectGuid -Properties Enabled -ErrorAction Stop
    if ($verifiedAdUser.Enabled) { throw "AD disable returned but read-back still shows enabled. Stop and investigate partial state." }
} else {
    throw "Confirmation did not match. No change was made."
}

# SAFETY GATE [security-synced-cloud-gap-block]
# Target: the same synchronized Entra UPN and immutable cloud user ID
# Effect: blocks cloud sign-in during the directory-sync propagation gap
# Scope: one verified Entra identity after authoritative AD disable read-back
# Reversibility: reversible by a separate reviewed cloud re-enable after AD recovery
$requiredConfirmation = "BLOCK CLOUD SYNC GAP FOR $($cloudUser.UserPrincipalName) ID $($cloudUser.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    Update-MgUser -UserId $cloudUser.Id -AccountEnabled:$false -ErrorAction Stop
    $verifiedCloudUser = Get-MgUser -UserId $cloudUser.Id -Property AccountEnabled -ErrorAction Stop
    if ($verifiedCloudUser.AccountEnabled) { throw "Cloud block returned but read-back still shows enabled. Stop and investigate partial state." }
} else {
    throw "Confirmation did not match. No change was made."
}
```
</details>

<details>
<summary>PowerShell — revoke Microsoft Entra sessions for one user</summary>

```powershell
Connect-MgGraph -Scopes "User.RevokeSessions.All"
$upn = "[UPN]"
$sessionUser = Get-MgUser -UserId $upn -Property Id,UserPrincipalName -ErrorAction Stop
if ([string]::IsNullOrWhiteSpace([string]$sessionUser.Id) -or [string]$sessionUser.UserPrincipalName -cne $upn) { throw "The exact Entra identity was not resolved. No change was made." }
# SAFETY GATE [security-session-revoke]
# Target: canonical UPN and immutable ID in $sessionUser
# Effect: invalidates Entra refresh tokens and browser session cookies
# Scope: Entra-managed refresh tokens and browser cookies for one user; other app sessions can persist until expiry
# Reversibility: not reversible; the user must authenticate again
$requiredConfirmation = "REVOKE ENTRA SESSIONS FOR $($sessionUser.UserPrincipalName) ID $($sessionUser.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    $revocationAccepted = Revoke-MgUserSignInSession -UserId $sessionUser.Id -ErrorAction Stop
    if ($revocationAccepted.Value -ne $true) { throw "Entra did not acknowledge the revocation request. Current session state is unknown." }
} else {
    throw "Confirmation did not match. Entra sessions were not revoked."
}
```
</details>

<details>
<summary>PowerShell — read-only mailbox persistence checks</summary>

```powershell
Connect-ExchangeOnline
Get-InboxRule -Mailbox "[UPN]"                                       # look for malicious auto-forward/delete rules
Get-Mailbox "[UPN]" | Select ForwardingSmtpAddress,DeliverToMailboxAndForward  # check hidden forwarding
```
</details>

## ⚠️ Risk warning
- Source-authoritative account blocking prevents new authentication. The separate Entra revocation request invalidates refresh tokens/browser cookies after propagation, while current access tokens/app-issued sessions may persist; confirm the identity/evidence before either gate.
- Don't delete evidence before capturing it (screenshots/log export) — you'll need it for the incident report.
- Genuine breach with business/legal impact → escalate to leadership; deep cyber forensics → external IR/vendor support.

## ✅ Verification checklist
- [ ] Account contained at the resolved source of authority; Entra refresh-token/browser-cookie revocation requested and checked after propagation; password/MFA remediated through their separate gates if compromised
- [ ] No malicious inbox rules / forwarding / OAuth grants remain
- [ ] Scope confirmed (other affected users handled)
- [ ] Phish purge, sender block, and CA remediation each [separately approved/verified under their own workflow / documented as not required]
- [ ] Incident documented (timeline + root cause)

## 📝 Jira-ready note
> Resolved [date/time]. Security alert: [type] on `[UPN]`. Severity [low/med/high]. Containment verified: [source-authoritative block / Entra revocation checked after propagation / password or MFA action under its separate gate / not required]. Removed [N] verified malicious rules/forwarding; scope [N users]. Phish purge: [verified under its separate workflow / not required]. Sender block: [verified under its separate workflow / not required]. CA remediation: [verified under its separate workflow / not required]. Root cause: [cause]. Incident report: [attached / not required]. Time spent: [X] min.
