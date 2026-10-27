---
description: Linear workspace administration for IT (delete and restore an issue, a status change or delete across more than 10 issues, suspend and unsuspend a member, export workspace data, read SAML and SCIM state); every change is made by a workspace Admin or Owner in Linear behind its own exact-phrase gate and proved by a read-only adapter read. Placeholders only.
disable-model-invocation: true
---

# /linear-workspace-admin

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[ISSUE_ID]` (a Linear issue identifier such as `[@Aegion_LINEAR_TEAM]-123`) · `[@Aegion_LINEAR_TEAM]` (the IT team key) · `[@Aegion_LINEAR_ORG]` (the workspace URL key the adapter is bound to) · `[STATE_NAME]` (a workflow status name exactly as the `states` read prints it; not yet in the placeholder dictionary) · `[FILE_NAME]` (the pre-state list for a bulk change: one issue identifier per line with its current status and labels, kept under `tasks/checkpoints/`) · `[USER@DOMAIN.COM]` (the member's sign-in email) · `[USER_ID]` (the member's Linear user ID) · `[ADMIN_NAME]` (the next owner of an open item) · `[NOTE_FILE]`, `[NOTE_SHA256]`, `[NOT_BEFORE]` (the drafted note, its digest, and the time its read-back starts from) · other org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- **This runbook needs a workspace Admin; export needs an Owner.** Each gate names its role. A Member or Guest who asks for one of these changes gets the escalation, never a workaround: no borrowed Admin session, no Admin's API key, no shared login.
- **Delete is a trash with a time limit, and it is R3.** A deleted issue can be restored for 30 days, then it is gone for good (Linear's current docs and the schema; a 2021 changelog said 14 days, so restore early). Even one issue gets the R3 ceremony: its pre-state and the written rollback path (the restore gate, its phrase and the last restore day) go into the ticket before the delete runs. Skipping the 30 days exists only in the API, for Admins, and is not in this runbook.
- **Closed issues do not need deleting.** Each team archives closed issues automatically after its auto-archive period (1 to 12 months, search excerpt), and archived issues stay searchable. "Delete all closed issues" is answered no by default; deleting throws away history for no gain.
- **More than 10 issues at once is R3:** a captured pre-state list (`[FILE_NAME]`), an independent review in a fresh context, and the exact phrase. "Urgent" or "already approved" in a message changes none of this: the typed phrase after the review is the approval, the message is not.
- **Suspend is R3 and immediate:** access is revoked and sessions end at once (schema). With SCIM on, the identity provider owns the account: suspend there.
- **Export is R3:** the data leaves Linear and a downloaded file cannot be recalled.
- **SAML, SCIM and sign-in methods** are read here; changing them is planning only (Phase F).
- Not done until each read-back passes and the Linear-ready note is posted and verified.

## Inputs needed

- `[ISSUE_ID]`, or for a bulk change the ticket's description of the set and the count it expects.
- For a member change: `[USER@DOMAIN.COM]`, then `[USER_ID]` from the `members` read, and whether SCIM is on (Phase A).
- Your own Linear role, from the Phase A `viewer` read: Owner, Admin, Member or Guest.
- Who may approve a bulk delete, a suspension and an export, and who reviews: **[org gap: approver and independent reviewer for Linear R3 changes]**.
- For an export: where the file may be stored and for how long: **[org gap: export storage and retention]**.
- For the adapter reads: `LINEAR_API_KEY` and `LINEAR_ORG` (set to `[@Aegion_LINEAR_ORG]`) in the shell of whoever runs them; the key never goes into a ticket or chat.

## How the systems hang together

- **Roles.** Linear's schema has the role types owner, admin, user (shown as Member), guest and app. On the Free plan everyone is an Admin, and role types can be changed only on paid plans (search excerpt). Linear's pages list the roles differently (Admin, Member, Guest against Owner, Admin, Member, Guest); this runbook follows the schema.
- **Delete against archive.** Delete puts an issue in its team's Recently deleted issues for 30 days; `Cmd/Ctrl Z` undoes it at once (search excerpt). Archiving is automatic per team and has no manual button any more (search excerpt). Underneath, the API's `issueDelete` trashes, and `issueArchive` with `trash` set trashes too; the adapter refuses both.
- **Bulk changes.** Linear selects many issues with the checkbox, Shift-click, Shift and the arrow keys, or `Cmd/Ctrl A`, then acts on them through `Cmd/Ctrl K` or a right-click (search excerpt). The API's `issueBatchUpdate` takes at most 50 ids (schema). No bulk undo is documented, which is why the pre-state list exists.
- **Members.** The Members page under Settings and Administration lists active and suspended members; suspending removes access at once and drops the member from the next billing cycle, and the member stays in the list (search excerpt). The schema's `userSuspend` says it "can only be called by a workspace admin or owner"; `userUnsuspend` has the same rule; an internal `forceBypassScimRestrictions` argument overrides the identity provider and is never used.
- **SAML and SCIM.** Both are Enterprise only. With SAML on, members must sign in through SAML while admins can still use other methods; SCIM needs Enterprise, SAML and Linear turning it on, and after that users are managed only in the identity provider (search excerpt). The security page appears at three paths on three Linear pages: Settings → Administration → Security, Settings → Workspace → Security and Settings → Security; use whichever your workspace shows.
- **Exports.** The full workspace CSV export sits under Settings → Administration → Import Export, for Owners (whether only on Enterprise is unclear), with a toggle for private teams, and the export is recorded in the audit log (search excerpt).
- **The adapter** (`node scripts/adapters/linear-client.js`) reads `viewer`, `issue`, `states` and `members`, and proves a person's change with `verify-trashed`, `verify-state` and `verify-suspended`. It has no read for SAML, SCIM, exports or the audit log, so those read-backs are in Linear.
- **How the vendor facts were read:** Linear's documentation site could not be opened from this session on 2026-10-27, so menu labels, plan tiers and windows come from Linear's pages as indexed by a web search that day ("search excerpt"): confirm each label on screen. Field names and the role rules quoted from the schema come from Linear's published GraphQL schema.

## Fast path

1. Phase A: read your role, the member, the issue and the security settings (R0). The person who makes the change is not a workspace Admin (Owner for export): stop and escalate, whatever the key's role.
2. Phase B: one issue: delete (R3 gate, after the written rollback path is in the ticket), or restore within the window (R1 gate). Faster permanent removal is planning only.
3. Phase C: more than 10 issues: decide whether the change is needed at all, capture `[FILE_NAME]`, get the independent review, then the bulk status gate or the bulk delete gate (R3).
4. Phase D: suspend a member (R3 gate) or unsuspend (R2 gate); with SCIM on, the identity provider instead.
5. Phase E: export workspace data (R3 gate, Owner).
6. Phase F: SAML, SCIM and sign-in methods: read only; changes are planning only.
7. Post the Linear-ready note on the ticket's issue and run its read-back.

## Phase A: Read who you are and what you are changing (R0)

**Purpose:** confirm the role before any gate, and record the pre-state the gates need.

1. Linear → Settings → Administration → Members → find your own row → read your role; then find `[USER@DOMAIN.COM]` → read the role and the status, Active or Suspended (search excerpt).
2. Linear → Settings → Security → read whether SAML and SCIM are on (the same page may sit at Settings → Administration → Security or Settings → Workspace → Security; Enterprise only; search excerpt).
3. Linear → `[ISSUE_ID]` → read the status, the attachments and the linked issues: what a delete would take with it.
4. Linear → `[@Aegion_LINEAR_TEAM]` team settings → Workflow → read the auto-archive period for closed issues (search excerpt).

<details>
<summary>The scale version: adapter reads for Phase A (HUMAN-RUN or Aegis, read-only)</summary>

```bash
# HUMAN-RUN or Aegis, read-only. LINEAR_API_KEY and LINEAR_ORG come from the shell environment, never from the ticket; without --execute a line only prints the query it would send
# the key's own user with its admin, owner and guest flags, and the workspace that answered; stop if it is not [@Aegion_LINEAR_ORG]
node scripts/adapters/linear-client.js viewer --execute
# every member, suspended ones included, with active, admin, guest and owner flags; note [USER_ID] for [USER@DOMAIN.COM]
node scripts/adapters/linear-client.js members --execute
# one issue: status, labels, archivedAt and trashed
node scripts/adapters/linear-client.js issue --issue [ISSUE_ID] --execute
# the team's statuses with their types, for [STATE_NAME]
node scripts/adapters/linear-client.js states --team [@Aegion_LINEAR_TEAM] --execute
```
</details>

**Stop if:** the person who will make the change is not a workspace Admin (an Owner for the export), whatever the key's role. Each change is made in Linear's GUI as that person, so their own role (step 1, or the `viewer` read when the key is their own) is the one that counts; the key's role never stands in for it. A key whose user is not that person is itself a stop: no borrowed Admin key (Admin / safety gate above). Every gate below needs a workspace Admin (export needs an Owner). Escalate with `/escalation-note` to a workspace Admin, attaching the ticket; there is no Member-level route.

**Verification checkpoint:** [ ] your role, the member's role and status, SAML and SCIM state, and the issue's pre-state are in the ticket.

## Phase B: One issue: delete, or restore (R3 / R1)

**Purpose:** remove one issue that must not stay (spam, a test, a ticket holding pasted personal data or a secret), keeping the 30-day way back.

Before the gate: a request that is only a duplicate or a mistake keeps its history better as a duplicate or a decline in triage than as a delete.

**R3 before step 1:** write two things in the ticket. The pre-state: the Phase A `issue` read of `[ISSUE_ID]` (status, labels, attachments, linked issues). The written rollback path: the restore gate below, its phrase `RESTORE LINEAR ISSUE [ISSUE_ID]`, and the last restore day (30 days after the delete; plan on 14 to be safe).

<!-- SAFETY GATE [linear-workspace-admin-delete-portal] -->
- **Target:** [ISSUE_ID]
- **Effect:** delete one issue; Linear puts it in the team's Recently deleted issues
- **Scope:** one issue with its comments and attachments; it leaves every view, search result and default API list
- **Reversibility:** R3 (a delete): restorable from Recently deleted issues for 30 days (current docs and the schema; a 2021 changelog said 14, so restore within 14 days to be safe), then permanently removed; `Cmd/Ctrl Z` undoes it at once (search excerpt); the written rollback path is the restore gate below
- **Required confirmation:** Type exactly `DELETE LINEAR ISSUE [ISSUE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** Linear's pages as indexed do not say which role may delete an issue (unverified); take the safer reading and have a workspace Admin delete it.

**PORTAL ACTION [linear-workspace-admin-delete-portal]:** Only after the Phase A read of `[ISSUE_ID]` and the written rollback path (the restore gate, its phrase and the last restore day) are in the ticket, and the exact match:
1. Linear → `[ISSUE_ID]` → the issue's contextual menu → **Delete issue** (or `Cmd/Ctrl Delete`; search excerpt).
2. Confirm the dialog if Linear shows one.

```bash
# read-only read-back: exits 0 only when [ISSUE_ID] is in the trash
node scripts/adapters/linear-client.js verify-trashed --issue [ISSUE_ID] --execute
```

GUI read-back: Linear → `[@Aegion_LINEAR_TEAM]` team → Archives → Recently deleted issues lists `[ISSUE_ID]` (search excerpt). Write the date 30 days on (14 to be safe) in the ticket as the last restore day.

<!-- SAFETY GATE [linear-workspace-admin-restore-portal] -->
- **Target:** [ISSUE_ID]
- **Effect:** restore one deleted issue from Recently deleted issues
- **Scope:** one issue, back in its team with its comments and attachments; possible only inside the restore window; restoring the issues of a bulk delete (more than 10) is not a run of this gate alone but the bulk restore named in Phase C, its own R3 change, inside which each issue is restored under this phrase
- **Reversibility:** R1: deleting it again under the delete phrase
- **Required confirmation:** Type exactly `RESTORE LINEAR ISSUE [ISSUE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** the same as for the delete: not stated by Linear (unverified), so a workspace Admin.

**PORTAL ACTION [linear-workspace-admin-restore-portal]:** Only after the exact match, and before the restore window ends:
1. Linear → `[@Aegion_LINEAR_TEAM]` team → Archives → Recently deleted issues → `[ISSUE_ID]` → **Restore** (search excerpt; the control's exact label is unverified).

```bash
# read-only read-back: the issue reads trashed false or null and archivedAt null again
node scripts/adapters/linear-client.js issue --issue [ISSUE_ID] --execute
```

> **PREVIEW ONLY [linear-workspace-admin-purge-preview]:** Planning only, not authorized here: removing an issue before its 30 days end exists only as an API argument (`issueDelete` with `permanentlyDelete: true`, "available only to admins" in the schema), has no undo, and has no path in Linear's pages as indexed. Aegis has no write path to it and this runbook does not run it. A request that truly needs it, such as a ticket holding a pasted credential that must be gone today, is its own reviewed change with the owner's sign-off; until then the gated delete plus the 30-day expiry is the deletion, and the pasted credential is rotated at its source.

**Verification checkpoint:** [ ] the pre-state and the written rollback path were in the ticket before the delete · [ ] `verify-trashed` exits 0 after a delete, or the `issue` read shows the issue back after a restore · [ ] the last restore day is in the ticket.

## Phase C: More than 10 issues at once (R3, after independent review)

**Purpose:** change or delete a large set of issues only when the change is needed, against a list captured first.

Decide first, in the ticket:
- **"Delete all closed issues":** no. Closed issues archive themselves after the team's auto-archive period (Phase A) and stay searchable; deleting them loses history and each one comes back only one at a time within the window. Changing the auto-archive period is a team setting and its own change.
- **"Move all closed issues to Done":** a closed issue is already in a completed or canceled status. Moving canceled issues to a completed status rewrites what happened (it says the work was done); confirm in the ticket which status types the set holds and why it should change.

Capture the pre-state (R0):
1. Linear → `[@Aegion_LINEAR_TEAM]` team → the issue list → filter to exactly the set the ticket names, for example status type completed or canceled (filter labels unverified) → read the count Linear shows.
2. Copy each identifier into `[FILE_NAME]` under `tasks/checkpoints/`, one per line, and run the `issue` read for each to record its status and labels beside it. The line count must equal the count the ticket expects; any other number, stop.
3. Hand the ticket, `[FILE_NAME]` and this phase to an independent reviewer in a fresh context (not the reasoning that produced them) and record the reviewer's sign-off.

<!-- SAFETY GATE [linear-workspace-admin-bulk-move-portal] -->
- **Target:** the issues listed in [FILE_NAME], team [@Aegion_LINEAR_TEAM], new status [STATE_NAME]
- **Effect:** move every issue listed in [FILE_NAME] to the status [STATE_NAME]
- **Scope:** exactly the issues in [FILE_NAME] (its line count, more than 10); whether notifications, integrations and automations react once per issue is not documented, so assume they do
- **Reversibility:** R3 (more than 10 objects): no bulk undo is documented; reversal is moving each issue back to the status recorded beside it in [FILE_NAME], as its own reviewed change
- **Required confirmation:** Type exactly `MOVE ISSUES LISTED IN [FILE_NAME] IN TEAM [@Aegion_LINEAR_TEAM] TO [STATE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** Linear documents no role for bulk edits (unverified); take the safer reading: a workspace Admin makes the change, after the independent review.

**PORTAL ACTION [linear-workspace-admin-bulk-move-portal]:** Only after the reviewer's sign-off is in the ticket and the exact match:
1. Linear → `[@Aegion_LINEAR_TEAM]` team → the filtered list from the pre-state step → tick exactly the issues in `[FILE_NAME]` (checkbox or Shift-click; `Cmd/Ctrl A` only when the list shows exactly that count).
2. Read the selection count Linear shows: it must equal the line count of `[FILE_NAME]`; any other number, stop and clear the selection.
3. Press `Cmd/Ctrl K` (or right-click) → the status command → `[STATE_NAME]` (search excerpt; the command's exact wording is unverified).

```bash
# read-only read-back, run once for each identifier in [FILE_NAME]: exits 0 only when that issue now sits in [STATE_NAME]
node scripts/adapters/linear-client.js verify-state --issue [ISSUE_ID] --state "[STATE_NAME]" --execute
```

GUI read-back: Linear → `[@Aegion_LINEAR_TEAM]` team → the list filtered on `[STATE_NAME]` shows every identifier from `[FILE_NAME]`. A failure part-way is an inconsistent state: record which identifiers passed and which did not, and stop.

<!-- SAFETY GATE [linear-workspace-admin-bulk-delete-portal] -->
- **Target:** the issues listed in [FILE_NAME], team [@Aegion_LINEAR_TEAM]
- **Effect:** delete every issue listed in [FILE_NAME]; Linear puts each one in Recently deleted issues
- **Scope:** exactly the issues in [FILE_NAME] (more than 10) with their comments and attachments
- **Reversibility:** R3: each issue is restorable for 30 days (14 by a 2021 changelog; restore early) with no documented bulk restore, then permanently removed; the written rollback path is a bulk restore of every identifier in [FILE_NAME], its own R3 change: [FILE_NAME] is its pre-state, it gets the independent review, each issue is restored under RESTORE LINEAR ISSUE [ISSUE_ID] and read back with the issue read, the restored count must equal the line count of [FILE_NAME], and it finishes before the last restore day
- **Required confirmation:** Type exactly `DELETE ISSUES LISTED IN [FILE_NAME] IN TEAM [@Aegion_LINEAR_TEAM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** Linear does not state which role may delete issues (unverified); take the safer reading: a workspace Admin, after the independent review.

**PORTAL ACTION [linear-workspace-admin-bulk-delete-portal]:** Only after the reviewer's sign-off is in the ticket, the ticket says why archiving is not enough, the written rollback path is in the ticket (a bulk restore of every identifier in `[FILE_NAME]`, its own R3 change: `[FILE_NAME]` is its pre-state, it gets the independent review, each issue is restored under `RESTORE LINEAR ISSUE [ISSUE_ID]` and read back with the `issue` read, the restored count must equal the line count of `[FILE_NAME]`, and it finishes before the last restore day), and the exact match:
1. Linear → `[@Aegion_LINEAR_TEAM]` team → the filtered list from the pre-state step → tick exactly the issues in `[FILE_NAME]`.
2. Read the selection count Linear shows: it must equal the line count of `[FILE_NAME]`; any other number, stop and clear the selection.
3. Press `Cmd/Ctrl K` → **Delete issue** (search excerpt: the command menu acts on the whole selection; its wording for several issues is unverified).

```bash
# read-only read-back, run once for each identifier in [FILE_NAME]: exits 0 only when that issue is in the trash
node scripts/adapters/linear-client.js verify-trashed --issue [ISSUE_ID] --execute
```

**Verification checkpoint:** [ ] every identifier in `[FILE_NAME]` passed its read-back · [ ] the reviewer's sign-off and the last restore day (for a delete) are in the ticket.

## Phase D: Suspend or unsuspend a member (R3 / R2)

**Purpose:** cut one member's access to the workspace now (a leaver, a compromised account), in a way that can be undone.

1. Linear → Settings → Administration → Members → `[USER@DOMAIN.COM]` → read the role and status; take `[USER_ID]` from the `members` read.
2. Linear → Settings → Security → read whether SCIM is on. **Stop if** it is: the identity provider owns the account. Suspend or deprovision it there (`/okta-user-lifecycle` or `/gws-offboard`), then **WAIT UNTIL** the identity provider's change reaches Linear (its timing is not documented on any page that could be read) and run the `verify-suspended` read-back below.
3. Linear → `[@Aegion_LINEAR_TEAM]` team → the issue list → filter on the member as assignee (filter labels unverified) → read their open issues and write in the ticket who takes each one.

<!-- SAFETY GATE [linear-workspace-admin-suspend-portal] -->
- **Target:** [USER@DOMAIN.COM], Linear user [USER_ID]
- **Effect:** suspend one Linear member; their sessions end and their access is revoked at once
- **Scope:** one member of workspace [@Aegion_LINEAR_ORG]; their issues, comments and assignments stay; they stay listed under Members as suspended and drop from the next billing cycle (search excerpt)
- **Reversibility:** R3 (a security control that acts at once): unsuspending restores access (the schema's `userUnsuspend`); with SCIM on, only the identity provider can
- **Required confirmation:** Type exactly `SUSPEND LINEAR MEMBER [USER@DOMAIN.COM] ID [USER_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** a workspace Admin or Owner in Linear (the schema's `userSuspend` can only be called by a workspace admin or owner). A Member or Guest cannot suspend anyone and there is no workaround: escalate to an Admin with `/escalation-note`.

**PORTAL ACTION [linear-workspace-admin-suspend-portal]:** Only after steps 1 to 3 are in the ticket and the exact match:
1. Linear → Settings → Administration → Members → `[USER@DOMAIN.COM]` row → `...` menu → **Suspend** (search excerpt).
2. Confirm the dialog.

```bash
# read-only read-back: exits 0 only when Linear user [USER_ID] reads active false
node scripts/adapters/linear-client.js verify-suspended --user [USER_ID] --execute
```

GUI read-back: Linear → Settings → Administration → Members → filtered on Suspended lists `[USER@DOMAIN.COM]`.

<!-- SAFETY GATE [linear-workspace-admin-unsuspend-portal] -->
- **Target:** [USER@DOMAIN.COM], Linear user [USER_ID]
- **Effect:** unsuspend one Linear member; their access returns
- **Scope:** one member of workspace [@Aegion_LINEAR_ORG]; they can sign in again with their existing issues and assignments
- **Reversibility:** R2: suspending again under the suspend phrase
- **Required confirmation:** Type exactly `UNSUSPEND LINEAR MEMBER [USER@DOMAIN.COM] ID [USER_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** a workspace Admin or Owner (the schema's `userUnsuspend` "can only be called by a workspace admin or owner", the same rule as `userSuspend`).

**PORTAL ACTION [linear-workspace-admin-unsuspend-portal]:** Only after the ticket says why access comes back and the exact match:
1. Linear → Settings → Administration → Members → filtered on Suspended → `[USER@DOMAIN.COM]` row → `...` menu → **Unsuspend** (the label is unverified: no Linear page that could be read names this control; if the menu shows none, stop and escalate).

```bash
# read-only read-back: the member list shows active true for [USER_ID]
node scripts/adapters/linear-client.js members --execute
```

**Verification checkpoint:** [ ] `verify-suspended` exits 0 after a suspend, or the `members` read shows active true after an unsuspend · [ ] the member's open issues have a named new owner.

## Phase E: Export workspace data (R3)

**Purpose:** a full CSV export for an audit or a migration; the data leaves Linear.

1. Read the ticket's reason. A question the adapter reads can answer does not need an export. A smaller export of one view through `Cmd/Ctrl K` (up to 250 issues, 2,000 for Admins, never for Guests; search excerpt) is still data leaving Linear and is not covered by this runbook.
2. Linear → Settings → Administration → Members → read that your role is Owner.

<!-- SAFETY GATE [linear-workspace-admin-export-portal] -->
- **Target:** Linear workspace [@Aegion_LINEAR_ORG]
- **Effect:** export the workspace's issue data as a CSV file; private teams are included only when the toggle is on
- **Scope:** every team the export covers, with issue ID, team, title, status, assignee, labels and more (search excerpt); assignee names make it personal data
- **Reversibility:** R3: not reversible; a downloaded file cannot be recalled, so where it is stored and when it is destroyed is the only control
- **Required confirmation:** Type exactly `EXPORT LINEAR WORKSPACE [@Aegion_LINEAR_ORG] DATA`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.

**Role needed:** a workspace Owner (Linear's exporting-data page as indexed says Owners; whether that holds on every plan or only Enterprise is unclear, search excerpt). An Admin who is not an Owner stops here.

**PORTAL ACTION [linear-workspace-admin-export-portal]:** Only after the reason and the storage location are in the ticket and the exact match:
1. Linear → Settings → Administration → Import Export → **Export**, with the private-teams toggle as the ticket decided, then confirm (search excerpt).
2. Keep the file only where the ticket names **[org gap]**; never in chat, a ticket or a shared drive.

**WAIT UNTIL** the CSV file is in hand: Linear's pages as indexed do not say whether it downloads at once or arrives later (unverified).

GUI read-back: the workspace audit log shows the export with your name and the time (search excerpt; the audit log page's label is unverified). No adapter read covers exports or the audit log.

**Verification checkpoint:** [ ] the file's location and its destroy-by date are in the ticket.

## Phase F: SAML, SCIM and sign-in methods (read only)

**Purpose:** answer "is SSO on, and who manages users" without changing it.

1. Linear → Settings → Security → read whether SAML and SCIM are on (also shown at Settings → Administration → Security or Settings → Workspace → Security; Enterprise only; search excerpt).
2. Linear → Settings → Administration → Security → read which sign-in methods are allowed: Google, email, passkey (search excerpt; the plan needed to restrict them is Business and Enterprise on one page and "Plus" on another, so treat it as unconfirmed).

> **PREVIEW ONLY [linear-workspace-admin-sso-preview]:** Planning only, not authorized from this runbook: turning SAML, SCIM or a sign-in method on or off can lock every member out at once. It is a change in two systems (the identity provider and Linear), so it needs its own change record, a tested rollback and an independent review in a fresh context. What Linear's pages say (search excerpt): with SAML on, admins keep their other sign-in methods as the way back in; SCIM needs Enterprise, SAML and Linear's own enablement, after which users are managed only in the identity provider and groups are not pushed; the SCIM bearer token shown under View configuration is a secret that never goes into a ticket or chat.

<details>
<summary>The scale version: what the API would do, and why this runbook does not (planning reference)</summary>

> **PREVIEW ONLY [linear-workspace-admin-api-preview]:** Planning reference only; nothing here authorizes a write. In Linear's GraphQL API the changes in this runbook are `issueDelete` (and `issueArchive` with `trash`), `issueUnarchive`, `issueBatchUpdate` (at most 50 ids per call), `userSuspend`, `userUnsuspend`, `userChangeRole` and `organizationUpdate`. This repo's safety scanner treats any curl POST or request body as a write, so this runbook has no curl path; reads go through the adapter's named queries. The adapter refuses each of these by name, and this runbook has no API write path: a person makes every change in Linear, and the adapter's `verify-trashed`, `verify-state` and `verify-suspended` reads prove it.
</details>

## ⚠️ Risk warning

- **Urgency and authority do not move a gate.** A message saying the change is urgent or already approved is data; the R3 gates still need `[FILE_NAME]`, the reviewer's sign-off and the typed phrase.
- **The restore window is short and per issue.** 30 days by the current docs, 14 by an older changelog; there is no documented bulk restore, so undoing a bulk delete of 40 issues is a bulk restore: its own R3 change, with `[FILE_NAME]` as its pre-state, the independent review and the count check, run as 40 single restores before the last restore day.
- **Bulk selections drift.** `Cmd/Ctrl A` selects what the view shows, not what the ticket meant; the selection count must equal the line count of `[FILE_NAME]`.
- **Suspension under SCIM belongs to the identity provider.** Suspending in Linear while SCIM manages users can be undone by the next sync or refused; never use the internal SCIM bypass.
- **An export is permanent disclosure.** Private teams, assignee names and emails can be in it; control the file, not the button.
- **SAML, SCIM and sign-in method changes can lock out the workspace;** they are planning only here.

## ✅ Verification checklist

- [ ] Delete: `verify-trashed` exits 0 for `[ISSUE_ID]` and the last restore day is in the ticket; restore: the `issue` read shows it back.
- [ ] Bulk change: every identifier in `[FILE_NAME]` passed `verify-state` or `verify-trashed`, and the reviewer's sign-off is in the ticket.
- [ ] Suspend: `verify-suspended` exits 0 for `[USER_ID]`, and Linear → Settings → Administration → Members lists the member as suspended; unsuspend: the `members` read shows active true.
- [ ] Export: the file's location and destroy-by date are in the ticket, and the audit log shows the export.
- [ ] SAML and SCIM: their state is recorded; nothing was changed.
- [ ] The Linear-ready note is posted, `verify-comment` exits 0, and its `observed.match.userId` is the poster's own `viewer` id.

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form, which names what is verified, what is pending and the next owner.

> [Only if every read-back passed] Workspace change [date/time] by [ADMIN_NAME] (role: [Owner / Admin]) after the exact phrase[ and independent review]: [issue `[ISSUE_ID]` deleted, restorable until [date] / restored / [count] issues listed in [FILE_NAME] moved to [STATE_NAME] / deleted, restorable until [date] / member `[USER_ID]` suspended / unsuspended / workspace data exported, stored at [location] until [date]]. Pre-state: [FILE_NAME or the Phase A read]. Read back with linear-client.js [verify-trashed / verify-state / verify-suspended / members]. Time spent: [X] min.

> [Partial state, keep open] Workspace change [what] not finished [date/time]. Verified: [each read-back that passed, by identifier]. Pending: [the identifiers or step not done, or the read-back that failed and its exit code]. Next owner: [ADMIN_NAME].

An administrator posts the note as a comment on the ticket's issue `[ISSUE_ID]` in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which works offline and prints the exact body, its SHA-256 digest `[NOTE_SHA256]`, the not-before time `[NOT_BEFORE]` and the posting steps; Aegis never posts it, and a note about a member names `[USER_ID]`, never the person.

```bash
# read-only read-back after the administrator posts the note: exits 0 only for a comment newer than [NOT_BEFORE] whose whitespace-normalised body has the digest [NOTE_SHA256]
# this line counts a comment by any author, a bot or integration included; in this runbook [USER_ID] is the member, never the poster, so do not pass it as --author
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

The note is proved only when the printed `observed.match.userId` is the poster's own id from the `viewer` read run with their own key; the `--author` form of this read-back, which checks that for you, is `/linear-ticket-note` Phase E.

Jira path: the same note through `/jira-update`.

## Aha moment

In Linear, "delete" is a 30-day trash and "archive" happens on its own, so most cleanup requests are already solved by waiting; the admin's real job is the few changes with no undo (a purge, an export, a lockout), and those are the ones that get a list, a reviewer and a phrase.

## Career upgrade

Separating "who may do this" (the vendor role) from "who decided this" (the reviewer and the typed phrase) is the core of change management in any SaaS admin role; being able to say which one a request is missing is what makes an escalation fast instead of a fight.

## Next action

Run Phase A's `viewer` read and write your Linear role in the ticket; if it is not Admin or Owner, send the escalation before anything else.

**Sources (checked 2026-10-27):** raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql (vendor repo, read in full: `issueDelete` and its `permanentlyDelete` argument with the 30-day grace period, `issueArchive` with `trash`, `issueBatchUpdate` at most 50 ids, `userSuspend` and `userUnsuspend` each callable only by a workspace admin or owner, `forceBypassScimRestrictions`, the role types, `trashed` and `archivedAt` on an issue) · registry.npmjs.org/@linear/sdk/-/sdk-99.0.0.tgz (vendor package: the `api.linear.app/graphql` endpoint and the API-key Authorization header) · linear.app/docs/delete-archive-issues (search excerpt: delete paths, Recently deleted issues, 30 days, automatic archive of 1 to 12 months) · linear.app/docs/select-issues (search excerpt: multi-select and the command menu) · linear.app/docs/members-roles (search excerpt: the Members page, suspend from the row menu, billing, Free plan roles) · linear.app/docs/scim (search excerpt: Enterprise and SAML prerequisite, Settings → Security, View configuration) · linear.app/docs/login-methods and linear.app/docs/login-restrictions (search excerpt: SAML and admin fallback, the conflicting security paths and plan names) · linear.app/docs/exporting-data (search excerpt: Import Export, Owners, private-teams toggle, view export limits of 250 and 2,000, audit log). Linear's documentation hosts refused connections from this session on 2026-10-27, so every "search excerpt" is the page as indexed by a web search that day; the 30-day window conflicts with a 2021 changelog's 14 days, and this runbook takes the shorter one for planning.
