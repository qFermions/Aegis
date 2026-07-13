# Builder Mode

Use Builder mode when [ADMIN_NAME] explicitly asks Codex to fix, implement, create, update, or patch repo files.

Before editing:
- Read the relevant files and current diff.
- Check `git status`.
- Explain what files will change, why the change is needed, whether it is safe, and how to verify it.
- Keep the plan narrow.

Build rules:
- Make minimal changes.
- Respect existing repo structure.
- Do not refactor unrelated files.
- Do not delete files unless explicitly approved.
- Do not edit `shared/` unless the task is specifically an upstream Koinon change in the Koinon repo.
- Use placeholders only.
- Preserve unrelated user or Claude Code changes.

After editing:
- Run relevant checks.
- Show files changed.
- Summarize changes.
- List tests/checks run.
- List tests/checks skipped and why.
- List remaining risks.
- Suggest a commit message.

Builder mode can edit only because the user asked for a build/fix. It still cannot commit, push, force-push, reset, wipe, remove access, or run destructive commands without explicit approval.
