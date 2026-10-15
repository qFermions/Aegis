---
description: Okta user lifecycle for one user — states, and gated suspend, unsuspend, deactivate (R3), delete (R3), activate, password reset (R1) and clear sessions; what Okta deprovisioning does to the Google account. Offboarding starts here, Okta first. Placeholders only.
disable-model-invocation: true
---

# /okta-user-lifecycle

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[UPN]` (the user's Okta username) · `[USER_ID]` (their Okta user ID) · `[USER@DOMAIN.COM]` (their Google account) · `[TEMP_PASSWORD]` (a temporary password handed over out of band) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Deactivate and delete are R3.** Deactivation removes every app assignment, deprovisions apps with deprovisioning enabled (which can destroy app data such as email or files) and permanently deletes the password; deletion is permanent and needs a deactivated user first. An offboarding that spans Okta, Google and devices is a destructive multi-system plan — route it through an independent, out-of-session review before Phase F runs.
- **Suspend is the reversible containment.** It keeps app and group assignments and is undone by unsuspend. Reach for it when the ticket says "while HR reviews" or "on leave".
- Every state change below has its own exact-phrase gate. A phrase never carries into a later phase; "yes" is never a confirmation.
- Not done until every read-back in the final checklist passes.

## Inputs needed

- `[UPN]` and `[USER_ID]`; `[USER@DOMAIN.COM]` when the Google side matters.
- The intended end state: Suspended (temporary), Deactivated (leaver), Deleted (after retention), or Active again.
- Whether the user is Okta-sourced or AD-sourced (delegated authentication changes what a password reset does).
- The Google Workspace integration's deactivation options — **[org gap — read them in Phase A before Phase F]**.
- Whether the user holds a Google super admin role (super admins bypass Okta SSO).

## Okta user states (API status and Admin Console label)

| API status | Admin Console label | What it means |
|---|---|---|
| STAGED | Staged | created, activation not started or an admin action is pending |
| PROVISIONED | Pending user action | activated, but the user has not clicked the activation email or set a password |
| ACTIVE | Active | normal |
| RECOVERY | Password reset | an admin requested a password reset; the user cannot sign in until they finish it |
| PASSWORD_EXPIRED | Password expired | the user must change the password before apps open |
| LOCKED_OUT | Locked out | too many failed sign-ins under the sign-on policy |
| SUSPENDED | Suspended | an admin suspended the user; no app, Admin Console or dashboard access; app assignments unaffected |
| DEPROVISIONED | Deactivated | an admin deactivated the user; all app assignments removed, password permanently deleted |

## What each action does

| Action | What happens | What is kept | Undo |
|---|---|---|---|
| Suspend (Phase D) | sign-in stops; every active Okta session ends | app and group assignments (reinstated on unsuspend); the profile stays editable | unsuspend (Phase E) |
| Unsuspend (Phase E) | the user returns to Active with their memberships | everything | suspend again |
| Deactivate (Phase F) | sessions end; every app assignment is removed; apps with deprovisioning enabled are deprovisioned; admin roles are revoked; the password is permanently deleted | group memberships; enrolled authenticators | activate (Phase G) — apps may need re-assigning and the user sets a new password |
| Delete (Phase H) | permanent; only on a deactivated user; removes factors, group memberships, linked objects and the Universal Directory record; the username can be reused; customer data purged in 30 days | nothing | none |
| Reset password (Phase B) | an emailed link valid one hour, or a temporary password; the API moves the user to RECOVERY until they finish | everything else | a new reset |
| Clear user sessions (Phase C) | every Okta identity-provider session ends; optionally tokens for logout-enabled apps and Okta API tokens; sessions already created inside web or native apps are not cleared | everything | none needed — the user signs in again |

Activate and reactivate are two different API calls: **activate** works on STAGED or DEPROVISIONED users; **reactivate** only on PROVISIONED or RECOVERY users and restarts an unfinished activation. In the Admin Console, **Activate** moves Staged, Suspended or Deactivated users to Active and emails the user.

## What Okta deprovisioning does to the Google account

- With **no deactivation options** selected on the Google Workspace integration, deactivating the Okta user **suspends the Google account**.
- The options change that: **Do not suspend user** keeps the Google account active (you then suspend it yourself in Google), **Remove all G Suite licenses** and **Remove all G Suite Roles** strip licences or roles. Okta recommends enabling user deactivation/reactivation so Google users are deactivated when they are deactivated in Okta or AD. The options sit under **Deactivation** on the integration's Edit User Assignment (or Edit Group Assignment) page. Which options `[@Aegion]` has selected is an **[org gap — read them in Phase A]**.
- **A Google super admin bypasses Okta SSO** and can sign in directly to the Google Admin console — check admin roles before trusting the Okta deactivation alone.
- Offboarding starts here (Okta first). The Google side — contain, transfer Drive and Calendar, suspend or delete — is `/gws-offboard`.

## Fast path

1. Phase A — read status, apps, and the Google integration's deactivation options (R0).
2. Phase B — password reset (R1 gate), including the "reset email never arrives" checks.
3. Phase C — clear user sessions (gate) when a sign-out everywhere is needed.
4. Phase D / E — suspend (R1 gate) and unsuspend (gate).
5. Phase F — deactivate (R3 gate). **WAIT UNTIL** Google reflects the provisioning result.
6. Phase G — activate a deactivated user (gate) when someone returns.
7. Phase H — delete only after deactivation, the retention decision and the independent review (R3 gate).

## Phase A — Read first (R0)

**Purpose** — know the current state and the downstream effects before choosing a phase.

- Okta Admin Console → Directory → People → `[UPN]` → read **Status**, the primary and secondary email, and the **Applications** tab (which apps are assigned and which provision).
- Okta Admin Console → Applications and Resources → Applications → the Google Workspace integration → **Assignments** tab → the user's row → **Edit** → read the **Deactivation** options on the Edit User Assignment page, then leave the page without saving (Phase F depends on them).
- Okta Admin Console → Reports → System Log → search for `[UPN]` → read the recent lifecycle and sign-in events.
- Google side: Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status and whether the user holds an admin role.

**Verification checkpoint** — [ ] status recorded · [ ] app list recorded · [ ] Google deactivation options recorded · [ ] admin-role check recorded.

## Phase B — Reset the password (R1)

**Purpose** — give the user a way back in: an emailed reset link (valid one hour) or a temporary password.

**If the reset email never arrives (R0 checks first):**

- Okta Admin Console → Directory → People → `[UPN]` → read the **primary** and **secondary email** on the profile — Okta sends the link to both, and a wrong or missing address is the usual cause.
- Read **Status**: **Pending user action** or **Staged** accounts have no password to reset — they need activation (Phase G), not a reset; **Password reset** means a reset is already pending and the user cannot sign in until they finish it.
- Okta Admin Console → Reports → System Log → search for `[UPN]` → read whether the reset event was recorded at all.
- Fallback: pick **Create a temporary password** in the gate below and hand `[TEMP_PASSWORD]` over out of band, or use the Okta API reset with `sendEmail=false`, which returns the reset link for you to deliver out of band.

<!-- SAFETY GATE [okta-user-lifecycle-reset-password-portal] -->
- **Target:** [UPN]
- **Effect:** reset one user's Okta password; the current password stops working immediately and the user sets a new one from the emailed link or the temporary password
- **Scope:** one user; for an AD-sourced user under delegated authentication the original AD password does not expire, so the user can still sign in with it until AD is changed
- **Reversibility:** R1 — there is no undo as such; a new reset replaces it and the user sets the password they will use
- **Required confirmation:** Type exactly `RESET OKTA PASSWORD FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-reset-password-portal]:** Only after identity is verified out of band and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **Reset or Remove password**.
2. Pick **Send a password reset email** (the link goes to the primary and secondary email and expires in one hour) or **Create a temporary password** (the account is marked expired and the user must change it at sign-in); tick **Sign out user** to end their sessions on every device and browser; click **Reset password**.
3. Read back: the status reads **Password reset** until the user completes the flow, then **Active**.

