# Security lane notes (batch 12)

## Hypothesis and what "verified" means (written 2026-11-14, before the first edit)

- **Hypothesis:** the security lane fits as one knowledge module (`knowledge/security/`) plus seven runbooks that mostly order and route to the gated runbooks Aegis already has (Entra, Okta, Google, Jamf, Fleet, GitHub, Slack), adding new gates only where no runbook covers the action: cloud keys and tokens (AWS, Google Cloud, Azure, GitHub, Slack), Exchange forwarding and inbox rules, Defender device isolation, Entra and Okta app containment, and the purge and block of a phishing message. The two tests that pin the runbook gate count (`scripts/gate-r-class.test.js`, `scripts/audit/read-back-field.test.js`) will need their numbers raised by exactly the new gates.
- **Verified means:** `node --test scripts/command-safety-gates.test.js scripts/markdown-links.test.js scripts/repository-structure.test.js scripts/eval/judged/cases.test.js` fails only the 41 known pwsh names; `node scripts/lint/command-structure.js` is clean; `node scripts/lint/ladder-audit.js --check` exits 0; every dev case parses with `readCaseFile`; a full `node --test` run fails no test name that the base commit `08963bf` did not already fail in this worktree; `node scripts/pre-commit-check.js` passes on each staged set.

## What happened against the hypothesis

The shape held: seven runbooks, 16 new gates, everything else routed to existing gates. It was wrong about the registries: five pinned values moved, not two (the gate count in `scripts/gate-r-class.test.js` and `scripts/audit/read-back-field.test.js`, 351 to 367; the runbook count in `scripts/repository-structure.test.js`, 108 to 115; one entry in `NOT_COUNTED` of `scripts/audit/counted-gates.test.js`; and the generated `docs/aegis/owner/vendor-facts-priority.md`, whose header counts runbooks and gates). The other three lanes will move the same numbers: the batch lead sums them at merge time.

## What I built

- **Knowledge module** `knowledge/security/`: `README.md` (scope, file map, which mode when, the escalation in one line, how existing and new runbooks fit), `method.md` (ten steps, the smells, the NIST SP 800-61 four phases mapped onto the Incident answer, severity, deciders and their costs, preservation and chain of custody, communications, the five judgment rules, the lookup tools), `decision-trees.md` (eight trees: mode, severity, contain or watch, the identity revocation order, wipe or not, exposed secret, phishing depth, patch window), `escalation.md` (roles, the matrix by severity, the hand-over), `reading-evidence.md` (retention, Entra and Okta sign-ins, Google audit, mailbox rules, headers, CloudTrail, GuardDuty, the Azure activity log, Google Cloud audit logs, endpoint tools, GitHub and Slack, CVE/CVSS/KEV/EPSS), `failure-catalog.md` (13 entries), `safe-changes.md` (every containment pattern with blast radius, who applies it, rollback, stop and its gate), `sources.md`.
- **Runbooks** (`.claude/commands/`): `/incident-triage` (B, no change), `/identity-compromise` (A, 2 gates), `/leaked-key` (A, 7 gates), `/phishing-bec` (A, 2 gates), `/ransomware-first-hour` (B, 2 gates), `/oauth-app-review` (A, 3 gates), `/vuln-triage` (B, no change). Ten PREVIEW ONLY markers. No gate names a `verify-*` read-back: no connector reads AWS, Google Cloud, Azure app credentials, Defender, Slack app tokens or Okta app status, so each R2 and R3 gate names its console proof instead.
- **Vendor facts** `docs/aegis/batch12/vendor-facts-security.md`: 79 lines, 72 CONFIRMED, 7 UNCONFIRMED.
- **Fixtures** `scripts/demo/fixtures/batch12/security/`: 4 good and 5 flawed answers, indexed in `fixtures.json`.
- **Dev cases** `docs/aegis/batch12/lanes/security-dev-cases.jsonl`: SEC01 to SEC14.
- **Capability rows** `docs/aegis/batch12/lanes/security-capability-rows.md`: S1 to S17.
- **Evidence** `docs/aegis/demo/evidence/batch12/security/`: the four-test run, the lint, the ladder check, the case parse, the fixture check and its script.

