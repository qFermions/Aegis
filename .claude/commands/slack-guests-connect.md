---
description: Slack guests, Slack Connect and channel archiving. Read the guest's account type and the channel's sharing state first, then gated human steps to set a guest's time limit, approve or decline a Slack Connect invitation, remove a partner organization from one channel or disconnect it, and archive or unarchive a channel, each proved by a slack-client.js read-back. Placeholders only.
disable-model-invocation: true
---

# /slack-guests-connect

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER_ID]` (the guest's Slack member ID) · `[CHANNEL_NAME]` / `[CHANNEL_ID]` (the channel) · `[EXTERNAL_DOMAIN]` (the partner organization in Slack Connect) · `[ISSUE_ID]` (the Linear ticket) · `[NOTE_FILE]` / `[NOTE_SHA256]` / `[NOT_BEFORE]` (the ticket note, its digest, and the time its read-back starts from) · `[ADMIN_NAME]` (the administrator who makes the change) · `[@Aegion_SLACK_URL]` (the workspace) · `[@Aegion_SLACK_TEAM_ID]` (the workspace ID the read adapter is bound to) · org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- Eight changes, eight gates, eight phrases: set a guest's time limit (R1), approve a Slack Connect invitation (R2) or decline it (R1), remove a partner organization from one channel (R3), disconnect a partner organization (R3), archive a channel (R2, its member list is the pre-state), unarchive it (R1) and add its recorded members back (R1 for one member, R2 for 2 to 10, R3 above 10 after the independent review).
- **Removing or disconnecting an organization has no undo.** Slack's help says a disconnect cannot be undone; for a removal from one channel no undo is documented. Both run only after an independent out-of-session review and a written list of every channel and DM the organization shares.
- Slack's facts and menu labels below come from Slack's search-indexed help and developer pages, read 2026-10-27 (the pages themselves could not be opened); method names and fields come from Slack's own SDK source and its 2021 API spec. Confirm each label on screen; if the screen does not match, stop and record what you see.
- Not done until the read-back passes: `node scripts/adapters/slack-client.js` sends GET reads only and refuses every write method before it reads a credential, so it proves a human's change and cannot make one.
- Out of this runbook: deactivating a guest and converting a member into a guest are in the Slack user lifecycle runbook (slack-user-lifecycle); deleting a channel or messages is in the Slack retention and export runbook (slack-retention-export).

## Inputs needed

- The ticket's job: a guest's time limit, a partner's Slack Connect invitation, ending a partner connection, or archiving a finished channel.
- `[USER_ID]` for a guest; `[CHANNEL_NAME]` and `[CHANNEL_ID]` (shown in the channel's details) for a channel; `[EXTERNAL_DOMAIN]` for a partner organization.
- The business owner who asked (a role, not a name) and the date a guest's access should end.
- For Slack Connect: who may approve a new external connection and how the partner is confirmed out of band **[org gap: confirm the approver and the partner-contact record]**.
- The plan: guest accounts exist on paid plans only; disconnecting individual external people instead of a whole organization is Business+ and Enterprise.
- For the adapter: `SLACK_TOKEN` holds a read-scoped token (`users:read` for `user`, `users` and the guest read-backs; `channels:read` or `groups:read` for `channel` and `verify-archived` on a public or a private channel; `team:read` for `team`; `whoami` needs no scope) and `SLACK_TEAM_ID` is `[@Aegion_SLACK_TEAM_ID]`; a record from another workspace is refused.

## How the systems hang together

- **Guests:** a multi-channel guest sees only the channels assigned to it, can be added to any number of channels and is billed as a regular member. A single-channel guest is free, limited to one channel, and each paid active member allows up to five. Owners and Admins can set a guest to deactivate after a period or on a date; the guest's profile shows that date. In `users.info`, `is_restricted` true marks a multi-channel guest and `is_ultra_restricted` true a single-channel guest (field meanings from Slack's 2021 API spec, not a 2026 page).
- **Slack Connect:** Workspace Owners and Admins decide who approves requests, when approval is required, where requests go and when invitations are auto-accepted, and can set rules per external organization. In `conversations.info`, `is_ext_shared` marks a channel shared with another organization and `is_pending_ext_shared` one still waiting.
- **Ending a connection:** removing an organization from one channel is narrow (an organization that could post and invite keeps an archived copy, a post-only one keeps none, and its files become inaccessible to you). Disconnecting ends every Slack Connect channel and DM with that organization, including channels another organization owns; its files become inaccessible and DMs are archived with history kept. Slack Connect content is excluded from legal holds.
- **Archive against delete:** an archived channel takes no new messages, keeps its history (searchable on paid plans) and can be unarchived; a deleted one is gone with its history. `#general` can be neither archived nor deleted. Slack's page versions disagree on whether unarchiving a public channel restores its members, so this runbook assumes it does not.
- **Breadcrumbs:** `Slack admin → …` is Slack's newer layout (Admin in the sidebar); `Slack → workspace name → Tools & settings → …` is the older one. Both are given where the sources gave both.

