---
description: Assign or remove a Google Workspace licence for one user — assignment is a stated-undo R1, removal is an SR-2 R3 with the pre-state (which SKU, what data) captured first and archiving offered as the data-keeping alternative. Placeholders only.
disable-model-invocation: true
---

# /gws-license-assign

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[USER@DOMAIN.COM]` (the user) · `[LICENSE_TYPE]` (the subscription or SKU, for example a Google Workspace edition or an add-on) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

## ⚠️ Admin / safety gate

- **Assign = R1.** One user, one switch, undo stated in the gate (the removal gate below, under its own phrase).
- **Remove = R3 (SR-2 licence removal).** Removing a user's licence can lose their data. The vendor's data-keeping alternative is to archive the user instead (an Archived User licence); offer it before any removal. Pre-state — which SKU the user holds and what data sits behind it — is captured in Phase 1 before the gate.
- A removed licence can take up to 24 hours before it can be reassigned to someone else; a CSV upload can assign but never revoke; if automatic licensing is on for the service, an individual user's licence cannot be removed at all.
- Needs the User management privilege (user page) or the License management privilege (Billing → License settings).
- Not done until the read-backs in the final checklist pass.

## Inputs needed

- `[USER@DOMAIN.COM]` and `[LICENSE_TYPE]` (which subscription; the SKU IDs come from the Google licensing product list).
- Whether automatic licensing is on for that service and the user's organizational unit — read it in Phase 1.
- For a removal: why (left the organization → use the offboarding runbook `/gws-offboard` instead; finished a programme but stays → this runbook) and whether the data must be kept (→ archive instead of remove) — **[org gap — confirm the retention decision]**.

## How licensing works

- Licences are managed in three places: the Billing page (whole organization, uploaded lists, automatic licensing), the Users list (several users at once) and the individual user's page (one user — this runbook).
- Automatic licensing is set at Billing → License settings; an automatically assigned licence can take up to 24 hours to take effect, and while it is on you cannot remove a single user's licence.
- A licence cannot be moved directly from one user to another: unassign, then assign — and reassignment may be blocked for up to 24 hours. Mutually exclusive editions (for example Business Standard over Business Starter) make an assignment fail. Add-on licences removed mid-month can still be billed for the full month.
- **A licence is not the same as service access.** The user's organizational unit decides which services are turned on; "service not enabled" can be the unit setting rather than a missing licence — Phase 1 reads both.

## Fast path

1. Phase 1 — read the user's current licences, the automatic-licensing state and the data footprint (R0).
2. Phase 2 — assign (R1 gate). **WAIT UNTIL** the Licenses section reads **On** and the user can open the service.
3. Phase 3 — remove only with the pre-state recorded and archiving considered (R3 gate).

## Phase 1 — Pre-state (R0)

**Purpose** — know which SKU the user holds, whether the switch is even yours to flip, and what data a removal would put at risk.

1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → scroll down → **Licenses** → read which services show **On** in the Status column and record the SKU(s).
2. Admin console → Billing → License settings → read whether automatic licensing is **On** for `[LICENSE_TYPE]` (on = an individual removal is impossible from the user page).
3. Admin console → Apps → Google Workspace → Gmail → pick the user's organizational unit in the tree on the left → read whether the service is turned on for that unit (a ticket that says "service not enabled" often ends here).

```bash
# read-only: the user's licences, organizational unit and status before any change
gam info user "[USER@DOMAIN.COM]" licenses   # prints the SKUs the user holds plus OU and suspension state
# read-only: how much data sits behind the licence (Drive and Gmail storage in MB)
gam report users user "[USER@DOMAIN.COM]" parameters accounts:drive_used_quota_in_mb,accounts:gmail_used_quota_in_mb   # the data footprint a removal would put at risk
# read-only: licence counts per SKU, to see whether a seat is free before assigning
gam show licenses   # prints licence counts for every Google product
```

**Verification checkpoint** — [ ] current SKU(s) recorded · [ ] automatic-licensing state recorded · [ ] for a removal, the data footprint and the archive-or-remove decision are in the ticket.

## Phase 2 — Assign a licence (R1)

**Purpose** — give one user one licence; the undo is the removal gate under its own phrase.

<!-- SAFETY GATE [gws-license-assign-assign-portal] -->
- **Target:** [USER@DOMAIN.COM] ([LICENSE_TYPE])
- **Effect:** assign one [LICENSE_TYPE] licence to the user so the licensed services become available to them
- **Scope:** one user, one subscription; on the Flexible Plan this raises the monthly charge
- **Reversibility:** R1 — undo in the same place by switching the licence back off under the Phase 3 phrase `REMOVE LICENSE [LICENSE_TYPE] FROM [USER@DOMAIN.COM]`; the freed seat may take up to 24 hours before it can be reassigned
- **Required confirmation:** Type exactly `ASSIGN LICENSE [LICENSE_TYPE] TO [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-license-assign-assign-portal]:** Only after the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → scroll down → **Licenses**.
2. Open the `[LICENSE_TYPE]` service to show the on/off switches → in the **Status** column flip the switch on → **Save**.
3. Read back: the Licenses section for `[USER@DOMAIN.COM]` shows `[LICENSE_TYPE]` **On**.

