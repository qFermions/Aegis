---
description: Jamf Pro inventory and computer groups. Read one Mac's inventory and group memberships, work out why an extension attribute is blank, submit one inventory update, create a smart group or change its criteria with the member count proved before and after, change a static group, and delete a smart group only after every scope that names it is cleared and an independent review. Placeholders only.
disable-model-invocation: true
---

# /jamf-inventory-groups

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[SERIAL_NUMBER]` (one Mac) · `[DEVICE_ID]` (that Mac's Jamf Pro computer ID, the `id` the inventory read returns) · `[SMART_GROUP]` / `[SMART_GROUP_ID]` (a smart or static computer group and its ID) · `[MEMBER_COUNT]` (the member count you predict before a change) · `[ADD_COUNT]` / `[REMOVE_COUNT]` (the number of Macs a static group change adds and removes, each Mac named by serial in the change record) · `[PROFILE_NAME]` / `[PROFILE_ID]` and `[POLICY_NAME]` / `[POLICY_ID]` (a profile or policy whose scope names the group) · `[NOT_BEFORE]` (the time the change was made; a read-back ignores anything older) · `[ISSUE_ID]`, `[NOTE_FILE]`, `[NOTE_SHA256]` (the Linear issue and its note) · `[ADMIN_NAME]` · `[@Aegion_JAMF_URL]` (the Jamf Pro server; the adapter reads it from `JAMF_URL`) · org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- **Groups are scope.** A group that a profile or policy targets, limits or excludes is a live switch: change its criteria or members and Macs join or leave, and every profile and policy that names it installs, removes or runs at each Mac's next check-in. Read where a group is used before changing it.
- Five changes carry their own exact-phrase gates: one inventory update from one Mac (R1, Terminal), create a smart group (R1, nothing scoped to it yet), change a smart group's criteria (R2 when nothing names the group and it holds 10 Macs or fewer, R3 otherwise), change a static group's members (R2 up to 10 Macs, R3 above), and delete a smart group (R3, after independent review).
- Changing an extension attribute's script, and sending Update Inventory to a whole group, are not in this runbook (previews in Phase B): a script attribute runs on every Mac at every inventory update.
- Every R3 change needs, before its step 1: the group's criteria and members in the ticket (the pre-state), the list of every profile and policy that names it, a written rollback and an independent out-of-session review (CLAUDE.md, Risk-Classified Execution Policy, R3 row).
- Not done until the read-backs pass: `verify-group-count` for a smart group, the Mac's group memberships for a static group, and the inventory read for an attribute.

## Inputs needed

- `[SERIAL_NUMBER]` for an inventory question, or `[SMART_GROUP]` for a group change.
- The criteria or member list from the change record: **[org gap: never invented here]**.
- For a blank extension attribute: its name, its input type and which Macs are blank (from the ticket).
- For a delete: the group's owner and why it is retired: **[org gap]**.

## How the systems hang together

- **Inventory arrives when the Mac submits it.** The built-in Update Inventory policy does that once a week by default (Jamf recommends keeping it), `jamf recon` on the Mac submits one now, and the declarative status channel reports some attribute changes as they happen. Optional categories (local accounts, printers, services, package receipts) appear only when enabled in the Computer Inventory Collection settings.
- **Extension attributes** add your own fields. Input type: text field, pop-up menu, script, or directory service attribute mapping; data type: string, integer or date (YYYY-MM-DD hh:mm:ss). A script attribute runs on each Mac during inventory, reports its value then, and adds inventory time and network traffic. An attribute can be a smart-group criterion.
- **Smart groups** are built from criteria and their membership follows inventory; **static groups** hold the Macs someone assigned. Advanced computer searches use the same criteria, evaluated top to bottom.
- Profiles and policies are scoped to groups, so a group change is a scope change for everything that names the group.
- Every Jamf Pro label below was read from Jamf's search-indexed pages, not from an opened page (the vendor hosts were unreachable from this session); the Smart Computer Groups, Static Computer Groups, Computer Inventory Collection and Computer Extension Attributes paths are marked there as not confirmed verbatim. Confirm each label on screen before clicking.

## Fast path

1. Phase A: read one Mac's inventory, last inventory update and group memberships (R0).
2. Phase B: an extension attribute is blank on some Macs: split blank from filled, read the pattern, test one Mac with a gated inventory update (R1).
3. Phase C: count the group and list where it is used (R0), then create a smart group (R1 gate) or change its criteria (R2 or R3 gate). **WAIT UNTIL** the member count matches the prediction.
4. Phase D: change a static group's members (R2 or R3 gate). **WAIT UNTIL** each Mac's memberships read back.
5. Phase E: delete a smart group: every use removed and read back, independent review, then the delete (R3 gate).

## Phase A: Read one Mac's inventory and group memberships (R0)

**Purpose**: know how fresh the record is and which groups the Mac sits in before trusting any field.

1. Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → General → read the last inventory update and the last check-in.
2. Same record → Inventory → read the extension attribute in the category its definition places it in, and the group memberships (the category labels are not in the sources read).

<details>
<summary>Jamf Pro API through the read-only adapter: the scale version (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only - JAMF_URL, JAMF_CLIENT_ID and JAMF_CLIENT_SECRET come from the environment, never from a ticket
# without the final --execute flag the adapter only prints the request it would send
# the general section with the last inventory update and the last check-in
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GENERAL --execute
# the groups this Mac belongs to
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GROUP_MEMBERSHIPS --execute
# the whole record with every section, for reading on screen: the adapter strips key-like fields and withholds the values of any extension attribute whose name contains pass, secret, token, key or pin
# copy into the ticket only the fields the question needs (last inventory update, last check-in, group names, the one attribute's name and value) - never the whole output
node scripts/adapters/jamf-client.js computer-detail --id [DEVICE_ID] --execute
```
</details>

