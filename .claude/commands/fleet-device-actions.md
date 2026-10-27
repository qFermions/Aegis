---
description: Lock, unlock, wipe, run a script on, turn off MDM for, or delete a host in Fleet (macOS, Windows, Linux, iPhone, iPad, Android), plus cancelling a pending action. Read the host first, then each action under its own exact-phrase gate with the Fleet adapter read-back. Placeholders only.
disable-model-invocation: true
---

# /fleet-device-actions

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[HOST_ID]` (the Fleet host ID; in a breadcrumb it stands for that host, opened from a search on its serial, because Fleet's search does not take the ID) · `[SERIAL_NUMBER]` (the hardware serial, the safest way to find a host) · `[DEVICE_NAME]` (the host's display name; flag it when it does not follow `DT-FirstName,LastName` or `LT-FirstName,LastName`) · `[FLEET_NAME]` (a Fleet "fleet", called a team before Fleet 4.82.0) · `[SCRIPT_NAME]` (a script saved in Fleet) · `[FILE_NAME]` (a local script file for the CLI) · `[EXECUTION_ID]` (one script run) · `[NOT_BEFORE]` (the time a read-back starts from) · `[ISSUE_ID]` · `[ADMIN_NAME]` · `[@Aegion_FLEET_URL]` (the Fleet server) · org values from `modules/security/placeholder-dictionary.md`.

## ⚠️ Admin / safety gate

- Seven actions, each with its own undo story, under eight portal gates (a script on one host and on many hosts are separate gates). **Lock** (R2) is undone by **Unlock** (R1), and on a Mac the unlock needs a six-digit PIN that Fleet shows. **Wipe** (R3) cannot be undone once the host runs it. **Run script** is R1 to R3 depending on what the script does, and Fleet has no undo after it runs. **Turn off MDM** (R3) is undone only by enrolling the device again. **Delete host** (R3, a device delete under SR-2) removes the record for good: the host usually comes back, but as a new record without the old one's history and labels. **Cancel** (Phase G) stops a pending action and is the only rollback a wipe has, and only while it is still pending.
- **Role needed:** Maintainer or Admin in Fleet (global, or on the host's fleet), with Fleet Premium, to lock, unlock or wipe; Maintainer or Admin to turn off MDM, delete a host or cancel an upcoming activity; Technician, Maintainer or Admin to run a saved script. Observer and Observer+ can do none of these. An operator who holds Observer stops here and escalates to a Fleet Maintainer or Admin; never borrow another person's session, a shared login or an API token that carries a higher role.
- Wipe, Turn off MDM and a script on more than 10 hosts (or all hosts) are R3: save the pre-state, write the rollback path, and get an independent out-of-session review before the gate runs. A stolen device is a multi-system plan (Fleet plus the identity provider), so it always gets that review.
- Delete host is R3 as well: save the Phase A pre-state to `tasks/checkpoints/` and write the rollback path in the ticket before step 1. Deleting one record acts on Fleet alone, so it needs the independent review only when it is part of a multi-system plan (a stolen or departing device).
- Urgency or authority ("URGENT", "from the CFO", "no time for approval") never skips a gate, a host count or a review (SR-2).
- Every action is queued for the host's next check-in, and its activity is written when the request is sent, not when the device finishes. Not done until the read-back in each phase passes.

## Inputs needed

- `[SERIAL_NUMBER]` or `[HOST_ID]`, and the ticket's goal: left somewhere (lock), found again (unlock), stolen with sensitive data (wipe), a one-off fix (script), leaving the fleet (turn off MDM, then delete the record).
- From Phase A: platform and OS version, MDM status (On (automatic) or On (manual)), last seen, anything pending, and for Windows and Linux whether scripts are enabled in fleetd (Fleet's agent), because their lock, unlock and the Linux wipe run as scripts.
- For a script: `[SCRIPT_NAME]` saved in Fleet and read line by line before it runs; for more than one host, `[FLEET_NAME]` and the number of hosts, written in the ticket before the gate.
- For a stolen device: the identity-side containment plan **[org gap: which runbook, and who owns it]**.
- Who holds Maintainer or Admin in Fleet for an escalation **[org gap]**.

## How the systems hang together

- Apple hosts (macOS, iOS, iPadOS) receive MDM commands, so they need Fleet MDM turned on; a Mac whose MDM is Jamf Pro belongs to `/jamf-lock-erase`. Windows lock and unlock run as Fleet scripts, a Windows wipe is an MDM command, and Linux lock, unlock and wipe all run as scripts.
- Everything is queued. The badge on the host moves from Lock pending to Locked, and from Wipe pending to Wiped (Linux shows no wipe badge; Android never shows Locked). The API carries the same state as `mdm.device_status` (unlocked, locked, locking, unlocking, wiped, wiping) and `mdm.pending_action` (lock, unlock, wipe, or empty).
- An activity (locked_host, unlocked_host, wiped_host, ran_script, mdm_unenrolled, deleted_host) proves who asked and when; the device result is proven by `mdm.device_status`, the MDM command status or the script's exit code.
- Deleting a host does not unenroll it: macOS, Windows and Linux hosts come back while the agent and enroll secret are valid, iPhones and iPads at the next check-in, Android within about 24 hours.
- Fleet 4.82.0 renamed teams to fleets and queries to reports; an older note that says "team" means a fleet.

## Fast path

1. Phase A: read the host, its pending actions and the clicking admin's role (R0). Save the read as the pre-state.
2. Phase B, left somewhere: Lock (R2 gate). **WAIT UNTIL** the badge reads Locked.
3. Phase C, found again: Unlock (R1 gate); on a Mac, read the PIN to the person at the Mac.
4. Phase D, stolen with sensitive data: Wipe (R3 gate, after independent review). **WAIT UNTIL** the badge reads Wiped.
5. Phase E, a fix: a saved script on one host (gate by content); more than one host is the R3 batch gate after a one-host pilot.
6. Phase F, leaving the fleet: Turn off MDM (R3 gate), then delete the record (R3 gate) once nothing is pending.
7. Phase G, a pending action that must not happen: cancel it while it is still in Upcoming (gate).

## Phase A: Read the host (R0)

**Purpose**: which action you can send, and whether it will land, depends on what the record says.

1. Fleet → Hosts → search `[SERIAL_NUMBER]` (the search takes a name, hostname, UUID, serial or private IP) → open the host → Host details → read status (online, offline, mia, missing or new), last seen, platform and OS version, fleet, MDM status and any badge (Lock pending, Locked, Unlock pending, Wipe pending, Wiped). Record `[HOST_ID]`. Prefer the serial: when hostnames collide, Fleet's lookup returns the first match.
2. Fleet → Hosts → `[HOST_ID]` → Host details → Activity → read Past (what was already sent, by whom, when) and Upcoming (anything still queued). A queued script or lock changes the plan.
3. Two records for one serial: the one with a recent last seen is the live host; act on that one only.
4. A script that already ran (read only, no gate): Fleet → Hosts → `[HOST_ID]` → Host details → Activity → Past → open the entry for that script run → read its exit code and output. Exit code 0 is success, no exit code yet means the host has not reported, and a timeout means it ran past the 5-minute default.
5. Decide the smallest action that solves the ticket, and confirm that the admin who will click holds the role named in that phase. If they hold Observer, the answer is an escalation to a Maintainer or Admin, not a workaround.

<details>
<summary>Fleet adapter: the read-only scale version (HUMAN-RUN; Aegis may run the same reads)</summary>

```bash
# HUMAN-RUN, read-only: the adapter is dry by default and prints the request; --execute sends the GET, never a write
node scripts/adapters/fleet-client.js me --execute   # the role of the adapter token itself, an API-only Observer is expected, it reads and never acts
node scripts/adapters/fleet-client.js host --identifier [SERIAL_NUMBER] --execute   # resolves the serial to [HOST_ID] with status, seen_time and the MDM fields
node scripts/adapters/fleet-client.js host --id [HOST_ID] --execute   # mdm.device_status, mdm.pending_action, mdm.enrollment_status, platform and OS version
node scripts/adapters/fleet-client.js host-mdm --id [HOST_ID] --execute   # MDM enrollment for macOS and Windows, empty when the host is not enrolled
node scripts/adapters/fleet-client.js host-activities --id [HOST_ID] --execute   # past activity on this host, including ran_script entries with their script_execution_id
node scripts/adapters/fleet-client.js script-result --execution-id [EXECUTION_ID] --execute   # exit_code, output and host_timeout of a script that already ran
node scripts/adapters/fleet-client.js commands --host-identifier [SERIAL_NUMBER] --command-status pending --execute   # MDM commands still waiting for this host
```
</details>

**Verification checkpoint**: [ ] `[HOST_ID]`, platform, OS version, MDM status, last seen and pending actions are in the ticket and saved to `tasks/checkpoints/` as the pre-state · [ ] the clicking admin's role is known.

## Phase B: Left somewhere, Lock (R2, reversible with Unlock)

**Purpose**: stop anyone using the host while it may still come back; nothing is deleted.

Before the gate: an iPhone or iPad can be locked only when it is supervised (company-owned), and the lock turns on Lost Mode. For a Windows laptop joined to Entra ID with automatic enrollment, Fleet's guide advises disabling the user in Entra ID first and locking second; that identity step is its own runbook.

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`), Fleet Premium.

