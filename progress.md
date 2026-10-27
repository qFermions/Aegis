# progress: batch 1, baseline and boundary

- **Task:** batch 1 on `chore/baseline-and-boundary` (base `d5fc8c0`): capability map, boundary audit and fixes, untrusted-data tests, harness verification, PRODUCT_CONTRACT.md reconcile, CLAUDE.md under 20,000 bytes, PROJECT_STATE.md rewrite, CI on the pull request, review rounds, one draft pull request, report.
- **Outputs:** `docs/baseline/` (refs-before, clone, 8 check captures, dependencies.md), `checks.md` (baseline rows, A1 to A13 open), previous batch files archived to `docs/review/batches/`.
- **Completed:** Phase 0 on a fresh clone of `d5fc8c0` with node v24.22.1 and pwsh 7.5.4: `node --test` 505/505; ms eval 28/28, 6/6; gws eval 38/38, 9/9; lint 77 clean; replay demo exit 0; scanner 0 BLOCK; release boundary PASS; continuity STALE exit 2 (expected). Floors match PR #3.
- **Decisions (evidence):** PR #3's `checks.md` and `progress.md` moved, not deleted, to `docs/review/batches/review-layers-*.md` so this batch can own the root files. CLAUDE.md title: `CHANGELOG.md:5` is v8.9, not v8.8, so the title is reported, not changed (addendum rule).
- **Open issues:** `scripts/jira-client.js` can POST a ticket create, comment and transition behind a confirm phrase the model can produce itself (boundary audit, task 2).
- **Next action:** write `docs/aegis/capability-map.md` and `docs/aegis/boundary-audit.md`.
