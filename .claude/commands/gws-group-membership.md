---
description: Add a member to a Google Group or remove one — adding is a single reversible write with its undo stated in the gate; removing is SR-2 group removal, done only after the member list is captured. Admin console first, GAM as the scale version. Placeholders only.
disable-model-invocation: true
---

# /gws-group-membership

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the member) · `[GROUP_EMAIL]` (the group's address) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Add** is R1: one user, one group, undone by the remove procedure — and the undo is named inside the add gate.
- **Remove** is SR-2 group removal (the member's group mail and group-granted access stop): R2 — capture the member list first, remove under its own phrase, then read back. "They moved teams" still ends access the moment it runs, so read what the group is used for before you confirm.
- One gate per membership: a user in five groups needs five confirmations, not one.

## Inputs needed

- `[USER@DOMAIN.COM]` and `[GROUP_EMAIL]` (the group's email address, not its display name).
- Direction: add or remove. New members get the Member role; Manager or Owner is a separate decision — **[org gap — confirm who may hold Manager or Owner]**.
- For a removal: what the group is used for — mail only, or access to shared resources — **[org gap — confirm with the group owner]**.
- Whether `[@Aegion]` pushes this group's membership from Okta (Push Groups); an Okta-owned group is changed in Okta, not here — **[org gap — check the Okta group push list]**.

## Fast path

1. Phase A — read the group and the member's current state (R0).
2. Add — Phase B (R1 gate, undo stated).
3. Remove — Phase C: capture the member list (R0), remove (R2 gate), read back.
4. Verify in the member list and in Admin log events.

## Phase A — Read first (R0)

**Purpose** — know what the group is and whether the member is already in it.

- Admin console → Directory → Groups → `[GROUP_EMAIL]` → **Members** → read the member list, the roles and the member count.
- Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Groups** → read every group the user is in today.

```bash
# read-only: the group's members today, with role and status (the pre-state for any removal)
gam print group-members group "[GROUP_EMAIL]"   # CSV of members: email, role, type, status
# read-only: is the user already a member, and with which role
gam info member "[USER@DOMAIN.COM]" "[GROUP_EMAIL]"   # the user's membership record in this group
```

**Verification checkpoint** — [ ] the group's purpose, member count and the user's current role (or absence) are in the ticket.

## Phase B — Add a member (R1 gate)

**Purpose** — give the user the group's mail and whatever the group grants.

<!-- SAFETY GATE [gws-group-membership-add-portal] -->
- **Target:** [USER@DOMAIN.COM] and [GROUP_EMAIL]
- **Effect:** add one member to the group with the Member role and the All email subscription
- **Scope:** one user in one group
- **Reversibility:** R1 — the undo is Phase C of this runbook (Directory → Groups → the group → Members → point to the member → Remove → Remove Members) under its own phrase `REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]`
- **Required confirmation:** Type exactly `ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-group-membership-add-portal]:** Only after the exact match:
1. Admin console → Directory → Groups → `[GROUP_EMAIL]` → **Members** → **Add members**.
2. Enter the first characters of `[USER@DOMAIN.COM]`, select the match, then click **Add To Group**.
3. Read the member list back: `[USER@DOMAIN.COM]` appears with role Member.

**Gotcha** — from the user's side the same change is Directory → Users → the user → **Groups** → **Add user to groups** → select the group → **Add**; same gate, not a second one. Changing the role afterwards (Member to Manager or Owner) is a separate change under its own gate; this runbook does not do it.

**Verification checkpoint** — [ ] the member list shows `[USER@DOMAIN.COM]` with role Member · [ ] the user receives a test message sent to `[GROUP_EMAIL]`.

## Phase C — Remove a member (R2: pre-state first)

**Purpose** — end the member's group mail and group-granted access, with a record of what the group looked like before.

**Pre-state (R0, paste into the ticket):** the full member list from Phase A (`gam print group-members group "[GROUP_EMAIL]"`, or the Members page), the member's role, and the group's purpose. Removing a member does not delete the user's account, and the group keeps working even if the member was its owner.

<!-- SAFETY GATE [gws-group-membership-remove-portal] -->
- **Target:** [USER@DOMAIN.COM] and [GROUP_EMAIL]
- **Effect:** remove one member from the group; mail addressed to the group stops reaching them
- **Scope:** one membership; the user's account, mailbox and other groups are untouched
- **Reversibility:** R2 — SR-2 group removal; re-adding under the Phase B phrase `ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]` restores membership with the Member role only, so a former Manager or Owner role has to be set again by hand — the captured pre-state is the record of what it was
- **Required confirmation:** Type exactly `REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no Google Workspace verify-* command reads group membership, group-members is a read: its proof is that read)
**PORTAL ACTION [gws-group-membership-remove-portal]:** Only after the pre-state is in the ticket and the exact match:
1. Admin console → Directory → Groups → `[GROUP_EMAIL]` → **Members** → point to `[USER@DOMAIN.COM]` → **Remove**.
2. Click **Remove Members** to confirm.
3. Read the member list back: `[USER@DOMAIN.COM]` is gone and the count dropped by one.

**Gotcha** — a removal is not a ban: a removed user can be added again. Banning (which blocks them from being added or invited until unbanned) is a separate action done in Google Groups, not here.

**Verification checkpoint** — [ ] the member count equals the pre-state count minus one · [ ] the former role is recorded in the ticket.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

```bash
# HUMAN-RUN — the administrator runs this in their own terminal — Aegis never does
# SAFETY GATE [gws-group-membership-add]
# Target: [USER@DOMAIN.COM] and [GROUP_EMAIL]
# Effect: add one member to the group with the Member role
# Scope: one user in one group
# Reversibility: R1 — the undo is the separate remove-member gate below under its own phrase
# Required confirmation: type exactly "ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
# the exact phrase to type
required_confirmation="ADD [USER@DOMAIN.COM] TO GROUP [GROUP_EMAIL]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # adds the user to the group with the Member role
  gam update group "[GROUP_EMAIL]" add member "[USER@DOMAIN.COM]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the user is listed with role MEMBER
gam print group-members group "[GROUP_EMAIL]"
```

```bash
# HUMAN-RUN — capture the pre-state first — the Phase A member list, then remove
# SAFETY GATE [gws-group-membership-remove]
# Target: [USER@DOMAIN.COM] and [GROUP_EMAIL]
# Effect: remove one member from the group
# Scope: one membership — nothing else on the user or the group changes
# Reversibility: R2 — SR-2 group removal — the separate add gate restores membership as Member only, so the captured role is the record
# Required confirmation: type exactly "REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no Google Workspace verify-* command reads group membership, group-members is a read: its proof is that read
# the exact phrase to type
required_confirmation="REMOVE [USER@DOMAIN.COM] FROM GROUP [GROUP_EMAIL]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # removes the membership regardless of the member’s role
  gam update group "[GROUP_EMAIL]" remove member "[USER@DOMAIN.COM]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the user no longer appears in the member list
gam print group-members group "[GROUP_EMAIL]"
```
</details>

## ⚠️ Risk warning

- **Removal is SR-2 group removal.** Whatever the group grants — mail, shared drives, calendars, anything that uses the group for access — stops for that member the moment the change runs. Capture the member list and the role first; the undo restores Member only.
- **Okta-pushed groups:** if Okta pushes this group, Okta owns its membership — make the change there, under that runbook's gate, or the two directories disagree.
- **One membership per gate.** A bulk change through a CSV or GAM sync is a different, larger blast radius and is not this runbook.
- Removing an owner leaves the group without one; assign ownership to another user if the group needs an owner who is not an admin.

## ✅ Verification checklist

- [ ] `gam print group-members group "[GROUP_EMAIL]"` (or Directory → Groups → the group → Members) shows the expected membership and count.
- [ ] `gam info member "[USER@DOMAIN.COM]" "[GROUP_EMAIL]"` returns the membership with role MEMBER (add) or no membership (remove).
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the add-member or remove-member event with the expected admin and time.
- [ ] Removal only: the pre-state member list and the member's former role are in the ticket.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Resolved [date/time]. [Added / Removed] `[USER@DOMAIN.COM]` [to / from] `[GROUP_EMAIL]` ([purpose of the group]). [Add: role Member, confirmed by the exact phrase; user receives group mail. / Remove: pre-state member list ([N] members, former role [ROLE]) captured before the change; member count now [N-1].] Verified in the Members list and Admin log events. Time spent: [X] min.

## Aha moment

A Google Group is an access object that happens to deliver mail: adding is a grant, removing is a revocation — which is why the remove gate carries a pre-state and the add gate carries its undo.

## Career upgrade

Treating group membership as access control (capture, change, read back) is the habit that scales to IAM reviews and least-privilege audits in any cloud.

## Next action

Run Phase A and record the group's purpose and current member count before choosing Phase B or Phase C.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/groups/add-or-invite-users-to-a-group · knowledge.workspace.google.com/admin/groups/remove-or-ban-users-from-a-group · knowledge.workspace.google.com/admin/reports/admin-log-events · help.okta.com/en-us/content/topics/provisioning/google/google-provisioning.htm (Push Groups) · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Groups-Membership page; GAM is an open-source tool, not a Google product).