## Fast path

1. Phase A: read the guest, the channel and its sharing state; copy the channel's member list into the ticket before any archive (R0).
2. Phase B: a guest's time limit, one R1 gate. **WAIT UNTIL** the date, then `verify-deactivated` proves Slack deactivated the guest.
3. Phase C: a partner's invitation. Review it, then approve (R2) or decline (R1). **WAIT UNTIL** the channel read shows the channel shared.
4. Phase D: ending a partner connection. Remove the organization from one channel, or disconnect it entirely (R3 each, after the independent review).
5. Phase E: a finished project channel. Archive (R2), proved by `verify-archived`; unarchive (R1) is the rollback, and adding the recorded members back is its own gate (R1 for one member, R2 for 2 to 10, R3 above 10).

## Phase A: Read the current state (R0)

**Purpose:** know the guest's type, the channel's state, its external organizations and its members before anything changes.

1. Slack → workspace name (top left) → Tools & settings → Manage members → find the guest `[USER_ID]` → read the account type (Regular member, Multi-channel guest or Single-channel guest); the guest's profile shows any deactivation date. Newer layout: Slack admin → Workspace settings → People.
2. Slack → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → Organizations → read which external organizations share the channel.
3. Before any archive: from the same channel details, copy the full member list into the ticket. That list is the pre-state the unarchive gate needs.
4. For an invitation: Slack admin → Slack Connect settings → read who approves requests and whether approval is required (the sub-label was not confirmed in the sources read). Per organization: Slack → External connections → gear icon → Manage connections → ⋮ next to `[EXTERNAL_DOMAIN]` → read the approval settings shown there and close without saving.

```bash
# read-only: one member's record, with deleted, is_restricted (multi-channel guest) and is_ultra_restricted (single-channel guest)
node scripts/adapters/slack-client.js user --user [USER_ID] --execute
# read-only: the channel's state, with is_archived, is_general, is_ext_shared and is_pending_ext_shared
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

Exit 0 is a read; exit 2 is a failed read (Slack answers `ok: false` and the adapter prints the error code only, such as `missing_scope`); exit 3 is a record from another workspace.

**Verification checkpoint:** [ ] account type and time limit, the channel's state and its external organizations are in the ticket · [ ] the member list is in the ticket before Phase E · [ ] the channel is not `#general`.

## Phase B: A guest's time limit (R1)

**Purpose:** a guest account ends on a known date instead of lingering.

