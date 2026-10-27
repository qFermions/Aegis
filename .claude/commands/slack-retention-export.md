---
description: Slack retention, legal holds, exports and permanent deletion. Read who holds which role, the plan, the retention setting and any legal holds first, then gated human steps to create a legal hold, run a public-channel or an approved all-conversations export, shorten retention, delete one member's messages or delete a channel, each with its read-back and its no-undo warning. Placeholders only.
disable-model-invocation: true
---

# /slack-retention-export

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER_ID]` (the member whose data is held, exported or deleted; in Phase A also your own member ID) · `[CHANNEL_NAME]` / `[CHANNEL_ID]` (the channel) · `[FILE_NAME]` (the downloaded export file) · `[ISSUE_ID]` (the Linear ticket, also the legal hold's name) · `[NOTE_FILE]` / `[NOTE_SHA256]` / `[NOT_BEFORE]` (the ticket note, its digest, and the time its read-back starts from) · `[ADMIN_NAME]` (the person who makes the change) · `[@Aegion_SLACK_URL]` (the workspace) · `[@Aegion_SLACK_TEAM_ID]` (the workspace ID the read adapter is bound to) · org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- Six changes, six gates, six phrases: create a legal hold (R1), export public channels (R3, an irreversible disclosure of every public channel), export every conversation including DMs (R3), shorten retention (R3), delete one member's messages (R3), delete a channel (R3). Applying to Slack for the all-conversations export and deleting files stay planning-only previews here.
- **Retention deletes, message deletion and channel deletion are permanent, and an export cannot be recalled.** Slack runs retention deletions once a day; lengthening retention afterwards brings nothing back; deleting a channel removes its history whatever the retention setting says. Every R3 gate here runs only after an independent out-of-session review and, where anything may be needed later, an export first.
- **Retention is an owner decision.** A Workspace Admin cannot change it: the request goes to a Workspace Owner (or the Org Owner when an org-level policy exists), never around them.
- **Private channels and DMs leave Slack only through Slack's approved export.** Slack rejects an application unless it shows valid legal process, the members' consent, or a legal requirement or right.
- Slack's facts and menu labels below come from Slack's search-indexed help and developer pages, read 2026-10-27 (the pages themselves could not be opened); method names and fields come from Slack's own SDK source and its 2021 API spec. Confirm each label on screen; if the screen does not match, stop and record what you see.
- Not done until the read-back passes. `node scripts/adapters/slack-client.js` sends GET reads only and refuses `chat.delete`, `admin.conversations.delete` and every other write before it reads a credential; where Slack exposes no read for a setting, the GUI is the read-back and the runbook says so.

## Inputs needed

- The ticket's job: change retention, preserve data (legal hold), export, delete one member's messages, or delete a channel.
- The written approval and its source (legal, HR, a court order) with the exact retention period or date range **[org gap: who may approve retention, export and deletion requests]**.
- The plan: legal holds and the all-conversations export through Organization settings are Enterprise; Business+ can apply for Slack's self-serve export tool. Slack's newer pages write "Enterprise" where older ones say "Enterprise Grid".
- `[USER_ID]` and `[CHANNEL_NAME]` / `[CHANNEL_ID]` as the ticket needs, and the evidence store where an export is kept **[org gap: the approved evidence location and who may open it]**.
- For the adapter: `SLACK_TEAM_ID` is `[@Aegion_SLACK_TEAM_ID]` and `SLACK_TOKEN` holds a token with `users:read` (`user`, `users`), `team:read` (`team`), and `channels:read` or `groups:read` (`channel`, for a public or a private channel); `whoami` needs no scope. The sign-in log read (`access-logs`) needs the `admin` scope, which also authorizes Slack's SCIM API (a SCIM delete deactivates a member), so it reads a separate admin's user token from `SLACK_ACCESS_LOGS_TOKEN`, exported for that one read and unset right after, never put in `SLACK_TOKEN`.

## How the systems hang together

- **Retention:** paid plans keep messages and files for the life of the workspace by default; a custom setting shortens that. Deletions run once a day, are permanent, and also remove pinned and saved items, canvases and lists. Owners can let members change retention for individual channels and DMs, and on Business+ and Enterprise admin overrides let admins change it for channels through the channel management tools. When an org-level policy exists, workspace owners cannot change retention. Free-plan options differ between versions of Slack's page (90 days only, or 90 days or 1 year; unverified).
- **Legal holds** (Enterprise only) preserve a custodian's data against retention deletion. The Legal Holds Admin system role creates them, and an Org Primary Owner or Workspace Primary Owner assigns that role. A hold takes up to 1,000 custodians and there is no limit on the number of holds. Slack Connect content is excluded. Held data comes out through a JSON export or the Discovery API.
- **Exports:** a standard export is public channels only, a zip of JSON with links to files rather than the files (Free plans: file links from the last 90 days). The all-channels-and-conversations export adds private channels and DMs, needs Slack's approval, and leaves out data deleted more than a year ago. The Discovery API is Enterprise only, enabled on request by the Primary Org Owner or an Org Owner, and limited to eDiscovery, archiving and DLP uses.
- **Deletion:** members may delete their own messages unless Owners restricted it; Owners and Admins can delete members' messages in public channels, private channels and group DMs they belong to. There is no bulk delete. Deactivating an account keeps the person's profile and past messages, which is usually what an offboarding needs.
- **Breadcrumbs:** `Slack admin → …` is Slack's newer layout (Admin in the sidebar); `Slack → workspace name → Tools & settings → …` and `Slack → org name → Tools & settings → Organization settings → …` are the older ones.

## Fast path

1. Phase A, always: your role, the plan, the retention setting and the legal holds (R0). A Workspace Admin asking to change retention stops here and escalates to a Workspace Owner.
2. Phase B: a legal hold first whenever litigation, an investigation or a dispute is possible (R1, Enterprise).
3. Phase C: an export, after the independent review. Public channels through the standard export (R3); private channels and DMs only through Slack's approved export (R3).
4. Phase D: shorten retention (R3, after review). **WAIT UNTIL** the next daily run before saying old data is gone; nothing comes back.
5. Phase E: delete one member's messages (R3, after review), one conversation at a time, with no bulk tool; deleting files stays a preview.
6. Phase F: delete a channel (R3, after review), export first. Archiving is the reversible alternative (`/slack-guests-connect`).

## Phase A: Read roles, plan, retention and holds (R0)

**Purpose:** know who may do what on this plan, and what is already preserved, before any decision.

1. Your role: Slack admin → Workspace settings → People → search for your own account → read your role (Workspace Primary Owner, Workspace Owner or Workspace Admin). If the page does not show it, the `user` read below does.
2. Retention: Slack → workspace name → Tools & settings → Workspace settings → Message history (some page versions say Data retention) → Expand → read the current setting for messages and files and whether members may set their own per channel or DM. On Enterprise, ask the Org Owner whether an org-level retention policy applies **[org gap]**.
3. Legal holds (Enterprise): Slack → org name → Tools & settings → Organization settings → Security → Legal Holds → read each hold and whether `[USER_ID]` or the channel is covered.
4. Exports: Slack admin → Workspace settings → Security → Import & export data → read which export types this plan offers.
5. For a channel: run the `channel` read below and record `is_archived`, `is_general` and `is_ext_shared`.

```bash
# read-only: which workspace and which account the token belongs to
node scripts/adapters/slack-client.js whoami --execute
# read-only: one member's record; here [USER_ID] is your own member ID, and is_owner, is_primary_owner and is_admin give your role
node scripts/adapters/slack-client.js user --user [USER_ID] --execute
# read-only: the workspace's name and ID; a plan field was not confirmed in the sources read, so take the plan from the Workspace Owner
node scripts/adapters/slack-client.js team --execute
# read-only: the channel's state before any export or deletion
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

