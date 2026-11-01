---
description: Offboard a Google Workspace user in an Okta + Jamf shop — start in Okta (the identity source), contain, preserve Drive and Calendar data with pre-state first, then suspend or delete in the Admin console. Placeholders only.
disable-model-invocation: true
---

# /gws-offboard

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the departing user's Google address) · `[UPN]` (their Okta username) · `[USER_ID]` (their Okta user ID) · `[MANAGER_UPN]` (who receives the data) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Destructive multi-system plan** (Okta → Google Workspace → devices). Route it through an independent, out-of-session review before Phase D runs.
- Every state change below has its own exact-phrase gate. A phrase never carries into a later phase; "yes" is never a confirmation.
- Not done until every read-back in the final checklist passes.

## Inputs needed

- `[UPN]` and `[USER_ID]` in Okta, `[USER@DOMAIN.COM]` in Google, `[MANAGER_UPN]` (an active, unsuspended Google account).
- Whether the departing user holds any Google admin role (super admins can sign in to the Admin console directly and bypass Okta SSO).
- The Okta Google Workspace integration's deactivation options — **[org gap — confirm in Okta before Phase A]** (see below).
- Retention decision: keep the account suspended, or delete it after the data is transferred — **[org gap — confirm the retention policy]**.

## How the systems hang together

- **Okta is the identity provider; Google Workspace is a SAML/OIDC service provider and may be provisioned from Okta.** Deactivating a user in Okta deprovisions them from every assigned app that has deprovisioning enabled.
- **What Okta provisioning does to the Google account:** with no deactivation option selected on the Google Workspace integration, Okta deprovisioning **suspends** the Google account. The options *Do not suspend user*, *Remove all G Suite licenses* and *Remove all G Suite Roles* change that. Which ones `[@Aegion]` uses is an **[org gap]** — read it before Phase A, because it decides whether Phase B is still needed.
- **Suspend vs delete:** suspension keeps mail, Drive and Calendar data and is still billed at the full rate; deletion removes every item that was not transferred and can be undone by a super admin for 20 days only.

## Fast path

1. Read the Okta user and the Google account (R0).
2. Phase A — deactivate in Okta (R3 gate). **WAIT UNTIL** Google reflects the provisioning result.
3. Phase B — suspend in Google only if Okta did not (R1 gate, undo stated in the gate).
4. Phase C — capture the Drive pre-state, then transfer Drive and Calendar to `[MANAGER_UPN]` (R2 gates). **WAIT UNTIL** both transfers finish.
5. Phase D — delete only after the independent review and the retention decision (R3 gate), or leave the account suspended.
6. Phase E — devices: lock or wipe the Mac and handle the Chromebook in their own runbooks (`/jamf-lock-erase`, `/gws-chromeos-device`).

## Phase A — Start in Okta (the identity source)

**Purpose** — cut the user off at the identity provider so every federated app, Google included, stops trusting them.

**Read first (R0):** Okta Admin Console → Directory → People → `[UPN]` → read **Status** and the **Applications** tab (which apps are assigned and which provision).

<!-- SAFETY GATE [gws-offboard-okta-deactivate-portal] -->
- **Target:** [UPN] in Okta
- **Effect:** deactivate the Okta user; Okta deprovisions every assigned app that has deprovisioning enabled
- **Scope:** one Okta user and its app assignments; group memberships are kept
- **Reversibility:** R3 — Okta Activate brings the account back, but app assignments may have to be re-assigned and the Okta password is permanently deleted
- **Required confirmation:** Type exactly `DEACTIVATE OKTA USER [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no read-back is named for it in this runbook: its proof is the read its own step names)
**PORTAL ACTION [gws-offboard-okta-deactivate-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Deactivate**.
2. Confirm in the dialog, then read the status back as **Deactivated**.

**WAIT UNTIL** the Google side shows the provisioning result: Admin console → Directory → Users → `[USER@DOMAIN.COM]` → status banner. With default integration settings the account is **Suspended**; with *Do not suspend user* it stays **Active** and Phase B is required.

**Verification checkpoint** — [ ] Okta status reads Deactivated · [ ] the Google status is recorded in the ticket.

## Phase B — Contain in Google (only if Okta did not suspend the account)

**Purpose** — stop Google sign-in when provisioning left the account active.

<!-- SAFETY GATE [gws-offboard-suspend-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** suspend one Google Workspace user; sign-in stops and Google resets the sign-in cookies, and nothing is deleted
- **Scope:** one user; mail, Drive, Calendar, licences and group memberships are kept (the licence is still billed)
- **Reversibility:** R1 — undo in the same place: Admin console → Directory → Users → filter User status = Suspended → More options → Reactivate, under its own exact phrase `REACTIVATE GOOGLE USER [USER@DOMAIN.COM]`
- **Required confirmation:** Type exactly `SUSPEND GOOGLE USER [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-offboard-suspend-portal]:** Only after the exact match:
1. Admin console → Directory → Users → point to `[USER@DOMAIN.COM]` → **More options** → **Suspend user**.
2. In the dialog, click **Suspend**, then read the status back as **Suspended**.

