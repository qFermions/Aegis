---
description: Troubleshoot and reset MFA in Entra — re-register on a new phone, clear old methods, fix "no prompt" issues, handle the CA-blocks-re-registration gotcha. Placeholders only.
disable-model-invocation: true
---

# /mfa-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Most MFA tickets are "got a new phone" (re-register) or "not getting prompts" (auth-method or Conditional Access misconfig). The classic gotcha: a CA policy blocks login **before** the user can re-register — temporarily exclude them, let them register, re-add.

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3 and that has a read-back named for it below, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and its read-back below as `--read-back`: `msgraph:verify-sessions-revoked --not-before` for [mfa-session-revoke-portal] or its PowerShell twin [mfa-session-revoke], `msgraph:verify-temporary-access-pass --not-before` for [mfa-temporary-access-pass-portal], `msgraph:verify-method-absent` for [mfa-method-delete-portal], `msgraph:verify-mfa-cleared` for [mfa-require-reregister-portal]), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`). The raw `auth-methods` output, before and after a delete, stays in `tasks/checkpoints/` (it prints phone numbers and device names, so the ticket names the method type only). A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names. A read-back whose line has `--not-before` is named with it and no value, such as `msgraph:verify-sessions-revoked --not-before`, and is run with `--not-before` at or after the approval's time, which `approve` prints: a read bounded earlier never proves the change (batch G4).

## What to check first
- Verify the requester first, using the agreed identity check **[org gap: confirm the identity-verification rule]**: confirm with the user that you're talking to the actual person (callback to a known good number: social engineering risk on MFA resets is real).
- Entra → Users → `[UPN]` → **Authentication methods** → what's registered?
- Entra → Sign-in logs → filter `[UPN]` → is MFA being prompted/failing, or never triggered?
- Entra ID → Conditional Access → which policy applies to this user?
- **A smell of compromise** (answer-format section 2, rule a): MFA prompts or sign-ins `[FIRST_NAME]` did not make, a lost or stolen phone that holds the sign-in method, or a request for a pass sent to a number nobody can verify. Name the escalation to the security lead or the security on-call (they need what was seen, when, `[UPN]`, the device, and the sign-in log entries); the new way in below still follows the identity check, and nobody calls it harmless before that team has looked.
- **Ask first** (rule d): a request to exclude `[UPN]` from a Conditional Access policy, with no failure reason from the sign-in logs in the ticket, gets one question first: "What does the sign-in log's failure reason say for the latest failed sign-in?" The exclusion is only for a cause that reason shows.

## Step-by-step fix (portal first)

**New phone / re-register:**

This is the lost-or-replaced-device path, and it follows answer-format section 2, "A new way in before the old way out": prove who is asking, give a time-limited way in, let the user register the new method, and only then remove the old one. The read-backs then show the new method present and the old one gone. Require re-register MFA is not this path; its gate is further down, with when it is the right tool.

1. Give the new way in first; nothing registered is removed in this step. In order: prove who is asking, cut the sessions of a lost or stolen phone, then issue a Temporary Access Pass and hand it over on a verified channel. Each part is written out below.

**Who is asking:** before any gate, the tech places a call to the number already on file for `[UPN]` (the HR record or the directory, never a number given in the ticket), or sees the person with photo ID, or has the person's manager confirm on a call the tech places. The ticket says which of the three was used. **[org gap: confirm the identity-verification rule]**

**Lost or stolen phone only:** revoke the user's sessions under the gate below, so nothing the missing phone still holds keeps working. For a phone the user still holds, or handed back wiped, leave the sessions alone: nothing is out of their hands.

<!-- SAFETY GATE [mfa-session-revoke-portal] -->
- **Target:** [UPN]
- **Effect:** invalidate Microsoft Entra refresh tokens and browser session cookies
- **Scope:** Entra-managed refresh tokens and browser cookies for one user; current access tokens and app-issued sessions can persist until expiry
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy: a revocation fits no row cleanly. It touches one user, as the single reversible write row does, but has no undo command; it is hard to reverse, as the multi-object or hard-to-reverse row says; so it takes the higher of the two. It changes no setting and takes nothing away, so the last row does not apply): not reversible; the user must authenticate again
- **Required confirmation:** Type exactly `REVOKE ENTRA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mfa-session-revoke-portal]:** Only after the exact match, with its change record approved, the user's recent sign-ins from `node scripts/adapters/msgraph-client.js sign-ins --user [USER_ID] --since [DATE_TIME] --execute` saved to `tasks/checkpoints/` (the R2 pre-state: which sessions were in use, read before the click; [DATE_TIME] a time before the device was lost, in UTC, written in the ticket, not the time the work started) and the time of the click written in the ticket, Entra → Users → `[UPN]` → **Overview** → **Revoke sessions**. This is distinct from **Require re-register MFA** and does not authorize deleting a method. Then run its read-back below, `verify-sessions-revoked` with `--change [CHANGE_ID]`: it passes once the user's sessions are valid only from the time the work started on. Microsoft notes tokens may take a few minutes more to be revoked, so do not claim every app session ended instantly.