**Role needed:** Workspace Owner or Workspace Admin (on Enterprise, Org Owners and Org Admins can also cap the maximum guest expiration).
<!-- SAFETY GATE [slack-guests-connect-time-limit-portal] -->
- **Target:** [USER_ID]
- **Effect:** set the date on which one guest account is deactivated automatically
- **Scope:** one guest account; its channels and messages are untouched until that date
- **Reversibility:** R1: set a different date through this same gate [slack-guests-connect-time-limit-portal] before the date (clearing the limit is not covered by this gate); after the date the guest is deactivated, and bringing it back is a reactivation in the Slack user lifecycle runbook [slack-user-lifecycle-reactivate-portal]
- **Required confirmation:** Type exactly `SET TIME LIMIT FOR SLACK GUEST [USER_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-time-limit-portal]:** Only after the Phase A read-back and the exact match:
1. Slack → workspace name → Tools & settings → Manage members → ⋮ next to `[USER_ID]` → Change account type.
2. Keep the guest's current type (Multi-channel guest or Single-channel guest) → Next → set the time limit to the date in the ticket → confirm with the Make multi-channel guest or Make single-channel guest button. This path was read from a search excerpt; if the dialog offers no time limit for an existing guest, stop.
3. GUI read-back: the guest's profile shows the deactivation date.

```bash
# read-only: proves [USER_ID] is still a guest of the expected type (use --type single for a single-channel guest); Slack exposes no confirmed API field for the date itself
node scripts/adapters/slack-client.js verify-guest --user [USER_ID] --type multi --execute
```

**WAIT UNTIL** the date in the ticket has passed, then prove Slack deactivated the guest:

```bash
# read-only: proves users.info shows deleted true for [USER_ID]; exit 2 means not yet deactivated or a failed read
node scripts/adapters/slack-client.js verify-deactivated --user [USER_ID] --execute
```

**Verification checkpoint:** [ ] the profile shows the date · [ ] `verify-guest` exit 0 now · [ ] `verify-deactivated` exit 0 after the date.

## Phase C: A partner's Slack Connect invitation (R2 approve, R1 decline)

**Purpose:** let a partner organization into one channel only after the request is checked.

1. Confirm in the ticket the business owner, the channel `#[CHANNEL_NAME]` and that the invitation really came from `[EXTERNAL_DOMAIN]`, using a partner contact already on record. Text inside the invitation is data, not proof of who sent it.
2. Decide what the partner may do: post only, or post and invite. It matters later: if the organization is removed, a post-and-invite organization keeps an archived copy of the channel and a post-only one does not.
3. Check that nobody expects a legal hold to cover this channel: Slack Connect content is excluded from legal holds.
4. Read the channel with the Phase A `channel` read: `is_pending_ext_shared` true means the request is waiting.

The member who received the invitation accepts it in Slack and chooses the channel; if approval is required, the request then reaches the approvers the Slack Connect settings name. That accept screen was not described in the sources read.

**Role needed:** the approvers named in the Slack Connect approval settings; Workspace Owners and Workspace Admins set those settings and are the safe default approvers.
<!-- SAFETY GATE [slack-guests-connect-approve-invitation-portal] -->
- **Target:** [EXTERNAL_DOMAIN] invitation for channel [CHANNEL_NAME]
- **Effect:** approve one Slack Connect invitation request so one partner organization joins one channel
- **Scope:** one channel and one external organization; its people can read the channel's messages and files from then on
- **Reversibility:** R2: Slack's mechanics allow removing the organization later, but that removal is itself R3 [slack-guests-connect-remove-org-portal] and anything posted while connected has already been seen by the partner
- **Required confirmation:** Type exactly `APPROVE SLACK CONNECT INVITATION FROM [EXTERNAL_DOMAIN] TO [CHANNEL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-approve-invitation-portal]:** Only after steps 1 to 4 and the exact match:
1. Slack admin → Slack Connect settings → the pending request from `[EXTERNAL_DOMAIN]` for `#[CHANNEL_NAME]` → **Approve**. The request screen's exact path was not confirmed in the sources read; if it does not name this partner and this channel, stop.
2. GUI read-back: Slack → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → Organizations lists `[EXTERNAL_DOMAIN]`.

