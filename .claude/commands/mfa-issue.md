---
description: Troubleshoot and reset MFA in Entra — re-register on a new phone, clear old methods, fix "no prompt" issues, handle the CA-blocks-re-registration gotcha. Placeholders only.
disable-model-invocation: true
---

# /mfa-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Most MFA tickets are "got a new phone" (re-register) or "not getting prompts" (auth-method or Conditional Access misconfig). The classic gotcha: a CA policy blocks login **before** the user can re-register — temporarily exclude them, let them register, re-add.

## What to check first
- Entra → Users → `[UPN]` → **Authentication methods** → what's registered?
- Entra → Sign-in logs → filter `[UPN]` → is MFA being prompted/failing, or never triggered?
- Entra → Protection → Conditional Access → which policy applies to this user?

## Step-by-step fix (portal first)

**New phone / re-register:**
<!-- SAFETY GATE [mfa-session-revoke-portal] -->
- **Target:** [UPN]
- **Effect:** invalidate Microsoft Entra refresh tokens and browser session cookies
- **Scope:** Entra-managed refresh tokens and browser cookies for one user; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** not reversible; the user must authenticate again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mfa-session-revoke-portal]:** Only after the exact match, Entra → Users → `[UPN]` → **Overview** → **Revoke sessions**. This is distinct from **Require re-register MFA** and does not authorize deleting a method. Verify after the documented propagation interval; do not claim every app session ended instantly.

<!-- SAFETY GATE [mfa-method-delete-portal] -->
- **Target:** the displayed method type and method ID for [UPN]
- **Effect:** delete one reviewed obsolete authentication method
- **Scope:** one named method for one user; all other methods remain unchanged
- **Reversibility:** not reversible; the method must be registered again
- **Required confirmation:** Render the reviewed values as `$methodType` and `$methodId`, then type exactly `DELETE MFA METHOD $methodType ID $methodId FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [mfa-method-delete-portal]:** Record the method type and displayed ID. Only after the separate exact match, Entra → Users → `[UPN]` → **Authentication methods** → select that one obsolete method → **Delete**.
2. Tell the user to go to **aka.ms/mfasetup** and register the new device.
> **PREVIEW ONLY [mfa-phone-add]:** An administrator adding a fallback method is a separate identity change. Do not perform it from this command without its own reviewed target/method gate.
3. Proposed fallback: Entra → Users → `[UPN]` → **Authentication methods** → **+ Add method** → **Phone** → `[PHONE_NUMBER]`.

**Not getting prompts:**
1. Confirm a method is registered (above). If none → have them register at aka.ms/mfasetup.
2. Entra → Protection → **Conditional Access** → confirm an MFA policy targets the user and isn't excluded.
3. Check **Authentication methods policy** (Entra → Protection → Authentication methods) — is the method (Authenticator/SMS) enabled?

**⚠️ CA-blocks-re-registration gotcha (Temporary Exception):**
> **PREVIEW ONLY [mfa-ca-exclusion]:** A Conditional Access exclusion is a separate R3 policy change. Export the policy, set a time-bounded rollback, and use a separate reviewed `/conditional-access` runbook; do not change it here.
1. Proposed recovery path: Entra → Protection → Conditional Access → the blocking policy → **Assignments → Users → Exclude** → add `[UPN]`.
2. User registers at aka.ms/mfasetup.
3. **Re-add the user** to the policy (remove the exclusion). Document as a Temporary Exception (who approved, when reverted).

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "UserAuthenticationMethod.Read.All","User.RevokeSessions.All"  # list methods + revoke Entra sessions
$sessionUser = Get-MgUser -UserId "[UPN]" -Property Id,UserPrincipalName -ErrorAction Stop
if ([string]::IsNullOrWhiteSpace([string]$sessionUser.Id) -or [string]$sessionUser.UserPrincipalName -cne '[UPN]') { throw "The exact Entra identity was not resolved. No change was made." }
# List the resolved user's registered methods (read-only check)
Get-MgUserAuthenticationMethod -UserId $sessionUser.Id -ErrorAction Stop             # see what's registered
# Request refresh-token/browser-cookie revocation. A later authentication prompts for MFA only when the applicable policy and application require it.
# SAFETY GATE [mfa-session-revoke]
# Target: canonical UPN and immutable ID in $sessionUser
# Effect: invalidates Entra refresh tokens and browser session cookies without deleting MFA methods
# Scope: Entra-managed refresh tokens and browser cookies for one user; other app sessions can persist until expiry
# Reversibility: not reversible; the user must authenticate again
$requiredConfirmation = "REVOKE ENTRA SESSIONS FOR $($sessionUser.UserPrincipalName) ID $($sessionUser.Id)"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    $revocationAccepted = Revoke-MgUserSignInSession -UserId $sessionUser.Id -ErrorAction Stop
    if ($revocationAccepted.Value -ne $true) { throw "Entra did not acknowledge the revocation request. Current session state is unknown." }
} else {
    throw "Confirmation did not match. No change was made."
}
```
</details>

## ⚠️ Risk warning
- **Never disable MFA org-wide** as a "fix." Per-user temporary exclusion only, time-boxed, documented, reverted.
- The CA exclusion is a real security gap while open — re-add the user immediately after registration. Route through independent plan review if it touches a broad policy.

## ✅ Verification checklist
- [ ] User completed registration at aka.ms/mfasetup (new method shows in Authentication methods)
- [ ] Test sign-in prompts for MFA and succeeds
- [ ] Any CA exclusion has been **removed** (no lingering bypass)
- [ ] Sign-in logs show successful MFA

## 📝 Jira-ready note
> Resolved [date/time]. MFA issue for `[UPN]`: [new-phone re-registration / no-prompt CA diagnosis]. Authentication-method state: [exact frozen method set deleted under its separate gate and empty-set read-back passed / unchanged]. Re-registration: [verified at aka.ms/mfasetup and in sign-in logs / not completed]. [If separately authorized and verified: temporary CA exclusion applied, then removed after registration — approval [MANAGER_NAME].] Time spent: [X] min.