**Gotcha** — a separate sign-in-cookie reset is not needed: suspending a user already resets their sign-in cookies.

## Phase C — Preserve the data (R2: capture pre-state first)

**Purpose** — move what the organization still needs before anything is deleted.

**Pre-state (R0, record it in the ticket):** the number of files `[USER@DOMAIN.COM]` owns, and whether any Vault hold applies (a user on a litigation hold cannot have data transferred or be deleted until a Vault admin lifts the hold).

```bash
# read-only: account status, organizational unit and admin flags before any change
gam info user "[USER@DOMAIN.COM]"   # prints status, OU, licences and admin roles
# read-only: how many files the user owns today (the pre-state for the transfer)
gam user "[USER@DOMAIN.COM]" print filecounts   # counts owned files by type
```

<!-- SAFETY GATE [gws-offboard-drive-transfer-portal] -->
- **Target:** [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new owner)
- **Effect:** transfer ownership of the user's My Drive files to the new owner
- **Scope:** files owned by one user, excluding Trash; shared-drive files are not touched (the organization owns them)
- **Reversibility:** R2 — not reversible from the Admin console — no undo is documented; the previous owner keeps edit access unless removed, so the recorded pre-state is the only record of what moved
- **Required confirmation:** Type exactly `TRANSFER DRIVE FILES FROM [USER@DOMAIN.COM] TO [MANAGER_UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no verify-* command reads Drive ownership or a data transfer: its proof is the read its step names)
**PORTAL ACTION [gws-offboard-drive-transfer-portal]:** Only after the pre-state is recorded and the exact match:
1. Admin console → Apps → Google Workspace → Drive and Docs → **Transfer ownership**.
2. Enter From user `[USER@DOMAIN.COM]` and To user `[MANAGER_UPN]`, then click **Transfer Files**.

**WAIT UNTIL** the transfer completes. A transfer that runs longer than 36 hours stops unsuccessfully and has to be started again.

<!-- SAFETY GATE [gws-offboard-calendar-transfer-portal] -->
- **Target:** [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new organizer)
- **Effect:** transfer the user's future, non-private calendar events to the new organizer
- **Scope:** future non-private events on the primary calendar; past events and secondary calendars do not move
- **Reversibility:** R2 — not reversible from the Admin console; record the event count first
- **Required confirmation:** Type exactly `TRANSFER CALENDAR EVENTS FROM [USER@DOMAIN.COM] TO [MANAGER_UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no verify-* command reads Drive ownership or a data transfer: its proof is the read its step names)
**PORTAL ACTION [gws-offboard-calendar-transfer-portal]:** Only after the exact match:
1. Admin console → Apps → Google Workspace → Calendar → **Event and Secondary calendar management** → **Events transfer**.
2. Enter `[USER@DOMAIN.COM]` and `[MANAGER_UPN]` and start the transfer. It starts about 10 minutes later and can run for about 15 minutes.

**Verification checkpoint** — [ ] `[MANAGER_UPN]` opens a sample of the transferred files · [ ] the transferred event count is recorded.

## Phase D — Delete, or keep suspended (R3, after independent review)