### A new way in: the Temporary Access Pass (still step 1)

**User check:** ask whether another registered method still works; the Authentication methods list shows what else is registered (a second phone number, a security key, Windows Hello). If one does, the user signs in with it and adds the new phone at aka.ms/mfasetup with no pass and no admin change; go on to the read at the end of step 2, then step 3.

Read first, changing nothing: Entra admin center → Entra ID → Authentication methods → Policies → **Temporary Access Pass** shows whether the method is enabled and whether `[UPN]` is in its scope. Microsoft: "only users included in the policy can sign in with it" (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-05). If it is off, or the user is outside its scope, stop here: changing that policy is a tenant-wide R3 change this runbook does not authorize. Escalate it, or use the fallback in step 5.

<!-- SAFETY GATE [mfa-temporary-access-pass-portal] -->
- **Target:** [UPN]
- **Effect:** create one Temporary Access Pass for the user: a time-limited passcode that signs in as them and lets them register a new method
- **Scope:** one user and one pass; a user holds one pass at a time, so a new pass replaces an earlier one (MB-09); no registered method is removed
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the destructive, mass or security control row: "CA/MFA/licensing changes"; one delete undoes the pass, as the single reversible write row says, but what its holder signed in to or registered while it lived cannot be taken back, so the higher class): reversible by deleting the pass before it is used; it also ends by itself when its lifetime runs out
- **Required confirmation:** Type exactly `CREATE TEMPORARY ACCESS PASS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `msgraph-client.js verify-temporary-access-pass --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mfa-temporary-access-pass-portal]:** Only after the exact match, signed in as at least Authentication Administrator (Privileged Authentication Administrator when `[UPN]` holds an admin role; Microsoft Learn, "Configure Temporary Access Pass", MB-02), with its change record approved, the method list from `node scripts/adapters/msgraph-client.js auth-methods --user [USER_ID] --execute` saved to `tasks/checkpoints/` and the rollback path written in the ticket (delete the pass under [mfa-method-delete-portal], naming Temporary Access Pass as the method type; an unused pass also ends when its lifetime runs out), Entra admin center → Entra ID → Users → `[UPN]` → **Authentication methods** → **Add authentication method** → **Temporary Access Pass** → one-time use where the policy allows it, and the shortest lifetime that lets the user finish (the policy's default is 1 hour, MB-06) → **Add**. The pass value shows once: "You can't view this value after you select Ok" (MB-04). Keep it for the handover only, and never write it in the ticket, a checkpoint or a chat. Then run its read-back below right away, before the handover: `verify-temporary-access-pass` with `--change [CHANGE_ID]` passes only when a pass created at or after `[NOT_BEFORE]` is listed and the user can use it. Microsoft notes a new pass can take a few minutes to show (MB-13).

**Handover:** give the pass to the user on a channel the tech has verified: a call the tech places to the number on file, in person, or through the manager who confirmed them. Never by email, chat or text, and never to a number or address taken from the ticket. Tell the user it works for a short time and that they need the new phone in hand first: with a one-time pass the registration must finish within 10 minutes of signing in (MB-08).

2. Tell the user to go to **aka.ms/mfasetup** and register the new device. They sign in with the pass and add the new method there; the pass can also set up Microsoft Authenticator from inside the app (MB-14). Before anything is removed, read the Authentication methods list again: it must show a method, other than the Temporary Access Pass itself, that is not in the saved checkpoint. That entry is the new way in; the pass alone is not, and with only the pass listed the old method stays.

3. Only then, the old way out: delete the one obsolete method under its gate below. Every other method stays.

**Try first:** the new way in, [mfa-temporary-access-pass-portal] above or another registered method that still works. The delete below never comes before one of them.

<!-- SAFETY GATE [mfa-method-delete-portal] -->
- **Target:** the displayed method type and method ID for [UPN]
- **Effect:** delete one reviewed obsolete authentication method
- **Scope:** one named method for one user; all other methods remain unchanged
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the destructive, mass or security control row: "CA/MFA/licensing changes"): not reversible; the method must be registered again
- **Required confirmation:** Render the reviewed values as `$methodType` and `$methodId`, then type exactly `DELETE MFA METHOD $methodType ID $methodId FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `msgraph-client.js verify-method-absent --user [USER_ID] --method-id [METHOD_ID] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mfa-method-delete-portal]:** Record the method type and displayed ID. Only after the separate exact match, with its change record approved, the method list from `node scripts/adapters/msgraph-client.js auth-methods --user [USER_ID] --execute` saved to `tasks/checkpoints/` and the rollback path written in the ticket (the user registers that method again at aka.ms/mfasetup), Entra → Users → `[UPN]` → **Authentication methods** → select that one obsolete method → **Delete**. Then run its read-back below, `verify-method-absent` with the displayed ID as `[METHOD_ID]` and `--change [CHANGE_ID]`: it passes only when that method id is no longer listed.