**Gotcha** — an admin-initiated reset lets the user in with the link or temporary password without other factors; deliver a temporary password out of band, never in the channel the request came from.

## Phase C — Clear user sessions

**Purpose** — sign the user out everywhere (lost device, leave of absence, or as a triage step).

<!-- SAFETY GATE [okta-user-lifecycle-clear-sessions-portal] -->
- **Target:** [UPN]
- **Effect:** clear every active Okta session for one user; with the dialog option ticked, Okta also revokes tokens for logout-enabled apps and Okta API tokens
- **Scope:** Okta identity-provider sessions (and optionally those tokens); sessions already created inside web or native apps are not cleared
- **Reversibility:** not reversible and none needed — the user authenticates again on the next request
- **Required confirmation:** Type exactly `CLEAR OKTA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-clear-sessions-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Clear User Sessions**.
2. In the **Clear sessions and revoke tokens** dialog, tick **Also include logout enabled apps and Okta API tokens** when the tokens must go too, then click **Clear and revoke**.
3. Read back: Reports → System Log shows the session-end events for `[UPN]`.

**Gotcha** — suspending or deactivating a user already signs them out of all devices; a separate session clear is only needed while the user stays Active.

## Phase D — Suspend (R1, reversible containment)

**Purpose** — stop sign-in without touching assignments — leave of absence, contractor pause, or an HR review.

<!-- SAFETY GATE [okta-user-lifecycle-suspend-portal] -->
- **Target:** [UPN]
- **Effect:** suspend one Okta user; sign-in stops and every active Okta session ends
- **Scope:** one user; app and group assignments are kept and reinstated on unsuspend; the profile can still be updated
- **Reversibility:** R1 — undo is the Phase E unsuspend gate under its own phrase
- **Required confirmation:** Type exactly `SUSPEND OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-suspend-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Suspend**.
2. Confirm in the dialog, then read the status back as **Suspended**.

