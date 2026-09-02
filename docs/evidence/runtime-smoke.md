# Runtime smoke — fresh headless session on the v8.8 tree (2026-09-02)

**Why this exists.** The v8.8 model policy changed the agent cards (`model: fable`,
`effort:` per lane). Cards register at session start, so an edited card is only
proven when a *new* session loads it. This is that proof: one genuine fresh
process, not the editing session.

**How it was run.** From the repository root, with a throwaway replay store
seeded by the same CLI the product uses:

```bash
# sandbox store, seeded with one verified T1 case (synthetic fixture text)
export AEGIS_REPLAY_DIR=<temp dir>
node scripts/replay/replay-cli.js record --ticket "How do I set an out-of-office reply in Outlook for [UPN]?" --solution-file <fixture> --deps <authority file>
node scripts/replay/replay-cli.js verify case-0001 --evidence "smoke fixture — synthetic verification, render round-trip"

# a NEW Claude Code process (headless), allowed only the tools the harness needs
claude -p "<three-step smoke prompt>" --output-format stream-json --verbose --max-turns 24 \
  --allowedTools "Agent" "Read" "Grep" "Glob" "Bash(node scripts/replay/replay-cli.js:*)"
```

The prompt asked for exactly three things: (1) run the replay lookup and, on a hit,
render verbatim without reasoning; (2) dispatch `tier1-support` once on a routine
ticket; (3) dispatch `tier2-support` once on a diagnostic ticket; then emit a JSON
summary. The event stream was parsed by a script, not read by hand.

**What the event stream shows** (Claude Code 2.1.258, `stream-json`):

| Observation | Evidence in the stream |
|---|---|
| Fresh session on the policy model | `system/init`: `model = claude-fable-5-1` |
| Updated cards loaded from the working tree | `system/init` agent list includes `tier1-support`, `tier2-support`, `zac`, `atlas`, `forge`, `warden` |
| Cards carrying `model: fable` and `effort:` loaded and dispatched | both handler spawns succeeded (`tool_use Agent subagent_type=tier1-support`, `…=tier2-support`), each running on `claude-fable-5-1`. The stream shows the cards loaded and the model they ran on; it does not show whether the `effort:` field was parsed or ignored — that the field exists and is honoured is vendor-documented (`TEAM.md` cites the pages), not observed here |
| Replay short-circuit | `Bash node scripts/replay/replay-cli.js lookup …` → `{"result":"CACHE_HIT","via":"exact"}`; next call `render case-0001`; the lead's summary reports the rendered first line and adds no steps |
| Routine T1 route works | `tier1-support` returned a card-format answer (first line `**What's happening**`) |
| T2 route works | `tier2-support` ran its own replay lookup (MISS), read `.claude/commands/outlook-issue.md`, and returned a verdict leading with the discriminating check |
| Bounded cost | 5 lead turns, 64 s wall clock, one session's spend of roughly two and a half US dollars at list price — recorded so nobody mistakes the smoke for free |

**What it does not prove.** Answer quality (that is the rubric in
`scripts/eval/README.md`), the effort level actually applied, or behaviour in an
interactive session with a human typing. One handler duplicated the lead's replay
lookup inside its own run — harmless, and a reminder that a brief should say
"replay already checked".

Placeholders only; the sandbox store was deleted after the run; no tenant was
touched (the session's only shell capability was the replay CLI).
