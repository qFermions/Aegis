# checks: batch G3 close-out 2 (owner decisions on PR #7's three open items)

Branch `fix/g3-closeout-2` on qFermions/Aegis, base `main` at `f086c88` (the merge of PR #7; `git merge-base --is-ancestor 02cc3ac f086c88` holds, `docs/aegis/g3-closeout-2/baseline/clone.txt`). Evidence: `docs/aegis/g3-closeout-2/baseline/` (Phase 0, fresh clone of `f086c88`) and `docs/aegis/g3-closeout-2/evidence/`. Verdicts: pass, fail, unresolved. The batch G3 close-out's table is kept at `docs/review/batches/g3-closeout-checks.md`. Owner decision 3 (object-level binding with a keyed digest) is "not now": nothing is built for it; PR #7's write-up is the record.

## Baseline (Phase 0, fresh clone of f086c88, node v24.22.2, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone <repo> <clone>`, `git checkout --detach f086c88` | HEAD `f086c88`, clean, contains `02cc3ac`; no package manifest or lockfile | `docs/aegis/g3-closeout-2/baseline/clone.txt` |
| tests | `node --test` | 1422 tests, 1422 pass, 0 fail, exit 0 | `docs/aegis/g3-closeout-2/baseline/node-test.txt` |
| own-harness suites | same run | deploy-check 21 passed (`:25`), health-check 19 passed (`:47`), graph 33/33 (`:1072`), memory 14/14 (`:1276`), replay 16/16 (`:1390`) | `docs/aegis/g3-closeout-2/baseline/node-test.txt` |
| tests under the socket tripwire | `bash -c NODE_OPTIONS="--require <clone>/scripts/adapters/socket-tripwire.js" node --test` | 1422/1422, exit 0 | `docs/aegis/g3-closeout-2/baseline/node-test-under-tripwire.txt` |
| evals | the four ticket evals | Microsoft 28/28 and 6/6, Google 38/38 and 9/9, G2 65/65 and 13/13, G3 44/44 and 8/8, each exit 0 | `docs/aegis/g3-closeout-2/baseline/*-ticket-eval.txt`, `head-checks.txt` |
| structure lint | `node scripts/lint/command-structure.js` | 108 commands, clean, exit 0 | `docs/aegis/g3-closeout-2/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | `docs/aegis/g3-closeout-2/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 0 BLOCK, 207 WARN, exit 0 | `docs/aegis/g3-closeout-2/baseline/head-checks.txt` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g3-closeout-2/baseline/release-boundary-check.txt` |
| head checks | `bash docs/aegis/g3/evidence/tools/head-checks.sh f086c88` | CLAUDE.md 19202 bytes; SAFETY GATE markers in .claude, modules and docs 501 | `docs/aegis/g3-closeout-2/baseline/head-checks.txt` |
| runbook gate markers | per-runbook count of `<!-- SAFETY GATE [` and fenced `# SAFETY GATE [` lines in `.claude/commands` | 342 in all; `mfa-issue.md` 3 | `docs/aegis/g3-closeout-2/baseline/runbook-gate-markers.txt` |
| safety gates and the G3 suites | `bash docs/aegis/g3/evidence/tools/suite-counts.sh` | command-safety-gates 474/474; change-record 17/17; jira-client 68/68; every listed suite passing | `docs/aegis/g3-closeout-2/baseline/suite-counts.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE (snapshot `b9acd99`), exit 2, as at every head of the previous batch | `docs/aegis/g3-closeout-2/baseline/check-continuity.txt` |
| tools | `node --version`, `pwsh --version` | v24.22.2, 7.6.9; nothing added to the repository | `docs/aegis/g3-closeout-2/baseline/dependencies.md` |

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| F1 `/mfa-issue`: Require re-register MFA gated R3, every gate classed, `verify-mfa-cleared` bound; no R2 or R3 read-back left unbound in any runbook (E1 passes); lint clean; runbook SAFETY GATE count rises by exactly the gates added and no file's count falls; inventory: every added entry gated, 0 moved to ungated | unresolved | not run yet | |
| F2 a counted batch change is done only when every object is proven: `open --expected N`; `status` "verified k of N", failed read-backs listed, partial below N; distinct run ids where the command takes one; a gate without a count as today | unresolved | not run yet | |
| E5 floors | unresolved | not run yet | |
| E6 no secret, token, personal path, real name, internal hostname or private email | unresolved | not run yet | |
| E7 no em-dash in any file or added line this batch wrote | unresolved | not run yet | |
| E8 no real system, no socket in tests | unresolved | not run yet | |
| E9 dependencies and tools added | unresolved | not run yet | |
| E10 product boundary unchanged | unresolved | not run yet | |
| E11 CLAUDE.md size, contract, state and progress files | unresolved | not run yet | |

## Review rounds

- `/security-review` 1 over `f086c88..a98704b`: no findings; one candidate filtered out at confidence 2, whose correctness gap was fixed (the run id is a UUID Fleet answered for: `88cdd51` red, `0c5e02b` green); 14 rejected candidates in `docs/aegis/g3-closeout-2/evidence/security-review-1.md`.
- `/code-review xhigh` (tier C), round 1 over `f086c88..09f9743`: 15 found, 12 fixed, 2 closed, 1 fixed in part and closed in part (`docs/aegis/g3-closeout-2/evidence/code-review-rounds.md`).
  - Closed, finding 3 (an Okta remove change counts a read made without `--absent`): not introduced here, the one-person remove gate binds the same read-back since batch G3; recording which form of a read-back ran is a trail-schema change for the owner.
  - Closed, finding 5 (with no run id, one object read N times reaches done): the owner's decision 2 accepts it for read-backs with no run id, and status says so; the keyed object digest that would close it is decision 3, parked.
  - Closed in part, finding 14 (a bound counted read-back prints its audit seq): harmless; a counted change's next step names no link, and a link still records a valid join.
- `/code-review xhigh`, round 2 over `09f9743..9966e7c` (diff only): 15 found, 14 fixed (each in its own commit, red tests first in `92e1b41`), 1 closed (`docs/aegis/g3-closeout-2/evidence/code-review-rounds.md`; `r2-red.txt`, `r2-green.txt`). Round 2 finding 1 reversed round 1 finding 4: a failed read with no run id keeps a counted change not done again.
  - Closed, finding 11 (round 1 findings 1, 2, 4 and 14 fixed in one commit, `d2b3a6d`): that commit is pushed and history is not rewritten; round 1 finding 4 was reversed on its own in `be8f44a`. Listed under Deviations.
- `/code-review xhigh`, round 3 (the last) over `9966e7c..6f66568` (diff only): 11 found, 10 fixed (each in its own commit, red tests first in `a2e5915`), 1 closed (`code-review-rounds.md`; `r3-red.txt`, `r3-green.txt`).
  - Closed, finding 10 (test trails open every connector's read-back under one real Okta gate): on purpose, the tests pass the same runbook and gate check production uses; an override of the runbook folder for tests would be a way around `checkGate`.

## Deviations

- The F1 confirmation is the owner's phrase plus the deletion it causes, `REQUIRE MFA RE-REGISTER FOR [UPN] AND DELETE ITS MFA METHODS`: `scripts/command-safety-gates.test.js` requires the typed phrase to name each action family of the gate's Effect, and the quoted Microsoft Learn Effect says "deletes" (`b7d5524`, `cfc798d`).
- Round 1 findings 1, 2, 4 and 14 were fixed in one commit, `d2b3a6d`, against the one-commit-per-finding rule; it was pushed before round 2 found it, and this branch's history is not rewritten. Round 1 finding 4 was later reversed on its own (`be8f44a`).
- Two green commits changed a test line: `60dbb88` (F2) widened the change-binding guard regex so a run id may follow `bound.change`; `6b84594` (round 2 finding 6) gave the fleet-client injection fixture the `execution_id` that verify-script now requires. Neither removed or loosened an assertion about behaviour.
- Test fixtures that opened change records under made-up runbook commands were switched to a real gate, `okta-mfa-reset-selected-portal`, in the round 2 red commit `92e1b41`, when `open` began refusing an unknown runbook (round 3 finding 10 closed this as intended).
- Review fixes replaced three assertions this batch had written: round 1 finding 4's test was reversed by round 2 finding 1 (`92e1b41`); the round 2 checklist pin for the one-method delete and the change-binding serial assertion (exit 0 with run null, now exit 1 with nothing recorded) were replaced in the round 3 red commit `a2e5915`. Each replacement is stricter than what it replaced.
- `r3-red.txt` names commit `35decc2`, the red test commit before the capture was added to it (`a2e5915`); the tests are the same.