**Verification checkpoint**: [ ] last inventory update and last check-in are in the ticket · [ ] the Mac's group memberships are recorded.

## Phase B: An extension attribute is blank on some Macs (R0, then one gated inventory update)

**Purpose**: a blank value usually means "not reported yet" or "nothing to report"; find which before anyone touches the script.

1. Split the Macs with a saved advanced computer search: the search gate below creates it (R1; a saved search is an object other administrators see, and no Mac changes). Read its results: the attribute, model, macOS version and last inventory update of each Mac.
2. Read the pattern and write the matching line in the ticket:
   - Blank only where the last inventory update is older than the attribute: those Macs have not reported since it was added. The weekly Update Inventory policy fills them in; test one Mac now with the gate below.
   - Blank on every Mac of one model family: an attribute that reads hardware some models lack (a battery on a desktop Mac) is blank there by design; say so in the ticket rather than "fixing" it.
   - Blank on one macOS version or one chip type only: the script behaves differently there; that is a script change for its owner (preview below).
   - Blank everywhere since one date: something changed then (the attribute, its script, or the Macs' macOS); who edited the attribute is not in the sources read **[org gap]**.
3. Jamf Pro → Settings → Computer Extension Attributes → the attribute → read the input type, the data type and, for a script, the script itself (R0; reading only). A script whose output does not fit the data type (text in an integer or date attribute) is a likely cause; what Jamf Pro stores then is not in the sources read, so read the value on one Mac before deciding.
4. A blank built-in field rather than an attribute: Jamf Pro → Settings → Computer Inventory Collection → read whether that optional category is collected. Turning a category on is a server-wide setting this runbook does not change.
5. Test one Mac from the blank side: record its group memberships first (the read just before the Terminal step), then the gated inventory update, then read the value and the memberships again.

**Role needed:** a Jamf Pro account with the privileges for advanced computer searches (their English names were not confirmed in the sources read); no Mac privilege is used.

<!-- SAFETY GATE [jamf-inventory-groups-saved-search-portal] -->
- **Target:** a saved advanced computer search named after [ISSUE_ID] (new)
- **Effect:** create one saved advanced computer search named after [ISSUE_ID]; no Mac, group or scope changes
- **Scope:** one search object on the Jamf Pro server that other administrators can see; it reads inventory and changes nothing on any Mac
- **Reversibility:** R1: no Mac is touched; the undo is deleting the saved search, whose control is not in the sources read (confirm it on screen)
- **Required confirmation:** Type exactly `CREATE SAVED SEARCH [ISSUE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-inventory-groups-saved-search-portal]:** Only after the exact match:
1. Jamf Pro → Computers → Search Inventory → **New** → name the search after `[ISSUE_ID]`.
2. Criteria: the extension attribute (for Phase C step 3, the new criteria from the change record, in order); Display: the attribute, model, macOS version and last inventory update → **Save** → read the results and their number.

> **PREVIEW ONLY [jamf-inventory-groups-ea-script-preview]:** Planning only: changing the attribute's input type, data type or script is not authorized here. The script runs on every Mac at every inventory update, so the change is fleet-wide: write it with the script's owner, run it by hand on one Mac of each model and macOS version, get an independent review, and carry it out as a separate reviewed change.

> **PREVIEW ONLY [jamf-inventory-groups-mass-inventory-preview]:** Planning only: sending Update Inventory to a whole group or search result (Action → Send Remote Commands) is not authorized here. The computer form of that mass action appears only in translated Jamf pages, it is R3 above 10 Macs, and the weekly Update Inventory policy refreshes every Mac without it.

<details>
<summary>Before the inventory update: the Mac's group memberships (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only - copy the group names into the ticket: an inventory update can move the Mac into or out of a smart group
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GROUP_MEMBERSHIPS --execute
```
</details>

**Role needed:** a local administrator account on the Mac (for `sudo`); no Jamf Pro privilege is used by the Terminal step.

<details>
<summary>Terminal on the Mac: submit one inventory update (HUMAN-RUN)</summary>

```zsh
# HUMAN-RUN - the administrator runs this in Terminal on the Mac, Aegis never does
# SAFETY GATE [jamf-inventory-groups-recon]
# Target: [SERIAL_NUMBER]
# Effect: submit a fresh inventory from one Mac so its extension attributes and smart group memberships are recalculated
# Scope: one Mac - recon itself runs no policy and changes no setting, but the smart group memberships of the Mac may change, so profiles and policies scoped to those groups may install, remove or run on it at its next check-in
# Reversibility: R1 - the inventory needs no undo since the next scheduled inventory replaces the values, but what a membership change set off is not undone by it - compare the GROUP_MEMBERSHIPS reads before and after
# Required confirmation: type exactly "SUBMIT INVENTORY UPDATE FROM [SERIAL_NUMBER]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="SUBMIT INVENTORY UPDATE FROM [SERIAL_NUMBER]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # submits a fresh inventory record to Jamf Pro
  sudo jamf recon
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**WAIT UNTIL** Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → General shows a last inventory update after `[NOT_BEFORE]` (the time you ran it), then read the attribute and the group memberships again.

<details>
<summary>Read-back through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only
# the last inventory update must be later than the time the update was submitted
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GENERAL --execute
# the groups after the update - compare with the read before the gate; a group joined or left goes into the ticket with the profiles and policies that name it (Phase C step 2)
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GROUP_MEMBERSHIPS --execute
# the whole record including the extension attribute value - copy only that attribute's name and value into the ticket
# an attribute whose name contains pass, secret, token, key or pin is printed without its value: read it on screen and never copy it into the ticket
node scripts/adapters/jamf-client.js computer-detail --id [DEVICE_ID] --execute
```
</details>

**Verification checkpoint**: [ ] the pattern line is in the ticket · [ ] the tested Mac shows a fresh inventory and either the value or the reason it stays blank · [ ] its group memberships before and after are in the ticket, with any change named.

## Phase C: Smart groups: count, find every use, then create or change criteria (R1, R2 or R3)

**Purpose**: a smart group's criteria decide which Macs every scope that names it reaches; prove the count before and after.

1. Count the group (R0): the adapter reads below (`smart-groups`, `group-members`), or Jamf Pro → Computers → Smart Computer Groups → `[SMART_GROUP]`. Copy the criteria and the members into the ticket: this is the pre-state and the rollback.
2. Find every use (R0): Jamf Pro → Computers → Configuration Profiles → each profile → Scope, and Jamf Pro → Computers → Policies → each policy → Scope; note every target, limitation and exclusion that names `[SMART_GROUP]`. The sources read describe no "where used" view, so this is a manual read; the adapter reads one object at a time (`profile --id`, `policy --id`).
3. Predict the new count: build the new criteria as a saved advanced search first, under Phase B's search gate with this change's `[ISSUE_ID]`, and read the number of results; write it as `[MEMBER_COUNT]`.
4. Classify: a new group, or nothing names the group and it holds 10 Macs or fewer: R1 or R2. Anything names it, or more than 10 Macs: R3, which needs the independent review and a change window first.

<details>
<summary>Jamf Pro API through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only
# the group by name with its ID and criteria - copy the criteria into the ticket
node scripts/adapters/jamf-client.js smart-groups --name "[SMART_GROUP]" --execute
# the current members of the group
node scripts/adapters/jamf-client.js group-members --id [SMART_GROUP_ID] --execute
# the scope of one profile that may name the group
node scripts/adapters/jamf-client.js profile --id [PROFILE_ID] --execute
# the scope of one policy that may name the group
node scripts/adapters/jamf-client.js policy --id [POLICY_ID] --execute
```
</details>

**Role needed:** a Jamf Pro account with the Administrator privilege set, or a Custom privilege set with create, read and update for smart computer groups (the API reference names Read Smart Computer Groups; the create and update names follow the same pattern and were not confirmed on an opened page).

<!-- SAFETY GATE [jamf-inventory-groups-smart-create-portal] -->
- **Target:** [SMART_GROUP] (new)
- **Effect:** create one smart computer group from the criteria in the change record; no profile or policy is scoped to it yet
- **Scope:** the group list only; no Mac changes until something is scoped to the group
- **Reversibility:** R1: an unused group can be deleted again under Phase E's gate, and nothing on any Mac changed
- **Required confirmation:** Type exactly `CREATE SMART GROUP [SMART_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-inventory-groups-smart-create-portal]:** Only after the predicted count is in the ticket and the exact match:
1. Jamf Pro → Computers → Smart Computer Groups → **New** → display name `[SMART_GROUP]`.
2. Criteria → **Add** → each criterion, operator and value from the change record, in order (criteria evaluate top to bottom) → **Save**. Write the save time as `[NOT_BEFORE]`.

**WAIT UNTIL** the member count reads `[MEMBER_COUNT]`; a Mac whose inventory is stale joins after its next inventory update, so a short count names its stale Macs in the ticket.

<details>
<summary>Read-back through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only
# the new group and its ID
node scripts/adapters/jamf-client.js smart-groups --name "[SMART_GROUP]" --execute
# proves the group holds exactly the predicted number of Macs
node scripts/adapters/jamf-client.js verify-group-count --id [SMART_GROUP_ID] --expect [MEMBER_COUNT] --execute
```
</details>

**Role needed:** the same Jamf Pro privileges as the create gate; for R3, the reviewer needs only the Auditor privilege set (read-only; the English name comes from a translated Jamf page).

<!-- SAFETY GATE [jamf-inventory-groups-smart-criteria-portal] -->
- **Target:** [SMART_GROUP] criteria
- **Effect:** change one smart group's criteria, so Macs join or leave it and every profile or policy that names it follows at each Mac's next check-in
- **Scope:** the Macs that join or leave (the step 3 prediction against the step 1 count), plus every profile and policy step 2 found
- **Reversibility:** R2 when nothing names the group and it holds 10 Macs or fewer, R3 otherwise: re-enter the old criteria from the ticket under a fresh run of this gate; installs, removals and policy runs already done downstream are not undone by restoring the criteria
- **Required confirmation:** Type exactly `CHANGE CRITERIA OF SMART GROUP [SMART_GROUP] TO REACH [MEMBER_COUNT] MACS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-inventory-groups-smart-criteria-portal]:** Only after the pre-state, the list of uses, the predicted count, (for R3) the independent review, and the exact match:
1. Jamf Pro → Computers → Smart Computer Groups → `[SMART_GROUP]` → **Edit** → Criteria → enter the criteria from the change record → **Save**. Write the save time as `[NOT_BEFORE]`.

