# CI and Release Gate runs on `fix/g3-closeout` (PR #7)

Source: the GitHub Actions API (`list_workflow_runs` for branch `fix/g3-closeout`, and `get_check_runs` and job logs for PR #7), read on 2026-10-30 at 09:41 UTC. One row per pushed head; minutes are from the run's start to its last update. "CI" is `.github/workflows/ci.yml` (jobs detect, risk-tier, verify, evals); "Release Gate" is `.github/workflows/release-gate.yml` (job "Tests and full-tree scan" on ubuntu-latest and windows-latest).

| head | CI run, result, minutes | Release Gate run, result, minutes | failed job and cause |
|---|---|---|---|
| `793bb2a` | 41019007399, success, 2.1 | 41019007418, success, 5.2 | none |
| `3bba35e` | 41022593815, success, 1.9 | 41022593814, failure, 5.4 | windows-latest (job 123953125461, log read): `env-example.test.js` "a name removed from .env.example is reported by name", backslash paths |
| `f6fd359` | 41024493778, success, 3.0 | 41024494014, failure, 3.8 | windows-latest (job 123959265282): failure notice only, log not read; the same test fails at the heads on both sides of it |
| `64bf95c` | 41026070048, failure, 1.6 | 41026070052, failure, 5.3 | verify (job 123964369416), ubuntu-latest (123964369134) and windows-latest (123964369017). The verify job's log (read) fails `command-safety-gates` on "a comment in a gated fence may not contain backticks, $, ...", the comment from `74f581d` (fixed in `f8763ed`); the two Release Gate logs were not read |
| `f9c6a99` | 41029090017, success, 1.8 | 41029090023, failure, 3.5 | windows-latest (job 123974215667, log read): `env-example.test.js`, backslash paths (fixed in `c499e9d`) |
| `c499e9d` | 41031984800, success, 2.5 | 41031984533, success, 3.2 | none |
| `2ba52bc` | 41033171739, success, 2.6 | 41033171800, success, 4.5 | none (jobs: detect, risk-tier, verify, evals; ubuntu-latest 1.6, windows-latest 4.5) |
| `420188e` | 41035089168, running at the read | 41035089459, running at the read | |