Exit 0 is a read; exit 2 is a failed read with Slack's error code only (for example `missing_scope`); exit 3 is a record from another workspace.

**If you are a Workspace Admin and the ticket asks you to change retention, stop here.** Customizing message and file retention is for Workspace Owners and Org Owners; a Workspace Admin cannot, and under an org-level policy only the organization can. Send the request with its written approval to a Workspace Owner. Per-channel member settings or admin channel tools are not a way around that decision.

**Verification checkpoint:** [ ] your role, the plan, the retention setting and the holds are in the ticket · [ ] the person who will make each change holds the role its gate names.

## Phase B: Preserve data with a legal hold (R1, Enterprise)

**Purpose:** keep one custodian's data safe from retention deletion before anything is exported, shortened or deleted.

**Role needed:** Legal Holds Admin (a system role an Org Primary Owner or Workspace Primary Owner assigns; Enterprise only).
<!-- SAFETY GATE [slack-retention-export-legal-hold-portal] -->
- **Target:** custodian [USER_ID], hold named [ISSUE_ID]
- **Effect:** create one legal hold that preserves one custodian's messages and files
- **Scope:** one custodian (a hold takes up to 1,000) for the conversations and date range chosen; Slack Connect content is excluded
- **Reversibility:** R1 to create: edit the hold or remove the custodian later (that path was not confirmed in the sources read); releasing a hold is effectively R3, because the held data then falls under retention deletion
- **Required confirmation:** Type exactly `CREATE LEGAL HOLD [ISSUE_ID] FOR CUSTODIAN [USER_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-legal-hold-portal]:** Only after the written approval is in the ticket and the exact match:
1. Slack → org name → Tools & settings → Organization settings → Security → Legal Holds → **Create Legal Hold** → name it `[ISSUE_ID]` → choose the conversations and the date range → **Add Custodians** → `[USER_ID]` → **Add** → Save.
2. GUI read-back: Legal Holds lists `[ISSUE_ID]` with custodian `[USER_ID]`. The adapter has no legal-hold read (Slack's Legal Holds API is not on its allow-list), so the GUI is the read-back.

**Verification checkpoint:** [ ] the hold is listed with its custodian · [ ] the ticket says Slack Connect content is not covered.

## Phase C: Export (R3 public channels, R3 every conversation, after independent review)

**Purpose:** take a copy of what a decision needs, to a place where access is controlled, before anything is deleted.

Before either gate: the written approval names the purpose and the date range, the evidence store is chosen, and the independent out-of-session review is recorded (an export is an irreversible disclosure, the T3 floor for exporting messages). A standard export holds public channels only; it never answers a request for DMs.

**Role needed:** Workspace Owner or Workspace Admin (a Workspace Admin exports public channels only).
<!-- SAFETY GATE [slack-retention-export-public-export-portal] -->
- **Target:** workspace [@Aegion_SLACK_TEAM_ID]
- **Effect:** export the public-channel history of the workspace for one date range; Slack emails a download link to the person who started it
- **Scope:** every public channel in the date range, as a zip of JSON with links to files rather than the files; on the Free plan, file links from the last 90 days only
- **Reversibility:** R3 (an irreversible disclosure): once downloaded the data cannot be recalled; only who starts it, who receives the link and where the zip is kept can be controlled
- **Required confirmation:** Type exactly `START EXPORT OF PUBLIC CHANNELS FROM SLACK WORKSPACE [@Aegion_SLACK_TEAM_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-public-export-portal]:** Only after the approval, the evidence store and the independent review are in the ticket, and the exact match:
1. Slack admin → Workspace settings → Security → Import & export data → **Export** → choose the date range from the approval → **Start Export**. Older layout: Slack → workspace name → Workspace settings → Import/Export Data → **Export** tab → the date range → **Start Export**.
2. **WAIT UNTIL** the export page shows Ready for download and the email with the link reaches the person who started it.
3. Download the zip straight into the evidence store, record its SHA-256 in the ticket with the command below, and never attach the zip to the ticket.

