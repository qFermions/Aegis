---
description: Query Aegis D Hermes's alpha-signal-brief skill for a single TICKER and return a one-line, plain-English read (signal · conviction · why).
disable-model-invocation: true
---

# /alpha-signal

## Risk metadata

- **Risk level:** R1 — runs one remote analysis command and appends one local log entry.
- **Access:** credential-sensitive remote execution and local write.
- **Credential-sensitive:** yes — uses the operator's SSH agent; never prints key material.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does (plain English):** Asks Hermes's `alpha-signal-brief` skill for a quick read on one ticker and returns a single plain-English line — signal, conviction, and the one reason that matters. For a gut-check, not a full thesis (use `/ask-hermes` or `/dashboard-render` for depth).

**Operator types:**
```
/alpha-signal [TICKER]
```

**Expected output:**
```
🎯 [TICKER] — BULLISH (medium): rev growth re-accelerating into the next print; trend intact above the 50-day.
```

## How Aegis executes

1. Read the TICKER arg (everything after `/alpha-signal`). **Require a ticker** — if none, ask for one (don't guess).
2. Uppercase + validate it looks like a ticker (1–5 letters, optional `.X`); reject junk. Ideally confirm it's in the holdings book (the tickers listed in `[HERMES_HOLDINGS]`).
3. SSH to Hermes (Windows OpenSSH) and run the `alpha-signal-brief` skill for that ticker via the `hermes -z` bridge.
4. Compress Hermes's answer to **one line**: `TICKER — SIGNAL (conviction): why.` Offer `/ask-hermes <ticker> full read` for depth.

> Note: this invokes the alpha-signal-brief skill, which may refresh a news/price cache on Hermes (a small write) as part of computing the read — that is the operator-invoked, intended behavior of this command. For a pure no-write view of the last cached read, use `/portfolio-status`.

<details>
<summary>Underlying commands — for reference (plain-English comments per line)</summary>

```powershell
$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"
$ticker = ($args -join ' ').Trim().ToUpper()                 # take arg, trim, uppercase
if (-not ($ticker -match '^[A-Z]{1,5}(\.[A-Z])?$')) { throw "Give me a valid ticker, e.g. /alpha-signal [TICKER]" }

# Run the real skill through the same bridge /ask-hermes uses, scoped to alpha-signal-brief
& $ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "timeout 180 hermes -z 'alpha signal one-liner for $ticker: signal, conviction, one reason' --skills alpha-signal-brief"
  # gpt-5.5 returns a short read; compress to a single line on the Aegis side
```
</details>

## Remote-write / local-write safety
- Read-mostly: a signal query. It may refresh a cache as a side effect of the skill, but it places **no trades**, changes **no positions**, and restarts **no service**. Authentication uses the loaded SSH agent; no key material is read or printed.
- This is a signal read, **not** a buy/sell recommendation — present it as Hermes's read; finance lives in Hermes's lane (Aegis surfaces, doesn't advise).
- Never forward the signal to anyone but the operator. Hermes host/paths stay `[HERMES_*]` placeholders.

## Failure modes (handle gracefully, never block)
- **No ticker given:** "Which ticker? e.g. `/alpha-signal [TICKER]`." Don't guess.
- **SSH unreachable / timeout:** "Hermes is offline — can't pull a signal for $ticker. Check `/hermes-status`." Stop.
- **Empty / unknown ticker from Hermes:** "Hermes has no signal for $ticker (unknown or no coverage)." Don't fabricate a read.
- **SSH auth error:** key must be in the Windows ssh-agent (see `/hermes-status`).

## Logging
Append to the repository-relative `.aegis-state/hermes-escalation-log.md`:
`[YYYY-MM-DD HH:MM:SS] /alpha-signal <TICKER> → <SIGNAL|NO-COVERAGE|UNREACHABLE>`