4. Prove both halves, in this order: `verify-method-absent` shows the old method gone, then `verify-mfa-method` shows a method of the new kind still registered; with the old one gone, the one it finds is the new one, as long as the checkpoint held no second method of that kind (if it did, compare the method ids with the checkpoint instead). A pass that is still valid after the registration (a multi-use pass) is deleted under the same delete gate or left to run out, and the ticket says which.

### Require re-register MFA: not the lost-or-replaced-device path

Require re-register MFA is not the lost-or-replaced-device path: it takes the old way out before a new way in exists. It clears every phone, Authenticator and software OATH method at once, and until the user registers again only the password stands between the account and anyone who knows it. It is the right tool when the registered methods themselves cannot be trusted: a confirmed account compromise in which an attacker may have added a method (`/security-alert-triage`), or methods the user does not recognize as theirs. Even then the user comes back in with a pass under the gate above, issued after the clear; that pass is left to run out, because the one-method delete is not used on a ticket that used this gate.

**Try first:** for a lost or replaced phone, the pass and then the one-method delete above ([mfa-temporary-access-pass-portal], then [mfa-method-delete-portal]). This gate is for the case where every registered method must go at once, which no smaller action does.

**Or, instead of the one-method delete:** clear every phone, Authenticator and software OATH method with Require re-register MFA. [mfa-require-reregister-portal] and [mfa-method-delete-portal] are alternatives: one or the other for a ticket, never both.

