---
description: Assign or unassign an Okta app integration for one person or one group: Applications and Resources → Applications → Assignments; an unassign can deactivate the user's account in the external app when Deactivate User provisioning is on. Placeholders only.
disable-model-invocation: true
---

# /okta-app-assignment

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[APP_NAME]` (the app integration's display name in Okta) · `[APP_ID]` (its Okta app ID, starts `0oa`; the value the API section exports as `APP_ID`) · `[UPN]` (the person's Okta username) · `[USER_ID]` (their Okta user ID, starts `00u`; the connector read-backs write the same value as `[OKTA_USER_ID]`) · `[GROUP_EMAIL]` (the Okta group's name; in this shop Okta groups are pushed to Google Groups, so a group is named by its Google address, written without the at sign) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 gates):** before a gate whose reversibility is R2, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `okta:verify-app-assigned`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`).

## ⚠️ Admin / safety gate

- **Assign to a person** is R1: one user, one app, undone by the separate unassign gate.
- **Assign to a group** is R2: every member of the group gets the app at once; record the member count first.
- **Unassign from a person** is R2, and **R3 when the app has Deactivate User provisioning on**: Okta then deactivates the person's account in the external app, and the app profile cannot be recovered.
- Every state change below has its own exact-phrase gate. A phrase never carries into a later phase; "yes" is never a confirmation.
- Every change phase ends with a read-only connector read-back (`scripts/adapters/okta-client.js`: GET only, it cannot change anything in Okta). It proves a change only against the Phase A pre-state: a person who already had the app passes `verify-app-assigned` with nothing changed.
- Not done until every read-back in the final checklist passes.

## Inputs needed

- `[APP_NAME]` and `[APP_ID]`, and `[UPN]` / `[USER_ID]` (person) or `[GROUP_EMAIL]` (group).
- For the connector: `OKTA_ORG_URL` set to `[@Aegion_OKTA_ORG_URL]` as a bare hostname, and the read-only service app's `OKTA_CLIENT_ID` and `OKTA_PRIVATE_KEY` exported from the secret manager, never pasted into a ticket. It asks for the four Okta read scopes only and refuses a token that also grants a write scope. Without `--execute` a command prints its planned GET and sends nothing.
- Whether the person already has the app and how: the **Type** column on the app's Assignments tab reads **Individual** or **Group**.
- Whether the app provisions and has **Deactivate User** enabled: **[org gap: read it in Phase A before any unassign]**.
- For a provisioning app: any app-specific attributes the assignment dialog asks for: **[org gap: confirm with the app owner]**.

## How assignments work

- **Individual vs Group.** Assigning the app directly gives the person an Individual assignment. Assigning the app to a group gives every member a Group assignment. A Group assignment cannot be removed from one person: remove the person from the group, or unassign the app from the whole group (Phase E).
- **Deactivate User provisioning.** When it is enabled on the app, Okta automatically deactivates the person's external application account when they are unassigned from the app in Okta, or when their Okta account is deactivated. Reassigning the app reactivates the account.
- **No automatic re-assignment.** When an Individual assignment is unassigned, Okta does not re-create it, even when the person belongs to a group that is assigned the app.
- **Converting a group assignment to an individual one** means removing the person from the group first, then creating the individual assignment; the API's `scope` parameter is not a conversion switch.
- **Group membership is app access.** Adding a person to a group, or taking them out of it, changes every app that group is assigned; that change is `/okta-group-membership`.

## Fast path

1. Phase A: read the current assignment, the Deactivate User setting and (for a group) the member count (R0).
2. Phase B: assign to one person (R1 gate). **WAIT UNTIL** the app shows on the person's My Apps page.
3. Phase C: assign to a group (R2 gate; member count recorded first).
4. Phase D: unassign from one person (R2/R3 gate). Group-type assignments go through the Phase E preview, never through this gate.
5. Verify on the Assignments tab and in the System Log.

## Phase A: Read the current state (R0)

**Purpose:** know the assignment type and the provisioning behaviour before anything changes.

- Okta Admin Console → Applications and Resources → Applications → `[APP_NAME]` → **Assignments** tab → read whether `[UPN]` is listed and what the **Type** column says (Individual or Group).
- Okta Admin Console → Directory → People → `[UPN]` → **Applications** tab → read every app the person has today.
- Okta Admin Console → Applications and Resources → Applications → `[APP_NAME]` → **Provisioning** tab → **To App** → read whether **Deactivate User** is enabled (this decides whether Phase D is R2 or R3).
- For a group assignment: Okta Admin Console → Directory → Groups → `[GROUP_EMAIL]` → read the member count (the count refreshes every two hours; the link on the count gives the exact figure).

