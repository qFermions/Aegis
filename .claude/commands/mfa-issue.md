---
description: Troubleshoot and reset MFA in Entra — re-register on a new phone, clear old methods, fix "no prompt" issues, handle the CA-blocks-re-registration gotcha. Placeholders only.
---

# /mfa-issue

**Verdict:** Most MFA tickets are "got a new phone" (re-register) or "not getting prompts" (auth-method or Conditional Access misconfig). The classic gotcha: a CA policy blocks login **before** the user can re-register — temporarily exclude them, let them register, re-add.

## What to check first
- Entra → Users → `[UPN]` → **Authentication methods** → what's registered?
- Entra → Sign-in logs → filter `[UPN]` → is MFA being prompted/failing, or never triggered?
- Entra → Protection → Conditional Access → which policy applies to this user?

## Step-by-step fix (portal first)

**New phone / re-register:**
1. Entra → Users → `[UPN]` → **Authentication methods** → **Revoke MFA sessions** + delete the old phone method.
2. Tell the user to go to **aka.ms/mfasetup** and register the new device.
3. Add the SMS fallback: Entra → Users → `[UPN]` → **Authentication methods** → **+ Add method** → **Phone** → `[PHONE_NUMBER]` — so the next lost/wiped phone doesn't mean another ticket.

**Not getting prompts:**
1. Confirm a method is registered (above). If none → have them register at aka.ms/mfasetup.
2. Entra → Protection → **Conditional Access** → confirm an MFA policy targets the user and isn't excluded.
3. Check **Authentication methods policy** (Entra → Protection → Authentication methods) — is the method (Authenticator/SMS) enabled?

**⚠️ CA-blocks-re-registration gotcha (Temporary Exception):**
1. Entra → Protection → Conditional Access → the blocking policy → **Assignments → Users → Exclude** → add `[UPN]`.
2. User registers at aka.ms/mfasetup.
3. **Re-add the user** to the policy (remove the exclusion). Document as a Temporary Exception (who approved, when reverted).

<details>
<summary>PowerShell — for reference only</summary>

```powershell
Connect-MgGraph -Scopes "UserAuthenticationMethod.ReadWrite.All","User.Read.All"  # MFA-method rights
# List the user's registered methods (read-only check)
Get-MgUserAuthenticationMethod -UserId "[UPN]"             # see what's registered
# Revoke sessions so the next sign-in forces fresh MFA
Revoke-MgUserSignInSession -UserId "[UPN]"                 # ⚠️ signs the user out everywhere
```
</details>

## ⚠️ Risk warning
- **Never disable MFA org-wide** as a "fix." Per-user temporary exclusion only, time-boxed, documented, reverted.
- The CA exclusion is a real security gap while open — re-add the user immediately after registration. Route through Nova if it touches a broad policy.

## ✅ Verification checklist
- [ ] User completed registration at aka.ms/mfasetup (new method shows in Authentication methods)
- [ ] Test sign-in prompts for MFA and succeeds
- [ ] Any CA exclusion has been **removed** (no lingering bypass)
- [ ] Sign-in logs show successful MFA

## 📝 Jira-ready note
> Resolved [date/time]. MFA issue for `[UPN]`: [new-phone re-registration / no-prompt CA fix]. Old methods cleared, user re-registered at aka.ms/mfasetup. [If used: temporary CA exclusion applied and removed after registration — approved by [MANAGER_NAME].] Verified via sign-in logs. Time spent: [X] min.
