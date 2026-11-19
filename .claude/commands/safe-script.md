---
description: Write an automation script a person will run against a real system (Python, Bash or PowerShell) - idempotent, dry run by default, logging, error handling and exit codes, input validation, no secrets in code, a count-bound confirmation before the change, and tests that fail on a wrong implementation; the one apply run sits behind an exact-phrase gate whose class follows what the script changes. Engineer answer (a build request: Options). Placeholders only.
disable-model-invocation: true
---

# /safe-script

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human runs every step (HUMAN-RUN): Aegis writes the script and its tests, and never runs or schedules it.

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[FILE_NAME]` (the script file, such as `archive_old_files.py`) · `[N]` (the count the dry run printed) · `[REPO_NAME]` (where the script and its tests are kept) · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Answer mode:** Engineer answer for a build request: **Options** (two or three designs, ranked, each with the trade-off that decides it, such as a vendor tool that already does it, a script, or a scheduled job owned by the platform team), then the Recommendation with the script and its tests in fenced blocks. Ask first when the target system or the change is not named ("write me a cleanup script") and a wrong guess would delete or change the wrong thing.

**Knowledge:** `knowledge/software-engineering/script-patterns.md` (the tested Python template and the Bash and PowerShell skeletons), `decision-trees.md` (tree 5), `modules/automation/powershell/safety_patterns.md` (PowerShell safety patterns already in the repository).

## ⚠️ Admin / safety gate

- **Dry run is the default.** The script changes nothing without `--apply`, and refuses `--apply` unless `--expect-count` equals what the dry run found.
- **More than ten objects is a mass operation** (SR-2, R3): the dry run's count goes in the ticket, the pre-state is saved, the rollback path is written, and the review CLAUDE.md asks for happens before the gate.
- **No secret in the script, its arguments, its log or the ticket.** It reads a credential from the environment or a secret store at run time.
- **Aegis never schedules a script.** A schedule is a separate change the system owner makes through their own process.

## Phase A: Pin down the job (R0)

**Purpose:** a script that does one named thing to one named target.

1. The ticket or change record names the target system, the objects, the change and the owner who approves it: Jira → `[JIRA-###]` → the description and its approval. Missing any of them: ask (Ask first).
2. Look for a tool that already does it: a vendor feature, an existing runbook (`.claude/commands/`), a script in `[REPO_NAME]`. Using one is Option 1.
3. Write the classes: what the change is (R1 one reversible object, R2 a few or hard to reverse, R3 destructive, mass, or a security control), and what the rollback is.

**Verification checkpoint:** [ ] target, objects, change, owner and class are in the ticket.

## Phase B: Write the script and its tests (R0)

**Purpose:** the eight properties of `script-patterns.md`, in the language the target needs.

1. Start from the template in `knowledge/software-engineering/script-patterns.md`: Python complete, Bash and PowerShell skeletons whose changing line is left for review.
2. Keep the eight properties: idempotent; dry run by default; the count binding; timestamped logging to stderr; stop on the first failure and say what changed and what did not; exit codes (0 done, 1 stopped part way, 2 bad arguments, 3 refused); input validation with a refusal for folders, accounts or scopes it must never touch; no secrets in code.
3. Write one test per rule, each naming the wrong implementation it catches (the template's five tests do this, and each was proven to fail on its named break).
4. Put the script and its tests in `[REPO_NAME]` through a pull request (`/code-review-checklist`), so a second person reads every line before it runs.

**Verification checkpoint:** [ ] the tests pass, and each names the wrong implementation it catches · [ ] the pull request is reviewed and merged.

## Phase C: Dry run, then apply once (R1 to R3, by what the script changes)

**Purpose:** change exactly what the dry run listed, once, with a log.

**Try first:** run the script without `--apply` on the real target. It changes nothing. Read every line it lists, paste the count `[N]` and the list (or its first lines and a total) into the ticket, and have the owner confirm the list.

<details>
<summary>The dry run (HUMAN-RUN; read-only by the script's own default)</summary>

```bash
# HUMAN-RUN read-only. Without --apply the script lists what it would change and changes nothing.
# runs the tests first, from the folder that holds the script and its tests
python3 -m unittest -v
# the dry run with the real arguments, which the ticket records, printing the count to paste into the ticket
python3 [FILE_NAME] --source /srv/app/logs --archive /srv/app/archive --days 30
```
</details>

**Stop if:** the count is larger than the owner agreed; the list holds anything the owner did not expect; for R2 or R3, the pre-state is not saved under `tasks/checkpoints/` or the rollback path is not written; for R3, the review has not approved it.

**Role needed:** the owner of the target system, or the person they name in the ticket.

<details>
<summary>The apply run (HUMAN-RUN)</summary>

**Try first:** the dry run above (Phase C), with its list and count confirmed by the owner in the ticket.

```bash
# HUMAN-RUN: run the reviewed script for real once, the owner of the target system runs this, Aegis never does
# SAFETY GATE [safe-script-apply]
# Target: [FILE_NAME], applied to what its dry run listed
# Effect: change what the dry run of [FILE_NAME] listed, nothing else, with the run log kept
# Scope: exactly the objects the dry run counted, the script itself refuses a different count
# Reversibility: R1 to R3 by what the script changes, the class written in the ticket decides the ceremony before this gate
# Required confirmation: type exactly "CHANGE WHAT [FILE_NAME] LISTED IN ITS DRY RUN"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, the proof is the dry run run again finding nothing left to change, and no connector reads it
# the exact phrase to type
required_confirmation="CHANGE WHAT [FILE_NAME] LISTED IN ITS DRY RUN"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# precondition, checked before you type the phrase: the tests pass, the dry run list and its count are in the ticket and the owner confirmed them, and for R2 or R3 the pre-state is saved and the rollback path is written
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # runs the script for real with the same arguments as the dry run and its count, and appends everything it prints to the run log
  python3 [FILE_NAME] --source /srv/app/logs --archive /srv/app/archive --days 30 --apply --expect-count [N] 2>&1 | tee -a [FILE_NAME].log
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the dry run again, it must find 0 files left to move
python3 [FILE_NAME] --source /srv/app/logs --archive /srv/app/archive --days 30
```
</details>

The arguments above are the worked example's; for another script, Aegis writes this gate with that script's own arguments, the same in the dry run, the apply run and the read-back.

**Read-back:** the second dry run finds nothing left to change, and the run log ends with `done`. A run that stopped part way exits 1 and its log names what moved and what did not: write both in the ticket and use the partial-state note; never run it again without reading why it stopped (CLAUDE.md, contract rule 5).

**Verification checkpoint:** [ ] the apply run exited 0 and its count equals the dry run's · [ ] the read-back dry run finds nothing left · [ ] the run log is attached to the ticket.

## ⚠️ Risk warning

- **A script with no dry run is a change you cannot preview.** Do not run it on a real target.
- **A count you did not predict means stop** (CLAUDE.md, contract rule 3).
- **Deleting where you could move removes the safe place.** Archive first; purge later, as its own reviewed change (judgment rule c).
- **A secret in an argument ends up in shell history and process lists.** Read it from the environment or a secret store.
- **Scheduling turns one reviewed run into many unreviewed ones.** It is the system owner's own change.

## ✅ Verification checklist

- [ ] Target, objects, change, owner and class are in the ticket.
- [ ] The script and its tests were reviewed and merged; each test names the wrong implementation it catches.
- [ ] The dry run's list and count are in the ticket and the owner confirmed them.
- [ ] One apply run, behind the gate, with the dry run's count; its log is attached.
- [ ] The read-back dry run finds nothing left to change.

## 📝 Jira-ready note

> [Completed, only when the read-back dry run found nothing left] Script [FILE_NAME] (pull request link, reviewed by (role)) run by [ADMIN_NAME] at (time) against (target): dry run listed [N], apply changed [N], exit 0; read-back dry run found 0 left. Class: (R1 / R2 / R3); pre-state: (path or none needed); rollback: (how). Log attached. Not checked: (what). Time spent: [X] min.
>
> [Partial state, keep open] Apply stopped at (object) with exit 1: changed (count), not changed (count, listed in the log). Next owner: [ADMIN_NAME]; next step: (one line).

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-software-engineering.md`):** docs.python.org argparse and logging (EV-46, EV-47) · learn.microsoft.com about_Error_Handling and about_Functions_CmdletBindingAttribute (EV-55, EV-56, EV-59).
