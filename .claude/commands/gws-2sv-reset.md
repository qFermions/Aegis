---
description: Get a locked-out user back through Google 2-Step Verification — backup codes first (routine), then a lost security key or passkey, the 10-minute login-challenge bypass, and only as a last resort turning 2SV off for one user (a security-control change). Google 2SV and Okta MFA are separate controls. Placeholders only.
disable-model-invocation: true
---

# /gws-2sv-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the user's Google address) · `[UPN]` (their Okta username) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Backup codes are the fix; turning 2SV off is not.** Google's own guidance for a locked-out user is a backup code. Turning 2SV off for one user removes a security control (R3): it is possible only when 2SV is not enforced org-wide, not on a suspended account, and only under the Phase E gate with the pre-state recorded.
- **Google 2SV and Okta MFA are separate controls.** A user who "lost their phone" may be locked out of Okta Verify, of Google 2SV, or both — read Phase A before touching either. Okta authenticators are reset in the Okta MFA-reset procedure, not here.
- Verify the requester first — a "lost my phone, need codes" request is a textbook account-takeover attempt — using the agreed identity check **[org gap — confirm the identity-verification rule]**. Backup codes, like passwords, never go into the ticket.
- Every state change below has its own exact phrase; "yes" is never a confirmation.
- **A lost or replaced phone or key follows one order** (answer-format section 2, "A new way in before the old way out"): identity first, then a backup code handed over on a verified channel, then the user registers the new second step, and only then is the old one removed. The section "Lost or replaced phone or key" below fixes that order. Phase E is not that path: it takes the old way out before a new way in exists.

## Inputs needed

- `[USER@DOMAIN.COM]`; whether the user signs in to Google through Okta SSO — **[org gap — confirm the sign-in path]**.
- What exactly stopped working: the phone (Google prompt / Authenticator app / text), a security key, a passkey, or a login challenge they cannot answer.
- Whether 2SV is enforced for `[@Aegion]` (read in Phase A — it decides whether Phase E is even available).

## Two controls, two consoles

- **Google 2-Step Verification** protects the Google Account itself. Only the user can turn it on; an admin can check it, hand out a backup code, add or remove security keys, remove passkeys, and (not recommended) turn it off for a locked-out user.
- **Okta MFA** protects the Okta sign-in that fronts Google under SSO. Its authenticators (Okta Verify, keys, and the rest) are reset in the Okta Admin Console under the person's More Actions, Reset Authenticators — the Okta MFA-reset procedure, which cannot be undone.
- **Separate factors inside Google:** backup codes, security keys and passkeys are enrolled and managed separately. The *Only security key* enforcement option accepts passkeys as well as security keys.
- Which prompt the user actually meets depends on `[@Aegion]`'s sign-in path (Okta SSO or direct) — **[org gap — confirm it]**; do not reset both controls on a guess.
- **Context-Aware Access is neither 2SV nor Microsoft Conditional Access.** It is Google's app-access policy built on context — identity, location, device state, IP — and it lives at Admin console → Security → Access and data control → Context-Aware Access. A user it blocks gets an app-access denial after signing in, not a 2SV prompt; nothing in this runbook touches it, and changing it is a separate security-control change.

## Fast path

1. Phase A — read the user's 2SV state, enforcement, and enrolled keys (R0); verify the requester.
2. Phase B — backup codes: copy an existing code (R0) or generate a new set (R1 gate). This resolves the routine case.
3. Phase C — a lost security key or passkey: record it, then remove it (R2 gate).
4. Phase D — a login challenge the user cannot answer: 10-minute bypass (R1 gate, self-expiring).
5. Phase E — last resort only: turn 2SV off for this one user (R3 gate, pre-state first).
6. **WAIT UNTIL** the user is back in and has re-enrolled a second step; verify.

A lost or replaced phone or key runs these phases in the order the next section sets: Phase A, Phase B, the user's new second step, then the removal of the old one.

## Lost or replaced phone or key: a new way in before the old way out

**Purpose:** the order for a person who lost or replaced the device that holds their second step (answer-format section 2, "A new way in before the old way out"). Phases A to C hold the steps and the gates; this section fixes their order and names what each step must show.

