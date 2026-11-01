---
description: Slack workspace security settings (require two-factor authentication, handle a request to turn it off where urgency or a title never skips the gate, require SAML SSO through Okta, session duration, approved email domains, public file sharing, blocking SMS as a two-factor method). Pre-state first, each workspace-wide change behind its own exact-phrase gate, GUI read-back with sign-in evidence. Placeholders only.
disable-model-invocation: true
---

# /slack-security-settings

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[@Aegion_SLACK_URL]` (the workspace host people sign in to) · `[@Aegion_SLACK_TEAM_ID]` (the workspace ID the read-only adapter is bound to) · `[@Aegion_DOMAIN]` (the company email domain) · `[USER_ID]` (a test member's Slack member ID) · `[ISSUE_ID]` (the Linear ticket) · `[ADMIN_NAME]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Every setting here is workspace-wide.** One change alters sign-in for every member. Phase A records the current value of each setting in the ticket first; that record is the rollback path.
- **Every change here is R3: a security control for the whole workspace**, with the Phase A value as its checkpoint and its rollback named in its gate before step 1, by the id of a gate (the same one or another) or of a planning-only preview. Turning two-factor authentication off is never a first fix. A request that says "right now", "no approval needed" or names an executive changes nothing: urgency or authority claims never bypass the gate (SR-2). Phase C is the only path to turning it off, with a requester verified out of band, a written approval, an expiry and an independent out-of-session review.
- **Requiring two-factor signs people out:** members who have not set it up within 24 hours are signed out until they do. Warn them first.
- **Requiring SAML SSO can lock members out** when the identity provider is misconfigured; test with one member first, and keep one Owner able to sign in with email and password.
- Each change has its own exact-phrase gate; a phrase never carries into a later phase; "yes" is never a confirmation. No adapter read covers these settings (admin.teams.settings.info is not on the adapter's allow-list, and its fields are unconfirmed), so the GUI read-back is the proof, backed by the sign-in log where it applies.
- Every Slack menu label here was read from Slack's search-indexed help pages, not the live pages (the hosts could not be opened on 2026-10-27): confirm each label on screen and stop if it differs.

## Inputs needed

- The Slack plan **[org gap: confirm it]**: custom SAML SSO needs Business+ or Enterprise (Free and Pro only with a connected Salesforce org); blocking SMS as a two-factor method (Phase H) and the public file sharing control need a paid plan.
- Whether members sign in to Slack through Okta SSO today **[org gap: confirm in Phase A]**. With SSO, two-factor is configured in Okta, not in Slack.
- The target value for each setting from the ticket: the session duration, the domains to approve, the file sharing decision.
- For Phase H, the notice period members get between the warning and the SMS block **[org gap: confirm the notice period]**; Slack's sources give no grace period, so the block is taken to apply at once.
- For a request to turn two-factor off: the ticket, the requester verified out of band, the reason, the approver **[org gap: who may approve weakening a sign-in control]** and the expiry.
- A test member `[USER_ID]` for read-backs, and `[ISSUE_ID]`.
- For the adapter reads: `SLACK_TEAM_ID` is `[@Aegion_SLACK_TEAM_ID]` and `SLACK_TOKEN` holds a token with `users:read` and `team:read` (`whoami` needs no scope). The sign-in log read (`access-logs`) needs the `admin` scope, which also authorizes Slack's SCIM API (a SCIM delete deactivates a member), so it reads a separate admin's user token from `SLACK_ACCESS_LOGS_TOKEN`, exported for that one read and unset right after, never put in `SLACK_TOKEN`.

## How the systems hang together

- **Email sign-in against SSO.** Slack's two-factor setting governs email-and-password sign-in. With SSO, members sign in through Okta, so two-factor lives in Okta. Only Owners and Admins can bypass SSO with email and password, and Owners and Admins must use two-factor themselves even when it is not mandatory.
- **SAML.** Slack's entity ID is `https://slack.com` and the post-back URL is `https://[@Aegion_SLACK_URL]/sso/saml`. Slack does not honor the identity provider's session length or Single Logout, and SSO overrides the workspace's sign-up preferences (approved domains).
- **Session duration** is Slack's own setting, desktop and mobile separately: it can sign members out when they close Slack or after a set period, warns them 2 hours and 15 minutes before, applies from that day and expires sessions gradually.
- **Approved email domains** let anyone with an address at that domain join; the domains show on the sign-in page.
- **Public file sharing** is one permission; Slack Connect file-upload permissions are separate.
- **The read-only adapter** (`scripts/adapters/slack-client.js`, GET only, bound to `[@Aegion_SLACK_TEAM_ID]`) confirms the workspace (`whoami`, `team`), reads one member (`user`, including `has_2fa`, a field from Slack's 2021 API spec whose visibility to the token is unconfirmed) and reads sign-ins (`access-logs`, paid plans, with its own admin-scope token in `SLACK_ACCESS_LOGS_TOKEN`). It changes no setting.

## Fast path

1. Phase A: record every current value in the ticket (R0).
2. Phase B: require two-factor (R3 gate). **WAIT UNTIL** the 24-hour window passes and the sign-in log shows members back.
3. Phase C: a request to turn two-factor off. Verify the requester, find the real problem, and use the R3 gate only as a written temporary exception after review.
4. Phase D: require SAML SSO (R3 gate) after one test member signs in through Okta.
5. Phase E: session duration (R3 gate, every member's sessions). **WAIT UNTIL** sessions expire over the chosen period.
6. Phase F: approved email domains (R3 gate, who can join the workspace).
7. Phase G: public file sharing off (R3 gate, the whole workspace).
8. Phase H: block SMS as a two-factor method (R3 gate, paid plans), only after Phase B reads required and the notice period recorded in the ticket has passed, and never while the person making the change or the Owner kept able to sign in still uses SMS codes.

## Phase A: Read every setting and record the pre-state (R0)

**Purpose:** each later gate restores from this record, so it is written before anything changes.

**GUI steps:**
1. Slack → Admin → Workspace settings → Security → read Two-factor authentication for email sign-in (on a paid plan, also whether SMS is allowed as a method; that label was not in the sources read), SSO & authentication, Desktop session duration and Mobile session duration. Older layout: Slack → the workspace name → Tools & settings → Workspace settings.
2. Enterprise: Slack → Organization settings → Security → Security settings → read Two-factor authentication for email sign-in.
3. Slack → Admin → Workspace settings → read the setting that lets people with approved email domains join, and who may invite (by default members, not guests; Owners and Admins can require approval).
4. Slack → Admin → Workspace settings → Permissions → Public File Sharing → read whether it is on.
5. Write every value into `[ISSUE_ID]` (text or screenshot).

<details>
<summary>Read-only adapter reads, the scale version (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN read-only. SLACK_TOKEN and SLACK_TEAM_ID are exported in the shell first, the token from an app a human installed with users:read and team:read, and never pasted into a ticket
# shows which workspace the token belongs to, stop if it is not the one in SLACK_TEAM_ID
node scripts/adapters/slack-client.js whoami --execute
# reads the workspace name, ID and domain
node scripts/adapters/slack-client.js team --execute
# reads one test member, including has_2fa where the token may see it
node scripts/adapters/slack-client.js user --user [USER_ID] --execute
# reads recent sign-ins by user, IP and user agent, on paid plans
# SLACK_ACCESS_LOGS_TOKEN holds a separate admin-scope user token, exported for this one read and unset right after, never SLACK_TOKEN
node scripts/adapters/slack-client.js access-logs --execute
```
</details>

**Stop if:** `whoami` shows a team other than `[@Aegion_SLACK_TEAM_ID]`, or a value cannot be read.

**Verification checkpoint:** [ ] every setting this ticket touches has its current value in `[ISSUE_ID]` · [ ] SSO in use or not is recorded.

## Phase B: Require two-factor authentication (R3)

**Purpose:** make two-factor mandatory for email-and-password sign-in.

**Before:** with SSO, set two-factor in Okta instead and skip this phase; announce the change and the 24-hour window to members. This phase leaves the allowed two-factor methods as Phase A recorded them; SMS is changed only in Phase H, under its own gate.

**Role needed:** Workspace Owner or Workspace Admin; on Enterprise, Org Owner or Org Admin (Organization settings).

<!-- SAFETY GATE [slack-security-settings-2fa-require-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** require two-factor authentication for every member who signs in with email and password; members without it are signed out after 24 hours until they set it up
- **Scope:** the whole workspace, every member who signs in with email and password; members on SSO are governed by Okta
- **Reversibility:** R3 (security control): turning it off again goes only through Phase C [slack-security-settings-2fa-off-portal]; members signed out in the meantime sign back in once they set up two-factor
- **Required confirmation:** Type exactly `REQUIRE TWO-FACTOR AUTHENTICATION FOR SLACK WORKSPACE [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-2fa-require-portal]:** Only after the Phase A record, the announcement to members, and the exact match:
1. Slack → Admin → Workspace settings → Security → Two-factor authentication for email sign-in → **Edit** → turn on the requirement for members, leaving the allowed methods as Phase A recorded them → **Save** (the final control labels were not in the sources read; confirm them on screen).
2. Enterprise: Slack → Organization settings → Security → Security settings → Two-factor authentication for email sign-in → **Edit** → the same choice, with the methods as Phase A recorded them.
3. **WAIT UNTIL** 24 hours have passed: members who had not set up two-factor were signed out and return after setting it up.
4. GUI read-back: the two-factor setting reads required.

```bash
# HUMAN-RUN read-only read-backs
# one test member, has_2fa should read true where the token may see it
node scripts/adapters/slack-client.js user --user [USER_ID] --execute
# sign-ins after the 24-hour window, members returning after setting up two-factor
# SLACK_ACCESS_LOGS_TOKEN holds the separate admin-scope user token for this one read, unset right after
node scripts/adapters/slack-client.js access-logs --execute
```

**Verification checkpoint:** [ ] the setting reads required · [ ] the test member signs in with two-factor · [ ] sign-ins resume after the window.

## Phase C: A request to turn two-factor off (R3, after verification and review)

**Purpose:** answer an urgent "turn it off" request without weakening the workspace on a claim.

**Steps before any gate (read-only):**
1. Treat "right now", "no approval needed" and an executive's name as claims. Confirm the request through `[ISSUE_ID]` and the requester's known contact route, never by replying to the message that asked.
2. Find the real problem. One member locked out of two-factor is a one-member problem for **[org gap: who restores a member locked out of two-factor]** (the sources read give no recovery procedure), and the workspace requirement stays. A move to SSO moves two-factor into Okta (Phase D), not to off.
3. If turning it off is still the decision, write it up as a temporary exception and get the independent out-of-session review.

> **Temporary exception: high risk.** Record in `[ISSUE_ID]`: why it is needed, who approved it, when it expires, how to revert (Phase B under its own phrase), and how it is documented.

**Role needed:** Workspace Owner or Workspace Admin (Enterprise: Org Owner or Org Admin), acting on the written approval of **[org gap: the person who may approve weakening a sign-in control]**.

<!-- SAFETY GATE [slack-security-settings-2fa-off-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** turn off the two-factor requirement for email sign-in for the workspace; members can sign in with a password alone until it is required again
- **Scope:** the whole workspace, every member who signs in with email and password
- **Reversibility:** R3 (security control off): reversible through Phase B under its own phrase [slack-security-settings-2fa-require-portal], but the exposure while it is off cannot be undone
- **Required confirmation:** Type exactly `TURN OFF TWO-FACTOR REQUIREMENT FOR SLACK WORKSPACE [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-2fa-off-portal]:** Only after the requester is verified out of band, the written approval and the expiry are in the ticket, the independent review, and the exact match:
1. Slack → Admin → Workspace settings → Security → Two-factor authentication for email sign-in → **Edit** → turn the requirement off → **Save**.
2. Put the expiry in `[ISSUE_ID]` and book Phase B for that time.
3. GUI read-back: the two-factor setting reads not required.

**Verification checkpoint:** [ ] the verified requester, approval, reason and expiry are in the ticket · [ ] the setting reads not required · [ ] Phase B is booked for the expiry.

## Phase D: Require SAML single sign-on through Okta (R3)

**Purpose:** move Slack sign-in to Okta so one identity provider controls access and two-factor.

**Before:** the Slack SAML app exists in Okta **[org gap: Okta app set-up]**, with Slack's entity ID `https://slack.com` and post-back URL `https://[@Aegion_SLACK_URL]/sso/saml`; one test member has signed in through Okta; one Owner can still sign in with email and password.

**Role needed:** Workspace Owner (Org Owner on Enterprise); custom SAML SSO is for Workspace Owners and Org Owners, so a Workspace Admin cannot set it up.

<!-- SAFETY GATE [slack-security-settings-saml-require-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** require SAML single sign-on through the identity provider for every member of the workspace
- **Scope:** the whole workspace; members then sign in through Okta, sign-up preferences such as approved domains are overridden, and only Owners and Admins can still bypass SSO with email and password
- **Reversibility:** R3 (security control with lock-out risk): the Phase A value is the checkpoint; returning SSO to optional reopens email-and-password sign-in for every member, so it is a separately reviewed change [slack-security-settings-saml-optional-preview], made by the Owner kept able to sign in with email and password; its path was not described in the sources read
- **Required confirmation:** Type exactly `REQUIRE SAML SSO FOR SLACK WORKSPACE [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-saml-require-portal]:** Only after the test sign-in through Okta, the Phase A record, the independent review (Okta and Slack together make it a multi-system change), and the exact match:
1. Slack → Admin → Workspace settings → Security → SSO & authentication → enter the identity provider's SAML values → test → make SSO required for members → **Save** (the required-or-optional labels were not in the sources read; confirm them on screen).
2. **WAIT UNTIL** members sign in again through Okta. Slack's own session duration (Phase E), not Okta's, decides when existing sessions end.
3. GUI read-back: SSO & authentication shows SSO required.

```bash
# HUMAN-RUN read-only read-back, sign-ins after the change, members arriving through Okta
# SLACK_ACCESS_LOGS_TOKEN holds the separate admin-scope user token for this one read, unset right after
node scripts/adapters/slack-client.js access-logs --execute
```

> **PREVIEW ONLY [slack-security-settings-saml-optional-preview]:** Planning only; nothing here authorizes making SSO optional again. It reopens email-and-password sign-in for every member, where Slack's own two-factor setting (Phase B) applies instead of Okta's, so it is a separately reviewed change with a written reason, an approver and the independent review, like Phase C. The Owner kept able to sign in with email and password makes it, restoring the Phase A value in SSO & authentication. The control that returns SSO to optional was not described in the sources read (the research marks that path unverified): confirm it on screen before anyone plans the change.

**Verification checkpoint:** [ ] SSO reads required · [ ] the test member and one other member signed in through Okta · [ ] an Owner can still sign in with email and password.

## Phase E: Session duration (R3)

**Purpose:** decide how long Slack sessions live, since Slack ignores Okta's session length.

**Role needed:** Workspace Owner or Workspace Admin (Enterprise: Org Owner or Org Admin); the sources read name Owners and Admins for this group of settings but not per setting, so when the control is greyed out, escalate to a Workspace Owner. Which plans offer the setting was not in the sources read **[org gap: confirm on screen]**.

<!-- SAFETY GATE [slack-security-settings-session-duration-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** set the desktop or mobile session duration for the workspace; sessions end gradually over the chosen period
- **Scope:** every member's desktop or mobile sessions; members are warned 2 hours and 15 minutes before a session ends; the change applies from that day
- **Reversibility:** R3 (a sign-in control for every member): the Phase A value is the checkpoint; restore it through this same gate [slack-security-settings-session-duration-portal] with a new typed confirmation; sessions that already ended stay ended and those members sign in again
- **Required confirmation:** Type exactly `SET SLACK SESSION DURATION FOR [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-session-duration-portal]:** Only after the Phase A value is recorded and the exact match:
1. Slack → Admin → Workspace settings → Security → Desktop session duration (or Mobile session duration) → **Edit** → pick the duration from the ticket → **Save**.
2. **WAIT UNTIL** the chosen period has passed; sessions end gradually, not at once.
3. GUI read-back: the setting shows the new value.

**Verification checkpoint:** [ ] the setting shows the ticket's value · [ ] the old value is in the ticket.

## Phase F: Approved email domains (R3)

**Purpose:** control which addresses can join without an invitation.

**Role needed:** Workspace Owner or Workspace Admin; the sources read do not name the role per setting, so when the control is greyed out, escalate to a Workspace Owner.

<!-- SAFETY GATE [slack-security-settings-approved-domains-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** change the list of approved email domains whose addresses can join the workspace without an invitation
- **Scope:** sign-up for the whole workspace: anyone with an address at a listed domain, for example `[@Aegion_DOMAIN]`, can join; the domains show on the sign-in page; when SSO is required, SSO overrides this setting
- **Reversibility:** R3 (who can join the workspace): the Phase A list is the checkpoint; restore it through this same gate [slack-security-settings-approved-domains-portal] with a new typed confirmation; anyone who joined while a domain was listed keeps the account until it is reviewed with `/slack-user-lifecycle`
- **Required confirmation:** Type exactly `CHANGE SLACK APPROVED EMAIL DOMAINS FOR [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-approved-domains-portal]:** Only after the Phase A list is recorded and the exact match:
1. Slack → Admin → Workspace settings → expand the setting that lets people with approved email domains join → enter the domains from the ticket → **Save**.
2. GUI read-back: the setting lists exactly the intended domains, and the sign-in page shows them.

**Verification checkpoint:** [ ] the list matches the ticket · [ ] the old list is in the ticket.

## Phase G: Public file sharing off (R3)

**Purpose:** stop members creating public links to files.

**Role needed:** Workspace Owner or Workspace Admin (paid plans); the sources read do not name the role per setting, so when the control is greyed out, escalate to a Workspace Owner.

<!-- SAFETY GATE [slack-security-settings-file-sharing-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** disable public file sharing for the workspace
- **Scope:** the whole workspace; Slack Connect file-upload permissions are separate and unchanged; what happens to links already shared was not in the sources read
- **Reversibility:** R3 (a sharing control for the whole workspace): the Phase A value is the checkpoint; turning public file sharing back on reopens public links, so it is a separately reviewed change [slack-security-settings-file-sharing-on-preview]
- **Required confirmation:** Type exactly `DISABLE PUBLIC FILE SHARING FOR SLACK WORKSPACE [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-file-sharing-portal]:** Only after the Phase A value is recorded and the exact match:
1. Slack → Admin → Workspace settings → Permissions → Public File Sharing → Expand → untick the checkbox → **Save**.
2. GUI read-back: Public File Sharing shows off. Test one existing public link from a signed-out browser and record the result, because the sources read do not say whether old links stop working.

> **PREVIEW ONLY [slack-security-settings-file-sharing-on-preview]:** Planning only; nothing here authorizes turning public file sharing back on. It reopens public links to files, so it is a separately reviewed change with a written reason and an approver. Its path is the same control as Phase G step 1, restoring the Phase A value.

**Verification checkpoint:** [ ] the permission reads off · [ ] the old-link result is in the ticket.

## Phase H: Block SMS as a two-factor method (R3, paid plans)

**Purpose:** stop text-message codes as a second factor without locking out the members who rely on them.

**Before:** Phase B is done and the requirement reads required; Phase A recorded whether SMS is allowed (the pre-state and the rollback value); members were told the date SMS codes stop working and asked to set up another method first, and the notice period from Inputs is in the ticket. The sources read do not say how to list the members who use SMS, so the warning goes to everyone who signs in with email and password; they give no grace period either (a search excerpt says only that paid plans can block SMS), so the block is taken to apply at once. The person making the change and the Owner kept able to sign in with email and password (Phase D) each write in the ticket that their own two-factor method is not SMS. With SSO, two-factor methods are set in Okta instead: skip this phase.

**Stop if:** the notice period recorded in the ticket has not passed; the person making the change or the Owner kept able to sign in still uses SMS codes; Phase B does not read required.

**WAIT UNTIL** the notice period recorded in the ticket has passed since the warning went out; nothing in Slack counts it down, so the ticket holds the warning's date and the notice period.

**Role needed:** Workspace Owner or Workspace Admin; on Enterprise, Org Owner or Org Admin (Organization settings).

<!-- SAFETY GATE [slack-security-settings-sms-block-portal] -->
- **Target:** [@Aegion_SLACK_URL]
- **Effect:** block SMS as a two-factor method for the workspace; members who sign in with an SMS code must use another method from then on
- **Scope:** the whole workspace, every member who signs in with email and password and uses SMS codes (paid plans); members on SSO are governed by Okta
- **Reversibility:** R3 (security control with lock-out risk): the Phase A value is the checkpoint; allowing SMS again weakens two-factor, so it is a separately reviewed change [slack-security-settings-sms-allow-preview]; a member locked out in the meantime goes to [org gap: who restores a member locked out of two-factor], which is no reason to undo the block
- **Required confirmation:** Type exactly `BLOCK SMS TWO-FACTOR FOR SLACK WORKSPACE [@Aegion_SLACK_URL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (a workspace setting no Slack verify-* command reads: its proof is the read its step names)
**PORTAL ACTION [slack-security-settings-sms-block-portal]:** Only after Phase B reads required, the Phase A value, the warning to members, the notice period recorded in the ticket has passed, and the exact match:
1. Slack → Admin → Workspace settings → Security → Two-factor authentication for email sign-in → **Edit** → turn off SMS as an allowed method, changing nothing else → **Save**. A search excerpt says paid plans can block SMS; the control's label was not in the sources read, so if the dialog shows no such control, stop.
2. Enterprise: Slack → Organization settings → Security → Security settings → Two-factor authentication for email sign-in → **Edit** → the same choice.
3. GUI read-back: the two-factor setting still reads required, and SMS reads not allowed.

> **PREVIEW ONLY [slack-security-settings-sms-allow-preview]:** Planning only; nothing here authorizes allowing SMS again. Allowing it weakens two-factor, so, like Phase C, it needs a verified requester, a written approval, an expiry and a review before anyone changes it. The path for that separate change is the same Edit dialog as Phase H step 1, restoring the Phase A value.

**Verification checkpoint:** [ ] the setting reads required with SMS not allowed · [ ] the Phase A value, the warning's date and the notice period are in the ticket · [ ] the person making the change and the Owner kept able to sign in each recorded a method other than SMS.

## ⚠️ Risk warning

- **Workspace-wide means everyone at once.** Record the old value before each change; there is no per-member preview.
- **Two-factor off is a security control off.** Never the first fix, never on urgency or a title alone, always with a verified requester, approval, expiry and review, and always with Phase B booked to undo it.
- **Two-factor on signs people out after 24 hours** if they have not set it up; announce it first.
- **SAML can lock members out.** Test with one member, keep an Owner able to sign in with email and password, and remember Slack ignores Okta's session length and Single Logout.
- **Approved domains open the door.** Anyone with an address at a listed domain can join; review who joined while a domain was listed.
- **Turning public file sharing off may not end links already shared** (not in the sources read); test one.
- **Blocking SMS can strand members who use only SMS codes.** Warn everyone first and wait out the notice period; never block while the person making the change or the Owner kept able to sign in uses SMS codes; a stranded member goes to [org gap: who restores a member locked out of two-factor], not a reason to allow SMS again.

## ✅ Verification checklist

- [ ] `whoami` showed team `[@Aegion_SLACK_TEAM_ID]`; the Phase A values are in `[ISSUE_ID]`.
- [ ] Two-factor: the Security page reads required, or, after Phase C, not required with the verified requester, approval, reason, expiry and booked Phase B in the ticket.
- [ ] SAML: SSO reads required; the access logs show members signing in through Okta; an Owner can still sign in with email and password.
- [ ] Session duration: the setting shows the ticket's value.
- [ ] Approved domains: the setting and the sign-in page list exactly the intended domains.
- [ ] Public file sharing: the permission reads off and the old-link test result is recorded.
- [ ] SMS: the two-factor setting reads required with SMS not allowed, and the Phase A value is in the ticket.

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed, only when every read-back passed] Slack `[@Aegion_SLACK_URL]`: [two-factor required / two-factor requirement turned off as a temporary exception until [expiry], approved by [approver] / SAML SSO required through Okta / [desktop or mobile] session duration set to [value] / approved email domains changed to [list] / public file sharing turned off / SMS blocked as a two-factor method] on [date/time] by [ADMIN_NAME], confirmed by the exact phrase[, after independent review]. Pre-state recorded in this ticket: [old value]. Read-back: the GUI shows [new value][; the access logs show sign-ins after the change]. Time spent: [X] min.
>
> [Partial state, keep open] Verified: [what passed]. Pending: [for example the 24-hour two-factor window, members still to sign in through Okta, or the old-link test]. Next owner: [ADMIN_NAME or team]; next step: [one line].

An administrator posts the note as a comment on [ISSUE_ID] in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the exact note and its SHA-256 digest ([NOTE_SHA256]) without credentials or network; the administrator notes the time just before posting as [NOT_BEFORE], and Aegis never posts it.

```bash
# HUMAN-RUN read-only read-back, passes only when a comment created after the noted time carries the prepared note's digest
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

Slack has two front doors, email-and-password and SSO, and each security setting guards only one of them: two-factor in Slack guards the email door, Okta guards the SSO door, and Owners keep a key to both, which is why their own two-factor is never optional.

## Career upgrade

Recording the pre-state, changing one control behind a typed confirmation and proving it with a read-back is the change-management loop security engineering and compliance audits expect to see.

## Next action

Run Phase A and write every current value into `[ISSUE_ID]`; for an urgent "turn two-factor off" request, start at Phase C step 1.

**Sources (checked 2026-10-27):** slack.com/help/articles/212221668 (mandatory two-factor, 24-hour sign-out, SMS restriction, Owners and Admins; search excerpt) · slack.com/help/articles/205168057 (custom SAML SSO, plans and roles, entity ID and post-back URL, IdP session length and Single Logout not honored; search excerpt) · slack.com/help/articles/115005223763-Manage-session-duration (desktop and mobile durations, warnings, gradual rollout; search excerpt) · slack.com/help/articles/115004856503 (approved email domains, SSO overrides sign-up preferences; search excerpt) · slack.com/help/articles/201330256 (who can invite, invitation approval; search excerpt) · slack.com/help/articles/4412651915539-Manage-public-file-sharing (Public File Sharing path and roles; search excerpt) · docs.slack.dev/reference/methods/admin.teams.settings.info (Enterprise settings read, fields unconfirmed; search excerpt) · docs.slack.dev/reference/methods/team.accessLogs and /reference/methods/auth.test (sign-in log on paid plans, token identity; search excerpt) · github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py (method names; vendor repo) · github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_examples.json (user field has_2fa; vendor repo, last updated 2021).
