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

## H4: newly classed R2 and R3 gates and their read-backs

44 of the 58 newly classed gates are R2 or R3. 13 bind a read-back now (`/offboard`: sign-in block, session revocation, password reset, MFA clear, the last a counted gate; `/password-reset`: the three resets and both session revocations; `/security-alert-triage`: both session revocations and the two cloud sign-in blocks). The other 31 have none, for these reasons:

| gate(s) | class | why no read-back |
|---|---|---|
| `conditional-access-enable-portal` | R3 | the Graph connector reads no Conditional Access policy |
| `device-full-wipe-portal`, `device-full-wipe`, `offboard-device-wipe-portal`, `offboard-work-phone-wipe-portal` | R3 | Intune wipe: the Graph connector reads a managed device but has no wipe read-back (Fleet and Jamf have theirs, for their own devices) |
| `distribution-external-senders-portal`, `offboard-mailbox-delegation-strip-portal` | R3 | Exchange settings and permissions: no Exchange connector |
| `quarantine-release-all-portal`, `quarantine-release-all`, `quarantine-delete-portal`, `quarantine-permanent-delete` | R3 | Defender quarantine: no connector reads it |
| `quarantine-release-one-portal`, `quarantine-release-one` | R2 | the same |
| `restricted-entity-unblock-portal`, `restricted-entity-unblock` | R3 | Defender restricted entities: no connector reads them |
| `license-remove-portal`, `offboard-license-remove-portal` | R3 | the Graph connector has no license read |
| `offboard-ad-disable-portal`, `offboard-disabled-ou-portal`, `security-synced-ad-disable` | R3 | on-premises Active Directory: no connector reads it |
| `offboard-group-strip-portal`, `offboard-dl-strip-portal` | R3 | the sets are on-premises AD groups and distribution lists (Domain Users is excluded); Graph `verify-group-member --absent` sees only those synced to Entra, after a sync, so it is not written as their proof (an owner decision in PR #9) |
| `offboard-voip-deactivate-portal`, `offboard-voicemail-clear-portal` | R3 | the VoIP platform: no connector |
| `offboard-voip-reclaim-extension-portal` | R2 | the same |
| `offboard-zoom-portal`, `offboard-adobe-portal`, `offboard-vpn-portal`, `offboard-physical-portal` | R3 | Zoom, Adobe, the VPN and the alarm and badge systems: no connector |
| `print-queue-delete-portal`, `print-queue-delete` | R3 | a local spool folder on one workstation: no connector, the gate's own read is the proof |

The counted-gate rule, applied to these gates: only `offboard-clear-mfa-portal` names a count of objects each proved by its own read-back (`verify-method-absent`), so it is the fifth counted gate; the nine other Microsoft gates that name a count keep their reason in `scripts/audit/counted-gates.test.js` (now R3, no `verify-*` read-back).

## Review rounds

| round | range | result | record |
|---|---|---|---|
| `/security-review` 1 | `0a5feb7..77b74fd` | no findings at confidence 8 or above; of four observations below the bar, three fixed test first (a gate opened for a read-back its runbook does not bind, a GUID method id compared with case, the flags field without the credential-shape check) and one kept as a stated limit (`--not-before` not recorded) | `docs/aegis/g3-closeout-3/evidence/security-review-1.md` |
| `/code-review xhigh` round 1 | `0a5feb7..d07d166` | 15 found: 13 fixed, each test first where code or a pinned line changed; 2 closed: finding 6 (a password reset moving `signInSessionsValidFromDateTime` is not documented by Microsoft; for the owner) and finding 10 (an explicit read-back field in every gate would change all 343 gates' text, which H4 forbids; a next-batch candidate) | `docs/aegis/g3-closeout-3/evidence/code-review-rounds.md` |

## Deviations

| # | deviation | why | where |
|---|---|---|---|
| D1 | Each red capture (`h1-red.txt` to `h5-red.txt`) was taken on the working tree with the tests in place and the implementation not yet written or stashed; each green capture on the working tree before its commit. The commit hashes in the captures' headers are the parent's, with "(plus uncommitted changes in the working tree)" | the test-first order is in the commits; the captures show the run that justified each commit | `docs/aegis/g3-closeout-3/evidence/h*-red.txt`, `h*-green.txt` |
| D2 | Red commits were amended locally before any push: four in H1 to H4, and two in the review fixes (security review 1's gate-kind test, which wrongly listed a read-back the gate does bind; code review round 1 finding 7's test, whose trail stub also took call entries, recaptured red with the fix set aside). H1 to H4's: H1's (an unescaped apostrophe in a test, two fixtures opened without flags, `branch` missing from `NOT_PASS_ANY`), H2's (the commit message's test count), H3's (the `$select` path encoded as `%24`, a failed read having no `verified` field, g3-boundary and g3-runbooks coverage added, the failure count) and H4's (the class tally) | no red commit was ever pushed alone, so the amend rewrote only local history on a branch this session created; each pushed pair went up with its green commit | `git log 0a5feb7..HEAD` |
| D3 | H5's test and fix are one commit, not a red commit followed by a green one | the owner asked for H5 "in its own commit"; the red run is captured on the working tree (`h5-red.txt`) | `f246aac` |
| D4 | The red commits also updated test fixtures and helpers the new rule needs (entries of pass-flag read-backs carry `flags`; the counted helpers write `Count: N`; `trail-helper.changeFor(kind, argv)`), and H3's red commit added coverage in `g3-boundary.test.js` and `g3-runbooks.test.js` | without them the existing suites would fail for the fixture's shape rather than the rule under test | `f406e46`, `e68c6cb`, `93d4aee` |
| D5 | H4's counted-gate rule makes `/offboard`'s MFA clear (`offboard-clear-mfa-portal`) a fifth counted gate, while the owner's answer to item 3 kept "the 4 counted gates" | the owner's H4 instruction says to apply the counted-gate rule to the newly classed R2 and R3 gates; this gate names a count of objects each proved by H3's `verify-method-absent`, so the rule counts it. It is listed for the owner (PR body, report section 8) | `scripts/audit/change-record.js` `COUNTED_GATES`, `scripts/audit/counted-gates.test.js` |
| D6 | The state-change inventory changes one entry's categories: `okta-group-membership-rule-change-portal` gains two keyword categories (data-removal related, destructive) from H1's one-record-per-direction paragraph. No entry was added, removed or moved between gated and ungated | the paragraph's words match the inventory's keyword classifier; the gate was already gated and R3 | `docs/security/STATE_CHANGE_INVENTORY.json`, `node docs/aegis/g3/evidence/tools/inventory-diff.js 0a5feb7` |
| D7 | Two checks were changed beyond adding assertions. (1) `change-binding.test.js` pinned the prose sentence after /github-branch-protection's Phase F with its `--change` command; code review round 1 finding 3 showed that sentence bound the protection-on read to the last exception gate, so the assertion was rewritten to the new sentence, with a stricter one added: every bound read-back of that runbook belongs to a gate that adds or strengthens protection. (2) H1 had added an exemption to the change-binding pin ("not this change's proof"); finding 9 removed it, restoring the rule as it stood before the batch | the first is a fix the old assertion contradicted; the second undoes a loosening this batch made | `eb22556`, `6974560`, `24dde8f` |
