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

## Harness Architecture — one product, internal capabilities

Aegis is a single adaptive harness (ADR-006). The operator types the IT problem
in plain English; the lead model orchestrates inside Aegis and selects the
smallest sufficient execution shape:

```
  Ticket (plain English)
    │
    ├─ REPLAY  — verified exact duplicate → deterministic render, zero reasoning
    │            (scripts/replay/)
    ├─ DIRECT  — simple new work, handled inline
    ├─ AGENTS  — genuinely independent workstreams, lead-written briefs
    ├─ LOOP    — machine-checkable gate, attempt ceiling 3
    ├─ GRAPH   — formal tickets with execution risk (scripts/graph/, ATG)
    └─ MEMORY  — controlled retrieval/promotion (scripts/memory/)
    │
    ▼
  R0–R3 authorization → verification → Jira-ready documentation
```

### Independent Review (maker ≠ checker)

For multi-system plans with irreversible steps:
1. Aegis writes the numbered plan with verification steps
2. The plan gets an independent review in a fresh context — the reviewer sees
   the spec, the artifact, and ground truth, never the maker's reasoning
3. Feedback comes back → Aegis adjusts, then executes under the R-class ceremony

This is a human-in-the-loop checkpoint before high-risk operations with no
orchestration infrastructure required. The graph engine records the requirement
as `independentReviewRequired`; nothing in-session can satisfy it.

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
| Aegis — IT Troubleshoot Lab | Main IT troubleshooting + execution agent for [ADMIN_NAME]'s daily tickets | M365, Entra, Intune, Exchange, Windows, Meraki, VoIP, helpdesk, runbooks | Ticket text, screenshots, logs, sanitized environment details | Step-by-step fix, verification checklist, Jira-ready note, reusable runbook | High for guided troubleshooting; requires operator approval for destructive production changes | Native governance: modules/security/security-doctrine.md + placeholder-dictionary.md; warns before risky actions; GUI first, PowerShell secondary; Owner: [ADMIN_NAME]; Status: Active |

## Platform Notes (moved from CLAUDE.md, v8.3)

- **VS Code / Claude Code:** Full power. Slash commands active. CLAUDE.md loads automatically. File access + script execution.
- **Cowork:** Skills auto-trigger. Drop files directly in chat. Planning surface — execution often handed to VS Code.
- **Claude.ai (browser/desktop):** Projects with this as system prompt. Full context loads. No slash commands.
- **Claude iPhone app:** Same prompt, mobile-optimized. Portal steps only — no PS on phone. Keep responses short for field support.

## Environment Standing Questions (senior IT)

Open access-control facts the agent must not guess at — confirm with senior IT, then update here:

- **[@Aegion_FINANCE_SERVER]** — access is gated by **senior IT approval**; onboarding/offboarding steps request it, never grant directly. Document the actual approval path when confirmed.
- **Third server tower** — role unidentified (file storage, backup, or app hosting?). Standing question for senior IT; until answered, treat it as production and touch nothing on it.