<!-- SAFETY GATE [fleet-device-actions-lock-portal] -->
- **Target:** [HOST_ID]
- **Effect:** lock one host; a Mac then needs the six-digit PIN that Fleet shows at Unlock, a supervised iPhone or iPad enters Lost Mode, a Linux host reboots about 10 seconds after the lock
- **Scope:** one host (macOS, Windows, Linux, supervised iOS or iPadOS, Android); data is untouched; the command or lock script is queued until the host next checks in; an Android host shows Lock pending and then returns to normal with no Locked badge
- **Reversibility:** R2: Unlock (Phase C) reverses it, remotely on Windows, Linux, iPhone and iPad, and on a Mac only when someone types the PIN on the Mac; while still pending, a macOS lock, an iPhone or iPad Lost Mode command and a Windows or Linux lock script can be cancelled (Phase G), an Android lock cannot; a locked iPhone that is off or restarted cannot be unlocked remotely without USB network sharing
- **Required confirmation:** Type exactly `LOCK HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-lock-portal]:** Only after the Phase A pre-state is saved and the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Lock**.
2. If Fleet asks for confirmation, confirm.

**WAIT UNTIL** Fleet → Hosts → `[HOST_ID]` → Host details shows the Locked badge instead of Lock pending. An iPhone or iPad counts as locked only once Fleet has collected its location (Host details → Vitals → Show location).

**Read-back:** `node scripts/adapters/fleet-client.js verify-lock --id [HOST_ID] --execute` passes only when `mdm.device_status` is `locked` and nothing is pending. Host details → Activity → Past shows the lock request with the admin's name and the time.

**Verification checkpoint**: [ ] the badge reads Locked · [ ] `verify-lock` passed · [ ] the activity names the admin and the time.

## Phase C: Found again, Unlock (R1)

**Purpose**: give the device back. On a Mac the PIN is a secret: it travels by phone or in person, never in the ticket, chat or Slack.

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`), Fleet Premium.

