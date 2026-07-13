---
name: hermes-bridge-powershell
description: Reusable PowerShell/SSH templates for the read-only Hermes bridge and post-breach repo hygiene — read-only remote pull, latest-file scp, secret-scan one-liners, sanitization gate. Plain-English comments per line.
---

# Skill: hermes-bridge-powershell

**Trigger:** `/hermes-bridge-powershell` or "give me the SSH pull snippet", "scan the repo for secrets", "sanitization check" — when you need a vetted, read-only PowerShell/SSH template instead of writing one from scratch.

**Goal:** Hand the operator copy-paste-safe, **read-only** templates with a plain-English comment on every line, following CLAUDE.md PowerShell rules (collapsed `<details>`, no aliases, ⚠️ flag anything destructive).

> Maps to the PowerShell family. These are the reusable patterns templated out of the v8 build session.

---

## ⚠️ Safety note
Every template here is **read-only / additive**. None mutate Hermes, none read credential files, none rewrite git history. If you adapt one into something destructive, re-run the Script Safety Auto-Scan (CLAUDE.md) and add a ⚠️ block.

## Template 1 — Read-only remote command (ssh-agent auth)
```powershell
# Run a read-only command on Hermes; auth via the already-loaded ssh-agent key (never read the key file)
ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] "whoami; uptime"   # prove reachable + authed
```

## Template 2 — Pull the newest matching file off Hermes (no write-back)
```powershell
# 1) ask Hermes for the newest file path matching a glob (read-only 'ls')
$latest = ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] `
  "ls -t '[HERMES_DELIVERY_DIR]'/war_room_v30_*.html | head -1"   # newest first, take one
# 2) copy that single file down (scp = one-way read pull; nothing written to Hermes)
$dest = Join-Path $env:TEMP ("hermes_" + (Get-Date -Format yyyyMMdd_HHmmss) + ".html")
scp [HERMES_SSH_USER]@[HERMES_HOST]:"$latest" $dest   # pull only
Start-Process $dest   # open locally
```

## Template 3 — Secret scan across FULL git history (gitleaks-equivalent, read-only)
```powershell
# Search every commit tree (not just HEAD) for secret patterns; prints commit:file:line.
# Run from a git-bash shell for the $(...) expansion.
# This example uses publicly-documented prefixes that are safe to keep in a sanitized repo;
# ADD your fine-grained-PAT and LLM-API-key prefixes from your PRIVATE security config (don't commit those literals).
git grep -nIE '(ghp_|gho_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' $(git rev-list --all)
# Find which commit introduced/removed a specific token (pickaxe)
git log --all --oneline -S'<token-prefix>'
```
> ⚠️ This is a **read-only** scan. Do NOT rewrite history to remediate without an explicit operator decision — revoke + rotate the credential first; history purge (filter-repo/BFG) is a separate, deliberate step.

## Template 4 — Sanitization gate before committing handoff/integration content
```powershell
# Must return NOTHING. Any line printed = a leak to fix before you commit.
# Fill the bracketed terms from your peer internals + the secret-prefix ruleset in your PRIVATE config.
$forbidden = '<peer_home>/\.<agent>/|/opt/<agent>|<PEER_IP>|<peer_user>@<peer>|<peer_hostname>|<llm_key_prefixes>|<vcs_token_prefixes>'
Select-String -Path .\path\to\files\* -Pattern $forbidden   # PowerShell-native grep
# (git-bash equivalent: grep -nE "$forbidden" files...)
```

## Template 5 — Force Entra Connect sync (kept for IT-ops parity; run on AD Connect server)
```powershell
Start-ADSyncSyncCycle -PolicyType Delta   # Delta = sync only changes (fast); Initial = full (slow, rare)
```

## Notes
- Hermes host/paths stay as `[HERMES_*]` placeholders — resolved at runtime via `~/.ssh/config`.
- For passphrase-encrypted keys: rely on the ssh-agent; do **not** use `-o IdentitiesOnly=yes` (it bypasses the agent). See `/ask-hermes` for the canonical bridge.
- All of these are reference snippets — explain each line to the operator when presenting (PowerShell-learning context).