**Verification checkpoint** — [ ] status reads Suspended · [ ] the Applications tab still lists the apps.

## Phase E — Unsuspend

**Purpose** — bring a suspended user back with every membership intact.

<!-- SAFETY GATE [okta-user-lifecycle-unsuspend-portal] -->
- **Target:** [UPN]
- **Effect:** unsuspend one Okta user; app and group memberships are reinstated
- **Scope:** one suspended user
- **Reversibility:** R1 — suspend again under the Phase D phrase
- **Required confirmation:** Type exactly `REACTIVATE SUSPENDED OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-unsuspend-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People → **Suspended** (left menu) → `[UPN]` → **Activate**.
2. Read the status back as **Active**.

## Phase F — Deactivate (R3)

**Purpose** — the leaver action: cut the user off at the identity provider so every federated and provisioned app stops trusting them.

<!-- SAFETY GATE [okta-user-lifecycle-deactivate-portal] -->
- **Target:** [UPN] in Okta
- **Effect:** deactivate the Okta user; Okta deprovisions every assigned app that has deprovisioning enabled
- **Scope:** one Okta user and its app assignments; admin roles are revoked; group memberships and enrolled authenticators are kept; inactive, private, system and deprecated apps are not deprovisioned
- **Reversibility:** R3 — Okta Activate brings the account back, but app assignments may have to be re-assigned and the Okta password is permanently deleted; data an app destroys on deprovisioning (email, files) is not recovered by Okta
- **Required confirmation:** Type exactly `DEACTIVATE OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-deactivate-portal]:** Only after the Phase A read-backs, the independent review for a multi-system offboarding, and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Deactivate**.
2. Confirm in the **Deactivate Person** dialog, then read the status back as **Deactivated** (deactivation runs as a background task; admins receive an email listing users deactivated in the past 30 minutes).

