# progress: batch G2, Google Workspace, Fleet, Jamf, Slack and Linear

- **Task:** lane G2 on `feat/g2-gws-fleet-jamf-slack-linear`, stacked on draft PR #4 (`3592bd1`): lane spec, corpus first, a shared read-only adapter contract, five platform increments (Fleet, Linear, Slack, Jamf, Google Workspace), the Google Workspace posture audit, boundary audit and tiers, state docs, review rounds, one draft pull request.
- **Outputs:** `docs/aegis/g2/refs-before.txt`, `docs/aegis/g2/baseline/` (Phase 0 captures, `dependencies.md`), `checks.md` (new), `docs/review/batches/batch1-checks.md` and `batch1-progress.md` (moved).
- **Completed:** Phase 0 on a fresh clone of `3592bd1`: 588/588 tests, ms 28/28 and 6/6, gws 38/38 and 9/9, lint 77 clean, scanner 0 BLOCK 170 WARN, boundary PASS, continuity STALE (exit 2, expected).
- **Decisions (evidence):** stacked on #4 because `git merge-base --is-ancestor 3592bd1 origin/main` exits 1 (`docs/aegis/g2/refs-before.txt` shows `main` at `d5fc8c0`). PowerShell 7.6.9 came from the Microsoft apt repository because the GitHub release download returned HTTP 403 (`docs/aegis/g2/baseline/dependencies.md`).
- **Open issues:** none yet.
- **Next action:** vendor documentation research for the five platforms, then the lane spec (task 1).