1. **Prove who is asking (Phase A).** Use the identity check the org names: **[org gap: confirm the identity-verification rule]**. Until that rule is written down, the check this step names is a call the tech places to the phone number on file for the person, or the person's manager confirming on a call the tech places or in person. A number or address taken from the request proves nothing.
2. **Give a way in that runs out (Phase B).** A backup verification code works once: one the person saved, or one an admin reads for them (User management privilege; for another admin's account, a super admin). A new set is generated only under the Phase B gate [gws-2sv-reset-backup-codes-portal].
3. **Hand the code over on a verified channel.** Say it on a call the tech places to the number on file, hand it over in person, or give it to the manager to pass on in person. Google's own page says to send the code "in an IM or text message"; that is not enough on a lost-device ticket, because a chat account or a phone number named in the request may be the attacker's. Write the channel in the ticket, never the code.
4. **The person registers the new second step.** **WAIT UNTIL** they have signed in with the code and put the new phone, key or passkey on their own account (their Google Account, Security, 2-Step Verification). No gate: it is the user's own action. Proof a person can see: the user's Security card in the Admin console still reads 2-step verification on, a new key or passkey shows in the Passkeys & security keys table with today's date, and for a phone the person reads the second steps on their own 2-Step Verification page aloud and the new phone is among them.
5. **Only then take the old one out.** A lost security key or passkey: the Phase C gate [gws-2sv-reset-key-remove-portal], after step 4 and never before it. A lost phone: no admin control takes one phone off a user's account, so there is no gate; the person signs the lost phone out under Your devices in their Google Account and takes its number or prompt off their 2-Step Verification page. Google's help for a lost phone says to sign out of the lost phone and change the password: the password change and the sign-out of every session are `/gws-password-reset` (Phases B and C there).
6. **Read back both halves.** New one present: the step 4 proof. Old one gone: the Phase C read-back (the key table no longer lists the lost key), or for a phone the person reads their 2-Step Verification page and their device list aloud and the lost phone is on neither. The ticket is not done on one half.

**Not this path: Phase E.** Turning 2SV off for the user, and GAM `turnoff2sv`, which strips every registered second step, take the old way out before a new way in exists: the account is left on a password alone. Phase E is the right tool only when Phases B to D cannot get a verified person in and 2SV is not enforced, under its own R3 gate.

## Phase A — Read first (R0)

**Purpose** — know which control failed and what the policy allows before changing anything.

- Verify the requester through the agreed channel.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **2-step verification** → read whether 2SV is on for the user and whether it is enforced across the organization.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **Passkeys & security keys** → read the enrolled keys (name, platform, when added and last used).
- Okta Admin Console → Directory → People → `[UPN]` → read the status and enrolled authenticators, so an Okta lockout is not mistaken for a Google one.

```bash
# read-only: the user's 2SV enrollment and enforcement flags, status and OU
gam info user "[USER@DOMAIN.COM]"   # includes the Is Enrolled In 2Sv / Is Enforced In 2Sv flags
# read-only: how many backup codes the user has right now (no codes are shown)
gam user "[USER@DOMAIN.COM]" print backupcodes countsonly   # count only; a suspended user returns an error
```

**Verification checkpoint** — [ ] requester verified · [ ] 2SV on / enforced state recorded · [ ] the failing factor (phone, key, passkey, challenge) named in the ticket.

## Phase B — Backup codes (the routine fix)

**Purpose** — let the user sign in with their password plus a one-time code while they keep 2SV on.

**Read (R0):** Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **2-step verification** → **Get Backup Verification Codes** → read the existing codes; if the set is intact and not suspected stolen, copy one unused code and hand it over on the verified channel named below. Nothing changes. Requires the User management privilege; only a super admin can do this for another admin.

**Verified channel (every code this phase hands out):** a call the tech places to the phone number on file for the user, in person, or through the user's manager in person. Never a reply to the message that asked, and never a chat account or phone number the request supplied. Google's page suggests an IM or text message; on a lost-device ticket that channel is only as good as the proof of who holds it, so the step names the channel and the ticket records it (answer-format section 2, "A new way in before the old way out").

**User check:** ask the user to sign in with a backup code they saved when they turned on 2-Step Verification, or with another second step they enrolled earlier: a saved backup code covers a lost phone, and nothing changes on the account. The Read (R0) above is the next lighter step; new codes come only when the set is used up or suspected stolen.

<!-- SAFETY GATE [gws-2sv-reset-backup-codes-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** replace the user's backup verification codes with a new set; every code from the previous set stops working
- **Scope:** one user's backup codes; the 2SV setting and the enrolled keys are untouched
- **Reversibility:** R1 — the old set cannot be brought back, but generating again under a fresh phrase issues another set; the user stays protected by 2SV throughout
- **Required confirmation:** Type exactly `REPLACE BACKUP CODES FOR [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-2sv-reset-backup-codes-portal]:** Only when the existing codes are used up or suspected stolen, and after the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **2-step verification** → **Get Backup Verification Codes**.
2. Click **Generate new codes**; the previous set becomes inactive at once.
3. Copy one code and hand it to the user on the verified channel named above (a call the tech places to the number on file, in person, or through the manager); they sign in with their password and that code.

No connector read proves new codes exist (the Read-back field above is the R1 form). Proof a person can see: the Get Backup Verification Codes dialog lists the new set, and Admin log events shows the backup-code change with your address and the time.

**Gotcha** — a user who is required to use a security key cannot generate their own backup codes: an administrator must, and a grace period for using the code starts when it is generated. A suspended user cannot receive codes at all.

**WAIT UNTIL** the user has signed in with the code and re-enrolled a second step on a device they hold.

**Verification checkpoint** — [ ] the user is in · [ ] a new second step is enrolled · [ ] the handed-out code is not in the ticket.

## Phase C — A lost security key or passkey (R2 gate)

**Purpose** — revoke a factor that is physically gone, so nobody who finds it can use it.

**Pre-state (R0, record it):** the key table from Phase A — name, platform, when it was added and last used. Remove a security key only when it is lost; a key that is merely left at home gets a backup code (Phase B) instead.

**Try first:** when the key may only be left at home, not lost, Phase B's backup code gets the user in and nothing is removed.

**Order on a lost or replaced key:** the removal below comes after the user has signed in with a Phase B code and registered the replacement, never before it (answer-format section 2, "A new way in before the old way out"). Write in the ticket the name and the added date of the new key or passkey the table shows, then remove the lost one.

<!-- SAFETY GATE [gws-2sv-reset-key-remove-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** remove one lost security key or passkey from the user's account
- **Scope:** one key or passkey; the other enrolled factors and the 2SV setting stay
- **Reversibility:** R2 — not reversible from the console: the key itself is gone, and a replacement has to be enrolled again (the user adds a passkey or key, or an admin adds a 2SV-only security key with the key in hand); the recorded table is the record of what was removed
- **Required confirmation:** Type exactly `REMOVE SECURITY KEY OR PASSKEY FROM [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no verify-* command reads security keys or passkeys: its proof is the read its step names)
**PORTAL ACTION [gws-2sv-reset-key-remove-portal]:** Only after the pre-state is recorded and the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **Passkeys & security keys** → read the key table.
2. Scroll the table all the way to the right, hover over the lost key's row and click **Remove**.
3. Click **Remove** to confirm, then **Done**. Admin log events adds an entry each time a passkey or security key is revoked.

**Gotcha** — an automatically created Android passkey is removed under **Connected applications** on the same Security page, not in the key table; and to stop another one being created, reset the password and the sign-in cookies (`/gws-password-reset`).

**Verification checkpoint:** [ ] the key table lists the replacement key or passkey (new one present) · [ ] the key table no longer lists the lost key (old one gone) · [ ] the user can still sign in with another factor or a Phase B code.

## Phase D — A login challenge the user cannot answer (R1 gate, self-expiring)

**Purpose** — let a verified user through a login or verify-it's-you challenge they cannot complete, without changing any setting permanently.

**User check:** ask the user to try once more from the computer or phone they normally use for this account, on their usual network, before the challenge is turned off.

<!-- SAFETY GATE [gws-2sv-reset-challenge-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** disable the login or verify-it's-you challenge for one user for 10 minutes; it comes back on by itself
- **Scope:** one user, ten minutes; 2SV, keys and passwords are untouched
- **Reversibility:** R1 — it expires on its own after 10 minutes; nothing to undo
- **Required confirmation:** Type exactly `DISABLE LOGIN CHALLENGE FOR [USER@DOMAIN.COM] FOR 10 MINUTES`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-2sv-reset-challenge-portal]:** Only after the requester is verified and the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **Login challenge** → **Turn Off For 10 Minutes**.
2. Tell the user to sign in now; the window closes after 10 minutes.

**Verification checkpoint** — [ ] the user signed in inside the window · [ ] the challenge is back (no further action needed).

## Phase E — Last resort: turn 2SV off for one user (R3, security control)

**Purpose** — only when Phases B–D cannot get a verified user in, and policy allows it. Google does not recommend this; the backup code is the documented answer.

**Not the lost-or-replaced-device path:** this phase takes the old way out before a new way in exists (the account signs in on a password alone until the user turns 2SV back on), so a lost or replaced phone or key goes through the section "Lost or replaced phone or key" above, not here. It is the right tool only for a verified person whom a backup code, a key removal and the ten-minute challenge window all failed to get in, where 2SV is not enforced.

**Pre-state (R0, record it before the gate):** 2SV on, enforcement state, the enrolled methods and keys from Phase A, the justification, and the date the user will re-enroll. The option is disabled when 2SV is enforced across the organization or the account is suspended — in both cases this phase is not available and Phase B is the only path.

**Try first:** Phases B to D above (a backup code, the removal of a lost key, the ten-minute challenge window); this phase runs only when all of them failed for a verified user.

<!-- SAFETY GATE [gws-2sv-reset-turn-off-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** disable 2-Step Verification for one user; the account then signs in with the password alone until the user turns 2SV back on
- **Scope:** one user; the organization's enforcement setting is not touched (and if it is on, this control is greyed out)
- **Reversibility:** R3 — security-control change; an admin cannot turn 2SV back on, only the user can, so the rollback is the user re-enrolling at the recorded date with the pre-state as the reference for which methods to restore
- **Required confirmation:** Type exactly `DISABLE 2-STEP VERIFICATION FOR [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no verify-* command reads 2-Step Verification enrollment, the 2SV read-backs read enforcement: its proof is the read its step names)
**PORTAL ACTION [gws-2sv-reset-turn-off-portal]:** Only after Phases B–D are exhausted, the pre-state and justification are in the ticket, and the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **2-step verification** → read that 2SV shows on and not enforced.
2. Use the card's turn-off control for this user [control label unverified: the official page confirms the option exists on this card but does not print its label]; it is unavailable when 2SV is enforced org-wide or the account is suspended.
3. Read the card back: 2SV shows off for the user. Record the time in the ticket.

**WAIT UNTIL** the user has signed in and turned 2SV back on from their own account settings (only the user can turn it on); read the card again.

**Verification checkpoint** — [ ] pre-state and justification recorded · [ ] re-enrollment date set · [ ] 2SV reads on again after re-enrollment.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal — Aegis never does
# SAFETY GATE [gws-2sv-reset-backup-codes]
# Target: [USER@DOMAIN.COM]
# Effect: replace the user’s backup verification codes with a new set — the previous set stops working
# Scope: one user’s backup codes — 2SV and the enrolled keys are untouched
# Reversibility: R1 — the old set cannot be restored — another run under a fresh phrase issues another set
# Required confirmation: type exactly "REPLACE BACKUP CODES FOR [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
# the exact phrase to type
required_confirmation="REPLACE BACKUP CODES FOR [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # generates a new set of backup codes — the old set is invalidated — fails for a suspended user
  gam user "[USER@DOMAIN.COM]" update backupcodes
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the new set — hand ONE code to the user out of band, never in the ticket
gam user "[USER@DOMAIN.COM]" show backupcodes
```

```bash
# HUMAN-RUN — last resort only — the pre-state and justification must already be in the ticket
# SAFETY GATE [gws-2sv-reset-turn-off]
# Target: [USER@DOMAIN.COM]
# Effect: disable 2-Step Verification for one user — every registered second step is removed with it
# Scope: one user — the call fails if the user is suspended, not enrolled, enforced, or in the Advanced Protection Program
# Reversibility: R3 — only the user can turn 2SV back on — the recorded pre-state is the reference for re-enrollment
# Required confirmation: type exactly "DISABLE 2-STEP VERIFICATION FOR [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no verify-* command reads 2-Step Verification enrollment, the 2SV read-backs read enforcement: its proof is the read its step names
# the exact phrase to type
required_confirmation="DISABLE 2-STEP VERIFICATION FOR [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # turns 2SV off for the user and removes all registered second steps — Directory API behavior
  gam user "[USER@DOMAIN.COM]" turnoff2sv
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: Is Enrolled In 2Sv now reads False
gam info user "[USER@DOMAIN.COM]"
```
</details>

## ⚠️ Risk warning

- **Turning 2SV off is a security-control change (R3)** and Google's own page says it is not recommended: it leaves the account on a password alone, only the user can turn it back on, and the GAM/API route also removes every registered second step. Backup codes solve the routine lockout without any of that.
- **Account takeover looks exactly like this ticket.** "Lost my phone, need a code" is how attackers ask; verify identity before any phase, and never put a code, key name or password in the ticket.
- **Two controls:** resetting Okta authenticators does nothing for Google 2SV and the reverse; resetting both on a guess doubles the blast radius. The Okta reset cannot be undone.
- **Removing a key is not reversible** — the replacement must be enrolled again with a key in hand. Remove only a key that is truly lost.
- The 10-minute bypass is small but real: use it only for a verified user, and never to get around an enforced second step.

## ✅ Verification checklist

- [ ] `gam info user "[USER@DOMAIN.COM]"` shows the expected 2SV flags — unchanged after Phases B–D; Is Enrolled In 2Sv False only after the Phase E gate, and True again once the user re-enrolled.
- [ ] Backup codes: `gam user "[USER@DOMAIN.COM]" print backupcodes countsonly` shows the new set's count; the user signed in with password plus one code and re-enrolled a second step.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the backup-code, key-revocation, login-challenge or 2SV change event with the expected admin and time.
- [ ] Phase C: Directory → Users → the user → Security → Passkeys & security keys no longer lists the lost key.
- [ ] Lost or replaced phone or key: the ticket names the identity check and the verified channel the code went over (never the code); the new second step was registered before the old one was removed; both halves were read back, the new one present and the old one gone.
- [ ] Phase E only: the pre-state, justification and re-enrollment date are in the ticket, and the user's 2SV reads on again by that date.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Resolved [date/time]. `[USER@DOMAIN.COM]` was locked out of Google 2-Step Verification ([lost phone / lost security key or passkey / login challenge]). Requester verified via [channel]. [Lost or replaced device: code handed over by [a call placed to the number on file / in person / the manager]; new second step registered [timestamp], then the old one removed; both read back.] Action: [existing backup code handed out / new backup codes generated under the exact phrase / lost key removed, pre-state recorded / 10-minute login-challenge bypass / 2SV turned off for the user under the R3 gate — pre-state and justification recorded, re-enrollment due [date]]. Okta MFA [not involved / reset separately in the Okta procedure]. User signed in and re-enrolled a second step [timestamp]; Admin log events confirm the change. Time spent: [X] min.

## Aha moment

Google 2SV and Okta MFA are two locks on two different doors, and a backup code is the spare key: it opens the Google door without taking the lock off — which is why "turn 2SV off" is the last phase, not the first.

## Career upgrade

Choosing the least-privileged recovery path (code → factor removal → time-boxed bypass → control change) is the exact reasoning security engineers apply to every break-glass procedure.

## Next action

Run Phase A: verify the requester and record the user's 2SV state, enforcement, and which factor actually failed.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/security/manage-a-users-security-settings · knowledge.workspace.google.com/admin/security/recover-an-account-protected-by-2-step-verification · knowledge.workspace.google.com/admin/security/deploy-2-step-verification · knowledge.workspace.google.com/admin/security/temporarily-turn-off-login-challenges-for-a-user · knowledge.workspace.google.com/admin/reports/admin-log-events · help.okta.com/oie/en-us/content/topics/security/mfa/mfa-reset-users.htm · knowledge.workspace.google.com/admin/security/about-context-aware-access · knowledge.workspace.google.com/admin/security/deploy-context-aware-access · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users-Backup-Verification-Codes, Users-Signout-Turnoff2SV and Users pages; GAM is an open-source tool, not a Google product).

**Sources (checked 2026-11-13, vendor facts GB-01 to GB-03 in `docs/aegis/batch11/vendor-facts-google-okta-jamf.md`):** knowledge.workspace.google.com/admin/security/recover-an-account-protected-by-2-step-verification (the backup code steps, the privilege, Google's "IM or text message" sentence) · support.google.com/accounts/answer/185834 (a lost or stolen phone: sign out of it and change the password).
