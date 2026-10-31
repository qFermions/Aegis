---
description: Reset a user's password in a hybrid AD → Entra environment — portal first, force change at next logon, revoke sessions, optional MFA re-registration. Placeholders only.
disable-model-invocation: true
---

# /password-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** In a hybrid environment, **on-prem AD is the source of authority for synced users** — reset there, then let Entra Connect sync. Cloud-only users reset directly in Entra. Use `[FIRST_NAME]` / `[UPN]` — never the real name.

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3 and that has a read-back named for it below (the resets and the session revocation), open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and that read-back as `--read-back`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`). A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names. A read-back whose line has `--not-before` is named with it and no value, such as `msgraph:verify-sessions-revoked --not-before`, and is run with `--not-before` at or after the approval's time, which `approve` prints: a read bounded earlier never proves the change (batch G4).

## What to check first
- **Synced or cloud-only?** Entra → Users → `[UPN]` → "On-premises sync enabled" = Yes → synced.
- **Locked vs. forgotten?** ADUC → Account tab → "Unlock account" if locked.
- Any Conditional Access policy that could block re-login (see `/conditional-access`).

## Step-by-step fix (portal/GUI first)

<!-- SAFETY GATE [password-reset-synced-portal] -->
- **Target:** [first.last] mapped to [UPN]
- **Effect:** replace the authoritative on-prem AD password and require a change at next sign-in
- **Scope:** one verified synced identity; no cloud-side reset
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: "reversal needs data you'd have to reconstruct"): not reversible; another verified AD reset is required
- **Required confirmation:** Type exactly `RESET AD PASSWORD FOR [first.last] MAPPED TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [password-reset-synced-portal]:** Only the exact match authorizes the synced-user branch. Never reset both copies of a synced identity.

**Synced user (on-prem AD is authority):**
1. **ADUC** (`dsa.msc`) → find `[FIRST_NAME] [LAST_NAME]` → right-click → **Reset Password**.
2. Set a temp password; check **"User must change password at next logon"**.
> **PREVIEW ONLY [password-account-unlock]:** Account unlock is a separate identity change and is not authorized by a password-reset phrase.
3. If locked, move account unlock into a separate reviewed action.
4. Wait for the normal sync cycle. A forced sync requires a separate reviewed `/ad-connect` runbook.
5. Confirm it reached cloud: Entra → Users → `[UPN]`.

**Cloud-only user:**
<!-- SAFETY GATE [password-reset-cloud-portal] -->
- **Target:** [UPN]
- **Effect:** replace the cloud password and require a change at next sign-in
- **Scope:** one verified cloud-only identity
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: "reversal needs data you'd have to reconstruct"): not reversible; another verified cloud reset is required
- **Required confirmation:** Type exactly `RESET CLOUD PASSWORD FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [password-reset-cloud-portal]:** Only the exact match authorizes the cloud-only branch. Stop if on-premises sync is enabled.
1. **Microsoft 365 admin center** → Users → Active users → `[UPN]` → **Reset password**.
2. Auto-generate or set temp; check **"Require this user to change their password"**.

<!-- SAFETY GATE [password-session-revoke-portal] -->
- **Target:** [UPN]
- **Effect:** invalidate Microsoft Entra refresh tokens and browser session cookies
- **Scope:** Entra-managed refresh tokens and browser cookies for one user; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy: a revocation fits no row cleanly, one object but no undo command, so it takes the higher of the two rows it touches, the multi-object or hard-to-reverse row): not reversible; the user must authenticate again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [password-session-revoke-portal]:** Only after the separate exact match, Entra → Users → `[UPN]` → **Overview** → **Revoke sessions**. A password-reset confirmation never authorizes this effect; verify after propagation.

**Combo case — MFA-locked too (new phone + forgotten password):** order matters.
1. Use the separate exact method-ID deletion gate in `/mfa-issue`; this command does not authorize deleting authentication methods.
2. **Then** reset the password (steps above).
3. **Then** the user re-registers at **aka.ms/mfasetup** on first sign-in (full flow incl. the CA gotcha: `/mfa-issue`).
Resetting the password first just walks the user into an MFA wall they can't pass — they sign in with the temp password and get prompted on a phone they no longer have.

<details>
<summary>PowerShell — non-executing AD Connect sync reference</summary>

```powershell
# PREVIEW ONLY [password-reset-delta-sync] — non-executing sync reference; run only from a separate reviewed AD Connect runbook.
# Start-ADSyncSyncCycle -PolicyType Delta
```
</details>

<details>
<summary>PowerShell — cloud-only password reset</summary>

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All"
$upn = "[UPN]"
$user = Get-MgUser -UserId $upn -Property Id,UserPrincipalName,OnPremisesSyncEnabled -ErrorAction Stop
if ($user.OnPremisesSyncEnabled -eq $true) {
    throw "The resolved identity is synchronized from on-premises AD. Stop and use the authoritative on-premises reset path."
}
# SAFETY GATE [password-cloud-reset]
# Target: the resolved cloud-only user principal name and immutable ID
# Effect: replaces the cloud password and forces a change at next sign-in
# Scope: one user account
# Reversibility: R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: "reversal needs data you'd have to reconstruct"): not reversible; another verified reset is required
$requiredConfirmation = "RESET CLOUD PASSWORD FOR $($user.UserPrincipalName) WITH ID $($user.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    $temporaryCredential = Get-Credential -UserName $user.UserPrincipalName -Message "Enter the temporary password for the verified cloud-only user"
    $pw = @{ forceChangePasswordNextSignIn = $true; password = $temporaryCredential.GetNetworkCredential().Password }
    try {
        Update-MgUser -UserId $user.Id -PasswordProfile $pw -ErrorAction Stop
        $readBack = Get-MgUser -UserId $user.Id -Property Id,UserPrincipalName -ErrorAction Stop
        if ([string]$readBack.Id -cne [string]$user.Id -or [string]$readBack.UserPrincipalName -cne [string]$user.UserPrincipalName) { throw "Password update returned but identity read-back failed. Treat password state as UNKNOWN." }
    } finally {
        $pw.password = $null
        $pw = $null
        $temporaryCredential = $null
    }
} else {
    throw "Confirmation did not match. The cloud password was not reset."
}
```
</details>

