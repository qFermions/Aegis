# checks: batch G3 close-out 3 (owner decisions on PR #8's eight items)

Branch `fix/g3-closeout-3` on qFermions/Aegis, base `main` at `0a5feb7` (the merge of PR #8; `git merge-base --is-ancestor 52441fb 0a5feb7` holds, `docs/aegis/g3-closeout-3/baseline/clone.txt`). Evidence: `docs/aegis/g3-closeout-3/baseline/` (Phase 0, fresh clone of `0a5feb7`) and `docs/aegis/g3-closeout-3/evidence/`. Verdicts: pass, fail, unresolved. The batch G3 close-out 2's table is kept at `docs/review/batches/g3-closeout-2-checks.md`.

Owner answers with no work (PR #8 items 1, 2, 3 and 7): the F1 confirmation phrase and the gate rule stay; session revocation stays R2; the 4 counted gates and the 20 reasons in `scripts/audit/counted-gates.test.js` stand; a re-read of one object without a run id stays a stated limit, parked with object-level binding.

## Baseline (Phase 0, fresh clone of 0a5feb7, node v24.22.2, pwsh 7.6.9)

| check | command | result | evidence |
|---|---|---|---|
| clone | `git clone <repo> <clone>`, `git checkout --detach 0a5feb7` | HEAD `0a5feb7`, clean, contains `52441fb`; no package manifest or lockfile | `docs/aegis/g3-closeout-3/baseline/clone.txt` |
| tests | `node --test` | 1447 tests, 1447 pass, 0 fail, exit 0 | `docs/aegis/g3-closeout-3/baseline/node-test.txt:1608-1611` |
| tests under the socket tripwire | `bash -c NODE_OPTIONS="--require <clone>/scripts/adapters/socket-tripwire.js" node --test` | 1447/1447, exit 0 | `docs/aegis/g3-closeout-3/baseline/node-test-under-tripwire.txt` |
| evals | the four ticket evals | Microsoft 28/28 and 6/6, Google 38/38 and 9/9, G2 65/65 and 13/13, G3 44/44 and 8/8, each exit 0 | `docs/aegis/g3-closeout-3/baseline/head-checks.txt:3-6` |
| structure lint | `node scripts/lint/command-structure.js` | 108 commands, clean, exit 0 | `docs/aegis/g3-closeout-3/baseline/command-structure-lint.txt` |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | `docs/aegis/g3-closeout-3/baseline/replay-demo.txt` |
| scanner | `node scripts/pre-commit-check.js --all` | 0 BLOCK, 209 WARN, exit 0 | `docs/aegis/g3-closeout-3/baseline/head-checks.txt:8` |
| release boundary | `node scripts/harness/release-boundary-check.js` | PASS, exit 0 | `docs/aegis/g3-closeout-3/baseline/release-boundary-check.txt` |
| head checks | `bash docs/aegis/g3/evidence/tools/head-checks.sh 0a5feb7` | CLAUDE.md 19202 bytes; SAFETY GATE lines in .claude, modules and docs 530 | `docs/aegis/g3-closeout-3/baseline/head-checks.txt` |
| runbook gate markers | per-runbook count of `<!-- SAFETY GATE [` and fenced `# SAFETY GATE [` lines in `.claude/commands` | 343 in all | `docs/aegis/g3-closeout-3/baseline/runbook-gate-markers.txt` |
| gates without an R class | each gate's Reversibility line holds no `R0` to `R3` before "separate" | 58 of 343 gates, in 15 runbooks: `offboard.md` 23, `email-quarantine.md` 7, `password-reset.md` 5, `security-alert-triage.md` 5, `email-to-spam.md` 3, `conditional-access.md`, `device-wipe.md`, `mailbox-permissions.md`, `printer-issue.md` and `sharepoint-access.md` 2 each, `distribution-list.md`, `email-whitelist.md`, `license-audit.md`, `shared-mailbox.md` and `teams-issue.md` 1 each | the H4 test's first red run (`docs/aegis/g3-closeout-3/evidence/h4-red.txt`) |
| safety gates and the G3 suites | `bash docs/aegis/g3/evidence/tools/suite-counts.sh` | command-safety-gates 475/475; change-record 31/31; audit-log 14/14; msgraph-client 6/6; every listed suite passing | `docs/aegis/g3-closeout-3/baseline/suite-counts.txt` |
| continuity (session-start gate, not in CI) | `node scripts/harness/check-continuity.js` | STALE, exit 2, as at every head of the previous batches | `docs/aegis/g3-closeout-3/baseline/check-continuity.txt` |
| tools | `node --version`, `pwsh --version` | v24.22.2, 7.6.9; nothing added to the repository | `docs/aegis/g3-closeout-3/baseline/dependencies.md` |

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| H1 a presence pass never proves a removal: every verify-* flag that changes what a pass means is recorded in the verify entry; `open` names the read-back with them; `link` and `status` count only a read-back whose recorded flags match; every runbook line that proves a removal updated. Per command, tests first: a removal change is not done by a passing read without `--absent`; it is done by a passing `--absent` read under its change; an add change is not done by an `--absent` read; existing change-record, change-binding and counted-gate tests pass | unresolved | not run yet | |
| H2 the approval covers N: `--expected N` inside what the approval covers (one design, with the reason, in the audit README). Tests first: an approval given for one N does not cover a different N; a mismatched N is refused or never reads done; uncounted gates behave as today | unresolved | not run yet | |
| H3 read-backs for the two unproven `/mfa-issue` actions: `verify-sessions-revoked` and `verify-method-absent` in `msgraph-client.js`, GET only, vendor facts quoted, least-privileged read permission in the scope manifest, both bound in `/mfa-issue` with `--change [CHANGE_ID]`. Connector tests on fixtures (pass, fail, missing property, malformed time, 403, 404); dry run exits 4; no socket; the bound and unbound pin moves by exactly these lines | unresolved | not run yet | |
| H4 every SAFETY GATE carries an R class from CLAUDE.md's table, citing the row; a test fails when any gate lacks one (the failing run shown); the counted-gate and change-binding rules applied to the newly classed R2 and R3 gates, each one left without a read-back listed with its reason; no gate's text changes beyond its class line and any binding line; SAFETY GATE count unchanged; 0 entries moved to ungated | unresolved | not run yet | |
| H5 `/mfa-issue`'s "New phone / re-register" list starts at step 1, in its own commit | unresolved | not run yet | |
| E5 floors | unresolved | not run yet | |
| E6 no secret, token, personal path, real name, internal hostname or private email | unresolved | not run yet | |
| E7 no em-dash in any file, added line or commit message this batch wrote | unresolved | not run yet | |
| E8 no real system, no socket in tests | unresolved | not run yet | |
| E9 dependencies and tools added | unresolved | not run yet | |
| E10 product boundary unchanged | unresolved | not run yet | |
| E11 CLAUDE.md size, contract, state and progress files | unresolved | not run yet | |
| Push only commits at which the full battery passes | unresolved | not run yet | |

## Review rounds

Not run yet.

## Deviations

None yet.
