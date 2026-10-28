---
description: Slack incident communication that a person posts (for example "email is down for everyone"). Aegis drafts the status update, interim updates and the resolved follow-up; a human checks the channel, posts each draft behind its own exact-phrase gate, and verify-posted proves the posted text matches the draft. Aegis never sends. Placeholders only.
disable-model-invocation: true
---

# /slack-incident-comms

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[CHANNEL_NAME]` / `[CHANNEL_ID]` (the announcement channel, for example the IT announcements channel) · `[ISSUE_ID]` (the Linear incident ticket) · `[NOTE_FILE]` / `[NOTE_SHA256]` (a saved draft and its digest; every post has its own file and digest) · `[NOT_BEFORE]` (the time noted just before posting) · `[ADMIN_NAME]` · `[@Aegion]`, `[@Aegion_SLACK_TEAM_ID]` and other org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`). Lowercase fields in square brackets inside the drafts ([start time], [next update time]) are filled from verified facts before posting.

## ⚠️ Admin / safety gate

- **Aegis drafts; a person posts.** Aegis never sends a Slack message, reaction or pin. Every post below is a human step behind its own exact-phrase gate, and the read-back proves what landed.
- **Facts before words.** Every bracket in a draft is filled from evidence in `[ISSUE_ID]` (scope, start time, workaround); a sentence that cannot be filled is deleted, never guessed.
- **Right channel, right audience.** Confirm that `#[CHANNEL_NAME]` is not archived, is not shared with another organization (Slack Connect) and has no share with one pending, before posting internal incident details.
- **One post, one confirmation.** The status update, each interim update and the resolved follow-up get their own draft file, digest and typed confirmation; a phrase never carries into a later post.
- Posting is R1: one message, and the way back is a correction, posted as a new message through the same gate. Taking a post down is a message deletion, which this lane floors at T3, so it stays a planning-only preview here [slack-incident-comms-delete-post-preview]. An announcement reaches everyone at once: read the draft twice.
- Slack labels here come from Slack's search-indexed help pages and a 2019 Slack blog, not the live pages (the hosts could not be opened on 2026-10-27): confirm each label on screen.

## Inputs needed

