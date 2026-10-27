---
description: Google Workspace security posture review with the local generator scripts/gws-posture-audit.js - print the checklist, feed it a GAM export, read live counts through the read-only adapter, rank what to fix first, and make the fixes this runbook owns (Gmail automatic forwarding, third-party app access) behind exact-phrase gates, each proved by the value read back in the Admin console. The generator and the adapter never write to Google. Placeholders only.
disable-model-invocation: true
---

# /gws-security-posture

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[FILE_NAME]` (a local file: a GAM export the generator reads, or the report it writes; each use is a new name) · `[OU_PATH]` (the organizational unit a fix applies to) · `[APP_NAME]` and `[APP_ID]` (a third-party app and its OAuth client ID) · `[UPN]` (your own administrator sign-in address; the audit log records it as the actor) · `[NOT_BEFORE]` (the UTC time, ISO 8601, you write down just before a change; every read-back starts there) · `[ISSUE_ID]`, `[NOTE_FILE]`, `[NOTE_SHA256]` (the Linear ticket note) · `[ADMIN_NAME]` (the next owner in a partial-state note) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **The audit itself changes nothing in Google.** `node scripts/gws-posture-audit.js` prints a checklist; `--export [FILE_NAME]` reads a local GAM CSV; `--write [FILE_NAME]` creates one new local report only with the exact phrase its preview prints, and never overwrites a file. The generator never writes to Google. The adapter `scripts/adapters/gws-client.js` reads with read-only scopes, is dry by default, and refuses every write.
- **Three local writes, each behind an exact phrase.** The two GAM exports (Phase B, one gate each) and the saved report (Phase F, the generator's own phrase) are files on the administrator's machine that hold real addresses and admin flags. Keep them outside any Git checkout and outside the ticket; quote counts, never rows.
- **Three Google fixes live here, each R3.** Turning automatic forwarding off for a unit, allowing it for a unit, and blocking a third-party app are security controls for every user in scope; each has its own phrase in Phase E and needs a named approver.
- **The other fixes belong to other runbooks' gates:** Drive external sharing in `/gws-drive-sharing`; one user's 2-Step Verification reset in `/gws-2sv-reset`; sign-in and admin-change investigation in `/gws-audit-log`; the 2-Step Verification rollout, admin roles and account containment in this lane's gws-2sv-enforcement, gws-admin-roles and gws-account-containment runbooks. This runbook ranks them and hands them over; it changes none of them.
- **Role needed for the review:** Super Admin, or an admin role that holds each check's privilege: Reports (Reporting pages), Security center privileges plus read access to the Security health units (Security health), Gmail Settings (automatic forwarding), Mobile Device Management (Universal settings) (search excerpts).

## Inputs needed

- The Google Workspace edition **[org gap]**: the lane's sources list Security health only for Frontline Standard and Plus, Enterprise Standard and Plus, Education Standard and Plus, and Enterprise Essentials Plus (search excerpt); Business editions are not on that list.
- An access-controlled folder outside any Git checkout for the exports and the report **[org gap: confirm where]**.
- Whether GAM is approved and authorized by an administrator here **[org gap]**; without it, skip Phase B and use the adapter reads in Phase C.
- The approver for an R3 fix **[org gap: confirm the approver]**.

## How the systems hang together

- **The generator** (`scripts/gws-posture-audit.js`) is a local checklist. Each check prints its read-only Admin console path, its GAM read command, the Google source it rests on with the date it was checked, and a status. `--export` hands it a GAM CSV (`gam print users fields primaryemail,isenrolledin2sv,isenforcedin2sv,isadmin,isdelegatedadmin,suspended`, or `gam print admins`) to compute the user and admin checks from.
- **The adapter** reads the tenant live through the Directory and Reports APIs with read-only scopes. It does not read OAuth tokens or app passwords from the Directory API (that scope also grants writes); third-party app activity comes from the Reports API token events instead.
- **The Admin console** holds the settings. A human changes them; the value read back in the Admin console is the proof, and the adapter's Admin audit log read is supporting evidence, because the event names for these settings are not in the lane's sources.
- **Lag and retention:** Admin console → Reporting → User Reports → Security can lag up to 48 hours, while the Directory API fields isEnrolledIn2Sv and isEnforcedIn2Sv are real time. Admins cannot delete audit log data or change how long it is kept; Admin and Drive events arrive near real time and OAuth events can take a few hours (search excerpts). About 6 months of activity is what third-party sources and the GAM wiki (180 days) report; Google's own retention table was not seen.
- **Retired check:** the less secure apps settings were removed from the Admin console on June 15 2024 (search excerpt). A posture check for them reads "retired, not applicable", never "fail".

## Fast path

1. Phase A: print the checklist and open each check's Admin console path (R0).
2. Phase B: export users and admins with GAM into two new local files (local write, one gate per file).
3. Phase C: run the generator on each export and read the live counts with the adapter (R0).
4. Phase D: rank what to fix first and open one ticket per fix.
5. Phase E: make the fixes this runbook owns, automatic forwarding and third-party app access (R3 gates). **WAIT UNTIL** each read-back passes.
6. Phase F: save the report with `--write` (local, exact phrase) and put counts, not rows, in the ticket.

## Phase A: Print the checklist (R0)

**Purpose:** see every check, where it lives in the Admin console and which Google source it rests on, before reading the tenant.

```bash
# read-only: prints the posture report, each check with its read-only Admin console path, GAM read, Google source, check date and status
node scripts/gws-posture-audit.js
```

1. Run the command above and read each check's status and path.
2. Open the Admin console path of each check whose status needs a person to read it; the main paths are:
   - 2-Step Verification enrollment: Admin console → Reporting → User Reports → Security (add the 2-Step Verification enrollment and enforcement columns; up to 48 hours behind).
   - Super admins: Admin console → Account → Admin roles → Super Admin → Admins.
   - Super admin recovery: Admin console → Security → Authentication → Account recovery → Super admin account recovery. Its default differs by customer age and size, so read the actual value (search excerpt).
   - Automatic forwarding: Admin console → Apps → Google Workspace → Gmail → End User Access → Automatic forwarding (on by default, per unit; search excerpt).
   - Third-party apps: Admin console → Security → Access and data control → API controls → Manage Third-Party App Access (each app Trusted, Limited or Blocked per scope; search excerpt).
   - Drive external sharing: Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings → Sharing options.
   - Mobile and endpoints: Admin console → Devices → Mobile & endpoints → Settings → Universal.
   - Security health: Admin console → Security → Security center → Security health (path not confirmed in the lane's sources; edition-dependent).

**Verification checkpoint:** [ ] the report printed · [ ] each check's status or Admin console reading is noted, with the time read.

## Phase B: Export users and admins with GAM (local files, gated)

**Purpose:** give the generator the rows it computes the user and admin checks from, without anyone pasting real rows into a ticket.

**Role needed:** a GAM authorization made by an administrator who can read users and admin roles in Google: Super Admin, or a delegated role with user and role read privileges (the exact privilege names are not in the lane's sources). Nothing in Google changes; each gate guards one local file that lists real accounts.

Prerequisites: GAM approved and authorized **[org gap]**; the folder from Inputs exists; each `[FILE_NAME]` is a new name in that folder.

<details>
<summary>GAM: write the two exports (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN: the administrator runs this in their own terminal, Aegis never does
# SAFETY GATE [gws-security-posture-users-export]
# Target: [FILE_NAME]
# Effect: write one local CSV file with every user and the 2-Step Verification, admin, delegated admin and suspension flags
# Scope: one new file on the administrator machine, outside any Git checkout, a file of the same name would be replaced, nothing in Google changes
# Reversibility: R1, delete the local file, it holds real addresses so it never goes into Git or the ticket
# Required confirmation: type exactly "WRITE GAM USERS EXPORT [FILE_NAME]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="WRITE GAM USERS EXPORT [FILE_NAME]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and writes the file only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # prints every user with the five posture fields as CSV into the new local file
  gam print users fields primaryemail,isenrolledin2sv,isenforcedin2sv,isadmin,isdelegatedadmin,suspended > "[FILE_NAME]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: one header line plus one line per user
wc -l "[FILE_NAME]"
```