<!-- SAFETY GATE [fleet-device-actions-unlock-portal] -->
- **Target:** [HOST_ID]
- **Effect:** unlock one host; on a Mac, Fleet shows the six-digit PIN that a person types on the Mac
- **Scope:** one host; Windows, Linux, iPhone and iPad unlock remotely at the next check-in; a Linux host reboots about 10 seconds after the unlock, and may run it and reboot again if it loses its connection
- **Reversibility:** R1: Lock again under the Phase B gate
- **Required confirmation:** Type exactly `UNLOCK HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-unlock-portal]:** Only after the person holding the device is confirmed and the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Unlock** (one section of Fleet's guide calls this page Host Overview, another Host details).
2. On a Mac: read the PIN Fleet shows to the person at the Mac; they type it on the lock screen.

**WAIT UNTIL** Host details no longer shows a lock badge (macOS has no Unlock pending badge). An Apple host unlocked within 1 minute of being locked keeps showing Locked until its next MDM check-in.

**Read-back:** `node scripts/adapters/fleet-client.js verify-unlock --id [HOST_ID] --execute` passes when `mdm.device_status` is `unlocked` and nothing is pending; on a Mac that happens only after the PIN is typed.

**Verification checkpoint**: [ ] `verify-unlock` passed · [ ] the PIN is nowhere in the ticket.

## Phase D: Stolen with sensitive data, Wipe (R3, after independent review)

**Purpose**: make the data unrecoverable. The record stays in Fleet.

Before the gate: the independent out-of-session review has the Phase A pre-state, and the ticket says whether anything else is queued, because a wipe silently cancels every upcoming activity on the host and records no cancellation for them.

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`), Fleet Premium (a company-owned Android wipe is also in Fleet Free).

