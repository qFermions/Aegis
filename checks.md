# checks: batch G4 (model-judged eval runner and the close-out of PR #9's proof gaps)

Branch `feat/g4-eval-and-closeout` on qFermions/Aegis, base `main` at `1f6647c` (the merge of PR #9; it contains `46f84e8` and has the same tree, `docs/aegis/g4/baseline/clone.txt`). Evidence: `docs/aegis/g4/baseline/` (Phase 0, fresh clone of `1f6647c`) and `docs/aegis/g4/evidence/`. Verdicts: pass, fail, unresolved. The batch G3 close-out 3's table is kept at `docs/review/batches/g3-closeout-3-checks.md`.

## Baseline (Phase 0, fresh clone of 1f6647c, node v24.22.1, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone <repo> <clone>`, `git checkout --detach 1f6647c` | HEAD `1f6647c`, clean, contains `46f84e8`, trees equal; no package manifest or lockfile | `docs/aegis/g4/baseline/clone.txt` |
| tests | `node --test` | 1499 tests, 1499 pass, 0 fail, exit 0 | `docs/aegis/g4/baseline/node-test.txt:1662-1665` |
| tests under the socket tripwire | `NODE_OPTIONS="--require <clone>/scripts/adapters/socket-tripwire.js" node --test` | 1499/1499, exit 0 | `docs/aegis/g4/baseline/node-test-under-tripwire.txt:1662-1665` |
| ms eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 pairs, exit 0 | `docs/aegis/g4/baseline/ms-ticket-eval.txt` |
| gws eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 pairs, exit 0 | `docs/aegis/g4/baseline/gws-ticket-eval.txt` |
| G2 eval | `node scripts/eval/g2-ticket-eval.js` | 65/65 tickets, 13/13 pairs, exit 0 | `docs/aegis/g4/baseline/g2-ticket-eval.txt` |
| G3 eval | `node scripts/eval/g3-ticket-eval.js` | 44/44 tickets, 8/8 pairs, exit 0 | `docs/aegis/g4/baseline/g3-ticket-eval.txt` |
| lint | `node scripts/lint/command-structure.js` | 108 commands, clean, exit 0 | `docs/aegis/g4/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | `docs/aegis/g4/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 0 BLOCK, 209 WARN lines, exit 0 | `docs/aegis/g4/baseline/pre-commit-check-all.txt`, `head-checks.txt` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g4/baseline/release-boundary-check.txt` |
| head checks | `bash docs/aegis/g3/evidence/tools/head-checks.sh 1f6647c` | as above; CLAUDE.md 19,202 bytes; 578 SAFETY GATE markers in .claude, modules and docs | `docs/aegis/g4/baseline/head-checks.txt` |
| leak grep | `node docs/aegis/g3/evidence/tools/leak-grep.js 1f6647c` | 0 hits (nothing added yet) | `docs/aegis/g4/baseline/leak-grep.txt` |
| continuity | `node scripts/harness/check-continuity.js` | STALE, exit 2 (HEAD moved; a session-start gate, kept out of CI) | `docs/aegis/g4/baseline/check-continuity.txt` |
| runbook gate markers | per-runbook count of `<!-- SAFETY GATE [` and fenced `# SAFETY GATE [` lines in `.claude/commands` | 343 in all | `docs/aegis/g4/baseline/runbook-gate-markers.txt` |
| suite counts | `bash docs/aegis/g3/evidence/tools/suite-counts.sh` | every listed file passes | `docs/aegis/g4/baseline/suite-counts.txt` |

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| A1 disguised count lines | unresolved | not yet run | |
| A2 the approval door | unresolved | not yet run | |
| A3 every flag that decides what a pass means | unresolved | not yet run | |
| A4 password reset and session revocation (known limit) | unresolved | not yet run | |
| B1 case schema | unresolved | not yet run | |
| B2 case and result locations | unresolved | not yet run | |
| B3 system under test | unresolved | not yet run | |
| B4 deterministic checks | unresolved | not yet run | |
| B5 judge | unresolved | not yet run | |
| B6 report | unresolved | not yet run | |
| B7 calibration | unresolved | not yet run | |
| B8 thresholds | unresolved | not yet run | |
| B9 DEV set and tests | unresolved | not yet run | |
| B10 docs and wiring | unresolved | not yet run | |
| B11 smoke | unresolved | not yet run | |
| C owner kits | unresolved | not yet run | |
| D1 shared INCONCLUSIVE state | unresolved | not yet run | |
| D2 `Read-back:` line in every SAFETY GATE | unresolved | not yet run | |
| D3 read-backs for the 31 R2 and R3 gates | unresolved | not yet run | |
| K1 floors | unresolved | not yet run | |
| K2 no secret, personal path or real name | unresolved | not yet run | |
| K3 no em-dash | unresolved | not yet run | |
| K4 no real system, no socket in a test | unresolved | not yet run | |
| K5 dependencies and tools | unresolved | `docs/aegis/g4/baseline/dependencies.md` | |
| K6 product boundary unchanged | unresolved | not yet run | |
| K7 held-out separation | unresolved | not yet run | |
| K8 canon files current, CLAUDE.md under 20,000 bytes | unresolved | not yet run | |

## Deviations

| id | deviation | reason | evidence |
|---|---|---|---|
| V1 | The charter asks for Fable 5.1 at high; this session runs on Opus 5.5 at xhigh, and every subagent starts on Opus 5.5 at high | the owner's note during the session: keep going, do not switch models, record it here and in the report | the owner's message in this session |