- `[ISSUE_ID]` with the verified facts: what is down, for whom, since when, the workaround, who is working on it and when the next update is due.
- `[CHANNEL_NAME]` and `[CHANNEL_ID]` of the announcement channel.
- Who posts, and whether posting in that channel is limited to some people. **[org gap: the announcement channel's posting permission]**
- The update cadence. **[org gap: the incident-communication policy; until one exists, the incident owner sets the next-update time in each post]**
- Where staff go when Slack is also down. **[org gap: the fallback channel]**
- For the adapter reads: `SLACK_TEAM_ID` is `[@Aegion_SLACK_TEAM_ID]` and `SLACK_TOKEN` holds a token with `channels:read` and `channels:history` for a public announcement channel, or `groups:read` and `groups:history` for a private one (`whoami` needs no scope). Without the history scope every `verify-posted` read fails with `missing_scope`. The history scopes read message content, so the app that holds them needs the owner sign-off that `/slack-app-approval` asks for.

## How the systems hang together

- **Email is down, so Slack carries the news.** Diagnosis of a mail outage is `/gws-gmail-delivery`; the post-incident write-up is `/incident-report`; this runbook only carries the words in between.
- **Posting permissions.** On paid plans a channel's posting can be limited to make an announcement channel, and admins can limit who changes that (a 2019 Slack blog; current labels unconfirmed). By default any member who is not a guest can post and pin.
- **Pins are not records.** Any member can pin and unpin, so the ticket, not a pin, is the record of what was said.
- **The digest read-back.** The adapter's offline `digest` prints the SHA-256 of the whitespace-normalised draft and the exact verify-posted line; `verify-posted` reads the channel history from `[NOT_BEFORE]` and passes only when a person's plain message (no subtype, `bot_id` or `app_id`) has that digest. Any change to the text before or after posting changes the digest, so the draft is posted exactly as saved, as plain text.
- **The adapter cannot post.** It refuses chat.postMessage, chat.update, chat.delete, reactions.add and every POST before credentials or network.

## Fast path

1. Copy the drafts below and fill every bracket from `[ISSUE_ID]`.
2. Phase A: confirm the facts and the channel (R0).
3. Phase B: save the status update as `[NOTE_FILE]`, digest it, a person posts it (R1 gate), then `verify-posted`.
4. Phase C: interim updates at each promised time, each through Phase B again.
5. Phase D: only after the fix is verified, the resolved follow-up (R1 gate), then `verify-posted`.
6. The ticket note on `[ISSUE_ID]`.

## 💬 Message draft (a human posts it)

Plain text: no emoji, links or extra formatting, so the posted text keeps the draft's digest. Fill each bracket from the ticket or delete the sentence that holds it.

**Draft 1, status update (post now):**

```text
IT status: email is down for everyone
Since about [start time], nobody at [@Aegion] can send or receive email. Slack and phones still work.
What to do now: for anything urgent, message the person in Slack or call them. Please do not send test emails to IT.
What IT is doing: we are working on it. Ticket: [ISSUE_ID].
Next update: by [next update time], in this channel, or sooner if it is fixed.
```

**Draft 2, interim update (at each promised time):**

```text
IT status: email is still down
Update at [time]: [one sentence on what changed since the last update, or: no change yet, we are still working on it].
For anything urgent, use Slack or call.
Next update: by [next update time].
```

**Draft 3, resolved follow-up (only after the fix is verified):**

```text
IT status: email is working again
Email has worked normally since [fixed time]. Cause: [one sentence from the ticket, or: under review, a summary will follow].
What to do now: if an email you sent between [start time] and [fixed time] bounced or never arrived, send it again.
[Only if IT has confirmed it: mail sent to you in that window may arrive late.]
Still seeing a problem? Reply to this message or tell IT in [ISSUE_ID].
```

## Phase A: Confirm the facts and the channel (R0)

**Purpose:** post only true statements, in a channel that reaches the right people and nobody outside.

**GUI steps:**
1. Linear → `[ISSUE_ID]` → read the description and the latest comments: confirm scope, start time and workaround with the person working the outage (the mail checks are in `/gws-gmail-delivery`).
2. Slack → `#[CHANNEL_NAME]` → channel name in the header → read the channel details: the channel is not archived, and Settings → Organizations lists no other organization. If another organization is listed, this is a Slack Connect channel: do not post internal details there.
3. Confirm the person posting can post there; in an announcement channel only some people can (labels unconfirmed).

<details>
<summary>Read-only adapter reads (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN read-only. SLACK_TOKEN and SLACK_TEAM_ID are exported in the shell first, the token from an app a human installed with the read and history scopes in Inputs, and never pasted into a ticket
# shows which workspace the token belongs to, stop if it is not the one in SLACK_TEAM_ID
node scripts/adapters/slack-client.js whoami --execute
# reads the channel, is_archived must be false, is_ext_shared false and is_pending_ext_shared false, meaning not shared with another organization and no share pending
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```
</details>

**Stop if:** the channel is archived, shared with another organization (`is_ext_shared` true) or about to be (`is_pending_ext_shared` true: anything posted now could reach the partner once the share completes), or a fact in the draft is not in the ticket.

**Verification checkpoint:** [ ] the facts are confirmed in `[ISSUE_ID]` · [ ] the channel is not archived, not externally shared and has no share pending · [ ] the person posting can post there.

## Phase B: Post the status update (R1)

**Purpose:** a person posts the exact draft; the digest proves what landed.

**Prepare (offline, no token, no network):**
1. Fill the brackets in Draft 1 and save the final text as `[NOTE_FILE]`, a local text file outside the repository.
2. Run the digest below: it prints `[NOTE_SHA256]` and the exact verify-posted line to run after posting.
3. `[NOT_BEFORE]` is the `not_before` value the digest printed (it is earlier than the post). To note your own time instead, write it as an ISO 8601 time with a zone (for example 2026-10-27T18:30:00Z) or as epoch milliseconds; `verify-posted` refuses a local time such as 10:42 (exit 1).

```bash
# HUMAN-RUN offline, prints the SHA-256 of the whitespace-normalised draft and the exact verify-posted line, no token and no network
node scripts/adapters/slack-client.js digest --file [NOTE_FILE]
```

**Role needed:** a member who can post in `#[CHANNEL_NAME]`: by default any member who is not a guest; in an announcement channel, only the people its posting permission allows (labels from a 2019 Slack blog, unconfirmed).

<!-- SAFETY GATE [slack-incident-comms-status-post-portal] -->
- **Target:** [CHANNEL_NAME]
- **Effect:** post one incident status update to one channel, exactly as saved in [NOTE_FILE]
- **Scope:** one message in one channel; everyone in the channel sees it and may be notified
- **Reversibility:** R1: a wrong or outdated update is answered by a correction, posted as a new message through this same gate [slack-incident-comms-status-post-portal] with its own draft, digest and phrase; taking the post down is a deletion, a separately reviewed change [slack-incident-comms-delete-post-preview]; anyone who already read it has read it
- **Required confirmation:** Type exactly `SEND INCIDENT UPDATE TO [CHANNEL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-incident-comms-status-post-portal]:** Only after Phase A, the digest, and the exact match:
1. Slack → `#[CHANNEL_NAME]` → message box → paste the text of `[NOTE_FILE]` unchanged → **Send**.
2. Do not edit the message afterwards; an edit changes the text and the read-back fails. A correction is a new post through this phase.
3. GUI read-back: the message shows in `#[CHANNEL_NAME]` with the poster's name and time.

```bash
# HUMAN-RUN read-only read-back, passes only when a message posted after the noted time in the channel has the draft's digest
node scripts/adapters/slack-client.js verify-posted --channel [CHANNEL_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

If `verify-posted` fails while the message is visible, the posted text differs from the file (an edit, a changed character or added formatting): record the GUI read-back and the mismatch in `[ISSUE_ID]`, and do not repost just to make the check pass.

> **PREVIEW ONLY [slack-incident-comms-delete-post-preview]:** Planning only; nothing here authorizes deleting or unsending a posted update, in Phase B or Phase D. A deleted message is gone for good, this lane floors deleting messages at T3, and `/slack-retention-export` Phase E gates a message deletion at R3, so taking a post down is a separately reviewed change: record in `[ISSUE_ID]` which post, why (for example it carries data it should not), and who approved it. A mistake in the text is answered with a correction through the same gate instead. Slack's author menu (hover → ⋮ → Delete message) and the 15-second desktop unsend come from a search excerpt and are named here for planning only.

**Verification checkpoint:** [ ] `verify-posted` passes, or the mismatch is recorded with the GUI read-back · [ ] the digest is in the ticket.

## Phase C: Interim updates on the promised schedule

**Purpose:** keep the next-update promise even when nothing has changed.

1. At each promised time, fill Draft 2 and save it as a new `[NOTE_FILE]`; run Phase B again with it (a new digest, a new `[NOT_BEFORE]` and a new typed confirmation each time).
2. If nothing changed, say so in the draft; a missed update time costs more trust than an update with no news.

**Verification checkpoint:** [ ] every promised update went out with its own `verify-posted` result in the ticket.

## Phase D: The resolved follow-up (R1, only after the fix is verified)

**Purpose:** close the loop with what people should do now.

**Before:** the fix is verified in `[ISSUE_ID]` (for mail, the `/gws-gmail-delivery` verification checklist passed: a test message in and a test message out delivered); fill Draft 3, save it as a new `[NOTE_FILE]`, run the Phase B digest and take `[NOT_BEFORE]` from it (Phase B step 3 gives the formats).

**Role needed:** a member who can post in `#[CHANNEL_NAME]` (the same rule as Phase B).

<!-- SAFETY GATE [slack-incident-comms-resolved-post-portal] -->
- **Target:** [CHANNEL_NAME]
- **Effect:** post one resolved follow-up to one channel, exactly as saved in [NOTE_FILE]
- **Scope:** one message in one channel; everyone in the channel sees it and may be notified
- **Reversibility:** R1: a wrong follow-up is answered by a correction, posted as a new message through this same gate [slack-incident-comms-resolved-post-portal] with its own draft, digest and phrase; taking the post down is a deletion, a separately reviewed change [slack-incident-comms-delete-post-preview]; anyone who already read it has read it
- **Required confirmation:** Type exactly `SEND RESOLVED UPDATE TO [CHANNEL_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [slack-incident-comms-resolved-post-portal]:** Only after the fix is verified in the ticket, the digest, and the exact match:
1. Slack → `#[CHANNEL_NAME]` → message box → paste the text of `[NOTE_FILE]` unchanged → **Send**.
2. GUI read-back: the message shows in `#[CHANNEL_NAME]` with the poster's name and time.

```bash
# HUMAN-RUN read-only read-back, passes only when a message posted after the noted time in the channel has the follow-up's digest
node scripts/adapters/slack-client.js verify-posted --channel [CHANNEL_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

**Verification checkpoint:** [ ] `verify-posted` passes for the follow-up · [ ] the incident ticket moves on to `/incident-report` if the policy asks for one.

## ⚠️ Risk warning

- **Never post a cause, a time or a promise the ticket cannot support.** "Under review" is a complete answer; a wrong cause is hard to take back once everyone has read it.
- **Never post internal details into a Slack Connect channel** (shared with another organization) or an archived channel.
- **Deleting an announcement does not unsend what people read.** Read the draft twice before the confirmation.
- **Edits break the read-back and the record.** Post a correction as a new message through Phase B.
- **A pin is not a durable record**: any member can remove it; the ticket holds what was said and when.
- If Slack is also down, none of this reaches anyone; use the fallback channel from the inputs.

## ✅ Verification checklist

- [ ] Phase A: the facts are in `[ISSUE_ID]`; the `channel` read shows not archived, not externally shared and no share pending.
- [ ] Status update: `verify-posted` passed, or the mismatch is recorded with the GUI read-back.
- [ ] Interim updates went out at each promised time, each with its own `verify-posted` result.
- [ ] The resolved follow-up was posted only after the fix was verified, and `verify-posted` passed.
- [ ] No posted message was edited; corrections were new posts.

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed, only when every read-back passed] Incident communication for [ISSUE_ID] ([what was down]): status update posted to #[CHANNEL_NAME] at [time] by [ADMIN_NAME], [N] interim updates at [times], resolved follow-up at [time]. Each post was confirmed by its exact phrase and proved by verify-posted (digests recorded in this ticket). Aegis drafted; a person posted. Time spent: [X] min.
>
> [Partial state, keep open] Posted and verified: [which posts]. Pending: [the next update due at [time] / the resolved follow-up until the fix is verified / a verify-posted mismatch recorded with the GUI read-back]. Next owner: [ADMIN_NAME]; next step: [one line].

An administrator posts the note as a comment on [ISSUE_ID] in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the exact note and its SHA-256 digest ([NOTE_SHA256]) without credentials or network; here [NOTE_FILE] is the ticket note, a different file from the Slack drafts, the administrator notes the time just before posting as [NOT_BEFORE], and Aegis never posts it.

```bash
# HUMAN-RUN read-only read-back, passes only when a comment created after the noted time carries the prepared note's digest
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

An incident update is a promise with a timestamp: people plan around the next-update time, so keeping that promise matters more than having news.

## Career upgrade

Drafting, digesting and verifying a message that a person posts is separation of duties in miniature, the same split change management and incident command rely on: the system proposes and proves, the accountable person acts.

## Next action

Fill Draft 1 from `[ISSUE_ID]`, run Phase A on `#[CHANNEL_NAME]`, then hand the saved file, its digest and the confirmation phrase to whoever posts.

**Sources (checked 2026-10-27):** slack.com/help/articles/202395258-Edit-or-delete-messages (deleting a message, the 15-second unsend on desktop; search excerpt) · slack.com/help/articles/205239997 (pins, any member can pin and unpin; search excerpt) · slack.com/help/articles/360026489273-Remove-organizations-from-a-Slack-Connect-channel (channel name, Settings, Organizations; search excerpt) · slack.com/blog/transformation/managing-slack-at-scale-announcement-channels-and-new-admin-apis (posting permissions on paid plans, 2019; search excerpt) · docs.slack.dev/reference/objects/conversation-object (is_archived, is_ext_shared; search excerpt) · github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py (conversations.history and the write methods the adapter refuses; vendor repo) · github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_examples.json (conversations.history fields; vendor repo, last updated 2021).