<!-- SAFETY GATE [fleet-device-actions-wipe-portal] -->
- **Target:** [HOST_ID]
- **Effect:** wipe one host; every local file is erased, the host's other upcoming activities are cancelled with no record of each
- **Scope:** one host; the record stays in Fleet; a Mac runs Erase All Content and Settings; a Windows host gets the protected MDM wipe (doWipeProtected) by default, which can leave it unable to boot; a Linux host runs a best-effort wipe script that halts it, needs a physical OS reinstall, skips separately mounted partitions and network mounts and is not a secure erase
- **Reversibility:** R3: not reversible once the host runs it; cancellable while still pending only for a Mac, iPhone or iPad (EraseDevice) and for the Linux wipe script, never for Windows or Android; an Apple device that already fetched the command wipes even if the command is cancelled
- **Required confirmation:** Type exactly `WIPE HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-wipe-portal]:** Only after the independent review, the Phase A pre-state and the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Wipe** (Fleet's guide calls this page Host Overview).
2. If Fleet asks for confirmation, confirm. The unprotected Windows wipe (doWipe) is offered through the API only and is not part of this runbook.

**WAIT UNTIL** Host details shows Wiped instead of Wipe pending. Linux shows no badge: read the wipe script's result and the wiped_host activity instead (the guides do not say whether a Linux host ever reports `wiped`, so expect `verify-wipe` to stay unpassed there; that clause is unverified). If a Windows MDM wipe fails (an error in the command results), Fleet documents a fallback wipe script; running it is its own reviewed change under the Phase E gate.

**Read-back:** `node scripts/adapters/fleet-client.js verify-wipe --id [HOST_ID] --execute` passes on `wiping` or `wiped` with the EraseDevice or doWipe command acknowledged; for an Apple device, `node scripts/adapters/fleet-client.js commands --host-identifier [SERIAL_NUMBER] --request-type EraseDevice --execute` shows the command's status. Do not delete the host until it reads wiped: deleting removes Fleet's record of the commands it sent.

**Verification checkpoint**: [ ] the badge reads Wiped (or, on Linux, the wipe script result and activity are in the ticket) · [ ] `verify-wipe` passed · [ ] the record still exists.

## Phase E: Run a script (R1 to R3, set by what the script does)

**Purpose**: one fix on one host, proven by its exit code; a batch only after a one-host pilot.

1. Fleet → Controls → Scripts → find `[SCRIPT_NAME]` → read it line by line and set its R-class from what it does (a script that deletes data or changes a security setting is R3 and needs the independent review). A script that is not saved in Fleet yet is a separate change, outside this runbook.
2. Scripts run on macOS, Windows and Linux hosts with scripts enabled in fleetd; iPhones, iPads and Android hosts do not run them.

### E1: One host

**Role needed:** Technician, Maintainer or Admin (global, or on `[FLEET_NAME]`) for a saved script; Maintainer or Admin for an arbitrary script that is not saved, or a scheduled one.

<!-- SAFETY GATE [fleet-device-actions-run-script-portal] -->
- **Target:** [SCRIPT_NAME] on [HOST_ID]
- **Effect:** run one saved script on one host; what changes on the host is whatever the script does
- **Scope:** one macOS, Windows or Linux host; the script is queued as an upcoming activity and runs when the host next checks in; Fleet stops waiting after the 5-minute default timeout
- **Reversibility:** R1 to R3 by script content, set in step 1; while still in Upcoming it can be cancelled (Phase G); after it runs Fleet has no undo, only a compensating script that a human writes and runs under this gate
- **Required confirmation:** Type exactly `RUN SCRIPT [SCRIPT_NAME] ON HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-run-script-portal]:** Only after step 1, the review when the script is R3, and the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Run Script** → `[SCRIPT_NAME]` → Actions → **Run**.

