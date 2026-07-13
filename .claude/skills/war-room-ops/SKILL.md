---
name: war-room-ops
description: Operating pattern for the read-only Aegis D Hermes war-room bridge — the /war-room, /morning-brief, /portfolio-status, /dashboard-render, /alpha-signal, /hermes-status command family, with lane + placeholder discipline.
---

# Skill: war-room-ops

**Trigger:** `/war-room-ops` or "war room", "dashboard", "morning brief", "portfolio snapshot", "alpha signal", "is Hermes up" — any time [ADMIN_NAME] reaches for the Hermes-hosted trading war room from the laptop.

**Goal:** Surface Hermes's war-room outputs on the laptop **read-only and safely**, staying in lane (finance is Hermes's domain — Aegis surfaces, doesn't advise).

> Maps to the IT-ops family. Captures the new IT pattern from the v8 build: a read-only SSH bridge to a peer agent's data products.

---

## The command family (all read-only by design)
| Command | What it does | Touches Hermes how |
|---------|--------------|--------------------|
| `/war-room` | Open the latest dashboard in the browser | `ls` + `scp` pull (or open `WAR_ROOM_URL`) |
| `/morning-brief` | Print today's Daily Hunt brief | `cat` / `hermes brief --latest` |
| `/portfolio-status` | Core-holds snapshot (core tickers from holdings.yml) | snapshot/quote read |
| `/dashboard-render` | Generate a fresh dashboard | runs render skill — **additive artifact only** |
| `/alpha-signal TICKER` | One-line signal read | skill query |
| `/hermes-status` | SSH ping + cron check + last-render age | `whoami`/`crontab -l`/`ls` |

## Operating rules
1. **Read-only to Hermes.** Only `/dashboard-render` writes (a new timestamped HTML — additive, never a state mutation or service restart). Everything else is `cat`/`ls`/`scp`-pull/query. Never `systemctl`, never edit cron, never place a trade.
2. **Lane discipline.** Finance/markets is Hermes's lane. These commands *surface* Hermes's output; they don't add Aegis trade opinions. For depth, route to `/ask-hermes`. (See the four-agent stack in CLAUDE.md.)
3. **Placeholder discipline.** Hermes host/paths are `[HERMES_*]` placeholders resolved at runtime via `~/.ssh/config` + env vars. **Never** write the real host/IP/paths into chat, commits, or any artifact (Koinon SR-8 / §4).
4. **Operator's own data.** Briefs/snapshots are [ADMIN_NAME]'s financial data shown to [ADMIN_NAME]. Never forward to an end user or external surface.
5. **Fail soft, never block.** SSH down ⇒ say so plainly and stop; don't fabricate prices, signals, or a render. Point to `/hermes-status` first when anything comes back empty.
6. **Auth = ssh-agent.** Same loaded key as `/ask-hermes`. On auth error, point to `ssh-add -l` / reload — never read the key file.
7. **Log every call.** One-liner to `hermes-escalation-log.md`: `[ts] /<command> <args> → <result>`.

## Verification (prove it worked)
- `/hermes-status` returns ✅ reachable + both cron jobs ✅ + a recent render date.
- `/war-room` opens a file/URL with a render timestamp (not a 404 / empty).
- `/dashboard-render` reports a new dated HTML filename and exits 0.

## Failure triage
| Symptom | First check |
|---------|-------------|
| Brief/dashboard empty | `/hermes-status` → is the cron registered + last render fresh? |
| SSH "Permission denied" | `ssh-add -l` — is the key loaded? Reload with passphrase. |
| Render times out | Fetchers likely rate-limited — retry once, then check Hermes disk/logs |
| Stale prices | Snapshot shows "data as of" — if old, the price cache didn't refresh |