<details>
<summary>PowerShell — revoke Microsoft Entra sessions</summary>

```powershell
Connect-MgGraph -Scopes "User.RevokeSessions.All"
$upn = "[UPN]"
$sessionUser = Get-MgUser -UserId $upn -Property Id,UserPrincipalName -ErrorAction Stop
if ([string]::IsNullOrWhiteSpace([string]$sessionUser.Id) -or [string]$sessionUser.UserPrincipalName -cne $upn) { throw "The exact Entra identity was not resolved. No change was made." }
# SAFETY GATE [password-session-revoke]
# Target: canonical UPN and immutable ID in $sessionUser
# Effect: invalidates Entra refresh tokens and browser session cookies
# Scope: Entra-managed refresh tokens and browser cookies for one user; other app sessions can persist until expiry
# Reversibility: R2 (CLAUDE.md, Risk-Classified Execution Policy: a revocation fits no row cleanly, one object but no undo command, so it takes the higher of the two rows it touches, the multi-object or hard-to-reverse row): not reversible; the user must authenticate again
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

## 🔎 Read-back (read-only, after the person finishes)
The read-only Microsoft Graph connector (`scripts/adapters/msgraph-client.js`, GET only, a certificate credential with `User.Read.All` and `AuditLog.Read.All`) proves the reset. Write the time the reset started as `[NOT_BEFORE]` (UTC) and use the user's object ID as `[USER_ID]`.

```bash
# HUMAN-RUN read-only read-back of [password-reset-cloud-portal], [password-cloud-reset] or [password-reset-synced-portal]: passes only when Entra shows a password change at or after [NOT_BEFORE]; for a synced user, run it after the next sync
node scripts/adapters/msgraph-client.js verify-password-changed --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back of [password-session-revoke-portal] or [password-session-revoke]: passes only when the sessions are valid only from [NOT_BEFORE] on (vendor fact M-26)
node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back: passes only when the sign-in logs show a successful sign-in at or after [NOT_BEFORE] (Entra ID P1 or P2)
node scripts/adapters/msgraph-client.js verify-signin --user [USER_ID] --not-before [NOT_BEFORE] --execute
```

## ⚠️ Risk warning
- `Revoke-MgUserSignInSession` invalidates Entra refresh tokens and browser cookies after propagation; current access tokens and app-issued sessions can persist until expiry.
- For a synced user, a cloud-side reset can be overwritten at next sync — always reset **on-prem** for synced users.

## ✅ Verification checklist
- [ ] User signs in with temp password and is forced to change it
- [ ] `verify-password-changed` passes; `verify-signin` passes after the user signs in
- [ ] (Synced) change visible in Entra after sync — `Get-MgUser -UserId "[UPN]"`
- [ ] Entra session revocation completed and sign-in logs were checked after propagation; no claim is made about app-issued sessions
- [ ] MFA working, or re-registered via `/mfa-issue`
- [ ] Account not locked

## 📝 Jira-ready note
> Resolved [date/time]. Reset password for `[UPN]` ([synced via on-prem AD / verified cloud-only]). Temp password issued with force-change at next logon. Entra refresh-token/browser-cookie revocation [requested and checked after propagation / not requested]; current access tokens and app-issued sessions may persist until their own expiry. User confirmed sign-in + password change. Time spent: [X] min.