**WAIT UNTIL** the member count reads `[MEMBER_COUNT]`, then read each profile that names the group in `/jamf-config-profiles` Phase A: its Remaining count falls to 0 as Macs check in.

<details>
<summary>Read-back through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only
# proves the group now holds exactly the predicted number of Macs
node scripts/adapters/jamf-client.js verify-group-count --id [SMART_GROUP_ID] --expect [MEMBER_COUNT] --execute
# the members after the change - compare with the pre-state in the ticket
node scripts/adapters/jamf-client.js group-members --id [SMART_GROUP_ID] --execute
```
</details>

**Verification checkpoint**: [ ] criteria, members and every use are in the ticket before the gate · [ ] `verify-group-count` passed after it · [ ] the profiles that name the group read Remaining 0.

## Phase D: Change a static group's members (R2, R3 above 10 Macs)

**Purpose**: a static group holds exactly the Macs someone assigned; every profile and policy that names it follows the change.

1. Jamf Pro → Computers → Static Computer Groups → `[SMART_GROUP]` → read the member list and copy it into the ticket (the pre-state).
2. Find every use as in Phase C step 2.
3. Count the Macs you add and remove, and write them in the ticket by serial, as `[ADD_COUNT]` and `[REMOVE_COUNT]`, with the member count after the change as `[MEMBER_COUNT]`: the phrase below binds all three. More than 10 changed, or a group that a security profile names, is R3 and needs the independent review first.

**Role needed:** a Jamf Pro account with the Administrator privilege set, or a Custom privilege set with read and update for static computer groups (privilege names follow Jamf's object-plus-verb pattern and were not confirmed on an opened page).

<!-- SAFETY GATE [jamf-inventory-groups-static-members-portal] -->
- **Target:** [SMART_GROUP] members (a static group): [ADD_COUNT] Macs added and [REMOVE_COUNT] removed, each named by serial in the change record
- **Effect:** add or remove Macs in one static computer group, so every profile and policy that names the group follows at each Mac's next check-in
- **Scope:** only the [ADD_COUNT] Macs added and the [REMOVE_COUNT] removed, plus the objects step 2 found
- **Reversibility:** R2 up to 10 Macs, R3 above: restore the member list from the ticket under a fresh run of this gate; what a profile or policy already did on a Mac is not undone by restoring the list
- **Required confirmation:** Type exactly `ADD [ADD_COUNT] AND REMOVE [REMOVE_COUNT] MACS IN STATIC GROUP [SMART_GROUP] TO REACH [MEMBER_COUNT] MACS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-inventory-groups-static-members-portal]:** Only after the pre-state, the count, (for R3) the independent review, and the exact match:
1. Jamf Pro → Computers → Static Computer Groups → `[SMART_GROUP]` → **Edit** → Assignments → tick or untick exactly the Macs the change record names → **Save**. Write the save time as `[NOT_BEFORE]`.