```bash
# read-only: prints the SHA-256 of the downloaded export, so the ticket records exactly which file was handed over
shasum -a 256 [FILE_NAME]
```

> **PREVIEW ONLY [slack-retention-export-dm-application-preview]:** Planning only; nothing here authorizes an application or an export. Private channels and DMs leave Slack only through Slack's approved export: on Enterprise an Org Owner requests it, and on Business+ a Workspace Owner applies for Slack's self-serve tool. Slack rejects an application unless it shows valid legal process, the members' consent, or a legal requirement or right, so an HR investigation alone may not qualify and legal decides whether to apply **[org gap: who in legal signs]**. Which plans qualify today was not confirmed in the sources read.

**Role needed:** Org Owner or Primary Org Owner on Enterprise, after Slack approved the export; on Business+, the Workspace Owner through the self-serve tool Slack enables.
<!-- SAFETY GATE [slack-retention-export-all-conversations-portal] -->
- **Target:** workspace [@Aegion_SLACK_TEAM_ID], approval recorded in [ISSUE_ID]
- **Effect:** export every channel and conversation, DMs included, for one date range
- **Scope:** public and private channels and DMs of the chosen workspace (or of the entire organization, only if the approval says so) in the date range; data deleted more than a year ago is not included
- **Reversibility:** R3: private conversations leave Slack and cannot be recalled; only who holds the file can be controlled
- **Required confirmation:** Type exactly `EXPORT ALL SLACK CONVERSATIONS FROM WORKSPACE [@Aegion_SLACK_TEAM_ID] FOR [ISSUE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-all-conversations-portal]:** Only after Slack's approval, the legal sign-off and the independent review are in the ticket, and the exact match:
1. Slack → org name → Tools & settings → Organization settings → Security → Exports → **Export** next to All channels and conversations → choose `[@Aegion_SLACK_TEAM_ID]`, not the entire organization unless the approval says so → choose the date range from the approval and confirm.
2. **WAIT UNTIL** the export is ready, then download it straight into the evidence store and record its SHA-256 with the `shasum` read above.
3. The zip is expected to use the standard layout (`users.json` or `org_users.json`, `channels.json`, `groups.json`, `dms.json`, one folder per conversation with one JSON file per day); for this export that layout was assumed, not confirmed.

**Verification checkpoint:** [ ] the export page showed Ready for download · [ ] the SHA-256 and the evidence location are in the ticket · [ ] who downloaded it and when is in the ticket.

## Phase D: Shorten retention (R3, after independent review)

**Purpose:** apply an approved retention period, knowing that everything older is deleted for good.

Before the gate: the written approval names the period; Phase A shows no org-level policy and the legal holds that must keep their data; anything that must survive was exported in Phase C; the independent out-of-session review is recorded.

**Role needed:** Workspace Owner, or the Org Owner when an org-level policy exists. A Workspace Admin cannot change retention; escalate as in Phase A.
<!-- SAFETY GATE [slack-retention-export-shorten-retention-portal] -->
- **Target:** workspace [@Aegion_SLACK_TEAM_ID]
- **Effect:** shorten message and file retention for the whole workspace; Slack's daily run then permanently removes everything older than the new period
- **Scope:** every channel and DM in the workspace, including pinned and saved items, canvases and lists; channel-level settings that Owners let members or admins set may differ, and how they interact with a new workspace setting was not in the sources read, so record them first
- **Reversibility:** R3: the deletion is permanent; lengthening retention afterwards does not bring back what was deleted, and the next daily run can start within a day, so there is no undo window to rely on
- **Required confirmation:** Type exactly `SET SHORTER SLACK RETENTION FOR WORKSPACE [@Aegion_SLACK_TEAM_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-shorten-retention-portal]:** Only after the review, the holds check and any export, and the exact match:
1. Slack → workspace name → Tools & settings → Workspace settings → Message history (Data retention in some versions) → Expand → set the custom period written in the approval for messages, and for files if the approval covers them → Save. The newer layout's path to this setting was not in the sources read.
2. GUI read-back: the page shows the new period. Slack exposes no confirmed read API for retention, so the adapter cannot read this setting and the GUI is the read-back.

