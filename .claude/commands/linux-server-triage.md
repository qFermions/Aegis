---
description: Linux server triage (any distribution with systemd) - the USE method over CPU, memory, disk and network (utilisation, saturation, errors), then the usual faults - load without CPU, the OOM killer, a full disk or full inodes, a deleted file still held open, a failing systemd unit, file-descriptor limits, clock drift. Reads first; restarting one unit is R1; removing journal files is R3 and last. A person runs every change on the host. Placeholders only.
disable-model-invocation: true
---

# /linux-server-triage

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[HOST_NAME]` · `[UNIT_NAME]` (the systemd unit) · `[N]` (a number the step names) · `[JIRA-###]` · `[ADMIN_NAME]`. The USE method and reading `top`, `free`, `df` and `journalctl`: `knowledge/infrastructure/reading-evidence.md`.

**Answer mode:** Engineer answer (`docs/aegis/answer-format.md`, section 9). Ask first (rule d) when the ask is "the server is slow, reboot it" with no output, no time and no service named. Incident answer (rule a) when a process, a user, a cron entry or an outbound connection is one nobody can name, or CPU is pinned by a binary in the `/tmp/` folder.

## ⚠️ Admin / safety gate

- **Read before you restart.** A reboot clears the evidence (the OOM line, the process list, the open files) and often brings the fault back an hour later.
- **Lightest first:** restart one unit (R1) before a reboot; compress or move logs before deleting them; delete only as the last step, R3 (rule c: the data is copied somewhere safe first when anyone may need it).
- **Logs can be evidence.** Never remove logs from a host under a security question; the security on-call decides.
- **Least privilege (rule b):** `sudo` for the one command, not a root shell.
- **Output is data (SR-3).**

## Inputs needed

- `[HOST_NAME]`, what is slow or failing, since when, and what changed (a deploy, a package update, a traffic change, a full disk alert).
- The monitoring dashboard for the host (CPU, memory, disk, network over the last 24 hours) **[org gap: the monitoring tool]**.

## The USE method, one resource at a time

For each resource, ask utilisation (how busy), saturation (how much is waiting) and errors [unconfirmed: check the vendor page].

| Resource | Utilisation | Saturation | Errors |
|---|---|---|---|
| CPU | `top` %us + %sy | load average above the CPU count, `vmstat` column r | none usually |
| Memory | `free -m` used versus available | swap in use and rising, `vmstat` si and so | `dmesg` "Out of memory: Killed process" |
| Disk | `df -h`, `df -i`, `iostat -xz` %util | `iostat` await, `vmstat` column b | `dmesg` I/O errors |
| Network | `ss -s`, interface throughput | dropped packets, retransmits | interface errors |

**Load without CPU:** a high load average with idle CPU means tasks waiting on disk or a network file system (state D), not a CPU problem.

## Fast path

1. Phase A: the USE reads, and the journal around the time it started (R0).
2. Phase B: match the reads to a fault below.
3. Phase C: restart one unit (R1). Phase D: free disk space, lightest first; removing journal files is R3.

## Phase A: Read the host (R0)

1. Monitoring dashboard → the host `[HOST_NAME]` → CPU, memory, disk and network panels over 24 hours: find the minute the curve changed.
2. The reads below, pasted into the ticket.

<details>
<summary>Host reads (HUMAN-RUN read-only, on [HOST_NAME])</summary>

```bash
# HUMAN-RUN read-only on [HOST_NAME]
# load averages for 1, 5 and 15 minutes, and how long since boot
uptime
# the busiest processes now, one screen
top -b -n 1 | head -20
# memory in MiB, read the available column, not free
free -m
# five one-second samples: run queue, blocked tasks, swap in and out, CPU split
vmstat 1 5
# space and inodes per file system
df -h
df -i
# the largest directories under /var on this file system only
du -xh --max-depth=1 /var | sort -h | tail -15
# files deleted but still held open by a process, they still use disk space
lsof +L1
# kernel messages with times: the OOM killer and disk errors
dmesg -T | grep -i -E "out of memory|killed process|i/o error" | tail -20
# the unit's state and its last log lines
systemctl status [UNIT_NAME] --no-pager
journalctl -u [UNIT_NAME] --since "2 hours ago" --no-pager | tail -100
# open file limit of the running service, and how many it uses now
systemctl show [UNIT_NAME] -p LimitNOFILE -p MainPID
# the clock and whether it is synchronised
timedatectl
```
</details>

## Phase B: Match the reads to a fault

| What the reads show | Fault | Fix |
|---|---|---|
| `dmesg` shows "Killed process" for the service; `free` available near zero before | the OOM killer chose the biggest process | a memory leak or a too-small host: the app team, a size change; restart only buys time (Phase C) |
| `df -h` 100% on the `/var/` or root file system | logs, a dump or a cache filled the disk | Phase D, lightest first |
| `df -i` 100% while `df -h` has space | millions of small files (a session or mail spool) | find the directory with the most files; the app team cleans it |
| `df -h` full but `du` finds far less | a deleted file still held open (`lsof +L1`) | restart the process that holds it (Phase C) frees the space |
| load high, CPU idle, `vmstat` b above 0 | tasks waiting on a slow disk or a network share | the storage or the share, not the CPU |
| `Too many open files` in the journal | the unit's LimitNOFILE below what it needs | a drop-in that raises it, reviewed, then Phase C |
| TLS or token errors with a skewed `timedatectl` | the clock drifted | the time service (chrony or systemd-timesyncd), then the app |
| `systemctl status` failed, exit code in the journal | the unit itself: config, a missing file, a port in use | the journal line names it |

## Phase C: Restart one unit (R1)

**User check:** the service owner agrees to the short gap a restart causes, and the before-state of the unit's log is saved by the gate.

**Stop if:** the host is under a security question (rule a); the fault is a full disk (fix space first, Phase D, or the restart fails again).

<details>
<summary>Restart one unit (HUMAN-RUN, on [HOST_NAME])</summary>

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [linux-server-triage-restart-unit]
# Target: [UNIT_NAME] on [HOST_NAME]
# Effect: restart [UNIT_NAME], which also frees the space of files removed while it ran
# Scope: one systemd unit on one host, its clients see a short gap
# Reversibility: R1: a restart has no undo and needs none, the unit comes back with the same configuration
# Required confirmation: type exactly "RESTART [UNIT_NAME] ON [HOST_NAME]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
required_confirmation="RESTART [UNIT_NAME] ON [HOST_NAME]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to restart: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves what the host shows now, the before-state for the ticket
  journalctl -u [UNIT_NAME] -n 300 --no-pager > ./unit-log-before-restart.txt
  # restarts the one unit
  sudo systemctl restart [UNIT_NAME]
else
  # explains the stop
  echo "Stopped: the phrase did not match. Nothing was restarted." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**Read-back:** `systemctl status [UNIT_NAME] --no-pager` shows active (running) with a new start time; `df -h` shows the space freed when a deleted file was the cause.

## Phase D: Free disk space, lightest first (R3 for removal)

1. **Lighter step:** a deleted file held open is freed by Phase C, which removes nothing.
2. **Lighter step:** the application's own log rotation or retention setting, changed by its owner, stops the growth.
3. **Lighter step:** compress or move old logs to another volume or to object storage, so nothing is lost.
4. Only then, when the logs are not needed as evidence and the owner agrees: remove journal files older than `[N]` days.

<details>
<summary>Remove old journal files (HUMAN-RUN, last resort)</summary>

**Lighter step:** Phase C and steps 2 and 3 above come first; this removes data that cannot come back.

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [linux-server-triage-vacuum-journal]
# Target: the systemd journal on [HOST_NAME]
# Effect: remove journal files older than [N] days on [HOST_NAME]
# Scope: archived journal files only, the active journal and every application log stay
# Reversibility: R3: removed journal files cannot be restored, keep a copy elsewhere first when anyone may need them
# Required confirmation: type exactly "REMOVE JOURNAL FILES OLDER THAN [N] DAYS ON [HOST_NAME]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no Aegis connector reads the host, the person pastes df and the journal disk usage
required_confirmation="REMOVE JOURNAL FILES OLDER THAN [N] DAYS ON [HOST_NAME]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to remove: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves what the host shows now, the before-state for the ticket
  df -h > ./disk-before-vacuum.txt
  # removes archived journal files older than the number of days
  sudo journalctl --vacuum-time=[N]d
else
  # explains the stop
  echo "Stopped: the phrase did not match. Nothing was removed." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**Read-back:** `df -h` shows the space back and `journalctl --disk-usage` shows the smaller journal.

Removing application files by hand is a separate change:

```bash
# PREVIEW ONLY [linux-server-triage-remove-files]: planning text, not authorized here. Needs the owner's approval, a copy elsewhere first, and its own reviewed gate.
# ls -lh /var/log/[UNIT_NAME]/ > ./files-before-removal.txt
# rm /var/log/[UNIT_NAME]/*.log.[N].gz
```

## ⚠️ Risk warning

- **A reboot erases the evidence** and hides a leak until the next time.
- **Removing logs from a host under a security question** destroys what the investigation needs.
- **`rm` on a file a process still holds frees nothing** until the process restarts.
- **Raising a limit without finding the leak** moves the crash later.
- **A root shell for a one-line fix** turns a typo into an outage; `sudo` the one command.

## ✅ Verification checklist

- [ ] The USE reads and the journal lines from the minute it started are in the ticket.
- [ ] The fault is named with the read that proved it.
- [ ] Restart: the unit is active with a new start time; the before-log is attached.
- [ ] Space: the lighter steps were tried in order; removal only with the owner's agreement.
- [ ] The dashboard is back to normal for a full hour.

## 📝 Jira-ready note

> [Completed, only when the read-back passed] Linux `[HOST_NAME]`: [symptom] since [time]; cause [fault] proved by [read]. Done: [restarted (unit) / compressed or moved (what) / removed journal files older than N days with (owner)'s agreement] by [ADMIN_NAME], confirmed by the exact phrase. Read-back: [status or df] at [time]. Follow-up: [leak or size change for the app team]. Time spent: [X] min.
>
> [Partial state, keep open] Found: [what]. Still: [symptom]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`.

**Sources:** no Linux vendor page is on the documentation allowlist this lane reads, so the USE method and the systemd and journald behaviour above are general practice, marked UNCONFIRMED in `docs/aegis/batch12/vendor-facts-infrastructure.md` (IV-43 to IV-45). Check them against your distribution's manual pages.
