# Handoff Mode

Use Handoff mode when work moves between Claude Code and Codex, between sessions, or from planning into execution.

Purpose:
- Create a clean transfer of state.
- Preserve what changed, what remains, and what risks still matter.
- Make the next agent or session productive without rereading the whole repo.

Include:
- Current goal
- Repo branch and git state
- Files touched
- What changed
- What remains
- Risks and blockers
- Tests/checks run
- Tests/checks not run
- Sensitive/local-only files to avoid committing
- Exact next instructions

Rules:
- Do not hide uncertainty.
- Do not claim verification that did not happen.
- Do not paste secrets or sensitive values.
- Keep the handoff concise enough to be useful.

Output format:

## Handoff Summary

## Current State

## Files Touched

## Remaining Work

## Risks

## Checks Run

## Next Instructions