## Decisions and why

- **`/leaked-key`, not `/exposed-secret`.** `.gitignore` ignores every path containing "secret", "credential" or "password", so a runbook named `exposed-secret.md` is invisible to git and to every test that lists tracked files. Fixture and case file names avoid those words too.
- **`[CLOUD_ACCOUNT_ID]`, not `[CLOUD_ACCOUNT]`.** The counted-gates test reads any token ending in `COUNT]` as a count; `[CLOUD_ACCOUNT]` matched by accident.
- **Route, do not duplicate.** Entra, Okta and Google containment, MFA, Jamf and Fleet lock and wipe, GitHub alert closing, the Google app block and the Slack app restriction already have gates; the new runbooks name those gate ids in tables (tables are outside the portal grammar, so no unowned candidate appears).
- **Portal first, CLI only where the console cannot.** The one shell gate is the Google Cloud key disable, because Google says the console cannot disable a key (SV-45). AWS CLI lines are reads only (`get-access-key-last-used`, `list-access-keys`, `cloudtrail lookup-events`); the widened scanner at `2f2bcad` reads all three as reads.
- **Turn off, do not delete, attacker persistence.** The inbox rule gate turns the rule off (SV-68); deletion of hidden rules, app grants and Gmail filters is a preview for the security team after export.
- **Severity for a reported phish nobody acted on** is SEV-4 (SEV-3 until the recipients are read): answer-format's SEV-4 reads "a weakness or an exposure", and an attack attempt with no sign it worked is closest to it.
- **Vulnerability triage is an Engineer answer** until a sign of use turns up; then it becomes an Incident answer through `/incident-triage`.
- **The Okta password reset is R2** in the cases, as `/okta-user-lifecycle` classes it; the inbox rule and forwarding gates are R1 (one object, undo is the same toggle).
- **The patch windows** (24 to 72 hours, days, monthly) are defaults marked as such until the organisation sets its own (`[org gap]`).
- **No fresh-context review was started.** The brief says not to start subagents; the owner's rule asks for one before a final report. The lane's evidence files are ready for the batch's evidence-reviewer.

## Left out

- A Google Workspace message purge gate: the investigation tool's delete action and its edition were not confirmed (SV-64); it is a preview.
- AWS, Azure and Google Cloud gates for removing an attacker's IAM user, role assignment or instance: the runbooks capture and hand them to the cloud team as separate changes; a runbook per cloud would be the next step.
- Okta network zone or IP blocking for a password spray: the security lead's decision; no gate.
- A Microsoft Graph PowerShell gate for removing consent grants: PowerShell gates need pwsh to test, which this Mac lacks; it is a preview.
- An Entra "confirm user compromised" step in ID Protection.

## Open questions and things in existing files that look wrong

- `knowledge/security/` names `/security-alert-triage` for Entra session revocation; that runbook's PowerShell gates are among the 41 tests that fail without pwsh, so their fail-closed proof was not re-run here.
- `docs/aegis/answer-format.md` section 9 defines SEV-4 as "a weakness or an exposure with no sign it was used"; a received phish with no action taken fits it only loosely. A sentence there would settle it.
- `capability-map.md` row 12 says Okta containment is missing from the IR runbooks; `/identity-compromise` and `/oauth-app-review` now cover it, so row 12 should be updated when S9 lands.
- The `aws cloudtrail lookup-events` read relies on the widened scanner's read list; if that list narrows, `/leaked-key` Phase C's fence must become a preview.
- The full `node --test` run in this worktree failed 61 names at the base commit `08963bf` without `TMPDIR` set (20 memory and filesystem tests need the temp folder). With `TMPDIR=/private/tmp` near the final head it failed the 41 pwsh names of `docs/aegis/demo/evidence/batch12/baseline/failing-names.txt` plus one name this lane caused and then fixed (`docs/aegis/demo/evidence/batch12/security/full-run-failing-names.txt`). Compare runs with `TMPDIR` set.