<!-- SAFETY GATE [mfa-require-reregister-portal] -->
- **Target:** [UPN]
- **Effect:** Require re-register MFA, which "deactivates the user's hardware OATH tokens and deletes the following authentication methods from this user: phone numbers, Microsoft Authenticator apps and software OATH tokens" (Microsoft Learn, howto-mfa-userdevicesettings, read 2026-10-31)
- **Scope:** one user; the alternative to [mfa-method-delete-portal], never with it on the same ticket
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the destructive, mass or security control row: "CA/MFA/licensing changes"): not reversible; the user must register again before any sign-in that requires MFA
- **Required confirmation:** Type exactly `REQUIRE MFA RE-REGISTER FOR [UPN] AND DELETE ITS MFA METHODS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `msgraph-client.js verify-mfa-cleared --user [USER_ID] --change [CHANGE_ID] --execute`
**PORTAL ACTION [mfa-require-reregister-portal]:** Only after the exact match, signed in as at least Authentication Administrator (Microsoft Learn, "Manage user authentication options"; `docs/aegis/g3/vendor-facts.md` B-18), with its change record approved, the method list from `node scripts/adapters/msgraph-client.js auth-methods --user [USER_ID] --execute` saved to `tasks/checkpoints/` and the rollback path written in the ticket (the user registers again at aka.ms/mfasetup), Entra admin center → Entra ID → Users → `[UPN]` → **Authentication methods** → **Require re-register MFA** at the top of the window. Then run its read-back below right away, before the user registers again (step 2): `verify-mfa-cleared` with `--change [CHANGE_ID]` passes only while no phone, Authenticator or software OATH method is left.

> **PREVIEW ONLY [mfa-phone-add]:** An administrator adding a fallback method is a separate identity change. Do not perform it from this command without its own reviewed target/method gate.

5. Proposed fallback, for a user the Temporary Access Pass policy does not cover: Entra → Users → `[UPN]` → **Authentication methods** → **+ Add method** → **Phone** → `[PHONE_NUMBER]`. The order stays the same: who is asking first, the number confirmed on a verified channel, and the old method removed only after the user has registered with the new one.

### Other MFA problems

**Not getting prompts:**
1. Confirm a method is registered (above). If none → have them register at aka.ms/mfasetup.
2. Entra ID → **Conditional Access** → confirm an MFA policy targets the user and isn't excluded.
3. Check **Authentication methods policy** (Entra ID → Authentication methods → Policies) — is the method (Authenticator/SMS) enabled?

**⚠️ CA-blocks-re-registration gotcha (Temporary Exception):**
> **PREVIEW ONLY [mfa-ca-exclusion]:** A Conditional Access exclusion is a separate R3 policy change. Export the policy, set a time-bounded rollback, and use a separate reviewed `/conditional-access` runbook; do not change it here.
1. Proposed recovery path: Entra ID → Conditional Access → the blocking policy → **Assignments → Users → Exclude** → add `[UPN]`.
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
# Reversibility: R2: not reversible; the user must authenticate again. CLAUDE.md risk table: one user but no undo command, and hard to reverse, so the higher of the two rows it touches
# Read-back: msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
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

## 🔎 Read-back (read-only, after the person finishes)
The read-only Microsoft Graph connector (`scripts/adapters/msgraph-client.js`, GET only, a certificate credential with `User.Read.All`, `UserAuthenticationMethod.Read.All` and `AuditLog.Read.All`) proves each step. Use the user's object ID as `[USER_ID]`. For a read-back run with `--change [CHANGE_ID]`, take as `[NOT_BEFORE]` the `approved_at` that `change-record.js approve` printed for that read-back's change, because a bound earlier than the approval is refused before the read; for `verify-signin`, which runs without a change, use the time the work started (UTC).

```bash
# HUMAN-RUN read-only read-back of [mfa-session-revoke-portal] or [mfa-session-revoke] (Revoke sessions): passes only when the user's sessions are valid only from [NOT_BEFORE] on (signInSessionsValidFromDateTime, which the revocation resets; vendor fact M-26)
node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back of [mfa-temporary-access-pass-portal] (the Temporary Access Pass): run it right after that gate, before the handover; passes only when a pass created at or after [NOT_BEFORE] is listed and the user can use it (an older pass stays listed, so the time bound is what ties it to this change; vendor facts MB-09, MB-11); it never prints the pass value
node scripts/adapters/msgraph-client.js verify-temporary-access-pass --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back of [mfa-method-delete-portal] (the one-method delete): passes only when the method id recorded before the delete is no longer listed
node scripts/adapters/msgraph-client.js verify-method-absent --user [USER_ID] --method-id [METHOD_ID] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back of [mfa-require-reregister-portal] (Require re-register MFA): run it right after that gate, before the user registers again; passes only when no phone, Authenticator or software OATH method is left
node scripts/adapters/msgraph-client.js verify-mfa-cleared --user [USER_ID] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back after the user registers on the new phone: passes only when an Authenticator method is registered; on the lost-or-replaced-device path run it after the old method's delete read-back, so the method it finds is the new one
node scripts/adapters/msgraph-client.js verify-mfa-method --user [USER_ID] --method microsoftAuthenticator --execute
# HUMAN-RUN read-only read-back: passes only when the sign-in logs show a successful sign-in at or after [NOT_BEFORE] (Entra ID P1 or P2)
node scripts/adapters/msgraph-client.js verify-signin --user [USER_ID] --not-before [NOT_BEFORE] --execute
```

**Known limit (session revocation):** Microsoft does not document whether a password reset moves `signInSessionsValidFromDateTime`, so on a ticket that also reset the password this read-back may pass without a revocation: the reset may move it too. Record in the ticket whether the password was reset in the same ticket, and if it was, prove the revocation by the Revoke sessions entry in the user's audit log as well. The question is vendor fact M-28 (`docs/aegis/g3/vendor-facts-to-check.md`), checked on a test tenant (`docs/aegis/owner/test-tenant-runbook.md`).

## ⚠️ Risk warning
- A Temporary Access Pass signs in as the user for as long as it lives. Issue it only after the identity check, for one user, with the shortest lifetime that works, and hand it over only on a verified channel. A request to send it by text or chat to a number in the ticket is how an account is taken over.
- **Never disable MFA org-wide** as a "fix." Per-user temporary exclusion only, time-boxed, documented, reverted.
- The CA exclusion is a real security gap while open — re-add the user immediately after registration. Route through independent plan review if it touches a broad policy.

## ✅ Verification checklist
- [ ] Lost or replaced phone: identity proved by a named method before any gate, and the pass handed over on a verified channel (the ticket says which)
- [ ] Temporary Access Pass path: `verify-temporary-access-pass` passed under its change before the handover
- [ ] Lost or replaced phone: the old method was deleted only after a new method, other than the Temporary Access Pass, showed in Authentication methods
- [ ] User completed registration at aka.ms/mfasetup (new method shows in Authentication methods)
- [ ] Require re-register MFA path: `verify-mfa-cleared` passed under its change right after the gate, before the new registration
- [ ] Session revocation: `verify-sessions-revoked` passed under its change (Microsoft notes tokens may take a few minutes more to be revoked)
- [ ] One-method delete path: `verify-method-absent` passed under its change (the `auth-methods` output stays in `tasks/checkpoints/`; the ticket names the method type only)
- [ ] `verify-mfa-method` and `verify-signin` pass after the new registration
- [ ] Test sign-in prompts for MFA and succeeds
- [ ] Any CA exclusion has been **removed** (no lingering bypass)
- [ ] Sign-in logs show successful MFA
- [ ] Prompts or sign-ins the person did not make, or a stolen phone: escalated to the security lead or on-call with what was seen, when, the account, the device and the log entries (rule a)

## 📝 Jira-ready note
> Resolved [date/time]. MFA issue for `[UPN]`: [new-phone re-registration / no-prompt CA diagnosis]. Identity: [proved by a call to the number on file / in person / through the manager]. New way in: [Temporary Access Pass issued under [mfa-temporary-access-pass-portal], `verify-temporary-access-pass` passed under its change, handed over by [the verified channel used] / another registered method still worked, no pass issued]. Sessions: [revoked under [mfa-session-revoke-portal] and `verify-sessions-revoked` passed under its change / not revoked]. Authentication-method state: [one method deleted under [mfa-method-delete-portal] and `verify-method-absent` passed under its change / every phone, Authenticator and software OATH method cleared under [mfa-require-reregister-portal] and `verify-mfa-cleared` passed under its change / unchanged]. Re-registration: [verified at aka.ms/mfasetup and in sign-in logs / not completed]. [If separately authorized and verified: temporary CA exclusion applied, then removed after registration; approval [MANAGER_NAME].] Time spent: [X] min.
