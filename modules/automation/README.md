# Automation Module

PowerShell patterns, safety guardrails, and CI/CD tooling for IT operations automation.

## Contents

| File | Purpose |
|------|---------|
| [powershell/examples.md](powershell/examples.md) | Reusable PS scripts for M365, Intune, and AD operations |
| [powershell/safety_patterns.md](powershell/safety_patterns.md) | Defensive coding patterns, WhatIf, dry-run, rollback |
| [cicd.md](cicd.md) | Git workflow, branch strategy, and automation pipeline for this repo |
| [pre_commit_hooks.md](pre_commit_hooks.md) | How the pre-commit safety scanner works and how to extend it |
| [scripts/deploy-check.js](scripts/deploy-check.js) | Pre-deployment checklist validator — reads checklist.json, validates conditions |
| [scripts/checklist.json](scripts/checklist.json) | Sample deployment checklist with file, command, and env var checks |

## Design Principles

**Automation in IT ops is high-stakes.** A script that iterates over [@Aegion_SIZE] users and
removes licenses, disables accounts, or modifies group membership can cause irreversible
damage in seconds if written carelessly. These principles govern every script in this repo:

1. **WhatIf first** — any script that modifies more than one object must support `-WhatIf`
   to show what it *would* do before it does anything. Run WhatIf, review the output,
   then run for real.

2. **Dry run by default** — scripts that affect >10 objects default to `$DryRun = $true`.
   The operator must explicitly set `$DryRun = $false` to execute.

3. **Audit trail** — every bulk operation logs to a timestamped file before and after.
   If something goes wrong, there is a record of what changed.

4. **Rollback plan** — scripts that delete or disable export a rollback script before
   executing. If the operation needs to be reversed, the rollback script re-enables
   or re-assigns exactly what was changed.

5. **Pre-commit scanning** — the pre-commit hook catches PII, credentials, and dangerous
   cmdlets before they reach the repo. See [pre_commit_hooks.md](pre_commit_hooks.md).

## Quick Reference — Modules Required

| Task | Module | Install |
|------|--------|---------|
| Entra, Intune, M365 users | Microsoft.Graph | `Install-Module Microsoft.Graph -Scope CurrentUser` |
| Exchange mailboxes, mail flow | ExchangeOnlineManagement | `Install-Module ExchangeOnlineManagement -Scope CurrentUser` |
| On-prem Active Directory | ActiveDirectory (RSAT) | Windows feature, not a PS module |
| AD Connect | ADSync | Pre-installed on AD Connect server |
