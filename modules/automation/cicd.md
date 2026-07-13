# CI/CD — Git Workflow and Automation Pipeline

Branch strategy, commit conventions, and the automated safety checks that run on every commit.

---

## Branch Strategy

| Branch | Purpose | Who commits |
|--------|---------|------------|
| `main` | Production-ready state — what the live agent uses | Merges only |
| `portfolio` | Sanitized public version for portfolio / open source | Sanitization work |
| `feature/*` | New commands, workflows, documentation additions | Development |
| `fix/*` | Bug fixes to existing commands or scripts | Bug fixes |

### Flow

```
feature/new-command
        │
        ▼ (PR, review, merge)
      main
        │
        ▼ (sanitize, replace org values)
    portfolio
```

**Rule:** `main` always contains the full operational version.
`portfolio` always contains the sanitized version with `[@Aegion_*]` placeholders.
Never merge `portfolio` → `main`.

---

## Commit Message Convention

```
<type>: <short description>

<optional body — what and why, not how>
```

**Types:**
| Type | When to use |
|------|------------|
| `feat` | New command, workflow, or capability |
| `fix` | Corrects broken behavior |
| `docs` | Documentation-only changes |
| `refactor` | Restructures without changing behavior |
| `chore` | Maintenance: rename, move, clean up |
| `security` | Security-related change |
| `perf` | Performance improvement |

**Examples:**
```
feat: add offboarding workflow for Intune-enrolled devices

fix: pre-commit hook not catching email in markdown code blocks

docs: add Meraki site-to-site VPN troubleshooting section

security: tighten PII regex to catch phone numbers without dashes
```

---

## Pre-Commit Hook

Every commit triggers `scripts/pre-commit-check.js` automatically (configured in
`.git/hooks/pre-commit`). The hook runs three scans:

1. **PII scan** — blocks commits containing real email addresses or phone numbers
2. **Credential scan** — blocks commits containing hardcoded passwords, tokens, or API keys
3. **Dangerous cmdlet scan** — warns on destructive PowerShell or git operations

See [pre_commit_hooks.md](pre_commit_hooks.md) for full documentation.

### Bypassing the Hook (Only If You Know Why)

```bash
# Skip the pre-commit hook — use only for intentional false positives
git commit --no-verify -m "chore: update example with placeholder"
```

⚠️ Never use `--no-verify` to skip a BLOCK on a real credential or PII value.
Fix the issue first, then commit.

---

## Manual Safety Scan

Run the scanner without committing:

```bash
# Scan all staged files
node scripts/pre-commit-check.js

# Stage a file and scan it
git add scripts/my-script.ps1
node scripts/pre-commit-check.js
```

---

## Repository Structure Conventions

```
ITOps/
├── .claude/
│   ├── commands/          # Slash commands (one .md per command)
│   └── plugins/           # Plugin packages
│       └── enterprise-it-ops/
│           └── skills/    # Skill knowledge base
├── docs/                  # Architecture and reference docs
├── modules/               # Domain-specific knowledge modules
│   ├── automation/
│   ├── it_support/
│   ├── security/
│   └── systems/
├── scripts/               # Automation scripts (JS, PS, Python)
├── tasks/                 # Active task tracking and lessons log
├── CLAUDE.md              # Agent identity and rules (the "agent brain")
└── README.md              # Project overview
```

**File naming:**
- Commands: `kebab-case.md` (e.g., `reset-mfa.md`)
- Scripts: `kebab-case.js` / `kebab-case.ps1` / `kebab_case.py`
- Module docs: `snake_case.md` (e.g., `threat_detection.md`)
- Docs: `snake_case.md` (e.g., `security_model.md`)

---

## Adding a New Slash Command

1. Create `.claude/commands/[command-name].md`
2. Structure:

```markdown
# /command-name

**Trigger:** `/command-name` or natural language phrase

**Goal:** One sentence describing what this command does

---

## Steps

[Ordered steps...]

## Rules
- Placeholder-only
- Confirm before destructive actions
```

3. Test: in Claude Code, type `/command-name` — command should activate
4. Sanitize if needed: run `python scripts/sanitize_commands.py` to replace org values
5. Stage and commit: pre-commit hook validates automatically

---

## Script Release Checklist

Before committing a new or modified script to `main`:

```
[ ] Runs clean: test manually (WhatIf mode) against a non-production account
[ ] DryRun flag defaults to $true for bulk operations
[ ] No hardcoded credentials, UPNs, or real employee names
[ ] Plain-English comment on every non-obvious line
[ ] Pre-commit scan passes: node scripts/pre-commit-check.js
[ ] Verification step included at end of script
[ ] Listed in module README.md if new
```
