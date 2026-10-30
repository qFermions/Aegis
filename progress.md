# progress: batch G3 close-out (owner decisions 1, 2, 3 and 5 from PR #6)

- **Task:** on `fix/g3-closeout` from `main` at `01dcb37`, land four owner decisions test first: (2) a verify-* dry run exits 4 in every connector; (3) GitHub rate-limit 403s stop reading as permission refusals; (1) bind each read-back to its change when it is recorded; (5) the connector variables in `.env.example`. Order and cut line: 2, 3, 1, 4.
- **Outputs:** `docs/aegis/g3-closeout/baseline/` (Phase 0 captures, clone, tools); `docs/aegis/g3-closeout/refs-before.txt`; `checks.md` (new, baseline rows); `docs/review/batches/g3-checks.md` (the G3 table, moved).
- **Completed:** Phase 0 on a fresh clone of `01dcb37`: `node --test` 1294/1294 (also under the socket tripwire); evals 28/28 6/6, 38/38 9/9, 65/65 13/13, 44/44 8/8; lint 108 clean; gates 474/474; scanner 0 BLOCK, 207 WARN; release boundary PASS; CLAUDE.md 19,202 bytes; continuity STALE, exit 2 (expected when HEAD moves).
- **Decisions:** the clone is a local clone of the fetched checkout (same objects as `origin/main`), outside the system temporary folder (a clone under it fails 1 Linear test, `docs/aegis/g3/baseline/node-test-clone-under-tmp.txt`).
- **Open issues:** none yet.
- **Next action:** task 2: commit the red tests (owner decision 2), then the shared `EXIT.VERIFY_DRY_RUN` in all nine connectors.
