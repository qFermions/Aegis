---
description: Alias for /new-user — full onboarding deep flow (AD → sync → license → MFA → mail/groups → apps → devices → site/facilities → wrap-up). Placeholders only.
disable-model-invocation: true
---

# /onboard

## Execution boundary

This alias is routing-only. It cannot authorize or execute any onboarding action. Invoke the canonical `/new-user` command; each state change there must independently resolve its target and pass its own action-specific exact confirmation. Approval of this alias or of an onboarding plan is not execution approval.

## Step 0 — replay fast path (before any reasoning)

Run the deterministic lookup: `node scripts/replay/replay-cli.js lookup --ticket "<the operator's exact request>"`.
- **CACHE_HIT** → run the `render` command it returns and emit the stored solution **verbatim**. Do not re-derive, summarize, launch agents, loop, or open the graph — the work is already verified. Zero new ticket-solving calls.
- **STALE** → say the authority basis changed (name the changed file), then proceed through the normal flow below; afterwards the refreshed solution can be re-verified into the cache.
- **MISS** → proceed normally.

Full new-user onboarding is owned by **/new-user** — the canonical 26-step deep flow built from the operator's real checklist (gold-standard format per `docs/command-output-standard.md`, Variant A). Use that command: same placeholders, same admin gates, same verification discipline.

This alias exists so `/onboard` can never serve a stale generic copy again (2026-06-09 drift lesson). When invoked, deliver the `/new-user` runbook.

After a run is **verified** (directory read-back confirmed), offer to persist it:
`record` + `verify --evidence` per `scripts/replay/README.md` — the next exact
repeat then replays instantly.