**WAIT UNTIL** the Licenses section reads **On** and the user can open the service after reloading it. How long a manually assigned licence takes to reach the user is not stated on the vendor page — **[unverified]**; an automatically assigned one can take up to 24 hours, and a brand-new account can take up to 24 hours for services to become available.

**Verification checkpoint** — [ ] Licenses shows **On** · [ ] the user opens the service.

**Gotcha** — the assignment fails outright when the user already holds a mutually exclusive edition; remove the old one first (Phase 3, its own gate) and expect the up-to-24-hour reassignment delay.

## Phase 3 — Remove a licence (R3, SR-2)

**Purpose** — free the seat only when the data decision is made and the pre-state is in the ticket.

Archiving is the vendor's data-keeping alternative: an Archived User licence keeps the user's data without a full seat. If the data must stay, stop here and archive instead of removing (a separate procedure; the licensing page points to "Archive former employee accounts"). A user who has left the organization belongs in `/gws-offboard`, not here.

<!-- SAFETY GATE [gws-license-assign-remove-portal] -->
- **Target:** [USER@DOMAIN.COM] ([LICENSE_TYPE])
- **Effect:** remove one [LICENSE_TYPE] licence from the user; data behind that licence may be lost
- **Scope:** one user, one subscription; the account itself stays active and keeps its organizational unit and groups
- **Reversibility:** R3 — re-assigning restores the services under the Phase 2 phrase `ASSIGN LICENSE [LICENSE_TYPE] TO [USER@DOMAIN.COM]`, but data lost in between is not restored by re-assigning, and the seat may be unavailable for up to 24 hours; the Phase 1 record (SKU, Drive and Gmail footprint) is the only pre-state
- **Required confirmation:** Type exactly `REMOVE LICENSE [LICENSE_TYPE] FROM [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [gws-license-assign-remove-portal]:** Only after the Phase 1 pre-state is recorded, the archive-or-remove decision is in the ticket, and the exact match:
1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → scroll down → **Licenses**.
2. Open the `[LICENSE_TYPE]` service to show the on/off switches → in the **Status** column flip the switch off → **Save**.
3. Read back: the Licenses section for `[USER@DOMAIN.COM]` shows `[LICENSE_TYPE]` **Off**.

**Verification checkpoint** — [ ] Licenses shows **Off** · [ ] the ticket names the SKU removed and the data decision.

**Gotcha** — the Users list also has Assign Licenses and Remove Licenses in its More menu for several ticked users at once. That is a multi-user scope (R2/R3) with its own pre-state and gate, outside this runbook.

<details>
<summary>GAM — the scale version (HUMAN-RUN, for reference)</summary>

In GAM, licence commands take the SKU as `[LICENSE_TYPE]` (a SKU ID or one of GAM's abbreviations from its Licenses page). Both commands accept a `preview` word that shows the change without making it — a previewed line is still a mutation and stays inside its gate.

```bash
# HUMAN-RUN — the administrator runs this in their own terminal — Aegis never does
# SAFETY GATE [gws-license-assign-assign]
# Target: [USER@DOMAIN.COM] — [LICENSE_TYPE]
# Effect: assign one [LICENSE_TYPE] licence to the user
# Scope: one user, one subscription
# Reversibility: R1 — undo with the separate removal gate under its own phrase
# Required confirmation: type exactly "ASSIGN LICENSE [LICENSE_TYPE] TO [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="ASSIGN LICENSE [LICENSE_TYPE] TO [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # assigns the SKU to the user
  gam user "[USER@DOMAIN.COM]" add license "[LICENSE_TYPE]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the SKU should be listed for the user
