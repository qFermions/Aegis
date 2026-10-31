# progress: batch G4 (eval runner and close-out)

- **Task:** on `feat/g4-eval-and-closeout` from `main` at `1f6647c` (contains `46f84e8`, same tree). Cut-line order: A1, A2, A3, B1 to B11, A4, C1 to C4, D1 to D3.
- **Outputs:** `docs/aegis/g4/baseline/` (Phase 0 captures), `checks.md` (new table), `docs/review/batches/g3-closeout-3-checks.md` (the previous table, moved).
- **Completed:** Phase 0 on a fresh clone of `1f6647c`: `node --test` 1499/1499, the same under the socket tripwire; evals 28/28 6/6, 38/38 9/9, 65/65 13/13, 44/44 8/8; lint 108 clean; scanner 0 BLOCK; release boundary PASS; continuity STALE (exit 2); 343 runbook gate markers; CLAUDE.md 19,202 bytes.
- **Decisions:** none yet beyond the baseline.
- **Open issues:** the model deviation (Opus 5.5, owner's note) is recorded in `checks.md` V1.
- **Next action:** A1: tests first for the disguised count lines in `scripts/audit/change-record.test.js`.
</content>
</invoke>
