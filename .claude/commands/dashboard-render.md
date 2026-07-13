---
description: Trigger a fresh War Room dashboard render on Aegis D Hermes via the existing render_war_room_dashboard.py script, then report the generated HTML.
disable-model-invocation: true
---

# /dashboard-render

## Risk metadata

- **Risk level:** R1 — creates one remote dashboard artifact and appends one local log entry.
- **Access:** remote write, credential-sensitive remote execution, and local write.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** Kicks off a fresh war-room dashboard render on Hermes using the existing pipeline (`render_war_room_dashboard.py`), then tells [ADMIN_NAME] where the new HTML landed. Use it for an up-to-the-minute dashboard instead of waiting for the scheduled morning run.

**Operator types:**
```
/dashboard-render             # render for today
/dashboard-render 2026-05-26  # render for a specific target trading day
```

**Expected output:**
```
🛠️ War Room render — target 2026-05-22
→ render complete: war_room_20260522.html (delivery dir)
→ open it now with /war-room
```

## ⚠️ Scope — the one command that writes to Hermes
This is the **only** war-room command that writes on Hermes: it generates a new dashboard HTML file via the render script. Additive artifact generation is still a **remote state mutation**, classified R1 because its rollback is deletion of the newly generated artifact. It does not change holdings, positions, config, cron, or a running service. The operator must invoke it explicitly.

> Aegis-build note: during the v8/v8.1 autonomous runs the renderer was inspected and `py_compile`-checked but not executed. No live render was performed as part of this remediation.

## How Aegis executes

1. Parse the optional date arg (default = today), normalize to `YYYY-MM-DD` / the script's expected form.
2. SSH to Hermes (Windows OpenSSH) and run `render_war_room_dashboard.py` from `[HERMES_SCRIPTS_DIR]`.
3. Wait for completion (quick once data is cached; allow up to ~3 min if fetchers run).
4. Report the generated filename + delivery path. Suggest `/war-room` to open it.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"
$date = if ($args[0]) { $args[0] } else { (Get-Date -Format yyyy-MM-dd) }      # default to today

# Run the EXISTING renderer (the same script the morning job uses); generates a fresh dated HTML
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "python3 '[HERMES_SCRIPTS_DIR]/render_war_room_dashboard.py' --date $date"
  # writes a new war_room_<date>.html into the delivery dir; no other state touched

# Confirm the file landed (read-only)
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -lt --time-style=long-iso '[HERMES_DELIVERY_DIR]'/war_room_*.html | head -1"
```
> Check the script's real flags first with `python3 [HERMES_SCRIPTS_DIR]/render_war_room_dashboard.py --help` — if it takes no `--date`, run it bare (it defaults to today).
</details>

## Remote-write safety
- **R1 remote write:** generates one new dashboard file. No holdings/positions/config/cron changes and **no service restart**.
- **Undo:** remove only the exact newly generated artifact after confirming its path and filename; never use a wildcard deletion.
- Renders only — does NOT deliver to Telegram. Delivery is a separate, deliberate step.
- Hermes host/paths stay as `[HERMES_*]` placeholders. On a partial/failed render, report the exact error and don't retry more than once (Error Recovery Protocol).

## Failure modes (handle gracefully, never block)
- **SSH unreachable:** "Hermes is offline — can't render. Check `/hermes-status`." Stop.
- **Render errors (missing data / disk):** report the exact stderr + which fetcher failed; suggest `/hermes-status`. Don't mark complete on a failed render.
- **Timeout >4 min:** "Render is slow — fetchers may be rate-limited. Check `/hermes-status` and retry once."
- **SSH auth error:** key must be in the Windows ssh-agent (see `/hermes-status`).

## Logging
Append to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /dashboard-render <date> → <RENDERED file|FAILED reason|UNREACHABLE>`
