---
description: Transfer a Google Workspace user's Drive files (and, as a separate gate, their future calendar events) to a new owner — R2 with the pre-state captured first, because the vendor documents no undo. Placeholders only.
disable-model-invocation: true
---

# /gws-drive-transfer

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the current owner) · `[MANAGER_UPN]` (the new owner — an active account in the same organization) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **R2 — pre-state first.** The vendor page documents no undo for a completed transfer; the only record of what moved is the pre-state you capture in Phase 1: the owner's status, the owned-file count and the shared-item count.
- The previous owner keeps edit access to the transferred files unless their account is deleted or their permissions are changed — the transfer changes ownership, not access.
- Hard limits: the recipient must be in the organization, active (not suspended, archived or deleted), have enough storage and have Drive turned on; the source must not be on litigation hold for any service and must not already be deleted; no transfers to or from external accounts; items in Trash are not transferred; a transfer running longer than 36 hours stops unsuccessfully and must be started again; shared-drive files are unaffected (the organization owns them).
- Calendar events are a **separate gate** with their own limits (future, non-private events only; private events are cancelled).
- Needs the Drive & Docs administrator privilege (Calendar administrator privilege for Phase 3).
- Not done until the read-backs in the final checklist pass.

## Inputs needed

- `[USER@DOMAIN.COM]` (source) and `[MANAGER_UPN]` (recipient).
- Whether the source has any Vault hold — **[org gap — confirm in Vault before Phase 2]**; a user on litigation hold cannot have data transferred.
- Whether the account is being closed afterwards (then `/gws-offboard` owns the suspend and delete gates; this runbook only moves data) and whether future calendar events must move too.

## How the systems hang together

- The Admin console transfer moves ownership of what the user owns in My Drive. A transfer folder is created in the new owner's My Drive holding the transferred folders and files, any transferred Computers folders from a Drive sync client, and shortcuts to files whose parent folders are not shared with the new owner. A file that sits in someone else's My Drive but is owned by the source changes owner yet stays where it is.
- Transferring files does not affect who has access to them. Ownership history stays in the file's version history and, for recent changes, in Drive log events.
- The new owner, the previous owner and the admin who started the transfer each get a confirmation email when it completes.
- GAM offers two different routes: its own per-file transfer (`transfer drive`, where by default the source keeps **no** access — unlike the console) and Google's data-transfer service (`create datatransfer`, where the default privacy level moves **shared** files only; `all` moves everything).

## Fast path

1. Phase 1 — capture the pre-state: both accounts' status, owned-file count, shared-item count, Vault hold check (R0).
2. Phase 2 — transfer Drive ownership (R2 gate). **WAIT UNTIL** the confirmation email arrives and the counts move.
3. Phase 3 — transfer future calendar events (separate R2 gate). **WAIT UNTIL** the new secondary calendar appears for the new owner.
4. Phase 4 — read back, record, hand the account to `/gws-offboard` if it is being closed.

## Phase 1 — Pre-state (R0)

**Purpose** — the only rollback record there will be.

1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status (active or suspended) and the organizational unit.
2. Admin console → Directory → Users → `[MANAGER_UPN]` → read the status; it must be **Active** (not suspended, archived or deleted).
3. Admin console → Apps → Google Workspace → Drive and Docs → pick `[MANAGER_UPN]`'s organizational unit in the tree on the left → read that Drive is turned on for that unit; confirm the recipient has enough storage (the Drive transfer page links the storage page).
4. Vault: confirm no hold applies to `[USER@DOMAIN.COM]` for any service (the transfer page links "review holds in Vault"). A hold blocks the transfer.
5. Ask the source user (if still active) to move anything they want transferred out of Trash and, for unorganized files, to search Drive for `is:unorganized` plus their own address and move the hits into My Drive. Ask the new owner not to add files during the transfer.