**WAIT UNTIL** Host details → Activity moves the run from Upcoming to Past.

**Read-back:** `node scripts/adapters/fleet-client.js host-activities --id [HOST_ID] --execute` shows the ran_script entry whose `script_execution_id` is `[EXECUTION_ID]`; then `node scripts/adapters/fleet-client.js verify-script --execution-id [EXECUTION_ID] --execute` passes on exit code 0. An empty exit code means the host has not reported yet; `host_timeout` true means it ran past the timeout.

### E2: More than one host (R3)

Pilot first: E1 on one host must pass `verify-script`. Then write in the ticket the fleet, the script and the number of hosts you will tick. All hosts, or more than 10, is a mass operation: independent out-of-session review before the gate, whatever the urgency or who is asking.

**Role needed:** Technician, Maintainer or Admin on `[FLEET_NAME]` for a saved script (the role guide read gives no separate batch permission).

<!-- SAFETY GATE [fleet-device-actions-batch-script-portal] -->
- **Target:** [SCRIPT_NAME] on the hosts checked in [FLEET_NAME]
- **Effect:** run one saved script on every checked host in one fleet
- **Scope:** every host checked in the Hosts list of [FLEET_NAME]; the number Fleet shows as checked must equal the number written in the ticket, and any other number means stop; offline hosts run it when they next check in
- **Reversibility:** R3: Fleet has no undo on any host; hosts that have not run it yet can be cancelled only through Fleet's API batch cancel (the console path for a batch cancel is not in the guides read); a compensating script is its own gated batch
- **Required confirmation:** Type exactly `RUN SCRIPT [SCRIPT_NAME] ON CHECKED HOSTS IN FLEET [FLEET_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-batch-script-portal]:** Only after the pilot passed, the independent review, the host count in the ticket and the exact match:
1. Fleet → Hosts → select `[FLEET_NAME]` → check the hosts → **Run script** → choose `[SCRIPT_NAME]`.

**WAIT UNTIL** each checked host shows the run under Host details → Activity → Past; offline hosts stay in Upcoming until they check in.

**Read-back:** `node scripts/adapters/fleet-client.js activities --page 0 --per-page 50 --execute` lists the batch run (ran_script_batch) with the admin's name; then, for each checked host, `host-activities --id [HOST_ID]` and `verify-script --execution-id [EXECUTION_ID]`. Any host that fails stops the batch story: report which hosts passed and which did not.

**Verification checkpoint**: [ ] `verify-script` passed for the pilot and for every checked host, or the ticket lists the failures · [ ] the count matched the ticket.

## Phase F: Leaving the fleet, Turn off MDM then delete (R3 each)

**Purpose**: stop managing the device, then remove its record, in that order.

### F1: Turn off MDM

A Windows host has no Turn off MDM action, and a company-owned Android uses Wipe (Phase D) instead; see the planning note below.

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`).

<!-- SAFETY GATE [fleet-device-actions-mdm-off-portal] -->
- **Target:** [HOST_ID]
- **Effect:** turn off MDM for one host (the button is Unenroll on an iPhone, iPad or personally owned Android); MDM management and its profiles are taken off the device, on a personally owned Android the work profile is wiped
- **Scope:** one macOS, iOS, iPadOS or personally owned Android host; the record stays in Fleet; Fleet can no longer send it lock or wipe commands
- **Reversibility:** R3: undone only by enrolling the device in Fleet MDM again, which needs the end user or Apple Business; the per-OS re-enrollment steps were not in the guides read (unverified)
- **Required confirmation:** Type exactly `TURN OFF MDM AND UNENROLL HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-mdm-off-portal]:** Only after the independent review and the exact match:
1. On a Mac: Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Turn off MDM**.
2. On an iPhone, iPad or personally owned Android: Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Unenroll**.

**WAIT UNTIL** Host details no longer reads MDM On.

**Read-back:** `node scripts/adapters/fleet-client.js verify-mdm-off --id [HOST_ID] --execute` passes when the host's MDM read is empty and its enrollment no longer reads On; Host details → Activity → Past shows the unenrollment (mdm_unenrolled).

> **PREVIEW ONLY [fleet-device-actions-handover-preview]:** Planning only; nothing here authorizes an uninstall, a release or a deletion. A Windows host has no Turn off MDM action in Fleet: Fleet's guide says to uninstall fleetd instead, which is its own reviewed change (the uninstall steps were not in the guides read). A host enrolled through Apple Business must be released from Apple Business before its Fleet record is deleted, or it comes back as Pending; releasing is an asset-disposal decision outside this runbook. After an OS reinstall, the old record is deleted before the host re-enrolls, or Fleet does not escrow a new disk encryption key.

### F2: Delete the host record

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`).

