# CI runs on pull request #6 (batch G3)

Every run of the two workflows on `feat/g3-production-hardening`, read back with the GitHub API (`actions_list list_workflow_runs`, branch filter) on 2026-10-28. CI is `.github/workflows/ci.yml` (jobs verify, risk-tier, detect, evals); Release Gate is `.github/workflows/release-gate.yml` (tests and full-tree scan on ubuntu-latest and windows-latest). Minutes are wall time from the run's start to its last update, in UTC on 2026-10-28.

| head | CI run | CI result | CI minutes | Release Gate run | Release Gate result | Release Gate minutes |
|---|---|---|---|---|---|---|
| `8bdf5c8` | 40652758412 | success | 1.9 | 40652758546 | success | 5.0 |
| `4be5ec3` | 40653316740 | success | 2.4 | 40653316739 | success | 5.6 |
| `2b402b9` | 40656583538 | success | 2.5 | 40656583533 | success | 3.0 |
| `a7fdc36` | 40659984382 | success | 2.1 | 40659984398 | success | 4.7 |
| `96564ea` | 40661450106 | success | 1.7 | 40661450135 | failure (windows-latest: EPERM on the audit lock; fixed at ebb8cc1) | 4.8 |
| `3926810` | 40672744105 | success | 2.0 | 40672744125 | success | 5.1 |
| `ebb8cc1` | 40678862889 | success | 2.1 | 40678863108 | success | 3.8 |
| `beae153` | 40681009712 | success | 2.8 | 40681009823 | success | 5.2 |
| `f034942` | 40684735962 | success | 2.6 | 40684735782 | success | 5.3 |
| `19522d3` | 40687888589 | success | 2.6 | 40687888558 | success | 5.2 |
| `d0f2b3b` | 40692316423 | success | 2.4 | 40692316513 | success | 5.3 |

11 heads, 22 runs: 21 success, 1 failure (Release Gate at `96564ea`). Total wall minutes: CI 25.1, Release Gate 53.0. Runs at later heads are added to this file as they finish.
