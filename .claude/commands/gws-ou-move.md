---
description: Move a Google Workspace user to a different organizational unit — an OU move is a policy change, so record the source OU and the settings that differ first, then one gated move with the way back written down. Placeholders only.
disable-model-invocation: true
---

# /gws-ou-move

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the user being moved) · `[OU_PATH]` (the destination organizational-unit path, shown as `/[OU_PATH]` in the Admin console tree) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **An OU move is a policy change, not a filing change.** A user belongs to exactly one organizational unit and inherits that unit's settings; the unit decides which features and services the user can access. One move swaps every inherited setting at once — Gmail, Drive and Docs, Chrome, 2-Step Verification enforcement, service on/off.
- R1: one user, one reversible write. The undo is a second move back to the source OU recorded in Phase 1, under its own exact phrase — which is why nothing moves until the source OU is in the ticket.
- Needs the Organizational unit privilege (and the User management privilege to see the Users list controls). Without them the controls are hidden, not greyed out.
- Not done until the read-backs in the final checklist pass.

## Inputs needed

- `[USER@DOMAIN.COM]` and the destination `[OU_PATH]` — the unit must already exist; this runbook never creates one.
- The current (source) OU — read it in Phase 1, never assume it.
- Which settings the team change is supposed to deliver (the ticket's "right Chrome and Gmail settings") so Phase 1 can confirm the target unit actually carries them — **[org gap — confirm with the requester which settings must differ]**.

## How the systems hang together

- Every user and device sits in one organizational unit. The top-level unit holds everyone by default; child units inherit its settings unless a setting is overridden for that child. In each service's settings page the organization tree opens on the left, and text under each setting reads **Inherited** or **Overridden**.
- Service-setting changes can take up to 24 hours but typically happen more quickly. The vendor pages give no separate figure for how fast an OU move itself propagates — treat 24 hours as the outer bound and verify rather than assume.
- Configuration groups and access groups layer exceptions on top of units. A user who gets a setting from a group keeps it after the move; when the result does not match the unit, check the groups before touching the unit.

## Fast path

1. Phase 1 — record the source OU and compare the settings that differ between source and `[OU_PATH]` (R0).
2. Phase 2 — move the user (R1 gate). **WAIT UNTIL** the account page reads the new unit, then allow the settings window.
3. Phase 3 — verify the settings the ticket asked for actually apply; the source OU stays in the ticket as the undo path.

## Phase 1 — Pre-state: source OU and the settings delta (R0)

**Purpose** — know exactly what changes before it changes; the source OU is the rollback.

1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the **Organizational unit** on the account page. Record it in the ticket as the source OU.
2. Admin console → Apps → Google Workspace → Gmail → open the section the ticket cares about → in the organization tree on the left pick the source OU and read the setting and its **Inherited** / **Overridden** marker → then pick `[OU_PATH]` and read the same setting. Repeat for Drive and Docs and for any other service the team change relies on.
3. Admin console → Security → Authentication → 2-step verification → pick the source OU, then `[OU_PATH]` → read the **Enforcement** setting of each. A move into a unit with enforcement on locks out a user who has not enrolled.
4. Admin console → Devices → Chrome → Settings → pick the source OU, then `[OU_PATH]` → read the Chrome settings that differ (the ones the ticket names).

```bash
# read-only: the user's current organizational unit, status, admin flag and 2-Step Verification state (the pre-state)
gam info user "[USER@DOMAIN.COM]" fields ou,suspended,isadmin,isenforcedin2sv,isenrolledin2sv   # prints the source OU and whether 2SV is enforced and enrolled
# read-only: confirm the destination exists and read its name, path and parent
gam info ou "[OU_PATH]" nousers   # prints the destination unit without listing its members
```

**Verification checkpoint** — [ ] source OU recorded in the ticket · [ ] the settings that differ (including 2-Step Verification enforcement in `[OU_PATH]`) are listed in the ticket.

**Gotcha** — target unit enforces 2-Step Verification and the user is not enrolled (`isEnrolledIn2Sv` false)? Have them enroll before the move, or they lose sign-in the moment the policy applies.

## Phase 2 — Move the user (R1)

**Purpose** — one user, one write, with the undo path already written down.

<!-- SAFETY GATE [gws-ou-move-user-portal] -->
- **Target:** [USER@DOMAIN.COM] (destination [OU_PATH])
- **Effect:** move one user to [OU_PATH] so the user inherits that organizational unit's settings instead of the source unit's
- **Scope:** one user; group memberships, licences, data and admin roles are untouched, but every inherited service setting changes with the unit
- **Reversibility:** R1 — undo is a second move back to the source OU recorded in Phase 1, in the same place (Admin console → Directory → Users → tick the user → More → Change organizational unit), under its own exact phrase that names the recorded source path
- **Required confirmation:** Type exactly `MOVE GOOGLE USER [USER@DOMAIN.COM] TO OU [OU_PATH]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-ou-move-user-portal]:** Only after the Phase 1 pre-state is in the ticket and the exact match:
1. Admin console → Directory → Users → tick the box for `[USER@DOMAIN.COM]` → at the top, **More** → **Change organizational unit**.
2. Pick `[OU_PATH]` in the dialog → **Continue** → read the confirmation message about moving the user → **Change**.
3. Read back: the account page for `[USER@DOMAIN.COM]` shows **Organizational unit** = `[OU_PATH]`.

**WAIT UNTIL** Admin console → Directory → Users → `[USER@DOMAIN.COM]` reads `[OU_PATH]` (how long the directory itself takes to reflect the move is not stated on the vendor page — **[unverified]**), then allow the settings window: the settings a unit carries can take up to 24 hours to apply but typically apply more quickly.

**Verification checkpoint** — [ ] account page shows `[OU_PATH]` · [ ] the source OU path is in the ticket.

**Gotcha** — for a batch of users GAM also offers a unit-level move that takes a whole user collection (the Organizational-Units page of the GAM wiki). That is a multi-object R2 with its own pre-state and gate, not this runbook.

## Phase 3 — Confirm the policy outcome (R0)

**Purpose** — the ticket asked for settings, not a tree change; prove the settings arrived.

1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read **Organizational unit** = `[OU_PATH]`.
2. Admin console → Apps → Google Workspace → Gmail (then Drive and Docs) → pick `[OU_PATH]` in the organization tree → read the setting the ticket asked for; it should read as expected for that unit.
3. After the propagation window, have the user re-open Gmail and Chrome and confirm the expected behaviour. Still wrong after 24 hours? Check whether a configuration group or access group overrides the unit setting for this user before changing anything.
4. Admin console → Reporting → Audit and investigation → Admin log events → the move appears with your admin as the actor (API event name `MOVE_USER_TO_ORG_UNIT`).

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal; Aegis never does
# SAFETY GATE [gws-ou-move-user]
# Target: [USER@DOMAIN.COM] (destination [OU_PATH])
# Effect: move one user to [OU_PATH] so the user inherits that organizational unit's settings
# Scope: one user; group memberships, licences, data and admin roles are untouched
# Reversibility: R1 — a second move back to the recorded source path under its own phrase
# Required confirmation: type exactly `MOVE GOOGLE USER [USER@DOMAIN.COM] TO OU [OU_PATH]`
# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
required_confirmation="MOVE GOOGLE USER [USER@DOMAIN.COM] TO OU [OU_PATH]"   # the exact phrase to type
printf '%s\n' "Type exactly: $required_confirmation"   # shows the phrase
IFS= read -r confirmation   # reads one line exactly as typed
if [ "$confirmation" = "$required_confirmation" ]; then   # exact, case-sensitive match only
  gam update user "[USER@DOMAIN.COM]" ou "[OU_PATH]"   # moves the user; the destination unit's settings now apply
else
  echo "Confirmation did not match. No change was made." >&2   # explains the stop
  exit 1   # stops with a failure status
fi
gam info user "[USER@DOMAIN.COM]" fields ou   # read-back: the organizational unit should read [OU_PATH]
```
</details>

## ⚠️ Risk warning

- The move is one click, but the blast radius is every inherited setting — including 2-Step Verification enforcement and service on/off. A user moved into a unit with Gmail turned off loses mail until moved back.
- Never "fix" a wrong outcome by editing the destination unit's settings: that changes policy for everyone in that unit. Move the user back (its own gate) and re-plan.
- Group-based settings survive the move; a result that does not match the unit is usually a configuration or access group, not the OU.

## ✅ Verification checklist

- [ ] `gam info user "[USER@DOMAIN.COM]" fields ou` (or the account page) reads `[OU_PATH]`.
- [ ] The source OU path is recorded in the ticket — that is the undo path.
- [ ] The settings the ticket asked for read as expected for `[OU_PATH]` in the service settings page, and the user confirmed the behaviour after the propagation window.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the move event (`MOVE_USER_TO_ORG_UNIT`) with the expected admin and time.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Moved `[USER@DOMAIN.COM]` from [recorded source OU] to `[OU_PATH]` on [date/time], confirmed by exact phrase. Pre-state recorded: source OU and the settings that differ ([Gmail / Drive / Chrome / 2SV items]). Read-back: account page and `gam info user` show `[OU_PATH]`; Admin log events show the move. Settings verified after propagation: [list]. Undo path: move back to [recorded source OU]. Time spent: [X] min.

## Aha moment

In Google Workspace the organizational unit *is* the policy object: moving a user is not filing, it swaps every inherited setting at once — so the source OU is the rollback and the settings delta is the real pre-state.

## Career upgrade

Reading an inheritance tree (Inherited vs Overridden, groups layered on top) before changing membership is the same discipline as reasoning about GPO precedence or IAM policy inheritance — governance judgment that transfers to every cloud platform.

## Next action

Start Phase 1 after confirming with the requester which settings the move is meant to deliver.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/users/advanced/move-users-to-an-organizational-unit · knowledge.workspace.google.com/admin/users/advanced/how-the-organizational-structure-works · knowledge.workspace.google.com/admin/users/advanced/change-service-settings-for-different-users · knowledge.workspace.google.com/admin/security/deploy-2-step-verification · support.google.com/chrome/a/answer/6352858 (Devices → Chrome → Settings) · knowledge.workspace.google.com/admin/reports/admin-log-events · developers.google.com/workspace/admin/reports/v1/appendix/activity/admin-user-settings (MOVE_USER_TO_ORG_UNIT) · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users and Organizational-Units pages; GAM is an open-source tool, not a Google product).
