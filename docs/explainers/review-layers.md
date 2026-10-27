# Review layers: how a change gets from a branch to main

For the owner. One page on what each file does, how a change moves, what you read at each tier, and how to undo a merge.

## The files

- `REVIEW.md` (root): what every reviewer looks for first (the advisory-only boundary, injection, fabrication, secrets), what to ignore, how to report, the three risk tiers, the three-round limit, and the rule that every incident changes the system.
- `CLAUDE.md` sections `## Harness` and `## Review`: the executor's working rules (baseline first, checks.md, progress.md, never weaken a check) and the review rules it must follow before marking a pull request ready.
- `progress.md` and `checks.md` (root): the executor's state file and its acceptance-check table (requirement, verdict, evidence, correction). A fresh session reads them first.
- `.claude/agents/evidence-reviewer.md`: a read-only agent that opens the evidence named in checks.md and returns a verdict table. It cannot edit or run anything.
- `.github/PULL_REQUEST_TEMPLATE.md`: six sections every pull request fills in. An empty section means not ready.
- `.github/risk-tiers.json` and `scripts/risk_tier.mjs`: the paths that make a change tier C or B, and the script that computes the tier from the diff. `node scripts/risk_tier.mjs main` prints `tier=C|B|A` and the paths that set it. Tests: `node --test scripts/risk_tier.test.js`.
- `.github/workflows/ci.yml`: runs the declared checks on every pull request and every push to main. Jobs: `verify` (tests, lint, scanner, release boundary), `risk-tier` (writes the tier to the run summary), `detect` and `evals` (the ticket evals and replay demo, skipped with the reason in the job name when the scripts are missing).
- `.github/CODEOWNERS`: requests your review on every pull request.
- `docs/review/incidents.md`: one row per shipped bug, boundary crossing or revert, naming the layer that should have caught it and the one change made.
- `docs/review/baseline/`: the command outputs recorded before this batch changed anything.

## How a change moves

1. The executor works on a branch (`chore/...`, `feat/...`, `fix/...`), records a baseline, commits each task on its own, and keeps checks.md and progress.md current.
2. Before marking the pull request ready it runs /security-review, then /code-review at the tier's effort, fixes each real finding in its own commit, closes the rest with a one-line reason in checks.md, then runs the evidence-reviewer on the saved outputs. Three rounds at most.
3. It opens a draft pull request with every template section filled, including the tier from the script.
4. CI runs. A red job blocks ready.
5. You read it, sized by tier (below), and merge. Agent approvals never count. A new commit after your read resets the read.

## What you read at each tier

- Tier C (CI, instruction files, `.claude/**`, security modules, memory and replay stores, tool adapters, tier routing): the whole diff, line by line, before merging.
- Tier B (agent logic, prompts, evaluation code, other modules): the pull request body and the evidence in checks.md; spot-check three rows.
- Tier A (docs and anything outside the C and B globs; a test takes its directory's tier): the pull request body, then merge.

## How to revert

Every pull request body names its revert under "How to revert". The default is one command on main: `git revert -m 1 <merge commit>` for a merge commit, or `git revert <sha>` for a squash, then push. Nothing in this repository deploys, so a revert on main is the full rollback.

## Running a branch when there is no preview

The repository has no deployment and no preview environment. To review a branch locally: check it out, make sure Node.js 24 and PowerShell 7 (`pwsh`) are on your PATH, and run the declared checks from the README ("Run the evidence"), starting with `node --test`. The ticket evals and lint print their counts; compare them with the Testing section of the pull request.
