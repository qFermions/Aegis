# Aegis Team — roles, model policy, coordination (canonical, v8.7)

Two planes. Never confuse them.

## Runtime support plane (IT tickets)

| Role | Agent | Model / effort | Job |
|---|---|---|---|
| Lead / intake | the session itself | Fable 5, high (default) | Plain-English intake → replay → tier-guard → classify → route; owns convergence and the operator answer |
| Tier 1 | `tier1-support` | Fable 5, high | Routine bounded tickets, both ecosystems |
| Tier 2 | `tier2-support` | Fable 5, high | Bounded real troubleshooting, both ecosystems |
| Tier 3 fortress | existing graph/specialist machinery | Fable 5, xhigh-as-justified | ANALYSIS of hard tickets; output is always a human-executed procedure |
| Independent reviewer | fresh-context, out-of-session | Opus 5, max — only when doctrine requires genuine independence | Maker ≠ checker on consequential plans |

Replay CACHE_HIT is zero-model. Exactly two support handlers exist; support
handlers never spawn. **Aegis advises; humans execute** (`PRODUCT_CONTRACT.md`).

## Development plane (fixing Aegis itself — never routes IT tickets)

| Name | Agent card | Model / effort | Role |
|---|---|---|---|
| **ZAC** | `zac` | Opus 5, max | Prompt Architect + Change Dispatcher. Owns a complaint end-to-end: reads canon (PRODUCT_CONTRACT, PROJECT_STATE, TEAM, the actual implementation), localizes the defect (prompt/routing/output-contract/docs/implementation/test), writes a bounded brief, claims the task, dispatches the right developer natively, verifies with the real suites, updates durable state, reports. Never asks the operator to relay prompts. |
| **ATLAS** | `atlas` | Opus 5, max | System/Product Architect. Judges whether a proposed change fits the architecture and invariants BEFORE it is built. Read-only; returns fit/misfit + the smallest compliant design. |
| **FORGE** | `forge` | Fable 5, xhigh | Implementation Builder. Executes a bounded brief exactly: claims scope, edits only owned files, runs the relevant suites, reports diff + evidence. Does not spawn. |
| **WARDEN** | `warden` | Opus 5, max | Independent Code/Contract Reviewer. Fresh context, receives spec + diff + ground truth (never the maker's reasoning); returns ACCEPT / REJECT + invariant violations. Used where independence genuinely adds value, not as ceremony. |

**Invocation:** the operator addresses roles by name in plain English —
"ZAC, fix how Aegis handles X" · "ATLAS, does this change fit?" · "FORGE,
implement your assigned task" · "WARDEN, review what FORGE changed." A session
receiving a named-role request dispatches that agent (or, when the roster hasn't
registered a card yet in an old session, pins a general-purpose agent to the
card verbatim and says so).

## Model policy (actual runtime identifiers)

Frontmatter `model:` values resolve through Claude Code: `fable` → Claude Fable 5,
`opus` → Claude Opus 5. No `haiku`/`sonnet` remains on any required Aegis path.
Effort: `high` default on Fable paths; `xhigh` for fortress/FORGE work;
`max` for Opus roles — expensive effort must be justified, never ceremonial.

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