**WAIT UNTIL** each added Mac lists the group and each removed Mac no longer does.

<details>
<summary>Read-back through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only - repeat for each Mac added or removed
# the groups this Mac belongs to after the change
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section GROUP_MEMBERSHIPS --execute
```
</details>

**Verification checkpoint**: [ ] the member list before the change is in the ticket · [ ] every changed Mac reads back in or out of the group.

## Phase E: Delete a smart group (R3, after independent review)

**Purpose**: retire a group without silently widening or narrowing any scope.

1. Pre-state: the group's criteria and members from Phase C step 1 are in the ticket. A group rebuilt later gets a new ID and is attached to no scope.
2. Every use from Phase C step 2 is removed first, one reviewed change at a time, and read back. Count the group first (`verify-group-count`, R0); the count picks the gate:
   - A profile's Targets, group of 10 Macs or fewer: `/jamf-config-profiles` Phase G's first gate (R2).
   - A profile's Targets, group of more than 10 Macs: the R3 path, the independent review first, then `/jamf-config-profiles` Phase G's third gate, whose Scope is a group of more than 10 Macs.
   - A policy's Targets: `/jamf-policies-self-service` Phase D's change gate, with the review first when the group holds more than 10 Macs (R3 there too).
   - A Limitation or an Exclusion: taking it away widens the scope, so the profile installs or the policy runs on the Macs it held back; an exclusion often protects Macs on purpose. Neither runbook authorizes it (PREVIEW ONLY below).
3. What Jamf Pro does with a profile or policy whose scope still names a deleted group is not in the sources read. This runbook takes the safer reading: deleting changes those scopes at once, so the delete waits until no use remains.
4. Independent out-of-session review: the reviewer gets the pre-state, the list of uses and their removal read-backs, never this conversation's reasoning.
5. **Stop if** any use remains, the owner has not agreed, or the review is missing.

> **PREVIEW ONLY [jamf-inventory-groups-limitation-exclusion-preview]:** Planning only: taking `[SMART_GROUP]` out of a profile's or a policy's Limitations or Exclusions is not authorized here, and neither is emptying it while it sits there. Both put Macs back in scope, so the profile installs or the policy runs on them at their next check-in. Count the Macs it would add, replace the protection first if it is still needed, and carry it out as a separately reviewed change (R3 above 10 Macs); the delete waits until it is done.

**Role needed:** a Jamf Pro account with the Administrator privilege set, or a Custom privilege set with delete for smart computer groups (privilege name not confirmed on an opened page); the reviewer needs only the Auditor privilege set.

<!-- SAFETY GATE [jamf-inventory-groups-delete-portal] -->
- **Target:** [SMART_GROUP]
- **Effect:** delete one smart computer group permanently; no profile or policy names it any more
- **Scope:** the group object only; its members stay managed and keep every other membership
- **Reversibility:** R3: not reversible; a group rebuilt from the criteria in the ticket gets a new ID and is attached to no scope until each scope is edited again
- **Required confirmation:** Type exactly `DELETE SMART GROUP [SMART_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [jamf-inventory-groups-delete-portal]:** Only after every use is removed and read back, the independent review, and the exact match:
1. Jamf Pro → Computers → Smart Computer Groups → `[SMART_GROUP]` → **Delete** (the button and its dialog are not in the sources read; confirm both on screen).
2. Confirm the dialog only if it names `[SMART_GROUP]`. Write the time as `[NOT_BEFORE]`.

**WAIT UNTIL** the group is gone from Jamf Pro → Computers → Smart Computer Groups.

<details>
<summary>Read-back through the read-only adapter (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN - read-only
# proves no group of that name is left - the read returns no match
node scripts/adapters/jamf-client.js smart-groups --name "[SMART_GROUP]" --execute
# each former user of the group shows no reference to it in its scope
node scripts/adapters/jamf-client.js profile --id [PROFILE_ID] --execute
# the same for each former policy
node scripts/adapters/jamf-client.js policy --id [POLICY_ID] --execute
```
</details>

**Verification checkpoint**: [ ] the smart-groups read returns no `[SMART_GROUP]` · [ ] every former user's scope read shows no reference.

## ⚠️ Risk warning

- **Criteria are scope.** Editing a smart group's criteria edits every profile and policy that names it, without opening any of them. Count before and after.
- **An exclusion group protects Macs.** Taking it away, emptying it or deleting it puts the excluded Macs back in scope.
- **Deleting a group cannot be undone.** A rebuilt group has a new ID and is attached to nothing; restore every scope by hand.
- **A script attribute runs everywhere.** Changing it is a fleet-wide change at the next inventory, not a field edit.
- Inventory is weekly by default. Do not loop `jamf recon` or a mass Update Inventory to "speed up" a count; test one Mac and wait.

## ✅ Verification checklist

- [ ] The pre-state (criteria, members, every use) was in the ticket before the first gate.
- [ ] After a create or a criteria change: `verify-group-count --id [SMART_GROUP_ID] --expect [MEMBER_COUNT]` passed, and the profiles that name the group read Remaining 0.
- [ ] After a static group change: each changed Mac's GROUP_MEMBERSHIPS read shows it in or out as planned.
- [ ] After a delete: the smart-groups read returns no `[SMART_GROUP]`, and every former profile and policy scope shows no reference.
- [ ] For a blank attribute: the tested Mac shows a last inventory update after `[NOT_BEFORE]` and either the value or the recorded reason it stays blank.
- [ ] Every R3 change has its independent review reference in the ticket.

## 📝 Linear-ready note

> **Completed (only when every read-back above passed):** Jamf Pro [extension attribute blank on [X] Macs: cause [not reported yet / model has no such hardware / script differs on one macOS version], tested on `[SERIAL_NUMBER]` with a gated inventory update / smart group `[SMART_GROUP]` created / criteria changed to reach [MEMBER_COUNT] Macs / static group `[SMART_GROUP]` members changed / smart group `[SMART_GROUP]` deleted after its uses were removed and an independent review [reference]] at [timestamp] by `[ADMIN_NAME]`, confirmed by the exact phrase. Pre-state (criteria, members, uses) recorded in this issue. Read-backs: [verify-group-count passed / memberships read back / smart-groups read returns no match / inventory updated after [NOT_BEFORE]]. Time spent: [X] min.
>
> **Partial state (any read-back failed or still pending):** Verified: [the read-backs that passed]. Pending: [Macs with stale inventory, uses not yet removed, count not yet reached]. Next owner: `[ADMIN_NAME]`; next step: [wait for the weekly inventory / remove the remaining use / rollback with the criteria in this issue].

An administrator posts this note as a comment on `[ISSUE_ID]` in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the exact note and its SHA-256 digest (`[NOTE_SHA256]`) with no credentials and no network; Aegis never posts it, and the read-back below proves the comment landed unchanged.

```bash
# read-back: a comment on the issue created after the note was posted whose body has the digest that note printed
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

A smart group is a saved query that other objects obey: change the query and you have changed every scope that names it, without opening a single profile or policy.

## Career upgrade

Treating groups like shared code (find every reference, change, prove the count, read the dependents back) is the refactoring discipline that separates an MDM operator from an endpoint engineer.

## Next action

Run Phase A on `[SERIAL_NUMBER]`, or Phase C step 1 and step 2 on `[SMART_GROUP]`, and paste the result into `[ISSUE_ID]` before any gate.

**Sources (checked 2026-10-27):** learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Computer_Inventory_Information (weekly Update Inventory policy, `jamf recon`, declarative status, optional categories; search excerpt of a translated page) · learn.jamf.com/r/de-DE/jamf-pro-documentation-11.28.0/Computer_Extension_Attributes (input types and data types; search excerpt of a translated page) · learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Computer_Inventory_and_Criteria_Reference (criteria; search excerpt) · learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Group_Management (smart and static groups; search excerpt) · learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Creating_an_Advanced_Computer_Search (Search Inventory, New, criteria order; search excerpt) · learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.23.0/Remote_Commands_for_Computers (mass actions; search excerpt of a translated page) · learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups (privilege sets; search excerpt of a translated page) · developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory (sections and serial filter; search excerpt) · developer.jamf.com/jamf-pro/reference/get_v2-computer-groups-smart-groups and get_v2-computer-groups-smart-group-membership-id (group search, membership, Read Smart Computer Groups; search excerpt) · docs/aegis/lanes/g2.md (the read-only adapter and its `verify-*` reads; repo document) · the G1 runbook `/jamf-enroll-mac` (the gated `jamf recon` pattern and the General section's last check-in; repo runbook checked 2026-10-15). No Jamf page could be opened from this session (proxy refusal and DNS failure on 2026-10-27), so every label and behaviour above comes from a search excerpt of the page named and is to be confirmed on screen.
