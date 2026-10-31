# Local battery at each pushed head (batch G3 close-out 3)

Every push of `fix/g3-closeout-3` went through the push gate (`push-gate.sh <battery-dir> <commit>`, then `git push`): the full battery (`run-battery.sh`, the same commands as `head/battery-*.txt`) ran in a fresh clone at that commit, every capture had to name that commit and exit 0 (the continuity check exits 2, STALE, as at the baseline), and both `node --test` runs had to report 0 failures. Read from the session's own run folders on 2026-10-31; only the run at `fb22339` is kept whole in the repository (`head/`). One battery, at `a48396c` (docs only), was stopped before its end, and `a48396c` went up with `fb22339`'s gate.

| head | what it carried | node --test (tests, pass, fail) | under the socket tripwire | evals, lint, replay, scanner, release boundary, head checks, suite counts | gate |
|---|---|---|---|---|---|
| `7a0048c` | H1 | 1463, 1463, 0 | 1463, 1463, 0 | all exit 0 | PASS |
| `41807ae` | H2 | 1466, 1466, 0 | 1466, 1466, 0 | all exit 0 | PASS |
| `f9daf80` | H3 | 1469, 1469, 0 | 1469, 1469, 0 | all exit 0 | PASS |
| `f246aac` | H4 and H5 | 1473, 1473, 0 | 1473, 1473, 0 | all exit 0 | PASS |
| `77b74fd` | the batch docs | 1473, 1473, 0 | 1473, 1473, 0 | all exit 0 | PASS |
| `83a512e` | deviations D1 to D6, gate-field-lines.js | 1473, 1473, 0 | 1473, 1473, 0 | all exit 0 | PASS |
| `d07d166` | security review 1 fixes and record | 1476, 1476, 0 | 1476, 1476, 0 | all exit 0 | PASS |
| `eb22556` | code review round 1, findings 1, 5 and 3 | 1479, 1479, 0 | 1479, 1479, 0 | all exit 0 | PASS |
| `d97282d` | code review round 1, the rest | 1484, 1484, 0 | 1484, 1484, 0 | all exit 0 | PASS |
| `1981e03` | round 1 record, code review round 2 | 1493, 1493, 0 | 1493, 1493, 0 | all exit 0 | PASS |
| `6bc59da` | round 2 record, code review round 3 | 1499, 1499, 0 | 1499, 1499, 0 | all exit 0 | PASS |
| `fb22339` | code review round 3 record, docs, security review 2 record (`a48396c` with it) | 1499, 1499, 0 | 1499, 1499, 0 | all exit 0 | PASS |
