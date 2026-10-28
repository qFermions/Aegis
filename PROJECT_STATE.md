# Aegis project state

> Dev-facing state file, rewritten by batch 1 on 2026-10-27 to match the repo as it is, and
> updated by batch G2 and batch G3 on 2026-10-28 (sections "Changed by batch G2" and "Changed by
> batch G3"). Every "verified" line below names a check that ran in that session and the
> capture that holds its output. Machine-checked fresh-session snapshot: `tasks/continuity.md` with
> `node scripts/harness/check-continuity.js`.

## Baseline and branch

- **Baseline:** `main` at `d5fc8c0`, the merge of PR #3 (review layers) on top of `e7c445c`, the
  merge of PR #2 (v8.9, Google Workspace / Okta / Jamf / macOS lane). v8.9 is merged, not in review.
- **Batch 1:** branch `chore/baseline-and-boundary`, one draft pull request to `main`. Batteries
  ran in a clean clone; captures in `docs/baseline/` (Phase 0 at `d5fc8c0`) and
  `docs/baseline/branch/` (at `5cc5d69`, after the three review rounds).

## Verified by batch 1 (checks run on 2026-10-27; batch G2's counts are under "Changed by batch G2")

| Check | Command | Result | Capture |
|---|---|---|---|
| Test battery | `node --test` | 588 tests, 588 pass (Phase 0: 505) | `docs/baseline/branch/node-test.txt:746-749` |
| Microsoft ticket eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs | `docs/baseline/branch/ms-ticket-eval.txt:41` |
| Google ticket eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs | `docs/baseline/branch/gws-ticket-eval.txt:54` |
| Structure lint | `node scripts/lint/command-structure.js` | 77 commands, clean | `docs/baseline/branch/command-structure-lint.txt:5` |
| Replay lifecycle | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/baseline/branch/replay-demo.txt:40-42` |
| Scanner | `node scripts/pre-commit-check.js --all` | 352 files, 0 BLOCK, 170 WARN, exit 0 | `docs/baseline/branch/pre-commit-check-all.txt:3`, `:448-452` |
| Release boundary | `node scripts/harness/release-boundary-check.js` | PASS | `docs/baseline/branch/release-boundary-check.txt:3` |

What those checks proved, by capability, is in `docs/aegis/capability-map.md`: at the end of
batch 1, 17 of 36 rows were verified (the map's counts line), among them Microsoft and Google ticket routing and risk floors (rows 1, 4, 9, 11),
Okta and Jamf routing (rows 6, 7), the tier floor (rows 22, 36), the advisory-only gates in every
runbook (rows 30, 31), the ticket graph (row 23), replay and memory engines (row 27), the scanner
(row 33), and the Jira client's GET-only boundary (row 32). Each row cites a capture run on
2026-10-27; every suite behind them ran again on the branch in `node --test`
(`docs/baseline/branch/node-test.txt:746-749`). The ticket evals prove routing and runbook
structure, not answer quality. After batch G2 the map has 62 rows: 39 verified now, 6
implemented but unverified, 14 partial, 3 missing (`docs/aegis/capability-map.md:72`).

## Changed by batch 1

- **Boundary:** `scripts/jira-client.js` no longer sends any write. Create, comment and transition
  print a HUMAN-RUN procedure; `verify-*` reads prove the administrator's write
  (`docs/aegis/boundary-audit.md`, 19 paths audited, 1 violation fixed).
- **Untrusted data:** `scripts/untrusted/` holds 57 tests for instruction injection, poisoned
  memory and wrong-customer cases. They found and drove fixes for obfuscated injection markers,
  instruction text in the replay cache, memory records edited on disk, mixed org namespaces, and
  stores shared across tenants.
- **Instruction file:** `CLAUDE.md` is 19,041 bytes (was 39,948); the moved passages are in
  `docs/aegis/operating-rules.md`, `docs/aegis/workflow.md` and `docs/aegis/operator-context.md`.
- **Contract:** `PRODUCT_CONTRACT.md` carries the boundary paragraph, where code enforces it, and
  the standing rules for answers.
- **Review:** three rounds, 45 findings: 42 fixed (35 with a test that fails before the fix, 7
  docs, comment, efficiency or refactor fixes) and 3 closed with a reason
  (`docs/review/batches/batch1-checks.md`, "Review rounds").

## Changed by batch G2

Branch `feat/g2-gws-fleet-jamf-slack-linear`, draft PR #5, stacked on batch 1 (`3592bd1`). The
lane spec is `docs/aegis/lanes/g2.md`; the corpus is `scripts/eval/g2-tickets.json` (63 tickets,
12 dangerous pairs). Each platform is proven on its own; captures in `docs/aegis/g2/evidence/`.

| Platform | Status | Commands | Proof (command and count) |
|---|---|---|---|
| Fleet | landed whole | `/fleet-host-health`, `/fleet-policy-failures`, `/fleet-vulnerable-software`, `/fleet-osquery-investigation`, `/fleet-device-actions` | `node scripts/eval/g2-ticket-eval.js`: 13/13 tickets, 3/3 pairs; `node --test scripts/adapters/fleet-client.test.js scripts/adapters/fleet-runbooks.test.js`: 44/44 at head (43/43 at landing) |
| Linear | landed whole | `/linear-intake`, `/linear-triage`, `/linear-ticket-note`, `/linear-workspace-admin` | G2 eval: 11/11 tickets, 2/2 pairs; `node --test scripts/adapters/linear-client.test.js scripts/adapters/linear-runbooks.test.js`: 33/33 |
| Slack | landed whole | `/slack-user-lifecycle`, `/slack-guests-connect`, `/slack-app-approval`, `/slack-retention-export`, `/slack-security-settings`, `/slack-incident-comms` | G2 eval: 14/14 tickets, 3/3 pairs; `node --test scripts/adapters/slack-client.test.js scripts/adapters/slack-runbooks.test.js`: 46/46 at head (42/42 at landing) |
| Jamf Pro | landed whole | `/jamf-config-profiles`, `/jamf-policies-self-service`, `/jamf-patch-management`, `/jamf-filevault`, `/jamf-inventory-groups` | G2 eval: 12/12 tickets, 2/2 pairs; `node --test scripts/adapters/jamf-client.test.js scripts/adapters/jamf-runbooks.test.js`: 33/33 |
| Google Workspace | landed whole | `/gws-drive-sharing`, `/gws-2sv-enforcement`, `/gws-account-containment`, `/gws-admin-roles`, `/gws-security-posture` | G2 eval: 13/13 tickets, 2/2 pairs; `node --test scripts/adapters/gws-client.test.js scripts/gws-runbooks.test.js`: 39/39 at head (36/36 at landing); `node --test scripts/gws-posture-audit.test.js`: 12/12 |

- **Security review 2 (`35b0415..2b35aa1`, the review fixes):** no security finding; one candidate
  below the bar named two floor gaps in this batch's own review fixes (a delete or purge across
  mailboxes, an Intune or Company Portal unenroll), fixed test first (`83d1318`, `9b35dd7`);
  `node --test` 1045/1045 after (`docs/aegis/g2/evidence/security-review-2.md`).
- **Battery at `cef6cee` (after code review round 3):** `node --test` 1041/1041
  (`docs/aegis/g2/evidence/node-test.txt:1201-1204`); Microsoft 28/28 and 6/6, Google 38/38 and
  9/9, unchanged; structure lint 102 commands, clean; scanner 0 BLOCK, 197 WARN (170 at batch 1;
  the shared injection markers added 15: 14 in tests and the corpus, 1 a quoted example in
  `/slack-user-lifecycle`); release boundary PASS. Suite counts at head:
  `docs/aegis/g2/evidence/head-suite-counts.txt`.
- **Boundary:** five read-only adapters on one contract (`scripts/adapters/README.md`) and a
  posture audit that writes one local report; `scripts/g2-boundary.test.js` (13 tests) proves no
  adapter command sends a write and every G2 runbook gates or previews each state change
  (`docs/aegis/boundary-audit.md`, rows 20 to 28).
- **Capability map:** rows 37 to 62 added, one platform each; row 14 (Google posture audit) is
  verified now; row 12 names Okta only and its Google half is row 59 (partial: `/gws-audit-log`
  still hands Google containment to the Microsoft-only triage runbook).
- **Not verified in this batch:** answer quality for every G2 platform (rows 38, 43, 48, 53, 58),
  and every vendor fact that rests on a search excerpt or a vendor repository because the vendor
  documentation hosts were refused by the session network (`docs/aegis/lanes/g2.md`, Sources).

## Changed by batch G3

Branch `feat/g3-production-hardening`, draft PR #6 against `main` (base `f185071`). Tier 1 help
desk hardening in advisory mode: no new write path; every connector reads only. Production
readiness is **NOT PASSED**: `docs/aegis/production-readiness.md` lists the 12 criteria, which
rows this batch proves for each platform and which only the owner can run (real tenants,
held-out cases, operator validation, vendor facts by hand). Captures in `docs/aegis/g3/evidence/`;
every G3 suite count at the batch head is in `docs/aegis/g3/evidence/t7-head-suite-counts.txt`.

| Platform | Status | Commands | Proof (command and count) |
|---|---|---|---|
| GitHub | landed whole: connector, 5 runbooks, 5 floors, corpus | `/github-repo-access`, `/github-branch-protection`, `/github-org-security`, `/github-offboard-member`, `/github-security-alerts` | `node scripts/eval/g3-ticket-eval.js`: 10/10 GitHub tickets, 5/5 pairs (`docs/aegis/g3/evidence/t5-g3-eval-final.txt:62`); `node --test scripts/adapters/github-client.test.js` 14/14; every runbook connector line runs as written, 5/5 (`t5-runbooks-green.txt:6-10`) |
| Okta | landed whole: connector, read-backs, group runbook | `/okta-user-lifecycle`, `/okta-mfa-reset`, `/okta-app-assignment` (read-backs added), `/okta-group-membership` (new) | G3 eval: 8/8 Okta tickets (`t5-g3-eval-final.txt:63`); `node --test scripts/adapters/okta-client.test.js` 28/28; runbook lines 4/4 (`t5-runbooks-green.txt:11-14`) |
| Microsoft 365 (Graph) | landed whole: connector and read-backs | `/password-reset`, `/mfa-issue`, `/intune-compliance` (read-backs added) | G3 eval: 9/9 Microsoft tickets (`t5-g3-eval-final.txt:64`); `node --test scripts/adapters/msgraph-client.test.js` 6/6; runbook lines 3/3 (`t5-runbooks-green.txt:3-5`) |
| Fleet | read-back added | `/fleet-host-health` (`verify-checked-in`) | `node --test scripts/adapters/endpoint-sync.test.js` 2/2; runbook lines 1/1 (`t5-runbooks-green.txt:15`) |
| Jamf Pro | read-back added | `/mac-troubleshoot` (`verify-checked-in`, from the last contact time) | `endpoint-sync.test.js` 2/2; runbook lines 1/1 (`t5-runbooks-green.txt:16`) |
| Linear, GitHub, Slack, email | one intake | `node scripts/intake/intake.js <linear\|github\|slack\|email> --file <path>` | `node --test scripts/intake/intake.test.js` 33/33; G3 eval: 4 intake tickets per source, 16/16 (`t5-g3-eval-final.txt:33-48`) |
| No platform named | one question first | `scripts/intake/clarify.js` | G3 eval: 6/6 ambiguous tickets ask one question (`t5-g3-eval-final.txt:27-32`) |

- **Guardrails:** least-privilege scope manifest and preflight for every connector
  (`scripts/adapters/scope-manifest.json`, `docs/aegis/g3/scope-manifest.md`); a hash-chained
  local audit trail and change records (`scripts/audit/`); every connector failure ends in a
  named state with a two-part operator message; latency budget p95 50 ms per ticket, measured
  0.47 to 0.68 ms (`docs/aegis/g3/evidence/t6c-latency-runs.txt`).
- **Shipped bug fixed:** twelve tier floors and ten engine twins took cubic or worse time on a
  long line (11 s to about 40 minutes on 20 KB); fixed with the same matches and a test that
  rejects the shape (`docs/review/incidents.md`).
- **Boundary:** `docs/aegis/boundary-audit.md` rows 29 to 40; `scripts/g3-boundary.test.js`
  (10 tests) proves no G3 command, connector, intake or audit path can write to a vendor system.
- **Capability map:** rows 63 to 83 added, one platform each or platform-neutral; 59 verified
  now, 7 implemented but unverified, 14 partial, 3 missing.
- **Not verified in this batch:** answer quality on every platform (rows 5, 38, 43, 48, 53, 58,
  66), and every UNCONFIRMED vendor fact (`docs/aegis/g3/vendor-facts-to-check.md`).

## Partial

14 capability-map rows: Microsoft answer quality (row 2, no model-judged run in this session);
portal-path currency in `scripts/security-audit.js` (row 3); network, VPN, SIP and VoIP routing
(row 8, no corpus ticket); Microsoft incident triage and report guidance, structure and gates
checked but not the containment order (row 10); Okta containment (row 12) and Google containment (row 59: the steps exist, but
`/gws-audit-log` still routes to a Microsoft-only runbook); the security audit's checklist content (row 13); the log
analyzer and hash checker (row 15, no tests); PowerShell and GAM procedure correctness (rows 16,
17); strategy selection, loops and review independence (row 24, model behaviour); session
bootstrap, with a stale continuity snapshot (row 29); injection and wrong-customer cases beyond
the deterministic edges (rows 34, 35). Implemented but unverified: Google answer quality and
real-tenant procedure evidence (row 5), and answer quality and vendor-fact currency for each G2
platform (rows 38, 43, 48, 53, 58).

## Missing

Infrastructure as code for Azure and for Google Cloud; an
automated runner for the model-judged eval half (the rubric is a document only).

## Open risks

- Agents that hold a shell (`tier1-support`, `tier2-support`, the development plane) have no code
  gate; only their cards and the operator's permission mode stop a tenant write
  (`docs/aegis/boundary-audit.md` rows 4 and 5). `.claude/settings.json` hooks are an open owner
  decision.
- `modules/automation/scripts/deploy-check.js` runs any executable a checklist names (row 12).
- Memory records written before batch 1 carry no seal and are withheld until an operator re-runs
  `verify` or `promote`. The seal is an unkeyed hash, so a writer that copies the CLI can forge it.
- Replay case files edited on disk, and graph runs resumed under another tenant, are not checked.
- `tasks/continuity.md` is stale (snapshot `b9acd99`; `docs/baseline/branch/check-continuity.txt:14-15`).
- The `CLAUDE.md` title says v8.7; `CHANGELOG.md` is at v8.9.

## Current work

Batch 1's pull request (#4) and batch G2's (#5) were merged into `main` on 2026-10-28 (`f185071`,
read from the GitHub pull request API); batch G3's draft pull request (#6) is open against `main`.
`node scripts/dev/claim.js list` showed 0 active claims on 2026-10-27
(`docs/aegis/evidence/claim-list.txt`).

## Roadmap skeleton

The five capabilities, where each stands, and the next step. No batch 2 work has started.
"Verified" below means a capability-map row marked verified now (row numbers given); a batch 1
row cites a capture run on 2026-10-27 and re-run by the branch battery (`docs/baseline/branch/`),
and a row batch G2 added or changed cites a capture run on 2026-10-28 (`docs/aegis/g2/evidence/`).

1. **IT support and infrastructure troubleshooting:** routing, floors and runbook structure
   verified on both corpora (rows 1, 4, 6, 7) and per G2 platform (rows 37, 42, 47, 52, 57);
   answer quality unscored (rows 2, 5, 38, 43, 48, 53, 58); network and VoIP have no corpus
   tickets (row 8).
2. **Defensive cybersecurity and incident response guidance:** Microsoft and Google compromise
   floors and triage routes verified (rows 9, 11); Okta containment partial (row 12); Google
   containment partial (row 59: `/gws-audit-log` still routes to the Microsoft-only triage
   runbook); Google posture audit verified in batch G2 (row 14).
3. **Platform engineering and infrastructure development:** release tooling and health checks
   verified (rows 20, 21); no infrastructure as code (rows 18, 19).
4. **Agent strategy and workflow design:** tier floor and ticket graph verified (rows 22, 23,
   36); strategy and loop behaviour is doctrine without a judged run (row 24).
5. **Agent development, testing and operation:** battery, replay, memory, scanner and boundary
   verified (rows 25, 27, 28, 30 to 33); no automated judged-eval runner (row 26); shell-holding
   agents have no code gate (`docs/aegis/boundary-audit.md` rows 4, 5).

**Batch 2 candidate: Microsoft 365 account-access recovery** (locked account, password reset,
MFA re-registration, Conditional Access sign-in block), worked end to end: intake, replay,
read-only diagnosis, a HUMAN-RUN fix, verification, and the Jira note with its `verify-*` read-back.

- *Closest to verified:* capability-map rows 1 (Microsoft routing and floors), 9 (compromise and
  MFA-urgency floors), 22 (tier floor), 27 (replay and memory), 30 (runbook gates) and 32 (Jira
  boundary) are verified now, each citing its capture and re-run in `docs/baseline/branch/`; the
  open gap is row 2 (answer quality) and row 26 (judged-eval runner).
- *Business situation:* a staff member who cannot sign in cannot work, and the same request is an
  attacker's favourite (T28: an MFA reset on a suspected compromise must floor to T3). 12 of the
  28 Microsoft corpus tickets are this class: T01, T02, T03, T04, T05, T13, T14, T19, T23, T25,
  T26, T28 (`scripts/eval/ms-tickets.json`).
- *What it needs:* a scored, repeatable model-judged run on those 12 tickets with the rubric in
  `scripts/eval/README.md` and a stored result (closes rows 2 and 26 for this slice); sanitized
  sign-in log fixtures for the read-only diagnostic step; the Jira note path wired to
  `verify-comment`; then the Google counterpart (2-Step Verification reset tickets) proven
  separately.
