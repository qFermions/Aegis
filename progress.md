# progress: batch review-layers

- **Task:** give Aegis the review layers (harness, REVIEW.md, PR template, risk tiers, CI, CODEOWNERS, incidents, explainer) on branch `chore/review-layers`, exercised by its own draft pull request.
- **Outputs:** `CLAUDE.md` (`## Harness`, `## Review`), `progress.md`, `checks.md`, `.claude/agents/evidence-reviewer.md`, `REVIEW.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.github/risk-tiers.json`, `scripts/risk_tier.mjs`, `scripts/risk_tier.test.js`, `.github/workflows/ci.yml`, `.nvmrc`, `docs/review/incidents.md`, `docs/review/baseline/`, `docs/explainers/review-layers.md`, `EVALUATE.md` (pwsh prerequisite).
- **Completed:** Phase 0 baseline on a fresh clone at e7c445c (node 24.22.1): 7 of 8 declared checks pass; `node --test` 450/491 without pwsh, 491/491 with pwsh; continuity STALE as expected. Phase 0b harness written. Tasks 1 to 9 written; risk tier tests 9/9; ci.yml parses and passes actionlint.
- **Decisions (evidence):** pwsh is an undeclared prerequisite (`docs/review/baseline/dependencies.md`); declared in EVALUATE.md, test file unchanged. `check-continuity` is a session-start gate, not a release check (not in EVALUATE Part A), so it is recorded but not put in CI. `release-gate.yml` kept (deleting a file I did not create is a one-way door); ci.yml adds the rest of the battery.
- **Open issues:** review rounds, evidence-reviewer run, push, draft PR, CI run (R6b), refs-after (R11).
- **Next action:** commit each task, run the full battery on the branch, then /security-review and /code-review xhigh.
