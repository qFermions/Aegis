# B11 smoke: not run

Checked on 2026-11-01 in the batch G4 session, read-only (file presence and environment variable names; no value was read or printed):

- The `claude` CLI is present: Claude Code 2.1.316 (`claude --version`).
- It is not signed in with a stored login: the CLI's config folder holds no credentials file. This cloud session reaches the model through its host, not through a login of its own.
- The runner removes every environment name ending in `_TOKEN`, `_KEY`, `_SECRET` or `_PASSWORD` from both children, by design (task B3). A nested `claude -p` started here would also inherit the hosting session's own session variables, which the runner does not remove.

So the condition the charter sets for the smoke ("present in this session and already signed in") does not hold, and the real backends were not run on any case. No model call was made by this batch. The cost figure for the first real run stays the one in `docs/evidence/runtime-smoke.md` (about 2.50 US dollars at list price for one Aegis session); the judge's cost is unmeasured.

What was run instead: the runner end to end on the 8 DEV cases with the fake CLI (`scripts/eval/judged/cli.test.js`, 7 tests), and the dry run on a copy of the DEV set outside the repository (exit 4; CI runs the same dry run).
