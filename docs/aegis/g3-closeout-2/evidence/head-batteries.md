# Local battery at each pushed head (batch G3 close-out 2)

Every push of `fix/g3-closeout-2` went through the push gate (`push-gate.sh <battery-dir> <commit>`, then `git push`): the full battery (`run-battery.sh`, the same commands as `head/battery-*.txt`) ran in a fresh clone at that commit, every capture had to name that commit and exit 0 (the continuity check exits 2, STALE, as at the baseline), and both `node --test` runs had to report 0 failures. Read from the session's own run folders on 2026-10-31; only the run at `2915068` is kept whole in the repository (`head/`), and `447d220` adds only the captures under `head/` and `checks.md`'s verdicts on top of it.

| head | what it carried | node --test (tests, pass, fail) | under the socket tripwire | evals, lint, replay, scanner, release boundary, head checks, suite counts | gate |
|---|---|---|---|---|---|
| `cfc798d` | F1 (gate, classes, bound read-back) | 1427, 1427, 0 | 1427, 1427, 0 | all exit 0 | PASS |
| `a98704b` | F2 and the docs | 1439, 1439, 0 | 1439, 1439, 0 | all exit 0 | PASS |
| `9966e7c` | security review 1 fixes, code review round 1 | 1443, 1443, 0 | 1443, 1443, 0 | all exit 0 | PASS |
| `6f66568` | code review round 2 | 1445, 1445, 0 | 1445, 1445, 0 | all exit 0 | PASS |
| `054f00f` | code review round 3 | 1447, 1447, 0 | 1447, 1447, 0 | all exit 0 | PASS |
| `2915068` | security review 2 record, contract and state docs | 1447, 1447, 0 | 1447, 1447, 0 | all exit 0 | PASS |
| `447d220` | head captures and checks.md verdicts | 1447, 1447, 0 | 1447, 1447, 0 | all exit 0 | PASS |
