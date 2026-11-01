# progress: batch G4 (eval runner and close-out)

- **Task:** on `feat/g4-eval-and-closeout` from `main` at `1f6647c` (contains `46f84e8`, same tree). Cut-line order: A1, A2, A3, B1 to B11, A4, C1 to C4, D1 to D3.
- **Outputs:** `scripts/audit/change-record.js`, `audit-log.js` and their READMEs (A1 to A3); `scripts/adapters/verify-flags.js` (A3); nine runbooks (A3), `/mfa-issue`, `/password-reset`, `msgraph-client.js` and vendor fact M-28 (A4); `scripts/eval/judged-eval.js`, `scripts/eval/judged/` with `dev-cases.jsonl` (B); `scripts/eval/README.md` 2d, readiness row 9, capability row 26, `.github/workflows/ci.yml` (B10); `docs/aegis/owner/` and `scripts/eval/vendor-facts-priority.js` (C); `docs/explainers/g4-eval-and-closeout.md`; canon updates; `docs/aegis/g4/baseline/` and `evidence/`.
- **Completed:** Phase 0 (1499/1499); A1, A2, A3 (with the runbook guidance), B1 to B10, A4, C1 to C4, each test first; B11 skipped (no stored CLI login, `b11-smoke.md`); battery at `078a467` (1519/1519, pushed); battery at `86c54ec` failed 2 safety-gate tests on the README's `cp` line, fixed in `9dbdf32`.
- **Decisions:** A2 removes the CLI writer (one writer, no drifting copy); A3 declares flags in one pure-data module, a time bound is named bare and checked against the approval's time, `--factor-type` stays not a pass flag; D1 to D3 not reached (conditional on room; the review rounds come first).
- **Open issues:** deviations V1 (model), V2 to V5 in `checks.md`; owner decisions listed for the PR body.
- **Next action:** the battery on the head, push, then `/security-review` on the branch.
</content>
</invoke>