```bash
# read-only: both accounts' status, organizational unit and admin flags before any change
gam info user "[USER@DOMAIN.COM]" fields suspended,archived,ou,isadmin   # the source must not be deleted; suspended is allowed
gam info user "[MANAGER_UPN]" fields suspended,archived,ou   # the recipient must be active: neither suspended nor archived
# read-only: how many files the source owns today, excluding Trash (the pre-state for the transfer)
gam user "[USER@DOMAIN.COM]" print filecounts excludetrashed showsize   # owned-file count by type plus total size
# read-only: how many of those files are shared with others, and with whom at a glance
gam user "[USER@DOMAIN.COM]" print filesharecounts excludetrashed   # Shared, Shared External and Shared Internal counts
# read-only: the list of owned files that carry a non-owner permission (the shared items), one row per file
gam user "[USER@DOMAIN.COM]" print filelist fields id,name,basicpermissions pm not role owner em excludetrashed   # keep this CSV with the ticket
# read-only: the recipient's file count before the transfer, to compare afterwards
gam user "[MANAGER_UPN]" print filecounts excludetrashed   # baseline for the new owner
```

**Verification checkpoint** — [ ] both statuses recorded · [ ] owned-file count and shared-item count (and the shared-items CSV) attached to the ticket · [ ] no Vault hold · [ ] recipient's baseline count recorded.

**Gotcha** — the vendor's own Step 1 suggests suspending the source account during the transfer so they cannot create or move content meanwhile. Suspension is its own gated action (`/gws-offboard` holds it); do it there if the ticket calls for it, and restore the account afterwards if it stays.

## Phase 2 — Transfer Drive ownership (R2)

**Purpose** — move ownership of everything the user owns in My Drive to `[MANAGER_UPN]`, with the pre-state already recorded.

<!-- SAFETY GATE [gws-drive-transfer-drive-portal] -->
- **Target:** [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new owner)
- **Effect:** transfer ownership of the user's My Drive files to the new owner; Trash is skipped
- **Scope:** files owned by one user; shared-drive files are not touched; access lists stay as they are, so the previous owner keeps edit access unless removed later
- **Reversibility:** R2 — not reversible from the Admin console; no undo is documented; a reverse transfer in the other direction is a new R2 with its own pre-state, and the Phase 1 counts plus the shared-items CSV are the only record of what moved
- **Required confirmation:** Type exactly `TRANSFER DRIVE OWNERSHIP FROM [USER@DOMAIN.COM] TO [MANAGER_UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-drive-transfer-drive-portal]:** Only after the Phase 1 pre-state is in the ticket and the exact match:
1. Admin console → Apps → Google Workspace → Drive and Docs → **Transfer ownership**.
2. For **From user** enter `[USER@DOMAIN.COM]` and pick it from the results; for **To user** enter `[MANAGER_UPN]` and pick it from the results.
3. Click **Transfer Files**. An error here means one of the two accounts fails the criteria in the safety gate above — fix the account state, never force it.

**WAIT UNTIL** the confirmation email reaches the new owner, the previous owner and you. Large transfers take time to show; one that runs longer than 36 hours stops unsuccessfully and must be started again.

**Verification checkpoint** — [ ] confirmation email received · [ ] a transfer folder exists in `[MANAGER_UPN]`'s My Drive · [ ] `gam user "[MANAGER_UPN]" print filecounts excludetrashed` rose by about the Phase 1 count.

## Phase 3 — Transfer future calendar events (separate R2)

**Purpose** — keep the user's future meetings and room bookings under an organizer who can still change them.

<!-- SAFETY GATE [gws-drive-transfer-calendar-portal] -->
- **Target:** [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new organizer)
- **Effect:** transfer the user's future non-private primary-calendar events to the new organizer; private events are cancelled
- **Scope:** future, non-private events on the primary calendar with at least one guest or resource; past events and secondary calendars do not move; the dialog's Release resources box is a different outcome (rooms freed, events not transferred) and is not what this gate authorizes
- **Reversibility:** R2 — not reversible from the Admin console; a user on litigation hold has nothing transferred; record the upcoming-event count with the user first
- **Required confirmation:** Type exactly `TRANSFER CALENDAR EVENTS OF [USER@DOMAIN.COM] TO [MANAGER_UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-drive-transfer-calendar-portal]:** Only after the exact match:
1. Admin console → Apps → Google Workspace → Calendar → **Event and Secondary calendar management** → **Events transfer** → enter `[USER@DOMAIN.COM]`.
2. Tick **Transfer events to other user** → enter `[MANAGER_UPN]` → **Transfer Events** → **Done**.

