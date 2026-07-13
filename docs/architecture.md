# Architecture — Aegis IT Operations Agent

## Overview

Aegis is an AI agent for IT operations built on Claude Code (Anthropic's CLI for the
Claude API). It specializes in Microsoft 365 hybrid environments and is designed to assist
a Tier 2–3 IT operator across the full stack: identity, MDM, networking, VoIP, and automation.

The design philosophy: **CLAUDE.md is the agent brain.** Everything that makes Aegis
behave differently from a generic LLM is encoded in that file — environment context,
behavioral rules, workflow orchestration, security gates, and the self-improvement loop.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Operator Interface                           │
│                                                                     │
│  VS Code + Claude Code CLI   │   Claude.ai (browser/desktop)        │
│  ↳ Full slash commands       │   ↳ Project system prompt            │
│  ↳ File access               │   ↳ No file access                   │
│  ↳ Script execution          │                                      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Agent Identity Layer                          │
│                                                                     │
│  CLAUDE.md (project root)                                           │
│  ├── Identity & persona ("Aegis, Tier 3 IT Engineer")               │
│  ├── Environment snapshot (tenant, vendors, sites, servers)         │
│  ├── Core behavior rules (portal-first, placeholder-only, etc.)     │
│  ├── Workflow orchestration (plan mode, verification gates)         │
│  ├── Self-improvement loop (lessons.md integration)                 │
│  ├── Security rules (destructive action gate, injection defense)    │
│  └── Admin portal navigation reference                              │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────┐
│   Slash     │ │   Plugin    │ │         Memory Layer            │
│  Commands   │ │ enterprise- │ │                                 │
│ .claude/    │ │  it-ops     │ │  ~/.claude/projects/[proj]/     │
│ commands/   │ │             │ │  memory/                        │
│ *.md        │ │ skills/     │ │  ├── user_role.md               │
│             │ │ it-ops.md   │ │  ├── project_*.md               │
│ ~50 command │ │             │ │  ├── feedback_*.md              │
│ files       │ │ Quick ref + │ │  └── MEMORY.md (index)          │
│             │ │ env vars    │ │                                 │
└─────────────┘ └─────────────┘ └─────────────────────────────────┘
```

---

## Multi-Agent Architecture

Three specialized agents divide the work by channel and context:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        [@Aegion] IT Operations                      │
└─────────────────────────────────────────────────────────────────────┘

  Aegis (VS Code / Claude Code)
  ├── Primary: IT tickets, onboarding, offboarding
  ├── Primary: Script development and automation
  ├── Primary: Meraki, VoIP, Intune operations
  └── Handoff → Nova for project/comms work

  Nova (Claude.ai browser/desktop)
  ├── Primary: Project tracking, meeting prep
  ├── Primary: Stakeholder comms, board reports
  ├── Supervision: Plan review for Aegis multi-system tasks
  └── Receives handoffs from Aegis via paste

  Red (Telegram / Claude iPhone app)
  ├── Primary: Mobile quick-reference
  ├── Primary: Field support, simple lookups
  └── Portal steps only — no PowerShell on mobile
```

### Handoff Protocol

When redirecting to Nova:
```
"This would be better in Nova.
Hand off context: [1-2 sentences of what Nova needs].
Your ask: [restate the request for Nova]."
```

### Nova Supervision Pattern

For multi-system plans with irreversible steps:
1. Aegis writes the numbered plan with verification steps
2. Operator pastes plan to Nova: *"Anything missing, risky, or out of order?"*
3. Nova gives second opinion → operator brings feedback back
4. Aegis adjusts if needed, then executes

This provides a human-in-the-loop checkpoint before high-risk operations without
requiring any infrastructure (no orchestration API, no agent-to-agent comms).

---

## CLAUDE.md — The Agent Brain

CLAUDE.md is the primary configuration artifact. It functions as:

- **System prompt enrichment** — loaded automatically by Claude Code on session start
- **Environment database** — tenant domain, vendor list, site topology, server roles,
  admin portal paths, device naming conventions
- **Behavioral ruleset** — 12 core rules governing response format, security, and interaction
- **Workflow engine** — plan mode triggers, verification requirements, error recovery protocol
- **Navigation reference** — exact portal paths for 2026 admin center layouts
- **Decision trees** — branching logic for common issue types (password reset, slow internet, etc.)

### Why CLAUDE.md Instead of a Database

For an operator working in a fast-moving environment, a single Markdown file has key advantages:
- Human-readable and editable without tooling
- Version-controlled alongside the scripts and commands it governs
- Loaded automatically by Claude Code — no setup required
- Portable: paste into any Claude session to activate the full agent

---

## Self-Improvement Loop

```
  Operator interaction
        │
        ├── Correction / feedback
        │         │
        │         ▼
        │   tasks/lessons.md
        │   "### [DATE] Lesson: [title]
        │    What happened: ...
        │    Correction: ...
        │    Rule: ...
        │    Category: ..."
        │
        └── Next session starts
                  │
                  ▼
           Agent reads lessons.md
           before any work
                  │
                  ▼
           Behavior updated
           without re-training
```

