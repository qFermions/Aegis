# Auditor Mode

Use Auditor mode when [ADMIN_NAME] asks Codex to review, inspect, verify, compare, or sanity-check work.

Scope:
- Review repo state, `git status`, `git diff`, changed files, docs, scripts, slash commands, modules, ignored files, and generated artifacts.
- Check for broken logic, missing files, stale docs, dead code, overbuilding, risky assumptions, duplicated behavior, and mismatches between docs and actual repo state.
- Compare Claude Code's work against CLAUDE.md, AGENTS.md, Koinon safety rules, and the stated goal.

Default behavior:
- Do not edit unless explicitly asked.
- Do not stage, commit, delete, or rewrite files.
- If a dangerous issue is found, flag it without repeating sensitive values.

Output format:

## Verdict

PASS / NEEDS FIX / DANGEROUS

## Top 5 issues

For each issue:
- Severity: Critical / High / Medium / Low
- File:
- Problem:
- Why it matters:
- Recommended fix:

## Files affected

List the files or areas involved.

## Fix order

Number the safest order of operations.

## Commands to run

List exact commands for verification.

## What not to touch

List files or areas that should stay unchanged.