**WAIT UNTIL** the transfer runs: it starts approximately 10 minutes later and can last 15 minutes. Afterwards a new secondary calendar with the former user's events appears in `[MANAGER_UPN]`'s calendar list.

**Verification checkpoint** — [ ] the new secondary calendar is in `[MANAGER_UPN]`'s list · [ ] a sample future event shows the new organizer.

## Phase 4 — Read back and hand off

**Purpose** — prove the data moved and leave the account to the right runbook.

1. Admin console → Reporting → Audit and investigation → Admin log events → the ownership transfer appears with your admin as the actor and the time.
2. Admin console → Reporting → Audit and investigation → Drive log events → recent ownership changes for the transferred files list `[MANAGER_UPN]` as the new owner.
3. If the previous owner must lose edit access to the transferred files, that is a separate permissions change (or the offboarding delete) — not part of this runbook.
4. If the account is being closed, continue in `/gws-offboard` with the Phase 1 counts attached; if it stays, restore it if it was suspended for the transfer.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

Two routes, different defaults: GAM's own per-file transfer leaves the source with **no** access unless `retainrole` says otherwise (the console leaves edit access), and places the files in a subfolder of the new owner's root named after the source. Its `preview` word writes a CSV of OldOwner, NewOwner, type, id, title without transferring anything — a previewed line is still a mutation and stays inside its gate. Google's data-transfer service (second fence) moves **shared** files only by default; `all` moves every file.

