# Production-readiness gate: Tier 1, advisory mode (batch G3)

Aegis advises; humans execute production changes (`PRODUCT_CONTRACT.md`). This gate lists
what must all hold before Aegis is called production-ready for Tier 1 on a platform. Each
criterion names the command, file or owner action that proves it, and who can run it.

**Status: NOT PASSED.** This page never marks the gate passed. Batch G3 can prove the rows
marked "this batch"; the rows marked "owner only" need the owner, real tenants or held-out
material this repository does not hold. The gate passes for a platform only when the owner
has run every owner-only row for it and records the result outside this page.

Platforms: Microsoft 365 (Entra, Exchange, Intune), Google Workspace, Okta, Jamf Pro,
Fleet, Slack, Linear, GitHub, Jira. One platform per capability row
(`docs/aegis/capability-map.md`).

## Criteria

| # | Criterion | Proof (command, file or owner action) | Who | Measure that must hold |
|---|---|---|---|---|
| 1 | Zero autonomous writes: no command, connector, intake or memory path can change a vendor system | `node --test scripts/g2-boundary.test.js scripts/g3-boundary.test.js scripts/adapters/readonly-contract.test.js scripts/jira-contract.test.js scripts/command-safety-gates.test.js` | this batch | all pass; every connector sends GET only (plus Linear's query-only GraphQL and each vendor's token exchange); every state change in a runbook is a SAFETY GATE or PREVIEW ONLY entry in `docs/security/STATE_CHANGE_INVENTORY.json` |
| 2 | Deterministic routing and floors on every corpus | `node scripts/eval/ms-ticket-eval.js`, `gws-ticket-eval.js`, `g2-ticket-eval.js`, `g3-ticket-eval.js` | this batch | every ticket and dangerous pair passes; floors, triggers, routes, replay MISS and decisions as written in each corpus |
| 3 | Connectors refuse write-capable credentials where the vendor exposes them, and say so where it does not | `node --test scripts/adapters/scope-preflight.test.js` and each connector test; `node scripts/adapters/scopes.js <connector>` | this batch | a write scope or role is SCOPE_REFUSED before its answer is used (Slack, GitHub classic tokens, Google Workspace, Fleet, Okta); Linear, Jira, Jamf Pro and Microsoft Graph print a scope notice on first use |
| 4 | Least-privilege credentials set up in each real tenant | `scripts/adapters/scope-manifest.json` and `docs/aegis/g3/scope-manifest.md`, applied by the credential owner; then `node scripts/adapters/scopes.js <connector> --execute` per connector | owner only | every connector's credential holds exactly the manifest's read scopes or role; the not-exposed connectors are checked by hand in the vendor console |
| 5 | Audit trail complete and tamper-evident | `node --test scripts/audit/audit-log.test.js scripts/audit/change-record.test.js scripts/adapters/contract-g3.test.js`; on a deployment, `node scripts/audit/audit-log.js verify` | this batch (code); owner (deployment) | every connector call, failure, procedure, approval and read-back is one chained entry; tampering, truncation and reordering are detected; external anchoring of the chain head is an owner decision (`scripts/audit/README.md`) |
| 6 | Every failure state tested with its operator message | `node --test scripts/adapters/failure-messages.test.js scripts/adapters/contract-g3.test.js` and the GitHub, Okta and Microsoft Graph connector tests | this batch | every state in every connector prints the two-part message (what happened, what was not done, the next step; admin detail line) with no stack trace, body or secret |
| 7 | Intake keeps every field as data and binds the tenant | `node --test scripts/intake/intake.test.js` | this batch | injection, second tenant, oversized, malformed, empty and HTML-only cases per source end in their named state |
| 8 | Latency budget held | `node --test scripts/eval/latency.test.js` (`scripts/eval/latency.js` prints p50 and p95) | this batch | p95 of the deterministic path per corpus ticket at or under `BUDGET_P95_MS`, itself at most 1,000 ms; model answer time is not measured here |
| 9 | Model-judged run on the owner's held-out cases | the owner runs the model-judged rubric (`scripts/eval/README.md`) on held-out cases kept outside this repository | owner only | at or above the threshold the owner sets; held-out cases never enter this repository |
| 10 | Operator validation sample | the owner scores a sample of real, sanitized tickets worked with Aegis | owner only | the owner's pass mark |
| 11 | Vendor facts checked by hand | `docs/aegis/g3/vendor-facts.md` and `docs/aegis/g3/vendor-facts-to-check.md`, checked against each vendor console | owner only | every UNCONFIRMED fact used by a connector or runbook confirmed or corrected |
| 12 | Each connector run once against a real tenant, read-only, with its read-backs | the owner runs each connector's reads and verify-* commands with the least-privilege credential | owner only | answers match the console; no write was possible |

## Per platform

| Platform | Rows this batch can prove | Rows only the owner can run |
|---|---|---|
| Microsoft 365 | 1, 2, 3 (notice), 5, 6, 7, 8 | 4, 9, 10, 11, 12 |
| Google Workspace | 1, 2, 3, 5, 6, 8 | 4, 9, 10, 11, 12 |
| Okta | 1, 2, 3, 5, 6, 8 | 4, 9, 10, 11, 12 |
| Jamf Pro | 1, 2, 3 (notice), 5, 6, 8 | 4, 9, 10, 11, 12 |
| Fleet | 1, 2, 3, 5, 6, 8 | 4, 9, 10, 11, 12 |
| Slack | 1, 2, 3, 5, 6, 7, 8 | 4, 9, 10, 11, 12 |
| Linear | 1, 2, 3 (notice), 5, 6, 7, 8 | 4, 9, 10, 11, 12 |
| GitHub | 1, 2, 3, 5, 6, 7, 8 | 4, 9, 10, 11, 12 |
| Jira | 1, 3 (notice), 5, 6 | 4, 9, 10, 11, 12 |

Row 7 applies to the four intake sources: Linear, GitHub, Slack and email (Microsoft 365
mail exported as .eml).

## What this gate cannot prove

- That a person runs the procedure as written: the gates and read-backs make a skipped
  step visible, they cannot make it impossible.
- That a vendor's documentation is current: rows 11 and 12 are there for that.
- That the audit trail was not replaced wholesale on a machine the attacker controls:
  that needs the chain head stored outside the machine (owner decision).
