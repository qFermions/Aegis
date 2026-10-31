---
description: Okta group membership. Add one person (R1), remove one person (R2), create, change or deactivate a group rule (R3), or move more than 10 people at once (R3). A group can be assigned apps, so membership is app access. Every change is a human step behind its own exact-phrase gate, proved by a read-only connector read-back. Placeholders only.
disable-model-invocation: true
---

# /okta-group-membership

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[UPN]` (the person's Okta username) · `[OKTA_USER_ID]` (their Okta user ID, starts `00u`) · `[GROUP_NAME]` (the Okta group's name) · `[OKTA_GROUP_ID]` (its ID, starts `00g`) · `[RULE_ID]` (a group rule's ID) · `[APP_NAME]` / `[APP_ID]` (an app the group is assigned, ID starts `0oa`) · `[NOT_BEFORE]` (the UTC time in ISO 8601, such as `2026-10-28T09:00:00Z`, written in the ticket just before a change) · `[N]` (the number of people on a change list) · `[JIRA-###]` · `[@Aegion_OKTA_ORG_URL]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `okta:verify-group-member`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`). Name the read-back with the flags on its line below that change what its pass means, such as `okta:verify-group-member --absent` for a removal, and run the line with the same flags: a read with other flags is refused under the change and never counts for it.

## ⚠️ Admin / safety gate

- **Add one person** is R1: one user, one group, undone by the separate remove gate. It also gives the person every app the group is assigned.
- **Remove one person** is R2: the person loses every app the group grants at once, and with **Deactivate User** provisioning on an app, Okta deactivates their account in that app. Save the checkpoint first.
- **A group rule created, changed or deactivated** is R3: one rule moves many people, and their apps, at once. Checkpoint, written rollback and an independent out-of-session review come before the phrase.
- **More than 10 people at once** is R3 (SR-2 mass operation): the same checkpoint, rollback and review, and the count goes into the phrase.
- Every change below has its own exact-phrase gate. A phrase never carries into a later phase; "yes" is never a confirmation.
- Every change ends with a read-only connector read-back (`scripts/adapters/okta-client.js`: GET only, it cannot change anything in Okta). A read-back proves a change only against the pre-state Phase A recorded: a person who was already a member passes `verify-group-member` with nothing changed.
- Okta Admin Console paths here come from the vendor facts checked on 2026-10-28 (assign people to a group, the Rules tab). Every other label is marked **[unconfirmed: check in the Okta Admin Console]**: confirm it on screen and stop if the screen differs.
- Not done until every read-back in the final checklist passes.

## Inputs needed

- `[UPN]` and `[OKTA_USER_ID]`; `[GROUP_NAME]` and `[OKTA_GROUP_ID]`; `[JIRA-###]`.
- The change: one person in, one person out, a rule, or a list of more than 10 people.
- Which apps the group is assigned and whether any has **Deactivate User** provisioning on: **[org gap: read it in Phase A]**.
- For a rule: `[RULE_ID]` (for a change or a deactivation), the old and the new condition, and the predicted number of people who move: **[org gap: from the requester and the Phase A reads]**.
- For more than 10 people: the change list (one `[OKTA_USER_ID]` per person) and its count `[N]`, written in the change record before the gate.
- Who reviews an R3 change out of session: **[org gap: name the reviewer]**.
- For the connector: `OKTA_ORG_URL` set to `[@Aegion_OKTA_ORG_URL]` as a bare hostname, and the read-only service app's `OKTA_CLIENT_ID` and `OKTA_PRIVATE_KEY` exported from the secret manager, never pasted into a ticket. It asks for the four Okta read scopes only and refuses a token that also grants a write scope. Without `--execute` a command prints its planned GET and sends nothing.

## How group membership works

- **A group can be assigned apps.** Every member gets a Group-type assignment for each app assigned to the group (`/okta-app-assignment`). Adding a person gives them all of those apps at once; with provisioning on, Okta creates or reactivates their account in each app.
- **Removing a person takes those Group assignments away.** An Individual assignment for the same app, or another group that grants it, keeps the app. With **Deactivate User** provisioning on an app, Okta deactivates the person's account in that app when the app is unassigned, and assigning the app again reactivates it.
- **Group rules** add people to a group when their profile matches the rule's condition. A rule's status reads ACTIVE, INACTIVE or INVALID.
- **Rule-managed groups.** Removing someone from a group a rule fills needs the rule changed or the person excluded from it (Phase D). A support-site search excerpt says a manual removal adds the person to the rule's exclusion list; that is **[unconfirmed: check in the Okta Admin Console]**, so this runbook never relies on it.
- **The System Log** records `group.user_membership.add` and `group.user_membership.remove`.
- **The read-only connector** proves membership with `verify-group-member`: the user read first, then up to 10 pages of 200 members. In a group of more than 2,000 members a person not found on those pages proves nothing either way; read the membership in the Admin Console instead.

## Fast path

1. Phase A: read the group, its members, its rules, the person's groups and the apps the group grants; record the pre-state (R0).
2. Phase B: one person in (R1 gate). Read back with `verify-group-member`.
3. Phase C: one person out (R2 gate, checkpoint first). A rule-managed group goes to Phase D instead. Read back with `verify-group-member --absent`.
4. Phase D: a group rule created, changed or deactivated (R3 gates, review first). **WAIT UNTIL** the rule has run.
5. Phase E: more than 10 people at once (R3 gates, checkpoint, rollback, review).
6. Verify every read-back, then write the ticket note.

## Phase A: Read first and record the pre-state (R0)

**Purpose:** know who is in the group, what fills it and what it grants before anything changes.

**GUI steps:**
1. Okta Admin Console → Directory → Groups → `[GROUP_NAME]` → read the member count, the members and the apps the group is assigned **[unconfirmed: check in the Okta Admin Console where the group page lists members and apps]**.
2. Okta Admin Console → Directory → Groups → **Rules** tab → read every rule, its status, and whether it adds people to `[GROUP_NAME]` **[unconfirmed: check in the Okta Admin Console where a rule shows its target group]**.
3. For each app the group is assigned, read the app's Assignments tab and its **Deactivate User** setting with `/okta-app-assignment` Phase A.

<details>
<summary>Read-only connector reads, the pre-state (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN read-only. OKTA_ORG_URL, OKTA_CLIENT_ID and OKTA_PRIVATE_KEY are exported in the shell first
# the group record, to confirm [OKTA_GROUP_ID] is [GROUP_NAME]
node scripts/adapters/okta-client.js group --group [OKTA_GROUP_ID] --execute
# the members, 200 a page, profile values other than the login withheld. A full page says more may follow: repeat with --after set to the last member ID it printed
node scripts/adapters/okta-client.js group-members --group [OKTA_GROUP_ID] --execute
# every group rule with its status. Note each rule that names [OKTA_GROUP_ID]
node scripts/adapters/okta-client.js group-rules --execute
# the groups the person is in today
node scripts/adapters/okta-client.js user-groups --user [OKTA_USER_ID] --execute
# the person's assignment to one app the group grants, HTTP 404 means not assigned. Repeat for each app
node scripts/adapters/okta-client.js app-user --app [APP_ID] --user [OKTA_USER_ID] --execute
```
</details>

Write in the ticket: whether `[UPN]` is a member today, the member count, every rule that names `[OKTA_GROUP_ID]`, and each app the group grants with its **Deactivate User** setting and whether the person holds it another way.

**Stop if:** a rule names `[OKTA_GROUP_ID]` and the ticket asks to take someone out. That is Phase D, not Phase C.

**Verification checkpoint:** [ ] membership, member count and rules are in the ticket · [ ] each app the group grants is listed with its Deactivate User setting · [ ] the person's other groups are recorded.

## Phase B: Add one person to the group (R1)

**Purpose:** put one person in one group, and so give them every app the group is assigned.

**Pre-state:** Phase A shows `[UPN]` is not a member. If they already are, stop: there is nothing to add, and the read-back would pass with nothing changed.

<!-- SAFETY GATE [okta-group-membership-add-person-portal] -->
- **Target:** [UPN] and [GROUP_NAME]
- **Effect:** assign one person to one Okta group; the person gets every app the group is assigned
- **Scope:** one user, one group; the apps recorded in Phase A come with it, with provisioning where it is on
- **Reversibility:** R1: undo is the Phase C remove gate under its own phrase; with Deactivate User provisioning on an app the group grants, that undo deactivates the person's account in that app, so it is not a free undo
- **Required confirmation:** Type exactly `ASSIGN [UPN] TO OKTA GROUP [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-add-person-portal]:** Only after the Phase A pre-state is in the ticket and the exact match:
1. Okta Admin Console → Directory → Groups → `[GROUP_NAME]` → **Assign people**.
2. Search for `[UPN]`, use **Assign** in that row, then **Done**.

```bash
# HUMAN-RUN read-only read-back, passes only when the person is on the group's member list. It proves the add only when Phase A showed them absent
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --execute
```

For each app the group grants that the person did not hold before (the Phase A `app-user` read returned HTTP 404):

```bash
# HUMAN-RUN read-only read-back, passes only when the person now holds the app with status ACTIVE or PROVISIONED
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --execute
```

**WAIT UNTIL** `[UPN]` sees the group's apps on their My Apps page. If an app read-back fails, read the reason it prints before anything else; never add the person again to make it pass.

**Verification checkpoint:** [ ] `verify-group-member` passed against a Phase A "not a member" · [ ] each new app read back · [ ] the person confirms the apps on their dashboard.

## Phase C: Remove one person from the group (R2)

**Purpose:** take one person out of one group, and with it every app that group alone gave them.

**Stop first if a rule fills the group** (the Phase A `group-rules` read names `[OKTA_GROUP_ID]`): removing someone from a rule-managed group needs the rule changed or the person excluded from it. Go to Phase D2.

**Pre-state (R2 checkpoint):** save the Phase A `user-groups` and `app-user` output for `[OKTA_USER_ID]` as a file under `tasks/checkpoints/` (local only, git-ignored, never committed), named after `[JIRA-###]`. Write in the ticket each app the person will lose (held only through this group) and whether **Deactivate User** is on for it. Phase A must show `[UPN]` as a member: otherwise the read-back passes with nothing changed.

<!-- SAFETY GATE [okta-group-membership-remove-person-portal] -->
- **Target:** [UPN] and [GROUP_NAME]
- **Effect:** remove one person from one Okta group; the person loses every app the group is assigned unless another assignment grants it
- **Scope:** one user, one group; their Individual assignments and their other groups are untouched
- **Reversibility:** R2: re-adding under the Phase B phrase restores the group's apps, but with Deactivate User provisioning on, the person's account in each such app is deactivated on removal and comes back only when the app is assigned again
- **Required confirmation:** Type exactly `REMOVE [UPN] FROM OKTA GROUP [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-remove-person-portal]:** Only after Phase A shows no rule naming the group, the checkpoint is saved, and the exact match:
1. Okta Admin Console → Directory → Groups → `[GROUP_NAME]` → find `[UPN]` among the members → remove the person from the group **[unconfirmed: check in the Okta Admin Console; the help page for this step was not found, so confirm the control's label and the dialog on screen]**.

```bash
# HUMAN-RUN read-only read-back, passes only when the user read succeeds and the person is not on the group's member list. It proves the removal only when Phase A showed them as a member
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute
```

For each app the person held only through this group:

```bash
# HUMAN-RUN read-only read-back, passes only when the user read succeeds and the app-user read returns HTTP 404. A 404 also comes from a wrong app ID, so check [APP_ID] first
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute
```

If the person also holds that app individually or through another group, this read finds that assignment and fails, which is correct: they keep the app. **WAIT UNTIL** each app with **Deactivate User** on shows the account deactivated, and record it in the ticket.

**Verification checkpoint:** [ ] checkpoint file saved · [ ] `verify-group-member --absent` passed against a Phase A "member" · [ ] each lost app read back absent · [ ] Deactivate User results recorded.

## Phase D: Group rules (R3)

**Purpose:** change what fills a group. One rule can move many people, and their apps, in a single save.

**Before any rule gate:** write in the ticket the rule's old condition (none for a new rule), the new condition, and the predicted number of people who join or leave. Save the Phase A `group-rules` and `group-members` output under `tasks/checkpoints/` (local only, never committed). Write the rollback: the old condition, put back under the change gate. Get the independent out-of-session review. Write `[NOT_BEFORE]`.

### Phase D1: Create a group rule

<!-- SAFETY GATE [okta-group-membership-rule-create-portal] -->
- **Target:** [GROUP_NAME]
- **Effect:** create one group rule for one Okta group and activate it; every person who matches its condition joins the group with every app the group is assigned
- **Scope:** every person whose profile matches the condition, now and later; the predicted count is in the ticket before the gate
- **Reversibility:** R3: deactivating the rule (Phase D3) stops it adding people; whether the people it added stay in the group is **[unconfirmed: check in the Okta Admin Console]**, and with Deactivate User provisioning on, a removal deactivates their external accounts
- **Required confirmation:** Type exactly `CREATE AND ACTIVATE OKTA GROUP RULE FOR [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-rule-create-portal]:** Only after the prediction, the checkpoint, the written rollback and the independent review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → Groups → **Rules** tab → **Add Rule**.
2. Name the rule, set its condition, pick `[GROUP_NAME]` as the group it assigns people to, and save it **[unconfirmed: check in the Okta Admin Console; the field labels were not in the pages read]**.
3. Activate the rule if it saved as inactive **[unconfirmed: check in the Okta Admin Console whether a new rule starts inactive and where its activate control sits]**.

**WAIT UNTIL** the `group-members` read shows the predicted count; how long a rule takes to apply is **[unconfirmed: check in the Okta Admin Console]**. Never save the rule again to hurry it.

```bash
# HUMAN-RUN read-only read-back, the rule list: the new rule names [OKTA_GROUP_ID] and reads status ACTIVE
node scripts/adapters/okta-client.js group-rules --execute
# HUMAN-RUN read-only read-back for one person the rule should add, picked from the prediction, passes only when that person is now a member. It proves the rule only when Phase A showed them absent
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
```

### Phase D2: Change a group rule (its condition, target group or exclusions)

This is also the path for taking one person out of a rule-managed group: exclude them from the rule. Where the rule's exclusions are set is **[unconfirmed: check in the Okta Admin Console]**.

<!-- SAFETY GATE [okta-group-membership-rule-change-portal] -->
- **Target:** [RULE_ID] and [GROUP_NAME]
- **Effect:** change one group rule's condition, target group or exclusions; the people it adds to the group change with it
- **Scope:** every person the old or the new condition matches; both counts are in the ticket before the gate
- **Reversibility:** R3: the old condition, saved in the checkpoint, goes back under this same gate with a new review; people moved in between gain or lose the group's apps, and with Deactivate User provisioning on, a removal deactivates their external accounts
- **Required confirmation:** Type exactly `CHANGE OKTA GROUP RULE [RULE_ID] FOR [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-rule-change-portal]:** Only after both conditions, both counts, the checkpoint, the written rollback and the independent review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → Groups → **Rules** tab → `[RULE_ID]` → update its condition, target group or exclusions and save **[unconfirmed: check in the Okta Admin Console; the edit control, and whether an active rule must be deactivated before an edit, were not in the pages read]**.

**WAIT UNTIL** the `group-members` read shows the predicted count; never save the rule again to hurry it.

**Change record:** a rule change that removes some people and adds others takes one change record for the people who leave (`okta:verify-group-member --absent`) and one for the people who join (`okta:verify-group-member`), each under this gate with the same reviewed procedure; each read-back below runs under its own `[CHANGE_ID]`.

```bash
# HUMAN-RUN read-only read-back, the rule list: [RULE_ID] shows the new condition and its status
node scripts/adapters/okta-client.js group-rules --execute
# HUMAN-RUN read-only read-back for one person who should leave, passes only when that person is no longer a member
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute
# HUMAN-RUN read-only read-back for one person who should join, passes only when that person is a member
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
```

### Phase D3: Deactivate a group rule

<!-- SAFETY GATE [okta-group-membership-rule-deactivate-portal] -->
- **Target:** [RULE_ID] and [GROUP_NAME]
- **Effect:** deactivate one group rule; it stops adding people to the group
- **Scope:** every person the rule added; whether they stay in the group is **[unconfirmed: check in the Okta Admin Console]**, so the member count before and after is the read-back
- **Reversibility:** R3: activating the rule again is a new change with a new review; anyone who left the group in between lost its apps, and with Deactivate User provisioning on, their external accounts were deactivated
- **Required confirmation:** Type exactly `DEACTIVATE OKTA GROUP RULE [RULE_ID] FOR [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-rule-deactivate-portal]:** Only after the member count, the checkpoint, the written rollback and the independent review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → Groups → **Rules** tab → `[RULE_ID]` → **Deactivate** **[unconfirmed: check in the Okta Admin Console; the control's label and place were not in the pages read]**.

```bash
# HUMAN-RUN read-only read-back, the rule list: [RULE_ID] reads status INACTIVE
node scripts/adapters/okta-client.js group-rules --execute
# HUMAN-RUN read-only read-back, the member count after: compare it with the count saved in the checkpoint and write both in the ticket
node scripts/adapters/okta-client.js group-members --group [OKTA_GROUP_ID] --execute
```

**Verification checkpoint (Phase D):** [ ] prediction, checkpoint, rollback and review were in the ticket before the gate · [ ] the rule reads the intended status · [ ] the member count matches the prediction · [ ] one person who should move read back with `verify-group-member`.

## Phase E: More than 10 people at once (R3)

**Purpose:** one change list, one count, one phrase. Each person is still checked one by one.

**Before either gate:** take out of the list anyone whose Phase A state already matches the goal (already a member for an add, not a member for a remove), so the list holds only real changes. For a removal, take out anyone a rule adds (Phase D instead). Write `[N]` and the list (one `[OKTA_USER_ID]` per person) in the change record, save the Phase A `group-members` output under `tasks/checkpoints/` (local only, never committed), write the rollback (the same list through the opposite gate), get the independent out-of-session review, and write `[NOT_BEFORE]`.

### Phase E1: Add the listed people

**Counted change:** open the change record for [okta-group-membership-bulk-add-portal] with `--expected [N]`, the number of people on the list in the ticket. The procedure saved for approval carries the count on one line, `Count: [N]`, and `open` refuses an `--expected` that differs from it, so the approval covers the count. `change-record.js status --change [CHANGE_ID]` then reports "verified k of N" over the bound `verify-group-member` read-backs, one per person, lists any that failed, and reads done only when exactly [N] passed and none failed; anything else reads partial. The read-back records no run id, so a repeated read of the same person is not detected: read each person on the list once, after the change shows. A read that failed with an answer cannot be matched to a later pass of the same person, so it keeps the change partial: write the people not yet proven in the ticket and open a new change for the objects left. A read that got no answer (a timeout) is uncounted: read that person again.

<!-- SAFETY GATE [okta-group-membership-bulk-add-portal] -->
- **Target:** [N] people on the change list and [GROUP_NAME]
- **Effect:** assign every person on the change list to one Okta group; each gets every app the group is assigned
- **Scope:** exactly the [N] people on the list, more than 10, each named by Okta user ID in the change record; nobody else
- **Reversibility:** R3: the rollback is Phase E2 for the same list under its own phrase; with Deactivate User provisioning on an app the group grants, that rollback deactivates each listed person's account in that app
- **Required confirmation:** Type exactly `ASSIGN [N] PEOPLE TO OKTA GROUP [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-bulk-add-portal]:** Only after the list, `[N]`, the checkpoint, the written rollback and the independent review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → Groups → `[GROUP_NAME]` → **Assign people**.
2. Search for each person on the list in turn and click **Assign** in their row, then **Done**; whether the dialog takes several people at once is **[unconfirmed: check in the Okta Admin Console]**.
3. Stop at the first person who cannot be added: write who was added and who was not, and go no further.

```bash
# HUMAN-RUN read-only read-back, run once per person on the list, every run must pass
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
# HUMAN-RUN read-only, the membership events since [NOT_BEFORE]: their count should equal [N]. A full page of 100 says more may follow
node scripts/adapters/okta-client.js logs --since [NOT_BEFORE] --event group.user_membership.add --execute
```

### Phase E2: Remove the listed people

**Counted change:** open the change record for [okta-group-membership-bulk-remove-portal] with `--read-back 'okta:verify-group-member --absent'` and `--expected [N]`, the number of people on the list in the ticket. The procedure saved for approval carries the count on one line, `Count: [N]`, and `open` refuses an `--expected` that differs from it, so the approval covers the count. `change-record.js status --change [CHANGE_ID]` then reports "verified k of N" over the bound `verify-group-member --absent` read-backs, one per person, lists any that failed, and reads done only when exactly [N] passed and none failed; anything else reads partial. The read-back records no run id, so a repeated read of the same person is not detected: read each person on the list once, after the change shows. A read that failed with an answer cannot be matched to a later pass of the same person, so it keeps the change partial: write the people not yet proven in the ticket and open a new change for the objects left. A read that got no answer (a timeout) is uncounted: read that person again.

<!-- SAFETY GATE [okta-group-membership-bulk-remove-portal] -->
- **Target:** [N] people on the change list and [GROUP_NAME]
- **Effect:** remove every person on the change list from one Okta group; each loses every app the group is assigned unless another assignment grants it
- **Scope:** exactly the [N] people on the list, more than 10, none of them added by a group rule; nobody else
- **Reversibility:** R3: the rollback is Phase E1 for the same list under its own phrase; with Deactivate User provisioning on, each listed person's account in that app is deactivated on removal and comes back only when the app is assigned again
- **Required confirmation:** Type exactly `REMOVE [N] PEOPLE FROM OKTA GROUP [GROUP_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-group-membership-bulk-remove-portal]:** Only after the list, `[N]`, the checkpoint, the written rollback and the independent review are in the ticket, and the exact match:
1. Okta Admin Console → Directory → Groups → `[GROUP_NAME]` → remove each person on the list in turn **[unconfirmed: check in the Okta Admin Console; the help page for removing people from a group was not found]**.
2. Stop at the first person who cannot be removed: write who was removed and who was not, and go no further.

```bash
# HUMAN-RUN read-only read-back, run once per person on the list, every run must pass
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute
# HUMAN-RUN read-only, the removal events since [NOT_BEFORE]: their count should equal [N]. A full page of 100 says more may follow
node scripts/adapters/okta-client.js logs --since [NOT_BEFORE] --event group.user_membership.remove --execute
```

**Verification checkpoint (Phase E):** [ ] list, `[N]`, checkpoint, rollback and review were in the ticket before the gate · [ ] every listed person read back · [ ] the event count equals `[N]` · [ ] a stop mid-list is written as a partial state.

## ⚠️ Risk warning

- **A group is a bundle of apps.** Adding or removing one person changes every app the group is assigned; with Deactivate User provisioning on, a removal deactivates the person's external accounts, and some apps destroy data on deactivation (`/okta-app-assignment`).
- **A rule is a standing mass change.** It keeps adding people who match, now and later; an over-broad condition hands the group's apps to everyone it matches.
- **Do not lean on a manual removal from a rule-managed group.** Whether Okta records it as an exclusion is unconfirmed; change the rule or exclude the person (Phase D2).
- **A big group can hide a read-back.** Past 2,000 members `verify-group-member` proves nothing when it does not find the person; read the membership in the Admin Console.
- **Deactivating the person's Okta account is a different runbook** (`/okta-user-lifecycle`): it removes every app at once, not one group's.

## ✅ Verification checklist

- [ ] The Phase A pre-state (membership, member count, rules naming the group, apps and their Deactivate User setting) is in the ticket.
- [ ] One person in: `verify-group-member` passed, and `verify-app-assigned` passed for each app they did not hold before.
- [ ] One person out: the checkpoint is saved, `verify-group-member --absent` passed, and `verify-app-assigned --absent` passed for each app they held only through the group.
- [ ] A rule: the `group-rules` read shows the intended status, the member count matches the prediction, and one person who should move read back.
- [ ] More than 10 people: every listed person read back, and the System Log event count equals `[N]`.
- [ ] Every read-back exited 0 with `"verified": true`; any that did not is named in the ticket as pending.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Okta group change for `[GROUP_NAME]` (`[OKTA_GROUP_ID]`) on `[JIRA-###]`: [assigned `[UPN]` / removed `[UPN]` / rule `[RULE_ID]` created, changed or deactivated / [N] people assigned / [N] people removed] at [timestamp], confirmed by the exact phrase. Pre-state: [member / not a member], [X] members, rules naming the group: [none / `[RULE_ID]`]; checkpoint saved for R2 and R3. Connector read-back [verify-group-member / verify-group-member --absent] passed at [timestamp] [for every listed person]; app read-backs: [apps and results]. Apps the group grants: [list]; Deactivate User: [on / off]. Independent review: [reference / not needed for R1 and R2]. Time spent: [X] min.

## Aha moment

In Okta a group is rarely just a list: it is the switch for every app assigned to it, so a membership change is an access change, and a rule is that change on repeat.

## Career upgrade

Group-based access with rule-driven membership is the core of role-based access control; reasoning about who a rule will catch before you save it is the skill IAM engineers are hired for.

## Next action

Run Phase A and record the membership, the member count, the rules naming the group and the apps it grants before choosing a phase.

**Sources (checked 2026-10-28, `docs/aegis/g3/vendor-facts.md` B-14, B-15, B-16, O-15, O-22, O-26):** help.okta.com/en-us/content/topics/users-groups-profiles/usgp-assign-group-people.htm · help.okta.com/en-us/content/topics/users-groups-profiles/usgp-create-group-rules.htm · developer.okta.com/docs/okta-event-types.csv · raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/current/management-minimal.yaml · the read-only connector `scripts/adapters/okta-client.js` (its read-back rules).
