# Aegis Team — roles, model policy, coordination (canonical, v8.8)

Two planes. Never confuse them.

## Runtime support plane (IT tickets)

| Role | Agent | Model / effort | Job |
|---|---|---|---|
| Lead / intake | the session itself | Fable 5.1, session default (high) | Plain-English intake → replay → tier-guard → classify → route; owns convergence and the operator answer |
| Tier 1 | `tier1-support` | Fable 5.1, medium | Routine bounded tickets, both ecosystems — two steps may be the whole answer |
| Tier 2 | `tier2-support` | Fable 5.1, high | Bounded real troubleshooting, both ecosystems |
| Tier 3 fortress | existing graph/specialist machinery | Fable 5.1, xhigh-as-justified | ANALYSIS of hard tickets; output is always a human-executed procedure |
| Independent reviewer | fresh-context, out-of-session | Fable 5.1, xhigh (Opus permitted, not required) | Maker ≠ checker on consequential plans |

Replay CACHE_HIT is zero-model. Exactly two support handlers exist; support
handlers never spawn. **Aegis advises; humans execute** (`PRODUCT_CONTRACT.md`).

## Development plane (fixing Aegis itself — never routes IT tickets)

| Name | Agent card | Model / effort | Role |
|---|---|---|---|
| **ZAC** | `zac` | Fable 5.1, high | Prompt Architect + Change Dispatcher. Owns a complaint end-to-end: reads canon (PRODUCT_CONTRACT, PROJECT_STATE, TEAM, the actual implementation), localizes the defect (prompt/routing/output-contract/docs/implementation/test), writes a bounded brief, claims the task, dispatches the right developer natively, verifies with the real suites, updates durable state, reports. Never asks the operator to relay prompts. |
| **ATLAS** | `atlas` | Fable 5.1, high | System/Product Architect. Judges whether a proposed change fits the architecture and invariants BEFORE it is built. Read-only; returns fit/misfit + the smallest compliant design. |
| **FORGE** | `forge` | Fable 5.1, xhigh | Implementation Builder. Executes a bounded brief exactly: claims scope, edits only owned files, runs the relevant suites, reports diff + evidence. Does not spawn. |
| **WARDEN** | `warden` | Fable 5.1, xhigh | Independent Code/Contract Reviewer. Fresh context, receives spec + diff + ground truth (never the maker's reasoning); returns ACCEPT / REJECT + invariant violations. Used where independence genuinely adds value, not as ceremony. |

**Invocation:** the operator addresses roles by name in plain English —
"ZAC, fix how Aegis handles X" · "ATLAS, does this change fit?" · "FORGE,
implement your assigned task" · "WARDEN, review what FORGE changed." A session
receiving a named-role request dispatches that agent (or, when the roster hasn't
registered a card yet in an old session, pins a general-purpose agent to the
card verbatim and says so).

## Model policy (runtime identifiers per the Claude Code docs, checked 2026-09-01)

Frontmatter `model:` values resolve through Claude Code: `fable` → the current
Claude Fable (5.1 today), `opus` → Claude Opus 5. `effort:` is a documented
subagent field (`low`/`medium`/`high`/`xhigh`/`max`; omitted = inherit the
session's level). Sources: https://code.claude.com/docs/en/sub-agents.md
(frontmatter fields, model resolution order, effort) and
https://code.claude.com/docs/en/model-config.md (alias → model, effort levels).
Nothing in this repository can test that the runtime honours these fields; the
cards declare them, the vendor docs define them, and the tier/claim suites only
pin the declarations.

Policy: **one strong model, effort sized to the lane, independence from fresh
context.** Fable on every required Aegis path — T1 at medium (routine, bounded),
lead/T2/ZAC/ATLAS at high, fortress analysis / FORGE / WARDEN at xhigh. `max` is
never ceremonial. Opus is *permitted* on a reviewer card when the operator wants
a second model family for a high-consequence review, but nothing in Aegis
requires model switching: the maker ≠ checker property comes from the reviewer
receiving spec + diff + ground truth in a fresh context, never the maker's
reasoning. No `haiku`/`sonnet` on any required Aegis path (test-enforced in
`scripts/tier/tier-routing.test.js` and `scripts/dev/claim.test.js`).

Why this changed in v8.8: the maker ≠ checker property was never a property of
the model family — it comes from the reviewer receiving spec + diff + ground
truth in a fresh context. Requiring a second model family added cost and a
second alias to keep in sync without adding independence. Deterministic suites,
file reads, and routine tickets never justify `max` effort.

## Multi-session coordination protocol (mandatory before ANY dev edit)

Several Claude Code sessions may work on Aegis simultaneously. Before editing:

1. Read `PRODUCT_CONTRACT.md`, `PROJECT_STATE.md`, this file.
2. `git status` — understand the live tree; unfamiliar dirty files belong to
   someone: never reset/checkout/stash/clean over them, never `git add .` blind.
3. `node scripts/dev/claim.js list` — see active task claims.
4. Claim before editing: `node scripts/dev/claim.js claim --task <id> --owner
   "<who/session>" --scope "<comma-separated paths or dirs>"` — the claim is
   refused (exit 1) if any ACTIVE task's scope overlaps yours. Overlap = STOP:
   wait, or hand off explicitly. Never resolve a collision by overwriting.
5. Work only inside your claimed scope; commit only files your task owns.
6. Release when done: `node scripts/dev/claim.js release --task <id> --summary
   "<result>"` (archives to `tasks/completed/`).

Task state lives per-task in `tasks/active/<id>.md` / `tasks/completed/<id>.md` —
sessions never rewrite one shared status file concurrently. A collision must
fail safe and visibly; corruption is never an acceptable resolution.

**Restart rule:** agent cards and bootstrap doctrine register at session start —
after changing them, restart the session before using it as acceptance evidence.
