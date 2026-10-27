# checks: batch 1, baseline and boundary

Branch `chore/baseline-and-boundary` on qFermions/Aegis, base `main` at `d5fc8c0` (the merge of PR #3). Evidence files: `docs/baseline/` (Phase 0, fresh clone) and `docs/baseline/branch/` (the battery on the branch). Verdicts: pass, fail, unresolved. The previous batch's table is kept at `docs/review/batches/review-layers-checks.md`.

## Baseline (Phase 0, fresh clone of d5fc8c0, node v24.22.1, pwsh 7.5.4)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone --depth 1 https://github.com/qFermions/Aegis /tmp/fresh` | exit 0, HEAD `d5fc8c0`; no `package.json`, no lockfile, nothing to install | `docs/baseline/clone.txt` |
| tests | `node --test` | 505 tests, 505 pass, 0 fail, exit 0 | `docs/baseline/node-test.txt` (tail) |
| Microsoft eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs, exit 0 | `docs/baseline/ms-ticket-eval.txt` |
| Google eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs, exit 0 | `docs/baseline/gws-ticket-eval.txt` |
| structure lint | `node scripts/lint/command-structure.js` | 77 commands, clean, exit 0 | `docs/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 276 files, 0 BLOCK, 170 WARN, exit 0 | `docs/baseline/pre-commit-check-all.txt` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/baseline/release-boundary-check.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE, exit 2 (snapshot HEAD `b9acd99`, live `d5fc8c0`) | `docs/baseline/check-continuity.txt` |

Floors from PR #3's head match on every row: 505 tests, 28/28 and 6/6, 38/38 and 9/9, 77 clean, 0 BLOCK, PASS. No gap.

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| A1 capability map rows carry evidence | unresolved | not yet run | |
| A2 boundary audit: no gate "none" left | unresolved | not yet run | |
| A3 three untrusted-data tests, expected decision first | unresolved | not yet run | |
| A4 harness and review layers present | unresolved | not yet run | |
| A5 PRODUCT_CONTRACT.md changes readable line by line | unresolved | not yet run | |
| A5b CLAUDE.md under 20000 bytes, moves traceable | unresolved | not yet run | |
| A6 PROJECT_STATE.md verified claims point to this session | unresolved | not yet run | |
| A7 CI and Release Gate green on the pull request | unresolved | not yet run | |
| A8 no finding open; refs unchanged | unresolved | not yet run | |
| A9 baseline floors hold | unresolved | not yet run | |
| A10 no secret, token, personal path or private email in the diff | unresolved | not yet run | |
| A11 no em-dash in files this batch wrote | unresolved | not yet run | |
| A12 dependencies and tools added | unresolved | not yet run | |
| A13 no real tenant, device, ticket system, scheduler, mailbox or payment call | unresolved | not yet run | |