**WAIT UNTIL** the Google side shows the provisioning result: Admin console → Directory → Users → `[USER@DOMAIN.COM]` → status. With no deactivation options selected the account is **Suspended**; with *Do not suspend user* it stays **Active** and the Google suspension is a separate gated step in `/gws-offboard`.

**Verification checkpoint** — [ ] Okta status reads Deactivated · [ ] the Applications tab is empty · [ ] the Google status is recorded in the ticket.

## Phase G — Activate a deactivated (or staged) user

**Purpose** — a returning user, or an activation that never completed.

<!-- SAFETY GATE [okta-user-lifecycle-activate-portal] -->
- **Target:** [UPN]
- **Effect:** activate one deactivated Okta user; the user receives an activation email with setup instructions
- **Scope:** one user; apps removed at deactivation are not restored automatically — re-assign them directly or through group memberships and rules
- **Reversibility:** R2 — deactivating again is the Phase F gate; the user has no password until they complete the activation email, so the account sits at Pending user action until then
- **Required confirmation:** Type exactly `ACTIVATE OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-activate-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People → filter the **Status** menu to **Deactivated** → `[UPN]` → **Activate** on the profile page.
2. Confirm in the **Activate Person** dialog, then read the status back as **Active** (or **Pending user action** until the user finishes the activation email).

**WAIT UNTIL** the user completes the activation email, then check the Applications tab and re-assign what the role needs (`/okta-app-assignment`).

## Phase H — Delete (R3, permanent, after deactivation and independent review)

**Purpose** — remove the record when retention allows. The user must already be Deactivated.

<!-- SAFETY GATE [okta-user-lifecycle-delete-portal] -->
- **Target:** [UPN]
- **Effect:** delete one deactivated Okta user permanently; Okta purges the customer data within 30 days
- **Scope:** one deactivated user; factors, group memberships, linked objects and the Universal Directory record go with it; a technical or billing contact cannot be deleted
- **Reversibility:** R3 — none; the deletion cannot be undone, and the username becomes reusable
- **Required confirmation:** Type exactly `DELETE OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-user-lifecycle-delete-portal]:** Only after the status reads Deactivated, the retention decision and the independent out-of-session review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → People → filter the **Status** menu to **Deactivated** → `[UPN]` → **Delete**.
2. Click **Delete** in the **Delete Person** dialog, then read back: `[UPN]` no longer appears on the People page.

<details>
<summary>Okta API — the scale version (HUMAN-RUN, for reference)</summary>

Export `OKTA_API_TOKEN` from the secret manager first (never paste a token into a ticket). Okta recommends OAuth 2.0 over SSWS tokens; an SSWS token inherits its creator's privileges and expires after 30 days unused. The lifecycle endpoints accept the user ID or the login in the path; `[USER_ID]` is used below.

```bash
# HUMAN-RUN — read-only: current status, app links and enrolled factors; nothing here changes anything
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # status: ACTIVE, SUSPENDED, RECOVERY, DEPROVISIONED, …
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/factors" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # enrolled factors (kept on deactivate, removed on delete)
```

