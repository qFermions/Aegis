---
description: Surface the latest Aegis D Hermes "War Room Morning Brief — Core Holds" read-only — last-run status, the morning dashboard artifact, and where the full brief was delivered.
disable-model-invocation: true
---

# /morning-brief

## Risk metadata

- **Risk level:** R0 for remote reads; R1 for the local audit-log append.
- **Access:** credential-sensitive remote read and local write.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** Surfaces the most recent morning brief Hermes generates — the "War Room Morning Brief — Core Holds" job (alpha-signal + daily-briefing across the holdings book). The full narrative brief is delivered to Telegram; this command confirms it ran, shows the morning dashboard artifact, and surfaces the brief text when it's readable on the box. Remote reads are read-only; the audit-log append is an R1 local write.

**Operator types:**
```
/morning-brief
```

**Expected output (real shape):**
```
🌅 Morning Brief — War Room Morning Brief — Core Holds
Last run: 2026-05-21 08:33 PT ✅ ok  (schedule 33 8 * * *)
Morning artifact: war_room_20260521.html  → open with /war-room
Full brief was delivered to Telegram (origin). Core read: HIGH [TICKER_1]/[TICKER_2]/[TICKER_3] · MEDIUM [TICKER_4]/[TICKER_5]/[TICKER_6].
```

## How Aegis executes

1. SSH to Hermes (Windows OpenSSH), read-only.
2. `hermes cron list` → find the "War Room Morning Brief — Core Holds" job; report its schedule + last-run status/time.
3. Report the latest `war_room_*.html` in `[HERMES_DELIVERY_DIR]` as the morning artifact (open with `/war-room`).
4. If a readable brief text artifact exists on the box, `cat` the latest and render it; otherwise note the full brief is in Telegram (the job delivers to `origin`).
5. Lead with the job status + a one-line core read, then any available brief text.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"

# 1) brief job status + last run (Hermes scheduler)
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] "hermes cron list" |
  Select-String -Pattern 'Morning Brief' -Context 0,6   # the War Room Morning Brief block + last run

# 2) the morning dashboard artifact (read-only)
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -t '[HERMES_DELIVERY_DIR]'/war_room_*.html | head -1"

# 3) optional: if the job writes a flat brief file, cat the latest (pure read). Briefs primarily go to Telegram.
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "f=`$(ls -t '[HERMES_BRIEF_DIR]'/*brief*.md 2>/dev/null | head -1); [ -n `"`$f`" ] && cat `"`$f`" || echo 'brief delivered to Telegram (no flat file)'"
```
</details>

## Remote-read / local-write safety
- Remote read-only: `hermes cron list`, `ls`, `cat` of existing files. **No skill re-run, no writes to Hermes, and no service restart.** Authentication uses the loaded SSH agent; no key material is read or printed.
- The brief covers [ADMIN_NAME]'s positions — his own data, shown to him. Never forward it anywhere or to any external surface.
- Hermes host/paths stay as `[HERMES_*]` placeholders. To regenerate a fresh brief (a write), that's a deliberate Hermes-side action, not this command.

## Failure modes (handle gracefully, never block)
- **SSH unreachable:** "Hermes is offline — can't pull this morning's brief. Check `/hermes-status`." Stop.
- **Brief job `Last run` not ok / missing:** flag it — the brief didn't generate; check `/hermes-status` and the job in `hermes cron list`.
- **No dashboard + no brief file:** report the job status only and point to Telegram.
- **SSH auth error:** key must be in the Windows ssh-agent (see `/hermes-status`).

## Logging
Append to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /morning-brief → <SHOWN date|JOB-FAILED|UNREACHABLE>`
