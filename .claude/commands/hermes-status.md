---
description: Health check on Aegis D Hermes — SSH reachability, agent status, war-room cron jobs registered/last-run, and the last dashboard render timestamp.
disable-model-invocation: true
---

# /hermes-status

## Risk metadata

- **Risk level:** R0 for remote reads; R1 for the local audit-log append.
- **Access:** credential-sensitive remote read and local write.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** A quick health check on Hermes before you rely on it. Confirms the box is reachable, the Hermes agent is up, the scheduled war-room jobs are registered and last ran OK, and when the dashboard last rendered. Run this first when `/morning-brief` or `/war-room` comes back empty. Remote checks are read-only; the audit-log append is an R1 local write.

**Operator types:**
```
/hermes-status
```

**Expected output (real shape, 2026-05-22):**
```
🩺 Hermes status — 2026-05-22 14:10
SSH:            ✅ reachable ([HERMES_SSH_USER]@[HERMES_HOST], up 19 days)
Agent:          ✅ hermes up — model gpt-5.5 / OpenAI Codex
Cron jobs:      ✅ host-monitor (*/5) last ok · ✅ "War Room Morning Brief — Core Holds" (33 8 * * *) last ok 2026-05-21
Last render:    ✅ war_room_20260521.html (1 day ago, 15:30)
Verdict: healthy. (If the War Room job's last run shows an error, or the last render > 8 days, investigate.)
```

## How Aegis executes

1. **SSH ping** — connect with a short timeout, run `whoami; uptime`. Fail → report unreachable and stop (everything below depends on it).
2. **Agent status** — `hermes status`, but surface ONLY the up/model lines. **Never print the "API Keys" section** (it shows masked key fragments — keep them out of chat and any artifact).
3. **Cron check** — `hermes cron list`; confirm the war-room jobs are `[active]` and each `Last run` is `ok`. Report job name · schedule · last-run status.
4. **Last render** — newest `war_room_*.html` in `[HERMES_DELIVERY_DIR]` + its age in days.
5. **Verdict** — healthy / degraded, with the specific thing to check if degraded.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
# Use Windows OpenSSH (the passphrase key lives in the Windows ssh-agent), not git-bash ssh.
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"

# 1) reachable + up?
& $ssh -o ConnectTimeout=10 [HERMES_SSH_USER]@[HERMES_HOST] "whoami; uptime"   # user + uptime if reachable

# 2) agent status — strip the API Keys block so no key fragments are ever shown
& $ssh -o ConnectTimeout=10 [HERMES_SSH_USER]@[HERMES_HOST] "hermes status" |
  Select-String -Pattern 'Model:|Provider:|Hermes Agent Status|exists'        # health lines only, NO keys

# 3) cron jobs registered + last run ok (Hermes's own scheduler, NOT system crontab)
& $ssh -o ConnectTimeout=10 [HERMES_SSH_USER]@[HERMES_HOST] "hermes cron list" |
  Select-String -Pattern 'Name:|Schedule:|active|paused|Last run:'            # job summary

# 4) last rendered dashboard + its modified time (pure read)
& $ssh -o ConnectTimeout=10 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -lt --time-style=long-iso '[HERMES_DELIVERY_DIR]'/war_room_*.html 2>/dev/null | head -1 || echo 'NO RENDERS YET'"
```
</details>

## Remote-read / local-write safety
- Remote read-only: `whoami`, `uptime`, `hermes status`, `hermes cron list`, `ls`. **No cron edits, no writes to Hermes, and no service restart.** Authentication uses the loaded SSH agent; no key material is read or printed.
- **Never echo the API-keys section** of `hermes status` — filter it out. Masked or not, key fragments don't belong in chat or any committed artifact.
- Does not register/pause/modify cron — only reports. Hermes host/paths stay as `[HERMES_*]` placeholders.

## Failure modes (handle gracefully, never block)
- **SSH unreachable / timeout:** "❌ Hermes unreachable (network or VPS down). All war-room commands are offline until it's back." Stop — don't report stale data as current.
- **A war-room job missing or `Last run` not ok:** flag that job ❌ with its last-run status; the dashboard/brief won't refresh until it's fixed.
- **No renders found:** "No dashboard rendered yet — run `/dashboard-render`."
- **SSH auth error:** the key must be in the **Windows** ssh-agent. Check `C:\Windows\System32\OpenSSH\ssh-add.exe -l` for the Hermes key (`[HERMES_SSH_KEY]`); reload with the passphrase if missing. (git-bash ssh has no agent and will fail.)

## Logging
Append to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /hermes-status → <HEALTHY|DEGRADED:reason|UNREACHABLE>`