gam info user "[USER@DOMAIN.COM]" licenses
```

```bash
# HUMAN-RUN — remove only after the Phase 1 pre-state and the archive-or-remove decision are in the ticket
# SAFETY GATE [gws-license-assign-remove]
# Target: [USER@DOMAIN.COM] — [LICENSE_TYPE]
# Effect: remove one [LICENSE_TYPE] licence from the user — data behind that licence may be lost
# Scope: one user, one subscription — the account stays active
# Reversibility: R3 — re-assigning does not restore data lost in between — the Phase 1 record is the only pre-state
# Required confirmation: type exactly "REMOVE LICENSE [LICENSE_TYPE] FROM [USER@DOMAIN.COM]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="REMOVE LICENSE [LICENSE_TYPE] FROM [USER@DOMAIN.COM]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # removes the SKU from the user
  gam user "[USER@DOMAIN.COM]" delete license "[LICENSE_TYPE]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the SKU should no longer be listed
gam info user "[USER@DOMAIN.COM]" licenses
# read-back: the freed seat shows in the per-SKU counts — reassignment may lag up to 24 hours
gam show licenses
```
</details>

## ⚠️ Risk warning

- **Removal can lose data** — that is the vendor's own warning. If anyone still needs the mailbox or Drive, archive instead; a removed licence is not a backup strategy.
- A freed seat may be unusable for up to 24 hours, so "remove from one, assign to another" is not an instant swap — plan the gap.
- Automatic licensing on for the service means the user-page switch will not remove the licence; do not try to force it by turning automatic licensing off, which changes licensing for the whole unit.
- A person who left the organization is an offboarding (`/gws-offboard`): sign-in, sessions and data transfer come before the licence.

## ✅ Verification checklist

- [ ] Admin console → Directory → Users → `[USER@DOMAIN.COM]` → Licenses shows `[LICENSE_TYPE]` **On** (assignment) or **Off** (removal); `gam info user "[USER@DOMAIN.COM]" licenses` agrees.
- [ ] Assignment: the user opened the service after reloading; the organizational unit has the service turned on.
- [ ] Removal: the ticket records the SKU, the Drive and Gmail footprint from Phase 1, and the archive-or-remove decision.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the licence change with the expected admin and time.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] [Assigned / Removed] `[LICENSE_TYPE]` for `[USER@DOMAIN.COM]` on [date/time], confirmed by exact phrase. Pre-state: [SKUs held / automatic licensing state / Drive and Gmail footprint]. [Removal: data decision — archived instead / removal approved by [role]]. Read-back: Licenses section and `gam info user` agree; Admin log events show the change. [Assignment: user confirmed the service opens; organizational unit has it turned on.] Time spent: [X] min.

## Aha moment

A licence and a service switch are two different objects: the licence is billing and entitlement per user, the organizational unit decides whether the service is on at all — "not enabled" is as often the unit as the seat.

## Career upgrade

Treating licence removal as a data-lifecycle decision (archive vs remove vs offboard) rather than a cost toggle is the judgment that separates seat administration from SaaS governance.

## Next action

Start Phase 1 — read the user's current licences and the automatic-licensing state before deciding which gate applies.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/billing/assign-remove-and-reassign-licenses · knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user (services available within 24 hours) · knowledge.workspace.google.com/admin/users/advanced/move-users-to-an-organizational-unit (the unit determines service access) · knowledge.workspace.google.com/admin/reports/admin-log-events · GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Licenses, Users and Reports pages; GAM is an open-source tool, not a Google product).