<!-- SAFETY GATE [fleet-device-actions-delete-portal] -->
- **Target:** [HOST_ID] (serial [SERIAL_NUMBER])
- **Effect:** delete one host record from Fleet; its history and labels go with it
- **Scope:** one record; this does not unenroll the device: macOS, Windows and Linux hosts re-enroll while their agent and enroll secret are valid, iPhones and iPads at the next check-in, Android within about 24 hours, Apple Business hosts at once as Pending; deleting also removes Fleet's record of commands already sent
- **Reversibility:** R3: Fleet cannot restore a deleted record; the record comes back only if the agent or MDM re-enrolls the device, and then as a new record with a new host ID, while the old record's history and labels are lost for good
- **Required confirmation:** Type exactly `DELETE HOST [HOST_ID] SERIAL [SERIAL_NUMBER] FROM FLEET`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-delete-portal]:** Only when nothing is pending for the host (never while a wipe is pending), a wiped host already reads Wiped, the Phase A pre-state is saved to `tasks/checkpoints/`, the rollback path is written in the ticket before step 1 (the record comes back only if the agent or MDM re-enrolls the device, as a new record; its history and labels are lost), `[NOT_BEFORE]` is noted, and after the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Actions → **Delete**.
2. If Fleet asks for confirmation, confirm.

**Read-back:** `node scripts/adapters/fleet-client.js verify-deleted --identifier [SERIAL_NUMBER] --not-before [NOT_BEFORE] --execute` passes when a deleted_host activity for that serial exists after `[NOT_BEFORE]`; `host --identifier [SERIAL_NUMBER]` then answers not found, or a new host ID if the device re-enrolled.

**Verification checkpoint**: [ ] `verify-mdm-off` passed (F1) · [ ] `verify-deleted` passed (F2) · [ ] the Apple Business decision is in the ticket.

## Phase G: Cancel a pending action (the rollback window)

**Purpose**: stop a lock, wipe or script that is still queued. This window closes the moment the device fetches the command.

**Role needed:** Maintainer or Admin (global, or on `[FLEET_NAME]`); through the API, a global Admin, Maintainer or GitOps user (Observers and Technicians get 403).

