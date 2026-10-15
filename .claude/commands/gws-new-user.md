---
description: Create a Google Workspace account for a new hire in an Okta + Jamf shop — decide whether Okta provisioning or the Admin console creates the account, put it in the right organizational unit, confirm the licence rule, add the team groups, and verify before the start date. Placeholders only.
disable-model-invocation: true
---

# /gws-new-user

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the new Google address) · `[FIRST_NAME]` `[LAST_NAME]` · `[OU_PATH]` (the organizational unit) · `[GROUP_EMAIL]` (each team group's address) · `[START_DATE]` · `[UPN]` (the Okta username, when Okta provisions the account) · `[TEMP_PASSWORD]` · `[LICENSE_TYPE]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- Creating an account is a billable, identity-creating change: on the Flexible Plan every added user raises the monthly payment automatically. The creation and every group add has its own exact-phrase gate; "yes" is never a confirmation.
- Two creation paths exist and only one is right for `[@Aegion]` (Phase A). Okta's own guidance is to enable account creation in Okta only when Google accounts are not already created by another process — so never run both paths for one person.
- Not done until the read-backs in the final checklist pass — and that has to happen before `[START_DATE]`, because Google services can take up to 24 hours to become available to a new user.

## Inputs needed

- `[USER@DOMAIN.COM]`, `[FIRST_NAME]` `[LAST_NAME]`, `[START_DATE]`.
- `[OU_PATH]` — the OU decides the settings and services the user inherits, so take it from the team's existing users, never guess it — **[org gap — confirm the OU for this team]**.
- `[GROUP_EMAIL]` for each team group — **[org gap — confirm the team's groups]**.
- The creation path: Okta provisioning (*Push New Users* on Okta's Google Workspace integration) or the Admin console — **[org gap — confirm before Phase A]**.
- Whether automatic licensing covers `[OU_PATH]` (Phase C).

## How the systems hang together

- **Okta may be the source of the Google account.** With *Push New Users* enabled on the Okta Google Workspace integration, new users created through Okta are also created in Google Workspace when they are assigned the app. Okta's guidance: if Google accounts are created primarily by a process outside Okta, do not enable account creation in Okta. Exactly one path is right for `[@Aegion]`.
- **The OU carries the policy.** A user belongs to exactly one organizational unit and inherits that unit's settings; the OU determines which features and services the user can access. Pick it at creation, not afterwards.
- **Licensing is a rule, not a click.** Automatic licence assignment is configured at Billing → License settings; if the rule covers the OU, the new account is licensed without a manual step.
- **Groups are mail and access.** New members get the Member role and the All email subscription; whatever the group is used to grant, the new member gets with it.

## Fast path

1. Phase A — confirm the creation path (R0): Okta app assignment, or the Admin console.
2. Phase B — create the account in `[OU_PATH]` (R1 gate) — Admin console path only.
3. **WAIT UNTIL** the account appears in Directory → Users; services can take up to 24 hours.
4. Phase C — confirm the licence (R0; a manual assignment is `/gws-license-assign`, not this one).
5. Phase D — add the team groups (R1 gate per group).
6. Phase E — hand over the credentials; the welcome email's reset link expires after 48 hours.
7. Verify every read-back before `[START_DATE]`.

## Phase A — Confirm the creation path (R0)

**Purpose** — create the account exactly once, from the system that owns it.

**Read first (R0):** Okta Admin Console → Applications and Resources → Applications → the Google Workspace app → **Provisioning** → **To App** → read whether *Push New Users* (account creation) is enabled under Provisioning to App.

> **PREVIEW ONLY [gws-new-user-okta-preview]:** Planning only — nothing here authorizes an Okta change. If Push New Users is on, the Google account is created when `[UPN]` is assigned the Google Workspace app in Okta; that assignment is the Okta app-assignment procedure with its own gate, and Phase B is skipped. The integration can also choose which organizational unit it pushes, so read the OU back in Phase C regardless of path.

- Path A — **Okta provisions the account:** the app assignment happens in the Okta app-assignment procedure (separate runbook); continue at the **WAIT UNTIL** below.
- Path B — **the Admin console creates the account:** continue to Phase B.

**WAIT UNTIL** the account exists: Admin console → Directory → Users → search for `[USER@DOMAIN.COM]` → the account row appears. Google services can take up to 24 hours to become available to the new user, and the account can take up to 24 hours to appear in the searchable Directory.

**Verification checkpoint** — [ ] the creation path is recorded in the ticket · [ ] (Path A) the account row appears in Directory → Users with the expected OU.

## Phase B — Create the account in the Admin console (Path B only, R1 gate)

**Purpose** — create one account, in the right OU, with a temporary password the user must change.

<!-- SAFETY GATE [gws-new-user-create-portal] -->
- **Target:** [USER@DOMAIN.COM] in [OU_PATH]
- **Effect:** create one Google Workspace user account in the organizational unit; on the Flexible Plan the monthly payment rises automatically
- **Scope:** one account; the OU's settings and the Billing → License settings rule apply to it from creation
- **Reversibility:** R1 as a creation — the undo is the separate delete-user procedure (its own R3 gate; a super admin can restore for 20 days); a mistyped address is fixed with Rename user, not with a delete
- **Required confirmation:** Type exactly `CREATE GOOGLE USER [USER@DOMAIN.COM] IN [OU_PATH]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-new-user-create-portal]:** Only after Phase A confirmed Path B and the exact match:
1. Admin console → Directory → Users → **Add new user**.
2. Enter `[FIRST_NAME]`, `[LAST_NAME]` and the primary email `[USER@DOMAIN.COM]` (pick the domain from the drop-down if `[@Aegion]` has more than one); a secondary email only if the user has a current address that can receive their account details.
3. Click **Manage user's password, organizational unit, and profile photo**; under **Organizational unit** click **Edit** and pick `[OU_PATH]`; under **Password** keep the automatically generated password or type `[TEMP_PASSWORD]`.
4. Click **Add New User**, then choose how the details reach the user: **Copy Password** (to pass it on yourself) or **Preview And Send** (emails the details to the secondary email), then **Done**.

**Gotcha** — if the console prompts you to fix a conflicting account, someone already uses this address for an unmanaged Google account: stop and follow the console's conflicting-account guidance before continuing.

**WAIT UNTIL** `[USER@DOMAIN.COM]` appears in Directory → Users. Services can take up to 24 hours; a user who tries a service that is not yet available sees a no-access message, which is not a fault.

**Verification checkpoint** — [ ] the account row shows `[OU_PATH]` · [ ] the temporary password was handed over through a channel other than the ticket.

## Phase C — Confirm the licence (R0)

**Purpose** — make sure the licence arrives by rule; a manual assignment is a separate runbook.

- Admin console → Billing → License settings → read whether automatic licensing covers `[OU_PATH]`.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Licenses** → read the Status column for `[LICENSE_TYPE]`.
- If nothing is assigned and the rule does not cover the OU, the licence is assigned with the Google licence-assignment procedure under its own gate — nothing in this runbook assigns one.

**Verification checkpoint** — [ ] Status shows `[LICENSE_TYPE]` assigned.

## Phase D — Add the team groups (R1 gate per group)

**Purpose** — give the user the team's mail and whatever the group grants.

**Read first (R0):** Admin console → Directory → Groups → `[GROUP_EMAIL]` → **Members** → read the current members and roles.

<!-- SAFETY GATE [gws-new-user-group-add-portal] -->
- **Target:** [USER@DOMAIN.COM] and [GROUP_EMAIL]
- **Effect:** add one member to the group with the Member role and the All email subscription
- **Scope:** one user in one group; every additional group gets its own run of this gate with its own phrase
- **Reversibility:** R1 — the undo is the remove-member procedure in `/gws-group-membership` under its own phrase `REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]`
- **Required confirmation:** Type exactly `ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-new-user-group-add-portal]:** Only after the exact match:
1. Admin console → Directory → Groups → `[GROUP_EMAIL]` → **Members** → **Add members**.
2. Enter the first characters of `[USER@DOMAIN.COM]`, select the match, then click **Add To Group**.

**Gotcha** — the same change from the user's side is Directory → Users → the user → **Groups** → **Add user to groups** → select the group → **Add**; it is the same gate, not a second one.

**Verification checkpoint** — [ ] the member list shows `[USER@DOMAIN.COM]` with role Member in every `[GROUP_EMAIL]`.

## Phase E — Hand over and first sign-in

**Purpose** — the account is only useful once the user is in.

1. Hand the credentials over through the agreed onboarding channel — **[org gap — confirm the channel]** — never inside the ticket.
2. If you used **Preview And Send**, the welcome email's password-reset link expires in 48 hours; a lapsed link means a `/gws-password-reset`, not a new account.
3. **WAIT UNTIL** the user signs in and sets their own password. On the Okta path they sign in through Okta; the Google password is only typed for direct sign-in.

**Verification checkpoint** — [ ] the user reached Gmail and Drive before `[START_DATE]`.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal; Aegis never does
# SAFETY GATE [gws-new-user-create]
# Target: [USER@DOMAIN.COM] in [OU_PATH]
# Effect: create one Google Workspace user account in the organizational unit with a random password the user must change
# Scope: one account; licence and settings follow the OU and the licence rule
# Reversibility: R1 as a creation — the undo is the separate delete-user procedure (20-day restore window)
# Required confirmation: type exactly `CREATE GOOGLE USER [USER@DOMAIN.COM] IN [OU_PATH]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="CREATE GOOGLE USER [USER@DOMAIN.COM] IN [OU_PATH]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam create user "[USER@DOMAIN.COM]" firstname "[FIRST_NAME]" lastname "[LAST_NAME]" ou "[OU_PATH]" password random changepassword true logpassword -   # creates the account in the OU; prints the random password once (hand it over out of band)
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info user "[USER@DOMAIN.COM]"   # read-back: status, OU, licences and group memberships
```

```bash
# HUMAN-RUN — one group per run; repeat with a fresh confirmation for each group
# SAFETY GATE [gws-new-user-group-add]
# Target: [USER@DOMAIN.COM] and [GROUP_EMAIL]
# Effect: add one member to the group with the Member role
# Scope: one user in one group
# Reversibility: R1 — the undo is the separate remove-member procedure under its own phrase
# Required confirmation: type exactly `ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam update group "[GROUP_EMAIL]" add member "[USER@DOMAIN.COM]"   # adds the user to the group as a Member
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam print group-members group "[GROUP_EMAIL]"   # read-back: the member list with role and status
```
</details>

## ⚠️ Risk warning

- **One creation path only.** An account created in the Admin console for a user Okta also pushes, or the reverse, is an identity to clean up later — settle Phase A first.
- **The OU is policy.** A user dropped into the wrong OU inherits the wrong settings and services; moving them later is its own change.
- **Billing moves with the click:** on the Flexible Plan the payment rises the moment the account exists.
- **Credentials never travel in the ticket.** The welcome link lasts 48 hours; a lapsed link is a password reset, not a reason to email the password.
- A group add is reversible, but it grants whatever the group grants the moment it runs — read the group's purpose first.

## ✅ Verification checklist

- [ ] `gam info user "[USER@DOMAIN.COM]"` (or Directory → Users → the account page) shows the account Active in `[OU_PATH]` with `[LICENSE_TYPE]` assigned and every `[GROUP_EMAIL]` listed.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the user-creation and add-member events with the expected admin and time; on Path A, Okta Admin Console → Reports → System Log shows the provisioning push for `[UPN]`.
- [ ] `gam print group-members group "[GROUP_EMAIL]"` lists `[USER@DOMAIN.COM]` with role MEMBER for each group.
- [ ] The user signed in and changed the temporary password before `[START_DATE]`; the welcome link did not lapse.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Google Workspace account `[USER@DOMAIN.COM]` created for `[FIRST_NAME] [LAST_NAME]` (start `[START_DATE]`) via [Okta provisioning / Admin console] in OU `[OU_PATH]`. Licence `[LICENSE_TYPE]` assigned [by rule / manually under its own gate]. Added to `[GROUP_EMAIL]` [list] as Member. Credentials handed over via [channel]; user signed in and set their own password [timestamp]. Admin log events confirm each change. Time spent: [X] min.

## Aha moment

In a federated shop the account has an owner before it has a user: Okta or the Admin console creates it, never both — and the OU you pick at creation is the policy the person lives under from their first sign-in.

## Career upgrade

Knowing which system is authoritative for account creation (IdP provisioning versus the service's own console) is the identity-lifecycle judgment every cloud and security role interviews for.

## Next action

Start Phase A after confirming the creation path, `[OU_PATH]` and the team's `[GROUP_EMAIL]` list.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user · knowledge.workspace.google.com/admin/users/advanced/how-the-organizational-structure-works · knowledge.workspace.google.com/admin/users/advanced/move-users-to-an-organizational-unit · knowledge.workspace.google.com/admin/billing/assign-remove-and-reassign-licenses · knowledge.workspace.google.com/admin/groups/add-or-invite-users-to-a-group · knowledge.workspace.google.com/admin/users/restore-a-recently-deleted-user · knowledge.workspace.google.com/admin/reports/admin-log-events · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm · help.okta.com/oie/en-us/content/topics/oda/device-logout.htm (Reports → System Log path) · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users and Groups-Membership pages; GAM is an open-source tool, not a Google product).