**Purpose** — end the licence charge only when the data is safe and the retention decision is made.

<!-- SAFETY GATE [gws-offboard-delete-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** delete the Google Workspace account; data that was not transferred is deleted with it
- **Scope:** one account and its untransferred data; shared-drive files stay
- **Reversibility:** R3 — a super admin can restore the account for 20 days (Directory → Users → More options → Recently deleted users → Recover); after 20 days the data is gone, and a user with data on a Vault hold cannot be deleted at all
- **Required confirmation:** Type exactly `DELETE GOOGLE USER [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no verify-* command proves a deleted account: its proof is the read its step names)
**PORTAL ACTION [gws-offboard-delete-portal]:** Only after the Phase C read-backs, the independent review and the exact match:
1. Admin console → Directory → Users → point to `[USER@DOMAIN.COM]` → **More options** → **Delete user**.
2. Next to **Data in other apps**, choose **Don't transfer data** (Phase C already moved it), then confirm the deletion.

**Gotcha** — on the Annual/Fixed-Term plan, deleting a user does not reduce the licence count; on the Flexible plan the charge is prorated.

## Phase E — Devices

> **PREVIEW ONLY [gws-offboard-devices-preview]:** Device actions are separate runbooks with their own gates; nothing in this command locks, wipes, or deprovisions a device.

- **Mac (Jamf):** use the Jamf lock/wipe runbook — the lock is reversible with its PIN, the wipe is not.
- **Chromebook:** use `/gws-chromeos-device` — powerwash and deprovision are different actions with different undo stories.

<details>
<summary>GAM / Okta API — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal — Aegis never does
# Okta API token: export OKTA_API_TOKEN from the secret manager first — never paste it into a ticket
# SAFETY GATE [gws-offboard-okta-deactivate]
# Target: [USER_ID] in Okta
# Effect: deactivate the Okta user — Okta deprovisions every assigned app that has deprovisioning enabled
# Scope: one Okta user and its app assignments
# Reversibility: R3 — reactivation may need app assignments re-created — the Okta password is permanently deleted
# Required confirmation: type exactly "DEACTIVATE OKTA USER [USER_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no read-back is named for it in this runbook: its proof is the read its own step names
# the exact phrase to type
required_confirmation="DEACTIVATE OKTA USER [USER_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # deactivates the user in Okta
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/deactivate" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: status should read DEPROVISIONED
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```

```bash
# HUMAN-RUN — suspend only if Okta did not already suspend the Google account
# SAFETY GATE [gws-offboard-suspend]
# Target: [USER@DOMAIN.COM]
# Effect: suspend one Google Workspace user — nothing is deleted
# Scope: one user — data, licences and group memberships are kept
# Reversibility: R1 — undo with the separate unsuspend procedure under its own phrase
# Required confirmation: type exactly "SUSPEND GOOGLE USER [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
# the exact phrase to type
required_confirmation="SUSPEND GOOGLE USER [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # suspends the account — sign-in stops
  gam suspend user "[USER@DOMAIN.COM]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the account shows as suspended
gam info user "[USER@DOMAIN.COM]"
```

```bash
# HUMAN-RUN — transfer Drive and Calendar data with Google’s data-transfer service
# SAFETY GATE [gws-offboard-data-transfer]
# Target: [USER@DOMAIN.COM] — source — and [MANAGER_UPN] — new owner
# Effect: transfer ownership of the user’s Drive files and future calendar events to the new owner
# Scope: one source user — "all" includes files that were never shared — the default moves shared files only
# Reversibility: R2 — not reversible from the Admin console — the recorded file count is the only pre-state
# Required confirmation: type exactly "TRANSFER DRIVE AND CALENDAR DATA FROM [USER@DOMAIN.COM] TO [MANAGER_UPN]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no verify-* command reads Drive ownership or a data transfer: its proof is the read its step names
# the exact phrase to type
required_confirmation="TRANSFER DRIVE AND CALENDAR DATA FROM [USER@DOMAIN.COM] TO [MANAGER_UPN]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # starts the transfer and prints its ID
  gam create datatransfer "[USER@DOMAIN.COM]" drive,calendar "[MANAGER_UPN]" all
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the transfer and its status
gam print datatransfers
```

```bash
# HUMAN-RUN — delete only after the independent review and the retention decision
# SAFETY GATE [gws-offboard-delete]
# Target: [USER@DOMAIN.COM]
# Effect: delete the Google Workspace account — untransferred data is deleted with it
# Scope: one account — shared-drive files stay
# Reversibility: R3 — a super admin can restore it for 20 days, then the data is gone
# Required confirmation: type exactly "DELETE GOOGLE USER [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no verify-* command proves a deleted account: its proof is the read its step names
# the exact phrase to type
required_confirmation="DELETE GOOGLE USER [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # deletes the account — 20-day restore window starts
  gam delete user "[USER@DOMAIN.COM]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: lists recently deleted users — the account should appear here — restorable for 20 days
gam print users deleted_only
```
</details>

## ⚠️ Risk warning

- **Okta first, always.** Suspending in Google while the Okta account is still active leaves every other federated app open; with default integration settings Okta's deactivation suspends Google for you.
- **A super admin bypasses Okta SSO** and can still sign in to the Admin console directly — check admin roles before you trust Phase A alone.
- **Delete is R3:** untransferred data is deleted, the restore window is 20 days, and a user with data on a Vault hold cannot be deleted. Data transfer has no documented undo.
- The Drive transfer moves owned My Drive files only; Trash is skipped and the default GAM transfer privacy level moves shared files only — `all` is deliberate.

## ✅ Verification checklist

- [ ] Okta: Directory → People → `[UPN]` reads **Deactivated** (API read-back status `DEPROVISIONED`).
- [ ] Google: `gam info user "[USER@DOMAIN.COM]"` shows the account suspended — or, after Phase D, `gam print users deleted_only` lists it and the deletion appears in Admin log events.
- [ ] Data: `gam print datatransfers` shows Drive and Calendar transfers completed; `[MANAGER_UPN]` opened a sample file; the pre-state file count is in the ticket.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the suspend / transfer / delete events with the expected admin and time.
- [ ] Devices handed to `/jamf-lock-erase` and `/gws-chromeos-device`, each with its own read-back.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Offboarded `[USER@DOMAIN.COM]` (Okta `[UPN]`). Okta deactivated [timestamp] (status DEPROVISIONED); Google account [suspended by Okta provisioning / suspended manually] [timestamp]. Pre-state: [N] owned files recorded. Drive and Calendar transferred to `[MANAGER_UPN]`, transfer IDs [IDs], completion verified. Account [kept suspended per retention policy / deleted after independent review — 20-day restore window ends [date]]. Admin log events confirm each change. Devices: [Mac via Jamf runbook / Chromebook via ChromeOS runbook — status]. Time spent: [X] min.

## Aha moment

The identity provider is the off-switch: in an Okta-federated shop, the Google account is one of many service-provider sessions hanging off one Okta identity — cut Okta first and let provisioning do the rest.

## Career upgrade

Being able to explain IdP → SP provisioning (who is authoritative, what deprovisioning does downstream) is exactly the identity-architecture judgment cloud and security roles test for.

## Next action

Start Phase A after confirming the Okta Google Workspace integration's deactivation options and the retention decision.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-deactivate-user-account.htm · help.okta.com/oie/en-us/content/topics/provisioning/google/managing-g-suite-users.htm · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm · developer.okta.com/docs/api/openapi/okta-management/management/tags/userlifecycle.md · knowledge.workspace.google.com/admin/users/suspend-a-user-temporarily · knowledge.workspace.google.com/admin/users/delete-or-remove-a-user-from-your-organization · knowledge.workspace.google.com/admin/users/restore-a-recently-deleted-user · knowledge.workspace.google.com/admin/drive/transfer-drive-files-to-a-new-owner-as-an-admin · knowledge.workspace.google.com/admin/calendar/cancel-or-transfer-events-or-secondary-calendars-before-deleting-a-user · knowledge.workspace.google.com/vault/holds/get-started-with-holds-in-google-vault · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users, Google-Data-Transfers, Users-Drive-Files-Display pages; GAM is an open-source tool, not a Google product).