**WAIT UNTIL** the next daily deletion run has passed before telling anyone the old data is gone; nothing it deletes comes back.

**Verification checkpoint:** [ ] the setting shows the approved period · [ ] the approval, the review and the pre-change setting are in the ticket.

## Phase E: Delete one member's messages (R3, after independent review)

**Purpose:** remove specific messages that must go, one conversation at a time.

Before the gate:

1. Ask what is actually needed. Deactivating an account keeps the profile and past messages, and that is usually the answer for a leaver (the Slack user lifecycle runbook, slack-user-lifecycle). "Delete everything they wrote" has no bulk tool in Slack.
2. Check Phase A for a legal hold on `[USER_ID]`; export the conversations first (Phase C) if legal wants a record.
3. List every message to delete in the ticket, conversation by conversation. An Owner or Admin can delete a member's messages only in public channels, private channels and group DMs they belong to; one-to-one DMs between other people are not in that list.
4. More than 10 messages in total is a mass deletion: the independent review must see the full list.

**Role needed:** Workspace Owner or Workspace Admin who is a member of the conversation.
<!-- SAFETY GATE [slack-retention-export-delete-messages-portal] -->
- **Target:** messages by [USER_ID] in channel [CHANNEL_ID]
- **Effect:** delete each message by one member that the ticket lists, in one conversation
- **Scope:** only the listed messages in one public channel, private channel or group DM; no bulk delete exists, so each message is one deletion
- **Reversibility:** R3: deletion is permanent; the desktop unsend within 15 seconds is the only grace and belongs to the author
- **Required confirmation:** Type exactly `DELETE MESSAGES BY [USER_ID] IN SLACK CHANNEL [CHANNEL_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-delete-messages-portal]:** Only after the review, the holds check and any export, and the exact match, one conversation per phrase:
1. Slack → `#[CHANNEL_NAME]` → open each listed message → hover over it → ⋮ → **Delete message** → confirm.
2. Tick each message off the ticket's list as it goes; stop at the first message that does not match the list.
3. GUI read-back: each listed message link no longer opens the message. The adapter cannot prove a deletion: its only history read, `verify-posted`, matches a drafted note's digest.