<details>
<summary>Read-only connector read, the pre-state (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN read-only. The person's assignment to the app, its status and scope, profile and credentials withheld. HTTP 404 means not assigned, or a wrong app ID. Write the result in the ticket: the read-backs below are judged against it
node scripts/adapters/okta-client.js app-user --app [APP_ID] --user [OKTA_USER_ID] --execute
```
</details>

**Verification checkpoint:** [ ] assignment type recorded (GUI Type and connector scope agree) · [ ] Deactivate User setting recorded · [ ] group member count recorded if Phase C applies.

## Phase B: Assign the app to one person (R1)

**Purpose:** give one person the app as an Individual assignment.

<!-- SAFETY GATE [okta-app-assignment-assign-person-portal] -->
- **Target:** [APP_NAME] and [UPN]
- **Effect:** assign the app integration to one person as an Individual assignment; with provisioning enabled, Okta creates or reactivates the person's account in the external app
- **Scope:** one user, one app; nothing else on the person's profile changes
- **Reversibility:** R1: undo is the Phase D unassign gate under its own phrase; when Deactivate User provisioning is on, that undo deactivates the external account, so it is not a free undo
- **Required confirmation:** Type exactly `ASSIGN [APP_NAME] TO [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-app-assignment-assign-person-portal]:** Only after the exact match:
1. Okta Admin Console → Applications and Resources → Applications → `[APP_NAME]` → **Assignments** → **Assign** → **Assign to People**.
2. In the dialog, click **Assign** in the row for `[UPN]`, confirm the attribute values, click **Save and Go Back**, then **Done**.
3. Read back: the **Type** column reads **Individual** for `[UPN]`.

**WAIT UNTIL** `[UPN]` sees the app on their My Apps page (the Okta End-User Dashboard). Reports → System Log shows **Add user to application membership** with status **success**.

```bash
# HUMAN-RUN read-only read-back, passes only when the app-user read returns the assignment with status ACTIVE or PROVISIONED. It proves the assign only when the Phase A read returned HTTP 404
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --execute
```

It passes for a Group assignment too, so the **Type** column above decides Individual. If it fails, read the reason it prints before anything else; never assign again to make it pass.

**Verification checkpoint:** [ ] Type reads Individual · [ ] `verify-app-assigned` passed against a Phase A HTTP 404 · [ ] System Log entry present · [ ] the person confirms the tile is on their dashboard.

## Phase C: Assign the app to a group (R2)

**Purpose:** give every member of one group the app in a single change.

**Pre-state (R0, record it in the ticket):** the group's member count from Phase A; that number is the blast radius. Also pick one member who does not have the app today (the Phase A `app-user` read for that member's `[OKTA_USER_ID]` returns HTTP 404): the read-back below checks that member.

<!-- SAFETY GATE [okta-app-assignment-assign-group-portal] -->
- **Target:** [APP_NAME] and [GROUP_EMAIL]
- **Effect:** assign the app integration to every member of one Okta group; each member gets a Group-type assignment
- **Scope:** every current member of the group (the recorded count), plus anyone added to the group later
- **Reversibility:** R2: unassigning the app from the group removes it from every member at once and is a separate reviewed change (Phase E preview); with Deactivate User provisioning on, that removal deactivates every member's external account
- **Required confirmation:** Type exactly `ASSIGN [APP_NAME] TO GROUP [GROUP_EMAIL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-app-assignment-assign-group-portal]:** Only after the member count is recorded and the exact match:
1. Okta Admin Console → Applications and Resources → Applications → `[APP_NAME]` → **Assignments** → **Assign** → **Assign to Groups**.
2. Click **Assign** in the row for `[GROUP_EMAIL]`, click **Save and go back**, then **Done**.
3. Read back: the Assignments tab lists the members with **Type** reading **Group**.

```bash
# HUMAN-RUN read-only read-back for the one member picked in the pre-state, passes only when that member now holds the app with status ACTIVE or PROVISIONED
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
```

If the spot check fails right after the save, **WAIT UNTIL** the Assignments tab lists that member with **Type** reading **Group**, then run it again; never assign the group again to make it pass. One member is a spot check, not proof for the whole group: the Assignments tab count against the recorded member count is the group-wide read-back.

**Gotcha:** a member whose Individual assignment was unassigned earlier is not re-assigned automatically by the group assignment; check that person separately.

## Phase D: Unassign the app from one person (R2; R3 with Deactivate User on)

**Purpose:** remove one person's Individual assignment. Read the assignment Type first: a **Group** assignment cannot be removed here (Phase E).

<!-- SAFETY GATE [okta-app-assignment-unassign-person-portal] -->
- **Target:** [APP_NAME] and [UPN]
- **Effect:** unassign the app integration from one person; the app disappears from their My Apps page, and with Deactivate User provisioning on, Okta deactivates their account in the external app
- **Scope:** one Individual assignment; group memberships are untouched
- **Reversibility:** R2: reassigning under the Phase B phrase restores access and, with Deactivate User on, reactivates the external account; the app profile itself cannot be recovered (API warning), so R3 when the app's deprovisioning destroys data
- **Required confirmation:** Type exactly `UNASSIGN [APP_NAME] FROM [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-app-assignment-unassign-person-portal]:** Only after the Type reads Individual, the Deactivate User setting is recorded, and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **Applications** tab.
2. Click **X** next to `[APP_NAME]`, then **OK** in the **Unassign Application** dialog.
3. Read back: `[APP_NAME]` is gone from the person's Applications tab and from the app's Assignments tab.