```bash
# HUMAN-RUN: the administrator runs this in their own terminal, Aegis never does
# SAFETY GATE [gws-security-posture-admins-export]
# Target: [FILE_NAME]
# Effect: write one local CSV file with every admin role assignment
# Scope: one new file on the administrator machine, a different name from the users export, a file of the same name would be replaced, nothing in Google changes
# Reversibility: R1, delete the local file, it names every administrator so it never goes into Git or the ticket
# Required confirmation: type exactly "WRITE GAM ADMINS EXPORT [FILE_NAME]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="WRITE GAM ADMINS EXPORT [FILE_NAME]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and writes the file only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # prints every admin role assignment as CSV into the new local file
  gam print admins > "[FILE_NAME]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: one header line plus one line per role assignment
wc -l "[FILE_NAME]"
```
</details>

**Verification checkpoint:** [ ] both files exist in the folder from Inputs, outside Git · [ ] the `wc -l` counts match the user and admin counts you expect · [ ] no row was pasted anywhere.

**Gotcha:** the GAM column headers are inferred from GAM wiki examples (camelCase API names such as primaryEmail and isEnrolledIn2Sv), not confirmed; if the generator rejects an export, read its message before changing the command.

## Phase C: Run the checks (R0)

**Purpose:** turn the exports and the live tenant into statuses and counts.