```bash
# HUMAN-RUN — the administrator runs this in their own terminal; Aegis never does
# SAFETY GATE [gws-drive-transfer-drive]
# Target: [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new owner)
# Effect: transfer ownership of every file the user owns (Trash excluded) to the new owner
# Scope: one source user; files land in a subfolder of the new owner's My Drive; the source keeps no access by default
# Reversibility: R2 — not reversible; the Phase 1 counts and the shared-items CSV are the only record
# Required confirmation: type exactly `TRANSFER DRIVE OWNERSHIP FROM [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="TRANSFER DRIVE OWNERSHIP FROM [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam user "[USER@DOMAIN.COM]" transfer drive "[MANAGER_UPN]"   # transfers every owned file (not Trash) to the new owner
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam user "[USER@DOMAIN.COM]" print filecounts excludetrashed   # read-back: the source's owned-file count should be near zero
gam user "[MANAGER_UPN]" print filecounts excludetrashed   # read-back: the new owner's count rose by about the Phase 1 figure
```

```bash
# HUMAN-RUN — Google's data-transfer service; "all" is deliberate (the default moves shared files only)
# SAFETY GATE [gws-drive-transfer-datatransfer]
# Target: [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new owner)
# Effect: transfer ownership of every Drive file the user owns (shared or not) to the new owner
# Scope: one source user; a transfer folder is created in the new owner's My Drive; the previous owner keeps edit access
# Reversibility: R2 — not reversible from the Admin console; the Phase 1 counts are the only record
# Required confirmation: type exactly `TRANSFER ALL DRIVE FILES FROM [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="TRANSFER ALL DRIVE FILES FROM [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam create datatransfer "[USER@DOMAIN.COM]" drive "[MANAGER_UPN]" all   # starts the transfer and prints its transfer ID
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam print datatransfers oldowner "[USER@DOMAIN.COM]"   # read-back: the transfer and its status (inprogress, completed or failed)
```

```bash
# HUMAN-RUN — future calendar events through the same data-transfer service (its own gate)
# SAFETY GATE [gws-drive-transfer-calendar]
# Target: [USER@DOMAIN.COM] (source) and [MANAGER_UPN] (new organizer)
# Effect: transfer the user's future non-private calendar events to the new organizer
# Scope: future non-private events with at least one guest or resource; past events and secondary calendars do not move
# Reversibility: R2 — not reversible from the Admin console; record the upcoming-event count first
# Required confirmation: type exactly `TRANSFER CALENDAR EVENTS OF [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="TRANSFER CALENDAR EVENTS OF [USER@DOMAIN.COM] TO [MANAGER_UPN] WITH GAM"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam create datatransfer "[USER@DOMAIN.COM]" calendar "[MANAGER_UPN]"   # starts the calendar transfer; booked resources are kept by default
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam print datatransfers oldowner "[USER@DOMAIN.COM]"   # read-back: both transfers and their status
```
</details>

## ⚠️ Risk warning

- **No documented undo.** Once ownership moves, the only way back is a new transfer in the other direction with its own pre-state — capture Phase 1 before anything else.
- **The previous owner still edits** every transferred file until their account is deleted or their permissions change; a "transfer" is not a lock-out.
- **Trash is skipped** and, if the user is later deleted, untransferred files in Trash are deleted with them. Files inside shared drives never move — the organization already owns them.
- **Calendar: private events are cancelled**, past events and secondary calendars stay behind. A litigation hold silently transfers nothing.
- The 36-hour ceiling is a failure, not a pause: a transfer past it stops and must be restarted.

## ✅ Verification checklist

- [ ] Phase 1 pre-state in the ticket: both statuses, `gam user "[USER@DOMAIN.COM]" print filecounts excludetrashed` total, `print filesharecounts` Shared total, the shared-items CSV, no Vault hold.
- [ ] Confirmation email received; `gam print datatransfers oldowner "[USER@DOMAIN.COM]"` (GAM route) or the transfer folder in `[MANAGER_UPN]`'s My Drive (console route) shows the transfer completed.
- [ ] `gam user "[MANAGER_UPN]" print filecounts excludetrashed` rose by about the Phase 1 count and `[MANAGER_UPN]` opened a sample transferred file.
- [ ] Calendar (if run): the new secondary calendar is in `[MANAGER_UPN]`'s list and a sample future event shows the new organizer.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the transfer with the expected admin and time.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Transferred Drive ownership from `[USER@DOMAIN.COM]` to `[MANAGER_UPN]` on [date/time], confirmed by exact phrase. Pre-state: [N] owned files ([size]), [M] shared items (CSV attached), no Vault hold, recipient active. Transfer [console / GAM transfer ID]; confirmation email received [time]; new owner's count rose to [count]; sample file opened. Calendar events [transferred — new secondary calendar visible / not in scope]. Previous owner retains edit access per vendor behaviour; [account handed to offboarding / account remains active]. Time spent: [X] min.

## Aha moment

An ownership transfer is a data-custody change, not an access change: the files get a new owner, every existing permission stays, and nothing writes a "before" picture for you — the pre-state you capture is the rollback.

## Career upgrade

Treating "no documented undo" as a requirement to capture state before acting is the same reflex as snapshotting before a migration — the habit that makes irreversible operations safe to own.

## Next action

Start Phase 1 after confirming there is no Vault hold on `[USER@DOMAIN.COM]` and that `[MANAGER_UPN]` is active.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/drive/transfer-drive-files-to-a-new-owner-as-an-admin · knowledge.workspace.google.com/admin/calendar/cancel-or-transfer-events-or-secondary-calendars-before-deleting-a-user · knowledge.workspace.google.com/admin/users/delete-or-remove-a-user-from-your-organization (litigation hold, shared drives) · knowledge.workspace.google.com/vault/holds/get-started-with-holds-in-google-vault · knowledge.workspace.google.com/admin/reports/drive-log-events · knowledge.workspace.google.com/admin/reports/admin-log-events · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users-Drive-Transfer, Google-Data-Transfers, Users-Drive-Files-Display and Users pages; GAM is an open-source tool, not a Google product).
