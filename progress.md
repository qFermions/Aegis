# progress: batch G3, production hardening of the Tier 1 help desk (advisory mode)

- **Task:** batch G3 on `feat/g3-production-hardening` (base `main` at `f185071`): readiness gate, G2 close-out, guardrails (scope manifest, audit trail, change records), one intake, G3 corpus, failure handling, GitHub, Okta and Microsoft Graph read connectors, endpoint sync reads, operator errors, telemetry, latency budget, boundary audit, reviews, draft pull request.
- **Outputs:** `docs/aegis/g3/baseline/` (Phase 0 captures, `dependencies.md`); `checks.md` (new; the G2 table moved to `docs/review/batches/g2-checks.md`).
- **Completed:** Phase 0. Node v24.22.1 and PowerShell 7.6.9 installed (MIT, `dependencies.md`). Battery on a fresh clone of `f185071`: `node --test` 1045/1045; ms 28/28 6/6; gws 38/38 9/9; G2 63/63 12/12; lint 102 clean; scanner 486 files 0 BLOCK 197 WARN; release boundary PASS; replay demo 17 steps; continuity STALE exit 2 (session-start gate).
- **Decisions (evidence):** the baseline clone sits outside the system temporary folder, because a clone under it fails one Linear note-guard test (`docs/aegis/g3/baseline/node-test-clone-under-tmp.txt`); the guard itself is a bug to fix in this batch. PR #5's body has no report sections 8 to 10; the G2 leftovers are taken from `docs/aegis/g2/evidence/code-review-rounds.md`, `security-review-2.md` and the G2 `progress.md` open issues.
- **Open issues:** none yet.
- **Next action:** task 2, G2 close-out, test first.