1. Run the generator on both exports in one command, the users export first. It reads the first `--export` as the `gam print users` CSV and the second as the `gam print admins` CSV, and refuses an admins export given first or alone (exit 2). Give each `[FILE_NAME]` as its full path in the folder from Inputs; with only the users export, pass that one alone.

```bash
# read-only: reads the two local GAM exports, users export first and admins export second, and prints the report with the checks it computes, nothing is written
node scripts/gws-posture-audit.js --export [FILE_NAME] --export [FILE_NAME]
```

2. Read the same posture live through the adapter. Each line is a read; nothing here can change Google.

```bash
# read-only: users not enrolled in 2-Step Verification, up to 500 per page, the query syntax is not confirmed in the lane sources
node scripts/adapters/gws-client.js users --query "isEnrolledIn2Sv=false" --max-results 500 --execute
# read-only: super administrators, the query syntax is not confirmed in the lane sources
node scripts/adapters/gws-client.js users --query "isAdmin=true" --execute
# read-only: every admin role with its roleId, isSuperAdminRole marks the super admin role
node scripts/adapters/gws-client.js roles --execute
# read-only: every role assignment, users, groups and service accounts alike, count those that carry the super admin roleId
node scripts/adapters/gws-client.js role-assignments --execute
# read-only: 2-Step Verification counts for one day, dates are UTC-8, a warning in the answer means missing or partial data for that day, parameter names from a search excerpt
node scripts/adapters/gws-client.js usage --date YYYY-MM-DD --parameters accounts:num_users_2sv_enrolled,accounts:num_users_2sv_enforced,accounts:num_users_2sv_not_enrolled --execute
# read-only: OAuth grant and revoke events, the third-party apps users connect and their client IDs
node scripts/adapters/gws-client.js activities --app token --user all --max-results 1000 --execute
# read-only: Admin console setting changes, who changed a posture setting and when
node scripts/adapters/gws-client.js activities --app admin --user all --max-results 1000 --execute
# read-only: mobile devices with compromised, encryption and device password status
node scripts/adapters/gws-client.js mobile-devices --execute
# read-only: ChromeOS devices with OS version compliance, auto-update expiry and last sync
node scripts/adapters/gws-client.js chromeos-devices --execute
```

3. Record counts in the ticket: super admins (and how many are groups or service accounts), users and admins not enrolled in 2-Step Verification, units with automatic forwarding allowed, apps with broad scopes, devices reported compromised or unencrypted.

**Verification checkpoint:** [ ] every check has a status or a count · [ ] the counts are in the ticket, no rows.

