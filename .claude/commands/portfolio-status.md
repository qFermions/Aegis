---
description: SSH to Aegis D Hermes (read-only) and surface a core-holds snapshot ([TICKER_1] / [TICKER_2] / [TICKER_3]) from holdings.yml + the latest cached alpha read — one line each.
disable-model-invocation: true
---

# /portfolio-status

## Risk metadata

- **Risk level:** R0 for remote reads; R1 for the local audit-log append.
- **Access:** credential-sensitive remote read and local write.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** Fast read on the core book without opening the full dashboard. Pulls the core holds (the rows marked core — [TICKER_1], [TICKER_2], [TICKER_3]) from Hermes's `holdings.yml` and pairs each with the most recent cached alpha read, then a single bottom line. Read-only — reads the book + last cached signal, never triggers a fresh (cache-writing) run.

**Operator types:**
```
/portfolio-status            # core holds
/portfolio-status full       # widen to the full book
```

**Expected output (real data shape):**
```
📊 Core holds — [DATE]
[TICKER_1]  ([ACCOUNT]) — [one-line thesis note from holdings.yml]       [last alpha: as of <ts>]
[TICKER_2]  ([ACCOUNT]) — [one-line thesis note from holdings.yml]       [last alpha: as of <ts>]
[TICKER_3]  ([ACCOUNT]) — [one-line thesis note from holdings.yml]       [last alpha: as of <ts>]
Bottom line: [one-line tier read across the core holds].
```

## How Aegis executes

1. SSH to Hermes (Windows OpenSSH), read-only.
2. Read the core rows ([TICKER_1], [TICKER_2], [TICKER_3]) from `[HERMES_HOLDINGS]` (the alpha-signal-brief `holdings.yml`) — ticker, account, note.
3. Pair each with the latest cached alpha read if one exists on the box (read-only); stamp "as of <ts>" so freshness is visible.
4. Render per-ticker line + a single bottom-line read. `full` widens to the full book.
5. Do NOT run the alpha-signal-brief skill here (that refreshes caches = a write). For a fresh read, use `/alpha-signal TICKER`.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"

# 1) core holds from holdings.yml (pure read). 'fgrep' avoids regex parens issues.
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "grep -E 'ticker: ([TICKER_1]|[TICKER_2]|[TICKER_3])' '[HERMES_HOLDINGS]'"   # core 3 rows: ticker/account/note

# 2) latest cached alpha read, if present (read-only; do NOT regenerate)
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -t '[HERMES_CACHE_DIR]'/*alpha* 2>/dev/null | head -1 | xargs -r stat -c '%y %n'"   # freshness stamp only
```
> The remote `([TICKER_1]|[TICKER_2]|[TICKER_3])` parens are inside single quotes so the remote shell treats them as a regex, not a subshell.
</details>

## Remote-read / local-write safety
- Remote read-only: reads `holdings.yml` + cache freshness. **No order placement, no position changes, no skill re-run, no writes to Hermes, and no service restart.** Authentication uses the loaded SSH agent; no key material is read or printed.
- [ADMIN_NAME]'s own financial data shown to [ADMIN_NAME]. Never forward it; never paste to any external/shared surface.
- Finance is Hermes's lane — surface the snapshot, don't add trade advice beyond the notes/reads Hermes already holds. Hermes host/paths stay `[HERMES_*]` placeholders.

## Failure modes (handle gracefully, never block)
- **SSH unreachable:** "Hermes is offline — can't read the book. Check `/hermes-status`." Stop.
- **No cached alpha read:** show holdings with "no recent alpha cache — run `/alpha-signal <ticker>` for a fresh read." Don't invent prices/signals.
- **holdings.yml missing/moved:** report the exact path tried; don't guess holdings.
- **SSH auth error:** key must be in the Windows ssh-agent (see `/hermes-status`).

## Logging
Append to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /portfolio-status <scope> → <OK|NO-CACHE|UNREACHABLE>`
