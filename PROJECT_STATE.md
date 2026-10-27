# Aegis project state

> Dev-facing state file, rewritten by batch 1 on 2026-10-27 to match the repo as it is. Every
> "verified" line below names a check that ran in that session and the capture that holds its
> output. Machine-checked fresh-session snapshot: `tasks/continuity.md` with
> `node scripts/harness/check-continuity.js`.

## Baseline and branch

- **Baseline:** `main` at `d5fc8c0`, the merge of PR #3 (review layers) on top of `e7c445c`, the
  merge of PR #2 (v8.9, Google Workspace / Okta / Jamf / macOS lane). v8.9 is merged, not in review.
- **Batch 1:** branch `chore/baseline-and-boundary`, one draft pull request to `main`. Batteries
  ran in a clean clone; captures in `docs/baseline/` (Phase 0 at `d5fc8c0`) and
  `docs/baseline/branch/` (at `5cc5d69`, after the three review rounds).

## Verified now (checks run on 2026-10-27)

| Check | Command | Result | Capture |
|---|---|---|---|
| Test battery | `node --test` | 588 tests, 588 pass (Phase 0: 505) | `docs/baseline/branch/node-test.txt:746-749` |
| Microsoft ticket eval | `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 dangerous pairs | `docs/baseline/branch/ms-ticket-eval.txt:41` |
| Google ticket eval | `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 dangerous pairs | `docs/baseline/branch/gws-ticket-eval.txt:54` |
| Structure lint | `node scripts/lint/command-structure.js` | 77 commands, clean | `docs/baseline/branch/command-structure-lint.txt:5` |
| Replay lifecycle | `node scripts/replay/replay-demo.js` | 17 steps, exit 0 | `docs/baseline/branch/replay-demo.txt:40-42` |
| Scanner | `node scripts/pre-commit-check.js --all` | 352 files, 0 BLOCK, 170 WARN, exit 0 | `docs/baseline/branch/pre-commit-check-all.txt:3`, `:448-452` |
| Release boundary | `node scripts/harness/release-boundary-check.js` | PASS | `docs/baseline/branch/release-boundary-check.txt:3` |

What those checks prove, by capability, is in `docs/aegis/capability-map.md`: 17 of 35 rows are
verified now, among them Microsoft and Google ticket routing and risk floors, Okta and Jamf
routing, the advisory-only gates in every runbook, the ticket graph, replay and memory engines,
the scanner, and the Jira client's GET-only boundary. The ticket evals prove routing and runbook
structure, not answer quality.

## Changed by batch 1

- **Boundary:** `scripts/jira-client.js` no longer sends any write. Create, comment and transition
  print a HUMAN-RUN procedure; `verify-*` reads prove the administrator's write
  (`docs/aegis/boundary-audit.md`, 19 paths audited, 1 violation fixed).
- **Untrusted data:** `scripts/untrusted/` holds 36 tests for instruction injection, poisoned
  memory and wrong-customer cases. They found and drove fixes for obfuscated injection markers,
  instruction text in the replay cache, memory records edited on disk, mixed org namespaces, and
  stores shared across tenants.
- **Instruction file:** `CLAUDE.md` is 18,069 bytes (was 39,948); the moved passages are in
  `docs/aegis/operating-rules.md`, `docs/aegis/workflow.md` and `docs/aegis/operator-context.md`.
- **Contract:** `PRODUCT_CONTRACT.md` carries the boundary paragraph, where code enforces it, and
  the standing rules for answers.

## Partial

Rendered answer quality on both corpora (no model-judged run in this session); portal-path
currency in `scripts/security-audit.js`; network, VPN, SIP and VoIP routing (no corpus ticket);
Google and Okta containment (G36 and G37 route to a Microsoft-only runbook); the security audit's
checklist content; the log analyzer and hash checker (no tests); PowerShell and GAM procedure
correctness; strategy selection, loops and review independence (model behaviour); injection and
wrong-customer cases beyond the deterministic edges. Rows and evidence: capability map.

## Missing

A Google Workspace posture audit; infrastructure as code for Azure and for Google Cloud; an
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

Batch 1's draft pull request. `node scripts/dev/claim.js list` showed 0 active claims on
2026-10-27 (`docs/aegis/evidence/claim-list.txt`).

## Roadmap skeleton

The five capabilities, where each stands, and the next step. No batch 2 work has started.

1. **IT support and infrastructure troubleshooting:** routing, floors and runbook structure
   verified on both corpora; answer quality unscored; network and VoIP have no corpus tickets.
2. **Defensive cybersecurity and incident response guidance:** Microsoft floors and triage
   routes verified; Google and Okta containment missing; no Google posture audit.
3. **Platform engineering and infrastructure development:** release tooling and health checks
   verified; no infrastructure as code.
4. **Agent strategy and workflow design:** tier floor and ticket graph verified; strategy and
   loop behaviour is doctrine without a judged run.
5. **Agent development, testing and operation:** battery, replay, memory, scanner and boundary
   verified; no automated judged-eval runner; shell-holding agents have no code gate.

**Batch 2 candidate: Microsoft 365 account-access recovery** (locked account, password reset,
MFA re-registration, Conditional Access sign-in block), worked end to end: intake, replay,
read-only diagnosis, a HUMAN-RUN fix, verification, and the Jira note with its `verify-*` read-back.

- *Closest to verified:* capability-map rows 1 (Microsoft routing and floors), 9 (compromise and
  MFA-urgency floors), 22 (tier floor), 27 (replay and memory), 30 (runbook gates) and 32 (Jira
  boundary) are verified now; the open gap is row 2 (answer quality) and row 26 (judged-eval runner).
- *Business situation:* a staff member who cannot sign in cannot work, and the same request is an
  attacker's favourite (T28: an MFA reset on a suspected compromise must floor to T3). 12 of the
  28 Microsoft corpus tickets are this class: T01, T02, T03, T04, T05, T13, T14, T19, T23, T25,
  T26, T28 (`scripts/eval/ms-tickets.json`).
- *What it needs:* a scored, repeatable model-judged run on those 12 tickets with the rubric in
  `scripts/eval/README.md` and a stored result (closes rows 2 and 26 for this slice); sanitized
  sign-in log fixtures for the read-only diagnostic step; the Jira note path wired to
  `verify-comment`; then the Google counterpart (2-Step Verification reset tickets) proven
  separately.