<details>
<summary>GAM: the scale version of the reads (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN, read-only: every admin role, with its privileges
gam print adminroles privileges
# HUMAN-RUN, read-only: 2-Step Verification counts for the tenant
gam report usage customer parameters accounts:num_users_2sv_enrolled,accounts:num_users_2sv_enforced
# HUMAN-RUN, read-only: the OAuth grants of every user, with app name, client ID and scopes
gam all users print tokens
# HUMAN-RUN, read-only: Admin console changes over the last 30 days
gam report admin start -30d
```
</details>

## Phase D: Rank what to fix first

**Purpose:** fix the account that can change everything before the setting that changes one thing.

1. **Super admin hygiene.** Google recommends more than one super admin, each managed by a separate person, no shared admin accounts, and a separate non-admin account for daily work (search excerpt). A super admin not enrolled in 2-Step Verification comes first of all; then fewer than two super admins, a shared super admin account, or a super admin used for daily mail. Hand these to this lane's gws-admin-roles runbook; replacing a super admin means assigning the new one first, who then removes the old role (search excerpt).
2. **Super admin recovery** set without a decision on record: read the actual value (its default depends on customer age and size) and route the change to the same admin-roles runbook.
3. **2-Step Verification gaps,** admins first, then everyone: a rollout by unit is this lane's gws-2sv-enforcement runbook; one locked-out user is `/gws-2sv-reset`.
4. **Automatic forwarding allowed** for units that do not need it (it is on by default): Phase E1 here.
5. **Third-party apps** with broad access that nobody approved: Phase E3 here.
6. **Drive external sharing** set to On where Allowlisted Domains would do: `/gws-drive-sharing`.
7. **Mobile and endpoint Universal settings** such as Device approvals: a separate reviewed change (preview in Phase E).
8. **Retired checks** (less secure apps): nothing to fix; record them as retired.

Open one ticket per fix with the count that justifies it; a suspicious sign-in or admin change found on the way goes to `/gws-audit-log`, not into this list.

**Verification checkpoint:** [ ] the ranked list is in the ticket · [ ] each item names the runbook that owns its gate.

## Phase E: Fixes this runbook owns (R3)

**Purpose:** close the forwarding and app-access findings, one gate per change, with the current value as the rollback.

Prerequisites for every gate: the current value for the scope is in the ticket (it is the rollback); the approver is named; users in scope are told **[org gap: who tells them]**.

### E1: Turn off automatic forwarding for a unit

**Role needed:** Super Admin, or a custom admin role with the Gmail Settings administrator privilege (search excerpt).

Read first: Admin console → Apps → Google Workspace → Gmail → End User Access → pick `[OU_PATH]` on the left → **Automatic forwarding** → note whether the box is ticked and whether the unit inherits or overrides. Write down `[NOT_BEFORE]` now.

<!-- SAFETY GATE [gws-security-posture-forwarding-off-portal] -->
- **Target:** [OU_PATH]
- **Effect:** turn off automatic forwarding for one organizational unit
- **Scope:** every user in [OU_PATH] and the child units that inherit from it; users can no longer set up automatic forwarding to another address; whether forwarding they already set up stops at once is not confirmed in the lane's sources
- **Reversibility:** R3: tick the box again under its own phrase, or click Inherit on a child unit to take back the parent value
- **Required confirmation:** Type exactly `TURN OFF AUTOMATIC FORWARDING FOR OU [OU_PATH]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-security-posture-forwarding-off-portal]:** Only after the current value and the approver are in the ticket and the exact match:
1. Admin console → Apps → Google Workspace → Gmail → End User Access → pick `[OU_PATH]` on the left → **Automatic forwarding**.
2. Clear the tick in **Allow users to automatically forward email to another address**, then click **Save** (on a child unit the button reads **Override**).

**WAIT UNTIL** the panel for `[OU_PATH]` shows the box cleared, and a test user in the unit no longer sees the forwarding option in Gmail settings. The panel is the proof: Google's event name for a Gmail setting change is not in the lane's sources, so no `verify-*` read can prove it.

Supporting evidence only: the read below lists your Admin console changes since `[NOT_BEFORE]`. Note in the ticket the event whose parameters carry `[OU_PATH]`, with its name, or note that none does; either way the panel decides.

```bash
# read-only: every Admin console change [UPN] made since [NOT_BEFORE], with each event name and its parameters, supporting evidence only
node scripts/adapters/gws-client.js activities --app admin --user [UPN] --start [NOT_BEFORE] --execute
```

**Verification checkpoint:** [ ] the panel shows the box cleared for `[OU_PATH]` (the proof) · [ ] the admin event whose parameters carry `[OU_PATH]` noted with its name, or its absence noted.