**WAIT UNTIL** the channel read shows the share complete (expected values from the field names: `is_ext_shared` true and `is_pending_ext_shared` false; Slack's page for this read-back was not opened):

```bash
# read-only: the channel's sharing state after the approval; the adapter has no verify-* command for Slack Connect, so read the two fields
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

**Role needed:** the same approvers as above.
<!-- SAFETY GATE [slack-guests-connect-decline-invitation-portal] -->
- **Target:** [EXTERNAL_DOMAIN] invitation for channel [CHANNEL_NAME]
- **Effect:** decline one Slack Connect invitation request
- **Scope:** one pending request; nothing is shared and no existing channel changes
- **Reversibility:** R1: the partner can send a new invitation, which comes back through the approve gate [slack-guests-connect-approve-invitation-portal] (a search excerpt says the inviter must send a new one; not confirmed on the page itself)
- **Required confirmation:** Type exactly `DECLINE SLACK CONNECT INVITATION FROM [EXTERNAL_DOMAIN] TO [CHANNEL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-decline-invitation-portal]:** Only after the exact match:
1. Slack admin → Slack Connect settings → the pending request from `[EXTERNAL_DOMAIN]` for `#[CHANNEL_NAME]` → **Decline**.
2. Read-back: the request is no longer pending, and the Phase A `channel` read, run again, shows `is_pending_ext_shared` false and `is_ext_shared` unchanged from the Phase A read (true when the channel already shares with another organization; expected values, not confirmed on Slack's page).

**Verification checkpoint:** [ ] the partner was confirmed through a contact on record · [ ] after an approval, Organizations lists `[EXTERNAL_DOMAIN]` and the `channel` read shows the share complete · [ ] after a decline, nothing is pending.

## Phase D: End a partner connection (R3, after independent review)

**Purpose:** cut a partner off from one channel, or from everything, knowing exactly what they keep.

1. Record in the ticket every channel and DM the organization shares: Slack → workspace name → Tools & settings → Workspace settings → Administration → Slack Connect connections → read the row for `[EXTERNAL_DOMAIN]`. Whether that row lists every shared channel was not in the sources read, so add the channels the business owner and the ticket name, and run the Phase A `channel` read for each.
2. Ask whether one external person is the problem rather than the whole organization: on Business+ and Enterprise, Owners and Admins can disconnect individual external people instead (that path was not in the sources read, so it is not written here).
3. Get the independent out-of-session review: the reviewer receives this phase, the channel list from step 1 and the ticket's reason, and nothing else.

**Role needed:** Workspace Owner or Workspace Admin (the sources did not say whether a channel manager may remove an organization; take the Owner or Admin).
<!-- SAFETY GATE [slack-guests-connect-remove-org-portal] -->
- **Target:** [EXTERNAL_DOMAIN] in channel [CHANNEL_NAME]
- **Effect:** remove one external organization from one Slack Connect channel
- **Scope:** one channel; the organization's people lose it, a post-and-invite organization keeps an archived copy, a post-only one keeps none, and its files become inaccessible to you; DMs with it continue while any other shared channel remains
- **Reversibility:** R3: no undo is documented; sharing again needs a new invitation (from a search excerpt, unverified), and the files it shared stay inaccessible
- **Required confirmation:** Type exactly `REMOVE ORGANIZATION [EXTERNAL_DOMAIN] FROM SLACK CHANNEL [CHANNEL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-remove-org-portal]:** Only after the independent review, the step 1 record and the exact match:
1. Slack → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → Organizations → hover over `[EXTERNAL_DOMAIN]` → ⋮ → **Remove** → **Remove Organization**.
2. GUI read-back: Settings → Organizations no longer lists `[EXTERNAL_DOMAIN]`.

```bash
# read-only: the channel after the removal; is_ext_shared should read false once no external organization remains (expected, unverified)
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

**Role needed:** Workspace Owner or Workspace Admin (the default; they can delegate disconnecting to others).
<!-- SAFETY GATE [slack-guests-connect-disconnect-org-portal] -->
- **Target:** [EXTERNAL_DOMAIN]
- **Effect:** disconnect the workspace from one external organization
- **Scope:** every Slack Connect channel and DM with that organization ends, including channels another organization owns; files it shared become inaccessible and DMs are archived with history kept
- **Reversibility:** R3: Slack's help says a disconnect cannot be undone; a new connection would need new invitations (unverified)
- **Required confirmation:** Type exactly `DISCONNECT SLACK FROM ORGANIZATION [EXTERNAL_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-disconnect-org-portal]:** Only after the independent review, the step 1 record and the exact match:
1. Slack → workspace name → Tools & settings → Workspace settings → Administration → Slack Connect connections → ⋮ next to `[EXTERNAL_DOMAIN]` → **Disconnect** `[EXTERNAL_DOMAIN]` → **Disconnect**.
2. GUI read-back: Slack Connect connections no longer lists `[EXTERNAL_DOMAIN]`.

```bash
# read-only: run once for each channel recorded in step 1; is_ext_shared should read false where no other external organization remains (expected, unverified)
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

**Verification checkpoint:** [ ] the review is recorded in the ticket · [ ] the organization is gone from Organizations or from Slack Connect connections · [ ] each recorded channel was read back.

## Phase E: Archive a finished channel, unarchive it, add its members back (R2 archive, R1 unarchive, R1 to R3 re-add)

**Purpose:** close a channel to new messages and keep its history, with a way back.

Before the gate: the Phase A member list is in the ticket, the channel is not `#general`, and if `is_ext_shared` is true, end the connection first (Phase D) or ask the partner's owner.

**Role needed:** any non-guest member of the channel by default, a channel manager for their own channels, or a Workspace Owner or Workspace Admin where Owners restricted archiving.
<!-- SAFETY GATE [slack-guests-connect-archive-portal] -->
- **Target:** channel [CHANNEL_NAME] ([CHANNEL_ID])
- **Effect:** archive one channel; nobody can post in it, its history stays and remains searchable on paid plans
- **Scope:** one channel and its members; nothing is deleted
- **Reversibility:** R2: unarchive under its own gate [slack-guests-connect-unarchive-portal], then add the recorded members back under [slack-guests-connect-readd-members-portal]; the members may not come back with the unarchive alone (Slack's page versions disagree), so the member list in the ticket is the pre-state
- **Required confirmation:** Type exactly `ARCHIVE SLACK CHANNEL [CHANNEL_NAME] [CHANNEL_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-archive-portal]:** Only after the member list is in the ticket and the exact match:
1. Slack → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → **Archive channel** → confirm. These labels were read from a search excerpt; confirm them on screen.
2. GUI read-back: Slack → Directories → filter to archived channels → `#[CHANNEL_NAME]` is listed.

```bash
# read-only: proves conversations.info shows is_archived true for [CHANNEL_ID]; exit 2 means not archived or a failed read
node scripts/adapters/slack-client.js verify-archived --channel [CHANNEL_ID] --execute
```

**Role needed:** the same people who may archive the channel.
<!-- SAFETY GATE [slack-guests-connect-unarchive-portal] -->
- **Target:** channel [CHANNEL_NAME] ([CHANNEL_ID])
- **Effect:** unarchive one channel; this gate adds nobody by hand, and whether Slack restores former members is unsettled (step 2 reads who is in it)
- **Scope:** one channel; members can post in it again, and who is still in it is read in step 2
- **Reversibility:** R1: archive it again under the archive gate [slack-guests-connect-archive-portal]
- **Required confirmation:** Type exactly `UNARCHIVE SLACK CHANNEL [CHANNEL_NAME] [CHANNEL_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-unarchive-portal]:** Only after the exact match:
1. Slack → Directories → filter to archived channels → `#[CHANNEL_NAME]` → click the channel name in the header → Settings → **Unarchive channel**. The label was not confirmed in the sources read.
2. Read-back: compare the channel's members with the list in the ticket and write the missing members and their number in the ticket; that number is `$memberCount` for the re-add gate below. Nobody is added under this gate.

```bash
# read-only: the channel after the unarchive; is_archived reads false
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

Before the re-add gate: the list in the ticket was written before the archive, possibly months ago, so check each listed member's account first. For each one, run `node scripts/adapters/slack-client.js user --user [USER_ID] --execute` (read-only) and leave out anyone who now reads `deleted` true, `is_restricted` true or `is_ultra_restricted` true. Write each member left out in the ticket with the reason, then recount the members left: that count is `$memberCount`. A member who became a guest goes back into a channel only through the guest gates of `/slack-user-lifecycle`, never through this gate.

**Stop if:** a listed member now reads as a guest or deactivated and the ticket does not show them left out; the count of members left differs from `$memberCount`.

**Role needed:** a member of `#[CHANNEL_NAME]` who may add people to it, or a Workspace Owner or Workspace Admin [unverified: channel-invite permissions were not in the sources read].
<!-- SAFETY GATE [slack-guests-connect-readd-members-portal] -->
- **Target:** channel [CHANNEL_NAME] ([CHANNEL_ID]) and the `$memberCount` members the unarchive read-back found missing
- **Effect:** add back to one channel the members the ticket recorded before the archive and the unarchive read-back found missing
- **Scope:** one channel and exactly the `$memberCount` members on that list, nobody else; each one sees the channel's history at once
- **Reversibility:** R1 for one member, R2 for 2 to 10 members, R3 above 10 (a mass operation under SR-2, after the independent out-of-session review): the recorded list is the checkpoint; a person added by mistake comes out again under [slack-user-lifecycle-channel-remove-portal], having already seen the history
- **Required confirmation:** Render the number of missing members as `$memberCount`, then type exactly `ADD $memberCount RECORDED MEMBERS BACK TO SLACK CHANNEL [CHANNEL_NAME] [CHANNEL_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-guests-connect-readd-members-portal]:** Only after the unarchive read-back, the account read of each listed member with anyone left out written in the ticket, the missing members and their number in the ticket, for more than 10 members the independent out-of-session review of that list, and the exact match:
1. Slack → `#[CHANNEL_NAME]` → click the channel name in the header → the member list → add each member on the list, one by one (the add control's label was not in the sources read; confirm it on screen). Stop at the first person who is not on the list, and stop if the list no longer has `$memberCount` names.
2. GUI read-back: the member list of `#[CHANNEL_NAME]` matches the recorded list. The adapter does not read channel membership, so this GUI read-back is the proof.

**Verification checkpoint:** [ ] after an archive, `verify-archived` exit 0 and Directories lists the channel as archived · [ ] after an unarchive, the `channel` read shows `is_archived` false · [ ] after the re-add, the members match the recorded list, with the review in the ticket when more than 10 were added.

<details>
<summary>Slack Web API reads through the adapter: the scale version (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN: read-only; SLACK_TOKEN holds a read-scoped token and SLACK_TEAM_ID is [@Aegion_SLACK_TEAM_ID], both exported in the shell, never pasted into a ticket
# read-only: confirms which workspace and which account the token belongs to before any other read
node scripts/adapters/slack-client.js whoami --execute
# read-only: one page of members with is_restricted and is_ultra_restricted, for counting guests by type; repeat with --cursor from the previous page
node scripts/adapters/slack-client.js users --limit 200 --execute
# read-only: the workspace's name and ID, to match against [@Aegion_SLACK_TEAM_ID]
node scripts/adapters/slack-client.js team --execute
```
</details>

The writes behind these gates (`conversations.archive`, `conversations.unarchive`, `team.externalTeams.disconnect`, `admin.conversations.disconnectShared` and the shared-invite methods) are refused by the adapter; a person makes each change in Slack.

## ⚠️ Risk warning

- **A disconnect reaches further than the channel in the ticket.** It ends every channel and DM with that organization, including channels the other organization owns, and cannot be undone. Remove the organization from one channel when one channel is the problem.
- **What the partner already saw stays seen.** Approving an invitation is easy to reverse on paper and impossible in practice for anything posted while connected.
- **Slack Connect content is excluded from legal holds.** Do not connect a channel that someone expects a hold to cover.
- **Unarchive may not bring the members back.** Record the member list before archiving; it is the only rollback data.
- **Guests cost or count.** A multi-channel guest is billed as a member; single-channel guests are capped at five per paid active member.
- Labels came from search excerpts on 2026-10-27; a screen that does not match is a stop, not a guess.

## ✅ Verification checklist

- [ ] Guest: the profile shows the deactivation date; `verify-guest` exit 0; after the date, `verify-deactivated` exit 0.
- [ ] Invitation approved: Slack → `#[CHANNEL_NAME]` → channel name → Settings → Organizations lists `[EXTERNAL_DOMAIN]`, and the `channel` read shows the share complete.
- [ ] Invitation declined: nothing pending for `[EXTERNAL_DOMAIN]`.
- [ ] Removal or disconnect: the independent review is in the ticket, the organization is gone from Organizations or Slack Connect connections, and every recorded channel was read back.
- [ ] Archive: `verify-archived` exit 0 and Directories lists `#[CHANNEL_NAME]` as archived; after an unarchive, `is_archived` false; after the re-add, members match the recorded list (with the review in the ticket above 10).

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> **Completed (every read-back passed):** Slack `[@Aegion_SLACK_URL]`, ticket `[ISSUE_ID]`. Change: [time limit [date] set for guest `[USER_ID]` / Slack Connect invitation from `[EXTERNAL_DOMAIN]` to `#[CHANNEL_NAME]` approved or declined / `[EXTERNAL_DOMAIN]` removed from `#[CHANNEL_NAME]` / `[EXTERNAL_DOMAIN]` disconnected / `#[CHANNEL_NAME]` archived or unarchived / [N] recorded members added back to `#[CHANNEL_NAME]`], made by `[ADMIN_NAME]` in Slack after the exact phrase [and the independent review]. Pre-state in this ticket: [account type and previous date / member list / organizations and channels shared]. Read-back: [verify-guest / verify-deactivated / channel / verify-archived] exit 0 at [time]; Slack shows [observation]. Time spent: [X] min.
>
> **Partial state (a read-back failed or is pending):** Verified: [what passed, with the command and time]. Pending: [what has not passed, and when it will be read again]. Next owner: [role]. No further change until the pending read-back passes.

An administrator posts this note as a comment on [ISSUE_ID] in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]` (which prints the digest), and then reads the posted comment back:

```bash
# read-only: proves a comment on [ISSUE_ID] created after [NOT_BEFORE] has the prepared note's digest
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

A Slack Connect channel is one channel living in two organizations at once: "removing" a partner is really asking the other side to forget, and Slack only partly can, so the safe decisions are made at the invitation, not at the exit.

## Career upgrade

Treating external collaboration as a trust boundary with an approval, a recorded scope and a tested exit is the same third-party-access discipline security and GRC roles audit for.

## Next action

Run the Phase A reads for the ticket's guest or channel and copy the member list into the ticket before any archive.

**Sources (checked 2026-10-27):** slack.com/help/articles/202518103 (guest roles, time limits, 5 single-channel guests per paid member; search excerpt) · slack.com/help/articles/218124397 (Change account type path; search excerpt) · slack.com/help/articles/115005912706 (Slack Connect approval settings and per-organization rules; search excerpt) · slack.com/help/articles/360063030933 (disconnect from an organization; search excerpt) · slack.com/help/articles/360026489273 (remove an organization from a channel; search excerpt) · slack.com/help/articles/213185307 (archive or delete a channel, unarchive; search excerpt) · docs.slack.dev/reference/objects/conversation-object and /reference/objects/user-object (is_archived, is_ext_shared, deleted; search excerpt) · docs.slack.dev/apis/slack-connect/using-slack-connect-api-methods (search excerpt) · github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads, Bearer header; vendor repo, read in full) · github.com/slackapi/slack-api-specs web-api OpenAPI v2 (scopes, is_restricted and is_ultra_restricted; vendor repo, last updated 2021-09-07). No Slack page could be opened directly from this session.
