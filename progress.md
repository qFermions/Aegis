# progress: batch G3 close-out 3 (owner decisions on PR #8's eight items)

- **Task:** on `fix/g3-closeout-3` from `main` at `0a5feb7` (contains `52441fb`), one draft PR. Cut-line order: H1 (record the flags that change what a read-back's pass means, such as `--absent`, and count only a read-back whose flags match the change), H2 (the approval covers `--expected N`), H3 (`msgraph-client.js verify-sessions-revoked` and `verify-method-absent`, bound in `/mfa-issue`), H4 (an R class on every SAFETY GATE, with a test), H5 (`/mfa-issue`'s re-register list starts at step 1). Items 1, 2, 3 and 7 of PR #8: answered by the owner, no work.
- **Outputs so far:** `docs/aegis/g3-closeout-3/baseline/` (Phase 0), `docs/aegis/g3-closeout-3/refs-before.txt`, a new `checks.md` (the close-out 2 table moved to `docs/review/batches/g3-closeout-2-checks.md`).
- **Completed:** Phase 0 on a fresh clone of `0a5feb7`: 1447/1447 (also under the socket tripwire), evals unchanged, lint 108 clean, scanner 0 BLOCK and 209 WARN, release boundary PASS, 343 runbook gate markers, 58 gates without an R class in 15 runbooks.
- **Decisions:** none yet.
- **Open issues:** none yet.
- **Next action:** H1 tests first: per read-back command with a pass-changing flag, a removal change is not done by a read without `--absent` and is done by one with it, and an add change is not done by an `--absent` read.
