---
description: Reset a Google Workspace user's password from the Admin console with a forced change at next sign-in — after deciding whether the Okta password is the one that matters (Okta SSO) — with an optional, separately gated sign-in-cookie reset. Placeholders only.
disable-model-invocation: true
---

# /gws-password-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the user's Google address) · `[UPN]` (their Okta username) · `[TEMP_PASSWORD]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- A password reset is a credential change on one account (R1); the sign-in-cookie reset ends every session that account holds (R1, its own gate). Each has its own exact phrase; "yes" is never a confirmation.
- Verify the requester before Phase B: a reset asked for over chat or phone is the classic social-engineering move — use the agreed identity check **[org gap — confirm the identity-verification rule]**.
- The temporary password never goes into the ticket or into a reply the requester could have forged.

## Inputs needed

- `[USER@DOMAIN.COM]`.
- The sign-in path: does `[@Aegion]` sign users in to Google through Okta SSO, and is Okta password push enabled — **[org gap — confirm before Phase A]**.
- How the new password reaches the user (chat, phone, or email to an address they can still read).

## Which password is it?

- **Okta SSO in front of Google:** the password the user types at sign-in is the **Okta** password. Resetting it is the Okta user-lifecycle procedure, not this runbook — Google's own reset page sends SSO customers elsewhere for exactly this reason.
- **Okta password push:** with *Push Password Updates* on, Okta synchronizes the password the user enters to sign in to Okta down to Google Workspace. A Google-side reset is then only a stop-gap for direct sign-in — a super admin (who can bypass SSO and sign in to admin.google.com directly) or users let in by a network mask — and is pushed over again when the user signs in to Okta.
- **No SSO (the Google password is used directly):** this runbook is the fix.

## Fast path

1. Phase A — verify the requester and read the account (R0).
2. Phase B — reset the password with *Ask the user to change their password* (R1 gate).
3. Phase C — optional: reset the sign-in cookies (R1 gate) when the old password may still be live on a lost device or in a suspect's browser.
4. **WAIT UNTIL** the user signs in and sets their own password; verify.

## Phase A — Identity and account state (R0)

**Purpose** — reset the right account, and only after the requester is verified.

- Verify the requester through the agreed channel; "cannot get into Gmail" is a symptom the real user and an attacker describe the same way.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status (Active, not Suspended) — a suspended account needs the suspension lifted, not a password.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → read whether 2-Step Verification is on; a user who also lost their second step needs `/gws-2sv-reset` after the password, not instead of it.

```bash
# read-only: account status, OU, suspension flag and 2SV flags before any change
gam info user "[USER@DOMAIN.COM]"   # prints status, OU, suspension and 2SV enrollment/enforcement flags
```

**Verification checkpoint** — [ ] requester verified · [ ] account Active · [ ] sign-in path (Okta SSO or direct) recorded in the ticket.

## Phase B — Reset the password (R1 gate)

**Purpose** — issue a temporary password the user must replace at their next sign-in.

