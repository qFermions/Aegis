---
description: Reset a user's password in a hybrid AD → Entra environment — portal first, force change at next logon, revoke sessions, optional MFA re-registration. Placeholders only.
---

# /password-reset

**Verdict:** In a hybrid environment, **on-prem AD is the source of authority for synced users** — reset there, then let Entra Connect sync. Cloud-only users reset directly in Entra. Use `[FIRST_NAME]` / `[UPN]` — never the real name.

## What to check first
- **Synced or cloud-only?** Entra → Users → `[UPN]` → "On-premises sync enabled" = Yes → synced.
- **Locked vs. forgotten?** ADUC → Account tab → "Unlock account" if locked.
- Any Conditional Access policy that could block re-login (see `/conditional-access`).

## Step-by-step fix (portal/GUI first)

**Synced user (on-prem AD is authority):**
1. **ADUC** (`dsa.msc`) → find `[FIRST_NAME] [LAST_NAME]` → right-click → **Reset Password**.
2. Set a temp password; check **"User must change password at next logon"**.
3. Account tab → **Unlock account** if locked.
4. Force sync from the AD Connect server (PowerShell below) or wait ~30 min.
5. Confirm it reached cloud: Entra → Users → `[UPN]`.

**Cloud-only user:**
1. **Microsoft 365 admin center** → Users → Active users → `[UPN]` → **Reset password**.
2. Auto-generate or set temp; check **"Require this user to change their password"**.

**After reset (both):** Entra → Users → `[UPN]` → **Revoke sessions** (kills existing stolen tokens).

**Combo case — MFA-locked too (new phone + forgotten password):** order matters.
1. **Clear auth methods FIRST:** Entra → Users → `[UPN]` → **Authentication methods** → delete the stale methods.
2. **Then** reset the password (steps above).
3. **Then** the user re-registers at **aka.ms/mfasetup** on first sign-in (full flow incl. the CA gotcha: `/mfa-issue`).
Resetting the password first just walks the user into an MFA wall they can't pass — they sign in with the temp password and get prompted on a phone they no longer have.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# --- Force Entra Connect sync (run ON the AD Connect server) ---
Start-ADSyncSyncCycle -PolicyType Delta   # push only changed objects to Entra (fast)

# --- Cloud-only reset via Graph (admin workstation) ---
Connect-MgGraph -Scopes "User.ReadWrite.All"               # connect with password-reset rights
$pw = @{ forceChangePasswordNextSignIn = $true; password = "[TEMP_PASSWORD]" }  # temp pw, must-change ON
Update-MgUser -UserId "[UPN]" -PasswordProfile $pw          # apply the reset to the cloud account

# --- Revoke all active sessions (kills existing tokens) ---
Revoke-MgUserSignInSession -UserId "[UPN]"                  # ⚠️ signs the user out everywhere
```
</details>

## ⚠️ Risk warning
- `Revoke-MgUserSignInSession` signs the user out of **all** sessions/devices — expected; warn them they'll re-auth everywhere.
- For a synced user, a cloud-side reset can be overwritten at next sync — always reset **on-prem** for synced users.

## ✅ Verification checklist
- [ ] User signs in with temp password and is forced to change it
- [ ] (Synced) change visible in Entra after sync — `Get-MgUser -UserId "[UPN]"`
- [ ] Sessions revoked (old tokens dead)
- [ ] MFA working, or re-registered via `/mfa-issue`
- [ ] Account not locked

## 📝 Jira-ready note
> Resolved [date/time]. Reset password for `[UPN]` ([synced via on-prem AD / cloud-only]). Temp password issued with force-change at next logon; active sessions revoked. User confirmed sign-in + password change. Time spent: [X] min.