### E2: Allow automatic forwarding for a unit

**Role needed:** Super Admin, or a custom admin role with the Gmail Settings administrator privilege (search excerpt).

Automatic forwarding is a path for mail to leave the organization: the ticket names the approver, the business reason and the narrowest unit that needs it. Read the current value as in E1 and write down `[NOT_BEFORE]` now.

<!-- SAFETY GATE [gws-security-posture-forwarding-allow-portal] -->
- **Target:** [OU_PATH]
- **Effect:** allow users in one organizational unit to forward their mail automatically to another address
- **Scope:** every user in [OU_PATH] and the child units that inherit from it; each user can then set up forwarding of their own mail, including to addresses outside [@Aegion_DOMAIN]
- **Reversibility:** R3: clear the tick again under its own phrase (E1), or click Inherit on a child unit; forwarding that users set up while it was allowed is the clean-up list, because the lane's sources do not confirm that turning it off stops it at once
- **Required confirmation:** Type exactly `ALLOW AUTOMATIC FORWARDING FOR OU [OU_PATH]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-security-posture-forwarding-allow-portal]:** Only after the approver and the business reason are in the ticket and the exact match:
1. Admin console → Apps → Google Workspace → Gmail → End User Access → pick `[OU_PATH]` on the left → **Automatic forwarding** → **Allow users to automatically forward email to another address** (tick it) → **Save** (on a child unit, **Override**).

**WAIT UNTIL** the panel for `[OU_PATH]` shows the box ticked. The panel is the proof, as in E1.

Supporting evidence only: the read below lists your Admin console changes since `[NOT_BEFORE]`. Note in the ticket the event whose parameters carry `[OU_PATH]`, with its name, or note that none does; either way the panel decides.

```bash
# read-only: every Admin console change [UPN] made since [NOT_BEFORE], with each event name and its parameters, supporting evidence only
node scripts/adapters/gws-client.js activities --app admin --user [UPN] --start [NOT_BEFORE] --execute
```

**Verification checkpoint:** [ ] the panel shows the box ticked for `[OU_PATH]` only (the proof) · [ ] the admin event whose parameters carry `[OU_PATH]` noted with its name, or its absence noted · [ ] the approver and the reason are in the ticket.

### E3: Block a third-party app for a unit

**Role needed:** Super Admin. The lane's sources leave the privilege for API controls unclear (one search excerpt mentions Service Settings), so take the safer reading and use a Super Admin.

Read first: Admin console → Security → Access and data control → API controls → Manage Third-Party App Access → find `[APP_NAME]` → note its client ID `[APP_ID]` and its current access level (Trusted, Limited or Blocked) for `[OU_PATH]`. Count its users from the Phase C token events. Write down `[NOT_BEFORE]` now.

<!-- SAFETY GATE [gws-security-posture-app-block-portal] -->
- **Target:** [APP_NAME] with OAuth client ID [APP_ID], in [OU_PATH]
- **Effect:** block one third-party app from Google Workspace data for one organizational unit
- **Scope:** every user in [OU_PATH] who uses [APP_NAME]; other apps and other units do not change
- **Reversibility:** R3: set the access level captured above back for the same scope, under its own phrase
- **Required confirmation:** Type exactly `BLOCK THIRD-PARTY APP [APP_NAME] ID [APP_ID] IN OU [OU_PATH]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-security-posture-app-block-portal]:** Only after the current access level, the user count and the approver are in the ticket and the exact match:
1. Admin console → Security → Access and data control → API controls → Manage Third-Party App Access → `[APP_NAME]` → **Change access** → scope `[OU_PATH]` → **Blocked** → confirm (the labels come partly from a search excerpt: confirm them on screen, and stop if they differ).

**WAIT UNTIL** the app list shows `[APP_NAME]` as Blocked for `[OU_PATH]`. The app list is the proof: Google's event name for an API controls change is not in the lane's sources, so no `verify-*` read can prove it.

Supporting evidence only: the reads below list the OAuth events and your Admin console changes since `[NOT_BEFORE]`. Note in the ticket the admin event whose parameters carry `[APP_ID]` or `[OU_PATH]`, with its name, or note that none does; OAuth events can take a few hours to appear (search excerpt). Either way the app list decides.