<!-- SAFETY GATE [gws-password-reset-password-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** reset the user's Google Workspace password to a temporary value; the user must change it at the next sign-in
- **Scope:** one account's Google password; nothing else on the account changes, and under Okta SSO the Okta password is untouched
- **Reversibility:** R1 — the old password cannot be restored; the undo is another reset under a fresh phrase, and the user replaces the temporary password at next sign-in anyway
- **Required confirmation:** Type exactly `RESET GOOGLE PASSWORD FOR [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-password-reset-password-portal]:** Only after Phase A and the exact match:
1. Admin console → Directory → Users → point to `[USER@DOMAIN.COM]` → **Reset password**.
2. In the Reset password box pick **Automatically generate a password** (or **Create password** to type `[TEMP_PASSWORD]` for a phone handover), tick **Ask the user to change their password**, then click **Reset**.
3. Pass it on: **Copy Password** for a chat or phone handover, or **Email Password** to an address the user can still read (that mail also carries a reset link), then **Done**.

**Gotcha** — the Security-page route does the same job: open the user's account page → **Security** → **Password** → **Reset Password**, with *Ask for a password change at the next sign-in* set to On. The Security page also offers *Require password change* (Turn on), which forces a change at the next sign-in without issuing a new password and resets itself to Off afterwards — but under third-party IdP SSO that setting is not available unless a network mask lets some users sign in directly.

**WAIT UNTIL** the user has signed in with the temporary password and set a new one. Done when: the user reaches Gmail on their own device.

**Verification checkpoint** — [ ] temporary password handed over out of band · [ ] the user confirms the new password works.

## Phase C — Optional: reset the sign-in cookies (R1 gate)

**Purpose** — end every existing session when the old password may still be live on a lost device or in a suspect's browser.

<!-- SAFETY GATE [gws-password-reset-cookies-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** reset the user's sign-in cookies; the user is signed out of their Google Account on every device and browser
- **Scope:** one account's Google sessions; Gmail can take up to an hour to sign out, other applications vary
- **Reversibility:** R1 — nothing is deleted; the user signs back in with the new password. Under Okta SSO the Okta session can sign them straight back in, so end the Okta session first (Okta user-lifecycle procedure)
- **Required confirmation:** Type exactly `RESET SIGN-IN COOKIES FOR [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-password-reset-cookies-portal]:** Only after the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Security** → **Sign-in cookies** → **Reset**.
2. Click **Done**.

**Gotcha** — not needed after a suspension: suspending a user already resets their sign-in cookies.

**Verification checkpoint** — [ ] the user is prompted to sign in again on their devices (allow up to an hour for Gmail).

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal; Aegis never does
# SAFETY GATE [gws-password-reset-password]
# Target: [USER@DOMAIN.COM]
# Effect: reset the user's Google Workspace password to a random value that must be changed at the next sign-in
# Scope: one account's password; the user is signed out immediately when changepassword is set
# Reversibility: R1 — the old password cannot be restored; another reset under a fresh phrase is the only undo
# Required confirmation: type exactly `RESET GOOGLE PASSWORD FOR [USER@DOMAIN.COM]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="RESET GOOGLE PASSWORD FOR [USER@DOMAIN.COM]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam update user "[USER@DOMAIN.COM]" password random changepassword true logpassword -   # sets a random password, forces a change at next sign-in, prints the password once
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info user "[USER@DOMAIN.COM]"   # read-back: the change-password-at-next-login flag is now set
```

```bash
# HUMAN-RUN — optional; only when existing sessions must end now
# SAFETY GATE [gws-password-reset-cookies]
# Target: [USER@DOMAIN.COM]
# Effect: reset the user's sign-in cookies; every web and device session is signed out
# Scope: one account's Google sessions
# Reversibility: R1 — nothing is deleted; the user signs in again
# Required confirmation: type exactly `RESET SIGN-IN COOKIES FOR [USER@DOMAIN.COM]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="RESET SIGN-IN COOKIES FOR [USER@DOMAIN.COM]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam user "[USER@DOMAIN.COM]" signout   # signs the user out of all web and device sessions and resets their sign-in cookies
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info user "[USER@DOMAIN.COM]"   # read-back: the account is still Active; the sign-out shows as a fresh sign-in prompt on the user's devices
```
</details>

## ⚠️ Risk warning

- **Social engineering is the threat model of this ticket.** A reset without an identity check hands the account to whoever asked.
- **Under Okta SSO the Google password is not what the user types.** Reset the Okta password in the Okta procedure; resetting here changes nothing for the SSO sign-in, and with password push on it is overwritten when the user signs in to Okta.
- **Cookie reset under SSO:** the Okta session may still let the user (or the attacker) straight back in — end the Okta session first.
- **The temporary password never goes into Jira.** Hand it over out of band; the user must change it at next sign-in.
- Suspected compromise (sign-ins from elsewhere, forwarding rules, app passwords) is a security-alert ticket, not a plain reset — the reset is step one of that triage, not its end.

## ✅ Verification checklist

- [ ] `gam info user "[USER@DOMAIN.COM]"` shows the account Active with the change-password-at-next-login flag set (cleared again once the user has changed it).
- [ ] The user signed in with the temporary password, set a new one, and reaches Gmail on their device.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the password-reset event (and the sign-in-cookie reset, if used) with the expected admin and time.
- [ ] Okta SSO path: the Okta reset was done in `/okta-user-lifecycle` and this runbook's Phase B was skipped — recorded in the ticket.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Resolved [date/time]. `[USER@DOMAIN.COM]` could not sign in to Gmail. Requester verified via [channel]. Sign-in path: [Okta SSO — password reset in Okta / direct — Google password reset in the Admin console with "Ask the user to change their password"]. Temporary password handed over out of band; user signed in and set a new password [timestamp]. Sign-in cookies [reset / not needed]. Admin log events confirm the change. Time spent: [X] min.

## Aha moment

"Reset the password" is two different tickets in a federated shop: the Okta password is what the user types, the Google password is what Google stores — and with password push, Okta writes the second one for you.

## Career upgrade

Tracing which credential actually authenticates a session (IdP password, pushed password, local password) is the same reasoning that separates a junior reset from a senior access review.

## Next action

Run Phase A: verify the requester and record whether `[USER@DOMAIN.COM]` signs in through Okta SSO or directly.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/users/reset-a-users-password · knowledge.workspace.google.com/admin/security/manage-a-users-security-settings · knowledge.workspace.google.com/admin/users/suspend-a-user-temporarily · knowledge.workspace.google.com/admin/reports/admin-log-events · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users and Users-Signout-Turnoff2SV pages; GAM is an open-source tool, not a Google product).