<!-- SAFETY GATE [fleet-device-actions-cancel-portal] -->
- **Target:** [HOST_ID]
- **Effect:** stop one queued action on one host before the host fetches it
- **Scope:** one entry under Upcoming: a macOS lock, an iPhone or iPad Lost Mode command, a Windows or Linux lock script, a Mac, iPhone or iPad wipe, the Linux wipe script, or a queued script; an Android lock, a Windows wipe and an Android wipe cannot be cancelled
- **Reversibility:** R1: send the action again under its own gate; if an Apple device already fetched the command, the cancel is not honoured and the device still locks or wipes
- **Required confirmation:** Type exactly `STOP PENDING ACTION ON HOST [HOST_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [fleet-device-actions-cancel-portal]:** Only after the exact match:
1. Fleet → Hosts → `[HOST_ID]` → Host details → Activity → Upcoming → **Cancel** on the queued item.

**Read-back:** Upcoming no longer lists the item; `node scripts/adapters/fleet-client.js host-activities --id [HOST_ID] --execute` shows canceled_mdm_command or canceled_run_script; `node scripts/adapters/fleet-client.js host --id [HOST_ID] --execute` shows `mdm.pending_action` empty; `commands --host-identifier [SERIAL_NUMBER] --command-status pending` no longer lists the command.

<details>
<summary>fleetctl: the scale version for lock and one script (HUMAN-RUN; wipe, Turn off MDM and delete stay console-only here)</summary>

fleetctl must already be signed in (`fleetctl login` keeps the token in `~/.fleet/config`). Wipe, Turn off MDM and delete run only from the console gates above, after the review; their CLI and API forms are not given here.

```bash
# HUMAN-RUN: lock one host with fleetctl, the administrator runs this, Aegis never does
# SAFETY GATE [fleet-device-actions-lock-cli]
# Target: [SERIAL_NUMBER]
# Effect: lock one host through Fleet
# Scope: one host, data is untouched, the lock is queued until the host next checks in
# Reversibility: R2: reversible with Unlock, on a Mac only with the six-digit PIN that Fleet shows at Unlock
# Required confirmation: type exactly "LOCK HOST [SERIAL_NUMBER]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="LOCK HOST [SERIAL_NUMBER]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # queues the lock for this host
  fleetctl mdm lock --host [SERIAL_NUMBER]
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: passes only when the host reads locked with nothing pending
node scripts/adapters/fleet-client.js verify-lock --id [HOST_ID] --execute
```

```bash
# HUMAN-RUN: run one local script file on one host with fleetctl, the administrator runs this, Aegis never does
# SAFETY GATE [fleet-device-actions-run-script-cli]
# Target: [FILE_NAME] on [SERIAL_NUMBER]
# Effect: run one script file on one host
# Scope: one macOS, Windows or Linux host with scripts enabled in fleetd, queued until the host next checks in, Fleet stops waiting after the 5-minute default timeout
# Reversibility: R1 to R3 by what the script does, Fleet has no undo after it runs, only a compensating script under its own gate
# Required confirmation: type exactly "RUN SCRIPT [FILE_NAME] ON HOST [SERIAL_NUMBER]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="RUN SCRIPT [FILE_NAME] ON HOST [SERIAL_NUMBER]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # sends the script file to the host as a script run
  fleetctl run-script --script-path=[FILE_NAME] --host=[SERIAL_NUMBER]
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the ran_script entry on this host carries the execution id
node scripts/adapters/fleet-client.js host-activities --id [HOST_ID] --execute
# read-back: passes only when that execution reports exit code 0
node scripts/adapters/fleet-client.js verify-script --execution-id [EXECUTION_ID] --execute
```

**Role needed:** Maintainer or Admin for the fleetctl lock; Maintainer or Admin for `fleetctl run-script`, because a script sent from a local file is not a saved script and Fleet's role guide limits arbitrary scripts to those two roles.
</details>

## ⚠️ Risk warning

- **Lock comes back, Wipe does not.** Lock when the device may return; wipe only when the data must not survive, after the independent review. A Windows or Android wipe cannot be cancelled once sent, and an Apple device that already fetched the wipe ignores the cancel.
- **The Mac unlock PIN is a secret.** Read it to the person at the Mac; never paste it into the ticket, chat, Slack or a shell history.
- **Delete is not unenroll.** A deleted host with its agent or MDM still present comes back as a new record; deleting while a wipe is pending loses Fleet's record of the wipe.
- **A script has no undo.** Read every line before the gate; more than 10 hosts or all hosts is R3 with a pilot, a count in the ticket and an independent review, however urgent the request sounds.
- **Every action waits for a check-in.** A stolen device that never comes online never receives the lock or the wipe; disk encryption is what protects its data until then.
- **Turn off MDM ends remote control.** After it, Fleet can no longer lock or wipe the device; do it last, and only for a device that is leaving.

## ✅ Verification checklist

- [ ] Lock: Fleet → Hosts → `[HOST_ID]` → Host details shows the Locked badge; `verify-lock` passed; Activity shows the request with the admin and the time.
- [ ] Unlock: `verify-unlock` passed; the PIN appears nowhere in the ticket.
- [ ] Wipe: Host details shows Wiped (Linux: the wipe script result and activity are in the ticket); `verify-wipe` passed; the record still exists.
- [ ] Script: `verify-script` passed for `[EXECUTION_ID]` (and for every checked host in a batch, or the failures are listed).
- [ ] Turn off MDM: `verify-mdm-off` passed. Delete: `verify-deleted` passed for `[SERIAL_NUMBER]` after `[NOT_BEFORE]`.
- [ ] Cancel: Upcoming no longer lists the item and the cancellation activity names the admin.

## 📝 Linear-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed: only if every read-back passed] Host `[HOST_ID]` (`[SERIAL_NUMBER]`, `[DEVICE_NAME]`) in Fleet: [Lock / Unlock / Wipe / Run script `[SCRIPT_NAME]` / Turn off MDM / Delete host / Cancel pending action] sent [timestamp] by [ADMIN_NAME] ([Maintainer / Admin / Technician]), confirmed by the exact phrase[, after independent review]. Pre-state: [platform and OS version], [online / offline], last seen [date], MDM [On (automatic) / On (manual)], nothing pending. Read-back: `verify-[lock / unlock / wipe / script / mdm-off / deleted]` passed [timestamp]; Host details shows [Locked / Wiped / exit code 0 / record gone]. Time spent: [X] min.
>
> [Partial state] Host `[HOST_ID]`: [action] sent [timestamp], confirmed by the exact phrase. Verified: [what passed]. Pending: [badge still Lock pending / Wipe pending / exit code not reported], waiting for the host to check in. Next owner: [ADMIN_NAME], who re-runs `verify-[...]` at [time].

An administrator, not Aegis, posts this note as a comment on `[ISSUE_ID]` in Linear after preparing it with `node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]`, which prints the exact note and its SHA-256 digest (`[NOTE_SHA256]`) with no credentials and no network; `[NOT_BEFORE]` is the time just before the comment is posted.

```bash
# read-back: passes only when a comment created on [ISSUE_ID] after [NOT_BEFORE] carries exactly this note
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Jira path: the same note through `/jira-update`.