```bash
# read-only: OAuth events since [NOT_BEFORE], grants for the blocked app should now fail, supporting evidence only
node scripts/adapters/gws-client.js activities --app token --user all --start [NOT_BEFORE] --execute
# read-only: every Admin console change [UPN] made since [NOT_BEFORE], with each event name and its parameters, supporting evidence only
node scripts/adapters/gws-client.js activities --app admin --user [UPN] --start [NOT_BEFORE] --execute
```

**Verification checkpoint:** [ ] the app list shows Blocked for `[OU_PATH]` (the proof) · [ ] the admin event whose parameters carry `[APP_ID]` or `[OU_PATH]` noted with its name, or its absence noted.

### Changes this runbook only previews

> **PREVIEW ONLY [gws-security-posture-app-trust-preview]:** Planning only: nothing here authorizes a change. Setting an app to Trusted or Limited opens access to Google Workspace data for every user in scope; it is a separate reviewed change with the app's scopes, its user count, the approver and the captured access level as its rollback.

> **PREVIEW ONLY [gws-security-posture-mobile-universal-preview]:** Planning only: nothing here authorizes a change. A Universal setting under Devices → Mobile & endpoints → Settings → Universal (for example Device approvals) applies to the whole device fleet; it needs the Mobile Device Management privilege, the current value captured, and its own reviewed change.

## Phase F: Save the report (local write, exact phrase)

**Purpose:** keep the dated report the ticket counts came from.

**Role needed:** none in Google; the write is one local file. The generator is its own gate: it writes only with the exact phrase its preview prints.

The generator writes only inside the folder it runs from: inside a Git checkout the report must be Git-ignored, and in a folder outside Git it needs `--standalone-private`. The report belongs in the folder from Inputs, outside any Git checkout, so run the generator from that folder. The exact phrase is bound to the report's content, so repeat the Phase C `--export` arguments unchanged and in the same order. The report name must start with `security-audit-gws-` and end with `.md`; `YYYY-MM-DD` below is the review date.

1. In the Aegis repository root, keep the generator's full path:

```bash
# local: stores the generator's full path in a shell variable for the two commands below, nothing is read or written
generator="$PWD/scripts/gws-posture-audit.js"
```

2. In the same terminal, change to the folder from Inputs, then preview and save:

```bash
# preview: writes nothing, prints the report target, its content SHA-256 and the exact phrase, then stops with "Exact confirmation mismatch" (exit 2), which is expected here
node "$generator" --standalone-private --export [FILE_NAME] --export [FILE_NAME] --write security-audit-gws-posture-YYYY-MM-DD.md
# writes one new local report only when the phrase matches exactly, and never over an existing file
node "$generator" --standalone-private --export [FILE_NAME] --export [FILE_NAME] --write security-audit-gws-posture-YYYY-MM-DD.md --confirm "THE EXACT PHRASE THE PREVIEW PRINTED"
```

If the generator refuses the target, read its reason and pick another name; never point it at an existing file.

**Verification checkpoint:** [ ] the generator reports the file written once · [ ] the ticket carries the counts and the report's location, not its rows.

## ⚠️ Risk warning

- **Allowing automatic forwarding (E2) or trusting an app opens a path for data to leave.** Name the approver and the reason, use the narrowest unit, and record the clean-up list if it is reversed.
- **Exports and reports hold real accounts.** They stay outside Git and outside the ticket; the ticket gets counts.
- **The audit is a snapshot.** User Reports lag up to 48 hours and OAuth events a few hours; the adapter's Directory reads are real time. Judge a fix by the read-back, not by the next report.
- **Unconfirmed reads fail quiet.** The users query syntax and the usage parameter names come from unconfirmed sources; an empty answer is not proof of a clean tenant, so compare it with the GAM export.
- **A blocked app can break a workflow** for every user of it in the unit; count its users first and tell them.
- **Super admin changes are not made here.** Removing or replacing a super admin belongs to the admin-roles runbook, where the new one is assigned before the old one is removed.

## ✅ Verification checklist