> **PREVIEW ONLY [slack-retention-export-file-delete-preview]:** Planning only; this runbook does not authorize deleting files. Who may delete another member's files, and where, was not confirmed in any Slack page read on 2026-10-27. Record the files in the ticket, and confirm the path and the role on Slack's help page before a separate reviewed runbook gates any file deletion.

**Verification checkpoint:** [ ] every listed message is ticked off and no longer opens · [ ] files, if any, are recorded and left in place.

## Phase F: Delete a channel (R3, after independent review)

**Purpose:** remove a channel and its history only when the content itself must go.

Before the gate:

1. Archiving keeps the history and can be undone (`/slack-guests-connect`, Phase E). Use it unless the content itself must be destroyed.
2. Export the channel (Phase C) if anything in it may be needed; deleting a channel removes its messages whatever the retention setting says.
3. The Phase A `channel` read shows it is not `#general` (which cannot be deleted). If `is_ext_shared` is true, stop: the sources read did not describe deleting a Slack Connect channel.
4. Check the legal holds, and record the independent review.

**Role needed:** Workspace Owner or Workspace Admin (on Enterprise, also an Org Owner).
<!-- SAFETY GATE [slack-retention-export-delete-channel-portal] -->
- **Target:** channel [CHANNEL_NAME] ([CHANNEL_ID])
- **Effect:** delete one channel with its whole history
- **Scope:** one channel, every message in it and its history; it disappears from Directories
- **Reversibility:** R3: permanent with no undo; only an export made beforehand keeps the content
- **Required confirmation:** Type exactly `DELETE SLACK CHANNEL [CHANNEL_NAME] [CHANNEL_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-retention-export-delete-channel-portal]:** Only after the review, the export decision and the exact match:
1. Slack → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → **Delete channel** → confirm. These labels were read from a search excerpt; confirm them on screen.
2. GUI read-back: Slack → Directories → search for `[CHANNEL_NAME]` with archived channels included → no result.

```bash
# read-only: expect a failed read (exit 2) with an error code such as channel_not_found (the exact code for a deleted channel was not confirmed); it counts only when the Phase A `channel` read of the same [CHANNEL_ID] succeeded with the same token; exit 2 with missing_scope or not_authed proves nothing
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

**Verification checkpoint:** [ ] Directories finds no channel · [ ] the `channel` read fails with a channel error code, not an auth or scope code, and counts only when the Phase A `channel` read of the same `[CHANNEL_ID]` succeeded with the same token (a private channel the token cannot see also answers channel_not_found).