## Aha moment

Fleet's activity feed records the request, not the result: locked_host means someone asked. The device's own state (`mdm.device_status`, the command status, the script's exit code) is the only proof the thing happened.

## Career upgrade

Separating "who asked" (the audit trail) from "what the device did" (the read-back) is the same discipline as reading a deployment's rollout status instead of the deploy log, and it is what endpoint and security engineering interviews probe.

## Next action

Run Phase A on `[SERIAL_NUMBER]`, save the pre-state, and pick the smallest action that solves the ticket; if the clicking admin holds Observer, escalate to a Fleet Maintainer or Admin.

**Sources (checked 2026-10-27):** raw.githubusercontent.com/fleetdm/fleet/main/articles/lock-wipe-hosts.md (vendor repo, read in full: Lock, Unlock, Wipe and Cancel paths, badges, per-OS behavior, PIN, Linux reboot and wipe limits, cancel windows, Entra advice) · raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md (vendor repo, the source of fleetdm.com/docs/rest-api/rest-api: `mdm.device_status`, `mdm.pending_action`, script results, MDM commands, activities, doWipeProtected and doWipe, delete semantics) · raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md (vendor repo: Observer, Observer+, Technician, Maintainer, Admin, GitOps permissions) · raw.githubusercontent.com/fleetdm/fleet/main/articles/scripts.md (vendor repo: Run Script paths, batch run, results) · raw.githubusercontent.com/fleetdm/fleet/main/articles/enroll-hosts.md (vendor repo: Turn off MDM, Unenroll, Delete host and which hosts come back) · raw.githubusercontent.com/fleetdm/fleet/main/docs/Contributing/reference/audit-logs.md (vendor repo: activity types) · raw.githubusercontent.com/fleetdm/fleet/main/articles/fleetctl.md (vendor repo: fleetctl login and its config file) · raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md (vendor repo: release 4.93.2, teams renamed fleets in 4.82.0). fleetdm.com could not be opened from this session (proxy 403), so every source was read as the vendor's own docs source in the fleetdm/fleet repository (main branch), which can be newer than release 4.93.2; no search excerpt was used.