- [ ] Phase A: the report printed; each check's status or Admin console reading is noted.
- [ ] Phase B (if run): both exports exist outside Git and their `wc -l` counts are plausible; no row reached the ticket.
- [ ] Phase C: counts for super admins, 2-Step Verification gaps, forwarding, third-party apps and devices are in the ticket.
- [ ] Phase D: the ranked fix list names the runbook that owns each gate.
- [ ] Phase E (if run): the panel or app list shows the new value (the proof); for each change, the admin event that carries the unit or the app is noted with its name, or its absence is noted.
- [ ] Phase F (if run): the generator reported one new report written; its location is in the ticket.
- [ ] The Linear comment is proven by `verify-comment` (below).

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise write the partial-state form naming what is verified, what is pending and the next owner.

> [Completed, only if every read-back passed] Google Workspace posture review, [date/time UTC], generator `scripts/gws-posture-audit.js` checked against sources dated [date]. Counts: [N] super admins ([N] groups or service accounts), [N] users and [N] admins not enrolled in 2-Step Verification, automatic forwarding allowed in [N] units, [N] third-party apps with broad access, [N] devices reported compromised or unencrypted; less secure apps: retired. Fix order: [1 ... 8, each with its owning runbook]. Changes made here by an administrator after the exact phrase: [forwarding turned off for `[OU_PATH]` / allowed for `[OU_PATH]`, approved by [approver] / `[APP_NAME]` blocked in `[OU_PATH]` / none]. Read-back: [panel / app list] shows the new value (the proof) at [time]; admin event [name] carrying [the unit / the app] seen in the activities read, or none found. Report saved at [location outside Git]. Time spent: [X] min.
>
> [Partial state] Verified: [checks and read-backs that passed]. Pending: [read-back, report lag or approval]. Next owner: [ADMIN_NAME]. No other change was made.

An administrator posts the note as a comment on [ISSUE_ID] in Linear, after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the exact note, its SHA-256 digest ([NOTE_SHA256]) and the posting steps without credentials or network; Aegis never posts it. Write down [NOT_BEFORE] just before posting, then prove the comment:

```bash
# read-only: passes only if a comment created after [NOT_BEFORE] carries exactly the prepared note
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

A posture audit is a ranking problem, not a checklist: the one account that can change every setting outranks every setting, which is why super admin hygiene comes before forwarding, apps or sharing.

## Career upgrade

Turning a vendor's settings into dated checks with a source, a read command and a status is how security posture management tools work; doing it by hand teaches you what those tools can and cannot see.

## Next action

Run `node scripts/gws-posture-audit.js` and note which checks need a GAM export or an Admin console reading before you export anything.

**Sources (checked 2026-10-27):** knowledge.workspace.google.com/admin/users/security-best-practices-for-administrator-accounts (search excerpt: more than one super admin, separate daily account, super admin recovery default and path) · support.google.com/a/answer/9807615 (search excerpt: Account → Admin roles) · support.google.com/a/answer/6000269 (search excerpt: User Reports → Security, 2-Step Verification columns, up to 48 hours lag) · support.google.com/a/answer/14724207 (search excerpt: automatic forwarding path, on by default, Gmail Settings privilege) · knowledge.workspace.google.com/admin/apps/control-which-third-party-and-internal-apps-access-google-workspace-data (search excerpt: API controls, Manage Third-Party App Access, Trusted, Limited, Blocked) · support.google.com/a/answer/6328676 (search excerpt: Universal settings, Mobile Device Management privilege) · support.google.com/a/answer/7532105 (search excerpt: Security health privileges and editions) · support.google.com/a/answer/14114704 (search excerpt: less secure apps settings removed June 15 2024) · support.google.com/a/answer/7061566 (search excerpt: retention cannot be changed, lag times) · developers.google.com/admin-sdk/reports/v1/reference/usage-ref-appendix-a/customers-accounts (search excerpt: the 2-Step Verification usage parameter names) · raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json (vendor repo: user fields isEnrolledIn2Sv, isEnforcedIn2Sv, isAdmin, roles, role assignments, mobile and ChromeOS devices, the security scope that also grants writes) · raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json (vendor repo: activities for admin and token, customer usage reports, dates in UTC-8) · raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md, Administrators.md, Users-Tokens.md and Reports.md (project wiki: GAM read syntax and CSV columns; GAM is a community tool, not a Google product) · docs/aegis/lanes/g2.md (the read-only adapter surface).
