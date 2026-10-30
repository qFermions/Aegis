# Local battery at each head (batch G3 close-out)

The `node --test` totals of the full battery (`run-battery.sh`, the same commands as `head/battery-*.txt`) at each head it ran on, in a fresh clone, read from the session's own run folders on 2026-10-30. Only the run at `2ba52bc` is kept whole in the repository (`head/`); the others are summarized here. From `d5cffe9` to `c499e9d` each total includes `scripts/audit/test-trail.js`, which `node --test` loaded as a test file with no tests (renamed in `2ba52bc`). "Pushed" means the head was the tip of a push.

| head | pushed | node --test (tests, pass, fail) | under the socket tripwire |
|---|---|---|---|
| `4a7a66a` | no | 1305, 1305, 0 | 1305, 1305, 0 |
| `793bb2a` | yes | 1325, 1325, 0 | 1325, 1325, 0 |
| `3ebb352` | no | 1367, 1367, 0 | 1367, 1367, 0 |
| `3a77057` | no | 1371, 1371, 0 | 1371, 1371, 0 |
| `3bba35e` | yes | 1389, 1389, 0 | 1389, 1389, 0 |
| `f6fd359` | yes | 1405, 1405, 0 | 1405, 1405, 0 |
| `64bf95c` | yes | 1419, 1418, 1 | 1419, 1418, 1 |
| `f9c6a99` | yes | 1422, 1422, 0 | 1422, 1422, 0 |
| `c499e9d` | yes | 1422, 1422, 0 | 1422, 1422, 0 |
| `2ba52bc` | yes | 1422, 1422, 0 | 1422, 1422, 0 |
| `420188e` | yes | 1422, 1422, 0 | 1422, 1422, 0 |

At `64bf95c` the one failure is `command-safety-gates` (the gated-fence comment fixed in `f8763ed`); that head was pushed anyway, a deviation recorded in `checks.md`.