```bash
# HUMAN-RUN — reset the password by API; the user sits in RECOVERY until they finish the reset flow
# SAFETY GATE [okta-user-lifecycle-reset-password]
# Target: [USER_ID]
# Effect: reset the user's Okta password; the user cannot sign in until they complete the reset flow
# Scope: one user; sendEmail=true emails the one-time link, sendEmail=false returns the link in the response for out-of-band delivery
# Reversibility: R1 — no undo as such; a new reset replaces it; for an AD-sourced user the original AD password does not expire
# Required confirmation: type exactly `RESET OKTA PASSWORD FOR [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="RESET OKTA PASSWORD FOR [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/reset_password?sendEmail=true" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # emails the one-time reset link; status becomes RECOVERY
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: status RECOVERY until the user finishes, then ACTIVE
```

```bash
# HUMAN-RUN — clear the user's Okta sessions
# SAFETY GATE [okta-user-lifecycle-clear-sessions]
# Target: [USER_ID]
# Effect: clear every active Okta identity-provider session for the user; sessions inside web or native apps are not cleared
# Scope: one user's Okta sessions
# Reversibility: not reversible and none needed; the user authenticates again
# Required confirmation: type exactly `CLEAR OKTA SESSIONS FOR [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="CLEAR OKTA SESSIONS FOR [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # revokes all active identity-provider sessions
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: the user is still ACTIVE; the System Log shows the session end
```

```bash
# HUMAN-RUN — suspend (only an ACTIVE user can be suspended)
# SAFETY GATE [okta-user-lifecycle-suspend]
# Target: [USER_ID]
# Effect: suspend one Okta user; group and app assignments are retained
# Scope: one ACTIVE user
# Reversibility: R1 — undo with the separate unsuspend gate below under its own phrase
# Required confirmation: type exactly `SUSPEND OKTA USER [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="SUSPEND OKTA USER [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/suspend" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # suspends the user
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: status SUSPENDED
```

```bash
# HUMAN-RUN — unsuspend (only a SUSPENDED user)
# SAFETY GATE [okta-user-lifecycle-unsuspend]
# Target: [USER_ID]
# Effect: unsuspend one Okta user; the user returns to ACTIVE with memberships intact
# Scope: one SUSPENDED user
# Reversibility: R1 — suspend again under the suspend phrase
# Required confirmation: type exactly `UNSUSPEND OKTA USER [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="UNSUSPEND OKTA USER [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/unsuspend" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # returns the user to ACTIVE
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: status ACTIVE
```

```bash
# HUMAN-RUN — deactivate (destructive; the API warns it cannot be recovered)
# SAFETY GATE [okta-user-lifecycle-deactivate]
# Target: [USER_ID] in Okta
# Effect: deactivate the Okta user; Okta deprovisions every assigned app that has deprovisioning enabled
# Scope: one Okta user and its app assignments; groups and factors are kept
# Reversibility: R3 — activation may need app assignments re-created; the Okta password is permanently deleted; app data destroyed by deprovisioning is not recovered
# Required confirmation: type exactly `DEACTIVATE OKTA USER [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="DEACTIVATE OKTA USER [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/deactivate" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # deactivates the user; transitioningToStatus DEPROVISIONED while it runs
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: status DEPROVISIONED
```

```bash
# HUMAN-RUN — activate a STAGED or DEPROVISIONED user (reactivate is a different call for PROVISIONED or RECOVERY users)
# SAFETY GATE [okta-user-lifecycle-activate]
# Target: [USER_ID]
# Effect: activate one STAGED or DEPROVISIONED Okta user; Okta emails the activation link
# Scope: one user; apps removed at deactivation are not restored by this call
# Reversibility: R2 — deactivate again under the deactivate phrase; the user has no password until they complete the activation link
# Required confirmation: type exactly `ACTIVATE OKTA USER [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="ACTIVATE OKTA USER [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/activate?sendEmail=true" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # starts activation and emails the link
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: transitioningToStatus ACTIVE, then ACTIVE (PROVISIONED until the link is used when no password exists)
```

```bash
# HUMAN-RUN — delete (permanent; only a DEPROVISIONED user; on a user not yet deactivated the first call deactivates and a second call deletes)
# SAFETY GATE [okta-user-lifecycle-delete]
# Target: [USER_ID]
# Effect: delete one DEPROVISIONED Okta user permanently; on a user who is not yet deactivated this call deactivates instead and a second call deletes
# Scope: one deactivated user and its factors, group memberships, linked objects and directory record
# Reversibility: R3 — none; the deletion cannot be undone
# Required confirmation: type exactly `DELETE OKTA USER [USER_ID]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="DELETE OKTA USER [USER_ID]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # deletes the deactivated user
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # read-back: 404 — the user is no longer returned
```
</details>

## ⚠️ Risk warning

- **Deactivate is destructive beyond Okta:** apps with deprovisioning enabled are deprovisioned, which can destroy app data such as email or files; with the Google integration at its defaults the Google account is suspended. Read the integration's deactivation options before the phrase, and run the Google data transfer in `/gws-offboard` before any Google deletion.
- **Delete has no undo and needs a deactivated user first.** The API's first DELETE on an active user deactivates; a second DELETE deletes. Customer data is purged within 30 days.
- **A Google super admin bypasses Okta SSO** — deactivating in Okta does not stop a super admin from signing in to the Google Admin console directly.
- **Password reset on an AD-sourced user does not expire the AD password** — the old password still works until AD is changed. An admin-initiated reset also lets the user in without other factors, so deliver temporary passwords out of band.
- **Clear User Sessions does not reach sessions already created inside web or native apps**; for a true sign-out everywhere combine it with the apps' own logout where Universal Logout is not configured.

## ✅ Verification checklist

- [ ] Okta Admin Console → Directory → People → `[UPN]` shows the intended status (Active / Password reset / Suspended / Deactivated, or absent after delete); API read-back `GET /api/v1/users/[USER_ID]` agrees (`ACTIVE`, `RECOVERY`, `SUSPENDED`, `DEPROVISIONED`, or 404).
- [ ] Okta Admin Console → Reports → System Log shows the lifecycle event for `[UPN]` with the expected admin and time.
- [ ] After a password reset: the user signed in with the new password and the status is back to Active.
- [ ] After a session clear, suspend or deactivate: the user reports being signed out on every device.
- [ ] After a deactivation: the Applications tab is empty, and the Google account shows the expected provisioning result (`gam info user "[USER@DOMAIN.COM]"` or Admin console → Directory → Users → status), recorded in the ticket.
- [ ] After a delete: `[UPN]` is absent from the People page and the ticket notes the 30-day customer-data purge.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Okta lifecycle change for `[UPN]`: [password reset by email link / temporary password handed over out of band · sessions cleared · suspended · unsuspended · deactivated · activated · deleted] at [timestamp], confirmed by the exact phrase. Status read back as [status] (API [status]). [Deactivation: Google account [suspended by Okta provisioning / left active per "Do not suspend user" — Google suspension tracked in `[JIRA-###]`]; app assignments removed; independent review recorded.] [Deletion: user absent from People; 30-day purge noted.] System Log shows the event. Time spent: [X] min.

## Aha moment

Suspend, deactivate and delete are three different promises: suspend keeps everything, deactivate cuts the apps and the password, delete erases the record — pick the weakest one that meets the ticket, because the stronger ones cannot be walked back.

## Career upgrade

Mapping lifecycle states to downstream provisioning effects is the core of IAM engineering — the same model drives SCIM, HR-driven provisioning and joiner/mover/leaver automation.

## Next action

Run Phase A and record the status, the app list and the Google integration's deactivation options before choosing a phase.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-end-user-states.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-suspend.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-deactivate-user-account.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-activate-user-account.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-reset-individual.htm · help.okta.com/oie/en-us/content/topics/oda/device-logout.htm · help.okta.com/oie/en-us/content/topics/provisioning/google/managing-g-suite-users.htm · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm · developer.okta.com/docs/api/openapi/okta-management/management/tags/userlifecycle.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/userlifecycle/other/activateuser.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/user.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/usercred.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/usercred/other/resetpassword.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/usersessions.md · developer.okta.com/docs/guides/create-an-api-token/main/
