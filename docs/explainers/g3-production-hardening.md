# Batch G3: hardening the Tier 1 help desk (advisory mode)

For the owner. One page. Details: `docs/aegis/production-readiness.md`, `PROJECT_STATE.md` ("Changed by batch G3"), `docs/aegis/boundary-audit.md` rows 29 to 40, `docs/aegis/capability-map.md` rows 63 to 83, `checks.md`.

## The short version

- Aegis still advises and people still execute. Nothing in this batch can change a vendor system: every connector sends reads only, and `scripts/g3-boundary.test.js` proves it for every new command, connector, intake and audit path.
- Production-ready is **not** claimed. The readiness gate has 12 criteria; this batch proves up to 7 of them in code for each platform (the intake row applies to four sources only). The other 5 need you: least-privilege credentials in each real tenant, a model-judged run on your held-out cases, an operator validation sample, the vendor facts checked in each console, and one read-only run of each connector against a real tenant.
- Test battery: 1,045 tests at the start (`docs/aegis/g3/baseline/node-test.txt:1204`); the count at the head is in the pull request body.

## What is new, per platform

- **GitHub:** a read-only connector (organization, members, teams, collaborators, branch protection, rulesets, 2FA and SSO settings, outside collaborators, audit log, secret scanning and Dependabot alerts), five runbooks (repository access, branch protection audit, organization security review, removing a departing person, alert triage) and five risk floors. 10 of 10 corpus tickets pass.
- **Okta:** a read-only connector; read-backs after every lifecycle, MFA and app change; a new group membership runbook. 8 of 8 tickets pass.
- **Microsoft 365:** a read-only Microsoft Graph connector; read-backs in `/password-reset`, `/mfa-issue` and `/intune-compliance`. 9 of 9 tickets pass.
- **Fleet and Jamf Pro:** a check-in read-back after a sync or re-enrolment. Jamf Pro has no last MDM check-in field in this read, so it uses the last contact time and says so.
- **One intake** for Linear issues, GitHub issues, Slack exports and exported email: each field stays data, a second tenant is refused, and every bad input ends in a named state. 16 of 16 intake tickets pass.
- **Tickets that name no system** get exactly one question first. 6 of 6 pass.

## Guardrails

- Each connector checks what its credential can do before it uses an answer. Where the vendor shows granted scopes (Slack, GitHub classic tokens, Google Workspace, Okta, Fleet), a write scope is refused. Where it does not (Linear, Jira, Jamf Pro, Microsoft Graph), the connector says so on first use, and `docs/aegis/g3/scope-manifest.md` tells you exactly what to grant.
- Every connector call, failure, procedure, approval and read-back goes into a local hash-chained audit trail. Editing, cutting or reordering it is detected. An approval authorizes a person's procedure; it never triggers a write.
- Every failure prints what happened, what was not done and the next step, with no stack trace or secret. Retries back off with jitter and follow Retry-After.
- The deterministic path from intake to runbook selection: p95 0.52 to 0.85 ms per ticket over three runs, slowest ticket 1.16 ms (budget p95 50 ms). Each command-line tool a session starts adds 35 to 43 ms of Node process start (`docs/aegis/g3/evidence/t6c-latency-runs.txt`). Model answer time is not measured.

## A bug found on the way

Eleven tier floors already on main, and one added earlier in this batch, took cubic or worse time on a long line that never completes them: 9 to 48 seconds each for one 20 KB pasted line, and for the one with three gaps an estimated 25 to 40 minutes. They are rewritten with the same matches (0 disagreements in 896,280 comparisons), and a test now rejects that shape in any floor (`docs/review/incidents.md`).

## Decisions for you

- Let a person run each connector once against a real tenant with the least-privilege credential (readiness rows 4 and 12).
- Confirm or correct the facts in `docs/aegis/g3/vendor-facts-to-check.md`, above all the GitHub and Okta UI labels the runbooks mark `[unconfirmed]`.
- Still open from earlier batches: agents that hold a shell (boundary audit rows 4 and 5), the checklist runner (row 12), a keyed memory seal, branch protection, and the model-judged runner.
