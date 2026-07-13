---
description: Open the current Aegis D Hermes war room dashboard in the default browser — live URL if served, else the latest rendered HTML pulled read-only from Hermes.
disable-model-invocation: true
---

# /war-room

## Risk metadata

- **Risk level:** R0 for the remote read; R1 when a local HTML copy or audit-log entry is created.
- **Access:** credential-sensitive remote read and local write/browser launch.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** Opens the most recent War Room v30 dashboard so [ADMIN_NAME] can read it in 5 minutes. If Hermes serves the dashboard over HTTP, it opens that URL. Otherwise it reads the newest rendered HTML from Hermes, creates a local temporary copy, and opens that copy in the browser. The remote operation is read-only; the local copy and audit log are R1 local writes.

**Operator types:**
```
/war-room
```

**Expected output:**
```
🗺️ War Room dashboard
Opening: war_room_v30_2026-05-22.html (rendered 2026-05-22 20:00)
→ launched in default browser
```

## How Aegis executes

1. **If `WAR_ROOM_URL` env var is set** (Hermes serves the dashboard over HTTP), open it directly:
   - `Start-Process $env:WAR_ROOM_URL`
2. **Otherwise**, pull the newest rendered dashboard read-only from Hermes and open the local copy:
   - find the newest `war_room_*.html` in `[HERMES_DELIVERY_DIR]` (daily `war_room_YYYYMMDD.html` + legacy `war_room_v30_*.html`)
   - `scp` it to a local temp dir (read-only copy off Hermes — no write to Hermes)
   - open the local file in the default browser
3. Report which file opened and its render timestamp.

> Note: this is the **trading war-room dashboard** (rendered HTML in `[HERMES_DELIVERY_DIR]`). It is NOT `hermes dashboard`, which is Hermes's own config/API-key web UI on localhost — different thing, don't use it here.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
# Path A — Hermes serves the dashboard over HTTP (preferred when available)
Start-Process $env:WAR_ROOM_URL          # open the configured dashboard URL in the default browser

# Path B — no HTTP endpoint: copy the latest rendered HTML off Hermes (READ-ONLY) and open it
# 1) ask Hermes for the newest dashboard filename (read-only 'ls', no write to Hermes)
$latest = ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -t '[HERMES_DELIVERY_DIR]'/war_room_*.html | head -1"   # newest dashboard file path
# 2) copy that one file down to a local temp folder (scp = read-only pull)
$dest = Join-Path $env:TEMP ("war_room_" + (Get-Date -Format yyyyMMdd_HHmmss) + ".html")
scp [HERMES_SSH_USER]@[HERMES_HOST]:"$latest" $dest   # pull the HTML; nothing written back to Hermes
# 3) open the local copy in the default browser
Start-Process $dest                       # launch the dashboard locally
```
</details>

## Remote-read / local-write safety
- Remote read-only: only `ls` and `scp` pull from Hermes. The temporary HTML copy, browser launch, and audit log are local effects. Nothing is written to Hermes and no service restarts. Authentication uses the loaded SSH agent; no key material is read or printed.
- Hermes internals (host, paths) stay as `[HERMES_*]` placeholders — resolved at runtime via `~/.ssh/config` and env vars. Never echo the real host/paths into chat or any artifact.

## Failure modes (handle gracefully, never block)
- **`WAR_ROOM_URL` unset AND SSH unreachable:** "War Room dashboard isn't reachable right now (no URL configured and Hermes is offline). Last local copy, if any, is in `%TEMP%`." Then stop — don't fake a render.
- **No `war_room_v30_*.html` found in the delivery dir:** "No rendered dashboard found on Hermes yet. Run `/dashboard-render` to generate one."
- **SSH auth error:** point to the same ssh-agent fix as `/ask-hermes` (`ssh-add -l`; reload key if missing).

## Logging
Append a one-liner to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /war-room → <OPENED url|file | UNREACHABLE>`
