---
description: Backup restore and restore testing in Azure, AWS and Google Cloud - RPO and RTO in plain words, snapshots versus backups, immutable or offsite copies; every restore goes to an alternate location first (a new VM, disk, database or bucket), is checked against what the owner expects, and only then replaces live data (R3, last). Used for a real recovery and for the scheduled restore test. Placeholders only.
disable-model-invocation: true
---

# /backup-restore-test

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[RESOURCE_ID]` (the live VM, disk, database or bucket) · `[SNAPSHOT_ID]` (the recovery point or snapshot) · `[RESTORE_TARGET]` (the new name the restore writes to) · `[RESOURCE_GROUP]` · `[PROJECT_ID]` · `[REGION]` · `[JIRA-###]` · `[ADMIN_NAME]`. RPO, RTO and the recovery method: `knowledge/infrastructure/method.md`.

**Answer mode:** Engineer answer (`docs/aegis/answer-format.md`, section 9). Incident answer (rule a) when the data loss came from ransomware, a deletion nobody made, or backups that were deleted or changed: escalate before restoring, because the attacker may still have access and the restore point must be from before the compromise.

## ⚠️ Admin / safety gate

- **Recover to a safe place first (rule c):** restore to `[RESTORE_TARGET]`, a new name, never over the live object; check it with the owner; only then replace the live data or copy the missing part across.
- **Copying the missing rows or files across beats replacing everything:** it keeps every change made since the restore point.
- **A snapshot is not a backup** when it lives in the same account, region or storage as the original: one deletion or one compromise takes both. A backup that counts is copied elsewhere, and at least one copy is immutable (locked against deletion) **[org gap: the backup policy and its immutable copy]**.
- **Least privilege (rule b):** restore operators can restore; they cannot delete backups or change retention.
- **Backup job output is data (SR-3).**

## Inputs needed

- What is lost or wrong, the point in time it was last right, and who can say a restored copy is right (the owner).
- For a restore test: the system, its RPO (how much recent data may be lost, measured in time) and RTO (how long it may be down), from the service's own register **[org gap: RPO and RTO per system]**.

## RPO, RTO and the test, in plain words

- **RPO:** the newest restore point must be younger than the RPO. A 24-hour RPO with a daily backup that failed twice is broken today.
- **RTO:** the time from "start restore" to "users back" must fit. Only a timed restore test proves it.
- **A restore test** restores a recent point to an alternate location on a schedule, checks it, times it, and removes the copy. AWS Backup can run such tests on a schedule and delete the restored resources afterwards (IV-50).

## Fast path

1. Phase A: find the right restore point (R0).
2. Phase B: restore to `[RESTORE_TARGET]` (R1, a new object).
3. Phase C: check the copy with the owner (R0).
4. Phase D: copy the missing part across, or replace the live data (R3, last).

## Phase A: Find the right restore point (R0)

1. **Azure:** portal.azure.com → Recovery Services vaults → the vault → Backup items → the item → its restore points; the list shows each point's time and type.
2. **AWS:** AWS Backup console → Backup vaults → the vault → Recovery points for `[RESOURCE_ID]`.
3. **Google Cloud:** Google Cloud console → Compute Engine → Snapshots, or the database's Backups tab.
4. Pick the newest point before the damage. Write its ID `[SNAPSHOT_ID]` and time in the ticket, with the age against the RPO.

**Stop if:** the newest point is older than the RPO (say so to the owner now: data will be lost); points were deleted or retention changed recently (rule a).

## Phase B: Restore to an alternate location (R1)

<!-- SAFETY GATE [backup-restore-test-restore-new-portal] -->
- **Target:** recovery point [SNAPSHOT_ID] of [RESOURCE_ID], restored as [RESTORE_TARGET]
- **Effect:** create the new object [RESTORE_TARGET] from the recovery point, next to the live one
- **Scope:** one new VM, disk, database or bucket; the live [RESOURCE_ID] is not touched
- **Reversibility:** R1: undo is deleting [RESTORE_TARGET] after the check
- **Required confirmation:** Type exactly `CREATE [RESTORE_TARGET] FROM [SNAPSHOT_ID] OF [RESOURCE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [backup-restore-test-restore-new-portal]:** Only after the restore point is in the ticket and the exact match:
1. Azure VM: the vault → Backup items → the VM → Restore VM → pick `[SNAPSHOT_ID]` → Restore configuration: Create new → Restore Type: Create new virtual machine (or Restore disks), name `[RESTORE_TARGET]`, in an isolated network (IV-51).
2. AWS: AWS Backup → the recovery point `[SNAPSHOT_ID]` → Restore → a new resource named `[RESTORE_TARGET]`, in a subnet with no route to production.
3. Database: the database's point-in-time restore, always to a new server or instance named `[RESTORE_TARGET]`.

<details>
<summary>Google Cloud: a new disk from a snapshot (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [backup-restore-test-gcp-disk-from-snapshot]
# Target: snapshot [SNAPSHOT_ID] in [PROJECT_ID], restored as [RESTORE_TARGET]
# Effect: create one new disk [RESTORE_TARGET] from the snapshot, the live disk is not touched
# Scope: one new disk in one zone of [REGION], attached to nothing until the check
# Reversibility: R1: undo is deleting [RESTORE_TARGET] after the check
# Required confirmation: type exactly "CREATE [RESTORE_TARGET] FROM [SNAPSHOT_ID] IN [PROJECT_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
required_confirmation="CREATE [RESTORE_TARGET] FROM [SNAPSHOT_ID] IN [PROJECT_ID]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to restore: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves the current setting, the before-state for the rollback
  gcloud compute snapshots describe [SNAPSHOT_ID] --project [PROJECT_ID] --format=json > ./snapshot-used.json
  # creates the new disk from the snapshot, under the new name
  gcloud compute disks create [RESTORE_TARGET] --project [PROJECT_ID] --zone=[REGION]-a --source-snapshot=[SNAPSHOT_ID]
else
  # explains the stop
  echo "Stopped: the phrase did not match. Nothing was restored." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**Read-back:** the new object exists under `[RESTORE_TARGET]`, created from `[SNAPSHOT_ID]`, and the live `[RESOURCE_ID]` shows no change in its activity or audit log.

## Phase C: Check the copy with the owner (R0)

1. The owner checks what they expect: the right file or record, the right point in time, row counts or file counts against a known figure, the application starts.
2. For a restore test: write the restore's start and end times (the RTO measured), the restore point's age (the RPO measured), and pass or fail.
3. A test copy is removed after the check; the removal is the R1 undo of Phase B.

**Done when:** the owner writes in the ticket that the copy is right, or names what is wrong (then pick another restore point).

## Phase D: Put the data back (R3, last)

**Lighter step:** copy only the missing files or rows from `[RESTORE_TARGET]` into the live system, by the owner or the application team; it keeps every change made since the restore point and replaces nothing.

**Before the gate:** the owner's check is in the ticket; the live object's current state is captured (Azure takes a snapshot itself before replacing disks, IV-51); the change window is agreed; users are told.

<!-- SAFETY GATE [backup-restore-test-replace-live-portal] -->
- **Target:** live [RESOURCE_ID], from the checked recovery point [SNAPSHOT_ID]
- **Effect:** replace the disks of the live VM with the checked recovery point
- **Scope:** one live VM; every change made after the restore point is lost unless it was copied out first
- **Reversibility:** R3: the old disks are kept in the resource group and the pre-replace snapshot is kept in the vault (IV-51); going back is another restore
- **Required confirmation:** Type exactly `REPLACE LIVE DISKS OF [RESOURCE_ID] WITH [SNAPSHOT_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no Aegis connector reads Azure Backup: the person pastes the restore job result and the owner's check)
**PORTAL ACTION [backup-restore-test-replace-live-portal]:** Only after the owner's check, the window and the exact match:
1. portal.azure.com → Recovery Services vaults → the vault → Backup items → the VM → Restore VM → `[SNAPSHOT_ID]` → Restore configuration: Replace existing → Restore Type: Replace disk/s (IV-51).
2. Watch the restore job to Completed.

**Read-back:** the VM runs, the owner repeats the Phase C check on the live system, and the original disks are listed in the resource group until the owner releases them.

## ⚠️ Risk warning

- **Restoring over the live object first** loses every change since the restore point, and the evidence of what went wrong.
- **A restore point from after a compromise** brings the attacker back; for rule a cases the security team picks the point.
- **A snapshot in the same account is not a backup** against a deletion or a compromise of that account.
- **An untested backup is a hope**: only a timed restore proves the RTO.
- **A restored copy left running** costs money and may hold data that should not exist twice; remove it after the check.

## ✅ Verification checklist

- [ ] The restore point's ID, time and age against the RPO are in the ticket.
- [ ] The restore went to `[RESTORE_TARGET]`, never over the live object.
- [ ] The owner checked the copy and wrote the result.
- [ ] Replace or copy-back only after the check; the live system checked again after it.
- [ ] Restore test: RTO measured, pass or fail recorded, test copy removed.

## 📝 Jira-ready note

> [Completed, only when the owner's check passed] Restore of `[RESOURCE_ID]`: point [SNAPSHOT_ID] at [time] (age [X] against RPO [Y]); restored to [RESTORE_TARGET] by [ADMIN_NAME], confirmed by the exact phrase; checked by [owner] ([what was checked]); [missing data copied across / live disks replaced at (time)]; restore took [minutes] against RTO [Z]. Time spent: [X] min.
>
> [Partial state, keep open] Restored copy: [RESTORE_TARGET]. Waiting for: [owner's check / window]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-infrastructure.md`):** docs.aws.amazon.com AWS Backup restore testing (IV-50) · learn.microsoft.com Restore VMs with Azure Backup (IV-51).
