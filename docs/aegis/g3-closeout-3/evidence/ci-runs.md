# CI and Release Gate on each pushed head (batch G3 close-out 3)

Read from GitHub Actions (`list_workflow_runs`, branch `fix/g3-closeout-3`) on 2026-10-31. Minutes are wall clock from each run's creation to its last update. Every run concluded `success`; none was re-run.

| head | CI (`ci.yml`) | Release Gate (`release-gate.yml`) |
|---|---|---|
| `7a0048c` | success, 2m16s | success, 4m54s |
| `41807ae` | success, 1m53s | success, 5m37s |
| `f9daf80` | success, 2m40s | success, 5m52s |
| `f246aac` | success, 2m19s | success, 4m56s |
| `77b74fd` | success, 2m23s | success, 3m24s |
| `83a512e` | success, 2m11s | success, 5m16s |
| `d07d166` | success, 2m43s | success, 4m18s |
| `eb22556` | success, 2m33s | success, 5m46s |
| `d97282d` | success, 2m16s | success, 5m43s |
| `1981e03` | success, 2m22s | success, 5m51s |
| `6bc59da` | success, 2m32s | success, 5m57s |
| `fb22339` | success, 2m42s | success, 5m55s |
| total | 12 runs, 28m50s | 12 runs, 63m29s |

The head after `fb22339` (the captures, the verdicts and the evidence review's corrections) is pushed after its battery; its runs are in PR #9's checks.