Lessons accumulate permanently (never deleted). When the file reaches 50 entries,
older entries are archived to `tasks/lessons-archive.md` to maintain context window efficiency.

**Immutability constraint:** Lessons cannot override security rules (Core Behavior Rules
#4, #5, #10 — placeholder enforcement, destructive action gate, no PII). Those rules
are defined in CLAUDE.md and survive any lesson.

---

## Security Architecture

See [security_model.md](security_model.md) for full analysis. Summary:

```
External content (emails, tickets, logs)
        │
        ▼
 ┌──────────────────┐
 │  Injection       │  OWASP LLM01 — detects and flags embedded
 │  Detection Layer │  instructions in pasted content
 └────────┬─────────┘
          │ (clean content passes through)
          ▼
 ┌──────────────────┐
 │  Destructive     │  OWASP LLM08 — any wipe/delete/disable/revoke
 │  Action Gate     │  requires explicit "yes, proceed"
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │  PII Isolation   │  Placeholder-only output; no real employee
 │  Layer           │  data in scripts, docs, or memory
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │  Pre-Commit      │  PII scan (BLOCK) + credential scan (BLOCK)
 │  Scanner         │  + dangerous cmdlet scan (WARN)
 └──────────────────┘
```

---

## Data Flow — Typical Ticket

```
Operator pastes ticket description
        │
        ▼
1. Injection check — is this external content safe?
        │
        ▼
2. Load context — which systems does this touch?
   (CLAUDE.md: environment, portal paths, decision trees)
        │
        ▼
3. Is this a 3+ step task?
   YES → Plan mode: write plan → operator confirms → execute
   NO  → Execute immediately
        │
        ▼
4. Execute steps (portal steps first, PS in details block)
        │
        ▼
5. Verify: run verification command or check portal state
        │
        ▼
6. Output: ticket resolution note (Jira-ready, under 200 words)
        │
        ▼
7. Lessons check: did the operator correct anything?
   YES → Write to tasks/lessons.md
```

---

## Repository Layout

```
├── CLAUDE.md                          # Agent brain — identity, rules, context
├── README.md                          # Project overview (this repo)
│
├── .claude/
│   ├── commands/                      # ~50 slash commands (one .md per command)
│   │   ├── onboard.md
│   │   ├── offboard.md
│   │   ├── reset-mfa.md
│   │   └── ...
│   └── plugins/
│       └── enterprise-it-ops/
│           ├── plugin.json            # Plugin metadata
│           └── skills/
│               └── it-ops.md         # Skill knowledge base (quick reference)
│
├── docs/
│   ├── architecture.md               # This file
│   └── security_model.md             # OWASP LLM analysis
│
├── modules/
│   ├── security/                     # Threat detection, IR, compliance, vuln scan
│   ├── it_support/                   # Workflows, troubleshooting
│   ├── systems/                      # Health checks, infrastructure, network ops
│   └── automation/                   # PS patterns, CI/CD, pre-commit hooks
│
├── scripts/
│   ├── pre-commit-check.js           # Pre-commit safety scanner (Node.js)
│   ├── security-audit.js             # M365 tenant security audit report generator
│   └── init-memory.js                # Initializes agent memory files for new installs
│
└── tasks/
    ├── todo.md                        # Current task tracking
    └── lessons.md                     # Self-improvement log (permanent, cumulative)
```


---

## Agent Registry — Aegis Entry (moved from CLAUDE.md, v8.3)

| Agent | Purpose | Scope | Inputs | Outputs | Reliability | Safety |
|---|---|---|---|---|---|---|
| Aegis — IT Troubleshoot Lab | Main IT troubleshooting + execution agent for [ADMIN_NAME]'s daily tickets | M365, Entra, Intune, Exchange, Windows, Meraki, VoIP, helpdesk, runbooks | Ticket text, screenshots, logs, sanitized environment details | Step-by-step fix, verification checklist, Jira-ready note, reusable runbook | High for guided troubleshooting; requires operator approval for destructive production changes | Inherits Koinon placeholders + security preamble; warns before risky actions; GUI first, PowerShell secondary; Owner: [ADMIN_NAME]; Status: Active |

## Platform Notes (moved from CLAUDE.md, v8.3)

- **VS Code / Claude Code:** Full power. Slash commands active. CLAUDE.md loads automatically. File access + script execution.
- **Cowork:** Skills auto-trigger. Drop files directly in chat. Planning surface — execution often handed to VS Code.
- **Claude.ai (browser/desktop):** Projects with this as system prompt. Full context loads. No slash commands.
- **Claude iPhone app:** Same prompt, mobile-optimized. Portal steps only — no PS on phone. Keep responses short for field support.

## Environment Standing Questions (senior IT)

Open access-control facts the agent must not guess at — confirm with senior IT, then update here:

- **[@Aegion_FINANCE_SERVER]** — access is gated by **senior IT approval**; onboarding/offboarding steps request it, never grant directly. Document the actual approval path when confirmed.
- **Third server tower** — role unidentified (file storage, backup, or app hosting?). Standing question for senior IT; until answered, treat it as production and touch nothing on it.