<details>
<summary>Slack Web API reads through the adapter: the scale version (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN: read-only; SLACK_TOKEN holds the read-scoped token from Inputs and SLACK_TEAM_ID is [@Aegion_SLACK_TEAM_ID], both exported in the shell, never pasted into a ticket
# read-only: one page of members with is_owner, is_admin and deleted, to list who holds the Owner role before routing a retention request; repeat with --cursor from the previous page
node scripts/adapters/slack-client.js users --limit 200 --execute
# read-only: sign-in history (team.accessLogs, paid plans), to show who signed in around an export or a deletion
# SLACK_ACCESS_LOGS_TOKEN holds a separate admin-scope user token, exported for this one read and unset right after, never SLACK_TOKEN
node scripts/adapters/slack-client.js access-logs --execute
```
</details>

The writes behind these gates (`chat.delete`, `files.delete`, `admin.conversations.delete`, any Legal Holds API write, any retention change) are refused by the adapter; a person makes each change in Slack.

## ⚠️ Risk warning

- **Nothing deleted comes back.** Retention runs daily and permanently; a deleted channel takes its history with it whatever the retention setting; a deleted message is gone. Export first whenever anyone may need the content.
- **Retention reaches further than people expect:** pinned and saved items, canvases and lists go too.
- **An export cannot be recalled.** Private channels and DMs need Slack's approval and a legal basis; the zip holds personal data and belongs in the evidence store, never in the ticket.
- **Legal holds do not cover Slack Connect content**, and releasing a hold exposes the held data to retention deletion.
- **No bulk delete:** more than 10 messages is a mass operation that the independent review must see in full.
- **Role first:** a Workspace Admin who changes retention by any other route is working around the owner's decision.
- Labels came from search excerpts on 2026-10-27; a screen that does not match is a stop, not a guess.

## ✅ Verification checklist

- [ ] Phase A: your role, the plan, the retention setting and the holds are in the ticket, and each change was made by someone with the role its gate names.
- [ ] Legal hold: Slack → org name → Tools & settings → Organization settings → Security → Legal Holds lists `[ISSUE_ID]` with custodian `[USER_ID]`.
- [ ] Export: Ready for download was shown, and the SHA-256, the evidence location and the downloader are in the ticket.
- [ ] Retention: the setting shows the approved period, with the approval, the review and the previous setting in the ticket.
- [ ] Messages: every listed message is ticked off and no longer opens; files are recorded and untouched.
- [ ] Channel: Directories finds nothing and the `channel` read fails with a channel error code, after the Phase A `channel` read of the same `[CHANNEL_ID]` succeeded with the same token.

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> **Completed (every read-back passed):** Slack `[@Aegion_SLACK_URL]`, ticket `[ISSUE_ID]`. Approval: [source and date]. Change: [legal hold `[ISSUE_ID]` created for `[USER_ID]` / public-channel export for [date range] / all-conversations export for [date range] after Slack's approval / retention shortened to [period] / [N] messages by `[USER_ID]` deleted in `[CHANNEL_ID]` / `#[CHANNEL_NAME]` deleted], made by `[ADMIN_NAME]` in Slack after the exact phrase [and the independent review]. Pre-state in this ticket: [previous retention setting / holds / channel state / message list]. Export: SHA-256 [value], stored in [evidence location]. Read-back: [GUI observation and time; `channel` read result where it applies]. Time spent: [X] min.
>
> **Partial state (a read-back failed or is pending):** Verified: [what passed, with the observation and time]. Pending: [what has not passed, and when it will be checked again]. Next owner: [role, for example the Workspace Owner for a retention change]. No further change until the pending read-back passes.

An administrator posts this note as a comment on [ISSUE_ID] in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]` (which prints the digest), and then reads the posted comment back:

```bash
# read-only: proves a comment on [ISSUE_ID] created after [NOT_BEFORE] has the prepared note's digest
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

Retention, export and deletion are one decision seen from three sides: what you keep, what you hand over, and what you destroy. Doing them in the order hold, export, then shorten or delete is what keeps a permanent action from destroying the evidence someone needed.

## Career upgrade

Owning data lifecycle (retention, legal hold, eDiscovery export and defensible deletion) is the records-management and compliance skill that separates a platform administrator from an IT governance lead.

## Next action

Run Phase A and record your role, the plan, the retention setting and the holds in `[ISSUE_ID]`; if you are a Workspace Admin asked to change retention, send it to a Workspace Owner now.

**Sources (checked 2026-10-27):** slack.com/help/articles/203457187 (customize data retention: defaults, path, overrides, daily permanent deletion; search excerpt) · slack.com/help/articles/4401830811795 (legal holds: Legal Holds Admin role, path, 1,000 custodians, Slack Connect excluded; search excerpt) · slack.com/help/articles/204897248 (import and export tools, export eligibility; search excerpt) · slack.com/help/articles/201658943 (export your workspace data: paths, date range, emailed link, all-conversations export; search excerpt) · slack.com/help/articles/220556107 (reading a Slack export: files and folders; search excerpt) · slack.com/help/articles/360002079527 (Discovery API; search excerpt) · slack.com/help/articles/213185307 (archive or delete a channel; search excerpt) · slack.com/help/articles/202395258 (edit or delete messages: who, no bulk, permanent, 15-second unsend; search excerpt) · slack.com/help/articles/204475027 (deactivation keeps profile and messages; search excerpt) · docs.slack.dev/reference/objects/conversation-object and /reference/methods/team.accessLogs (search excerpt) · github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads, Bearer header; vendor repo, read in full) · github.com/slackapi/slack-api-specs web-api OpenAPI v2 (user fields is_owner, is_admin, deleted; vendor repo, last updated 2021-09-07). No Slack page could be opened directly from this session.