```bash
# HUMAN-RUN read-only read-back, passes only when the user read succeeds and the app-user read then returns HTTP 404. It proves the unassign only when the Phase A read showed the assignment with scope USER
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --absent --change [CHANGE_ID] --execute
```

An HTTP 404 also comes from a wrong app ID, so check `[APP_ID]` against the app before trusting a pass. If the person also holds the app through a group, the read finds that assignment and fails, which is correct: they still have the app (Phase E).

**WAIT UNTIL** the external app reflects the change when Deactivate User is on (the account there reads deactivated), and record it in the ticket.

## Phase E: Group-assigned people (preview only)

> **PREVIEW ONLY [okta-app-assignment-group-unassign-preview]:** A person who has the app through a group keeps it until they are removed from the group or the app is unassigned from the whole group. Both are separate reviewed changes with their own gates: removing a member changes every app that group grants, and unassigning the app from the group removes it from every member (and deactivates every member's external account when Deactivate User is on). Nothing in this command removes a person from a group or unassigns an app from a group; this region is planning only and authorizes nothing.

<details>
<summary>Okta API, the scale version (HUMAN-RUN, for reference)</summary>

Export `OKTA_API_TOKEN` from the secret manager first (never paste a token into a ticket). Okta recommends OAuth 2.0 over SSWS tokens; an SSWS token inherits its creator's privileges and expires after 30 days unused. The app and group IDs come from the read-only calls below: export them as `APP_ID` and `GROUP_ID` in the same shell before the gated fences. Whichever way a change is made, here or in the Admin Console, the connector read-back in its phase above is the proof.

```bash
# HUMAN-RUN, read-only: look up the IDs and the current assignment; nothing here changes anything
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps?q=[APP_NAME]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # apps whose name or label starts with [APP_NAME]; copy the id into APP_ID
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/groups?q=[GROUP_EMAIL]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # the group by name; copy its id into GROUP_ID
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # the person's current assignment (404 means not assigned); scope reads USER or GROUP
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/groups/${GROUP_ID}/users?limit=200" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # pre-state for Phase C: the group's members (count them)
```

```bash
# HUMAN-RUN, assign the app to one person as an Individual assignment
# SAFETY GATE [okta-app-assignment-assign-person]
# Target: [APP_NAME] as APP_ID, and [USER_ID]
# Effect: assign the app integration to one person, with provisioning enabled, Okta creates or reactivates the external account
# Scope: one user, one app
# Reversibility: R1: undo is the separate unassign gate below under its own phrase. With Deactivate User on, that undo deactivates the external account
# Required confirmation: type exactly "ASSIGN [APP_NAME] TO [USER_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="ASSIGN [APP_NAME] TO [USER_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # creates the Individual assignment
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/users" -H "Authorization: SSWS ${OKTA_API_TOKEN}" -H "Content-Type: application/json" -d '{"id":"[USER_ID]","scope":"USER"}'
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: scope USER, status ACTIVE or PROVISIONED
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```

```bash
# HUMAN-RUN, assign the app to a group: every member gets a Group assignment
# SAFETY GATE [okta-app-assignment-assign-group]
# Target: [APP_NAME] as APP_ID, and [GROUP_EMAIL] as GROUP_ID
# Effect: assign the app integration to every member of one Okta group
# Scope: every current and future member of the group. Record the member count first
# Reversibility: R2: unassigning the app from the group is a separate reviewed change that removes it from every member
# Required confirmation: type exactly "ASSIGN [APP_NAME] TO GROUP [GROUP_EMAIL]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="ASSIGN [APP_NAME] TO GROUP [GROUP_EMAIL]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # assigns the group. Priority and profile are optional and left at their defaults
  curl -sS -X PUT "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/groups/${GROUP_ID}" -H "Authorization: SSWS ${OKTA_API_TOKEN}" -H "Content-Type: application/json" -d '{}'
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the group assignment exists
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/groups/${GROUP_ID}" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```

```bash
# HUMAN-RUN, unassign the app from one person. Destructive: the app profile cannot be recovered
# SAFETY GATE [okta-app-assignment-unassign-person]
# Target: [APP_NAME] as APP_ID, and [USER_ID]
# Effect: unassign the app integration from one person, with Deactivate User provisioning on, Okta deactivates the external account
# Scope: one Individual assignment with scope USER. A scope GROUP assignment goes through the group instead
# Reversibility: R2: reassigning under the assign phrase reactivates the external account, but the app profile is not recoverable. R3 when the app’s deprovisioning destroys data
# Required confirmation: type exactly "UNASSIGN [APP_NAME] FROM [USER_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="UNASSIGN [APP_NAME] FROM [USER_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # removes the Individual assignment
  curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: 404 means the assignment is gone
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/apps/${APP_ID}/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```
</details>

## ⚠️ Risk warning

- **Unassign is destructive on a provisioning app:** the app profile cannot be recovered, and with Deactivate User on, the external account is deactivated. For apps that delete data on deactivation, that is an R3 change that needs the retention decision first.
- **A group assignment is a blast radius, not a user change:** assigning to a group touches every member now and every future member; unassigning from the group touches them all at once (Phase E preview).
- **Never unassign a directory integration (Active Directory or LDAP) this way:** Okta's API warns that a user unassigned from a delegated-authentication directory is left with no password.
- **Deactivating the Okta user is the other trigger** for Deactivate User provisioning: it deprovisions every app at once. That is the Okta user lifecycle runbook (`/okta-user-lifecycle`), never this one.

## ✅ Verification checklist

- [ ] Okta Admin Console → Applications and Resources → Applications → `[APP_NAME]` → Assignments tab shows the intended row for `[UPN]` (Type Individual) or for `[GROUP_EMAIL]` (Type Group), or no row after an unassign.
- [ ] Okta Admin Console → Directory → People → `[UPN]` → Applications tab agrees.
- [ ] Reports → System Log shows **Add user to application membership** (assign) or the matching removal event with the expected admin and time.
- [ ] API read-back `GET /api/v1/apps/${APP_ID}/users/[USER_ID]` returns scope USER / GROUP as intended, or 404 after an unassign.
- [ ] The connector read-back passed (exit 0, `"verified": true`) against the Phase A pre-state: `verify-app-assigned` after an assign (for a group, on the one member picked first), `verify-app-assigned --absent` after an unassign, with `[APP_ID]` checked against the app.
- [ ] With Deactivate User on: the external app shows the account active (assign) or deactivated (unassign), recorded in the ticket.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Okta app assignment for `[APP_NAME]`: [assigned to `[UPN]` as Individual / assigned to group `[GROUP_EMAIL]` ([N] members, pre-state recorded) / unassigned from `[UPN]`] at [timestamp], confirmed by the exact phrase. Deactivate User provisioning: [on / off]; external account: [created / reactivated / deactivated / not applicable]. Verified on the Assignments tab and in the System Log; connector read-back [verify-app-assigned / verify-app-assigned --absent] passed at [timestamp] against the recorded pre-state; the person confirmed the tile [appears / is gone] on their dashboard. Time spent: [X] min.

## Aha moment

In Okta an app assignment is a provisioning contract, not a shortcut on a dashboard: assign and the account downstream is created, unassign and (with Deactivate User on) it is switched off, which is why the direction of the change sets the risk class.

## Career upgrade

Reasoning about Individual vs Group scope and what deprovisioning does downstream is the access-management judgment that IAM and platform-engineering roles interview for.

## Next action

Run Phase A and record the assignment Type and the Deactivate User setting before choosing Phase B, C or D.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/provisioning/lcm/lcm-assign-app-user.htm · help.okta.com/oie/en-us/content/topics/provisioning/lcm/lcm-assign-app-groups.htm · help.okta.com/oie/en-us/content/topics/provisioning/lcm/lcm-automatic-deactivate.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-unassign-apps.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-view-group-members.htm · developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationusers.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationusers/other/assignusertoapplication.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgroups.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/applicationgroups/other/assigngrouptoapplication.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/application/other/listapplications.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/group.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/group/other/listgroups.md · developer.okta.com/docs/guides/create-an-api-token/main/
