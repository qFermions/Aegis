# Code review 1, batch 9b (/code-review xhigh c0f3757...HEAD; HEAD moved during the review, every finding rechecked at 2eb7ee7)

14 findings, as returned (file:line, then the claim in short):

1. scripts/demo/step-ladder.js:25: "lightest step first" reads only the first gate's own section, so a T9m answer naming okta-mfa-reset-selected-portal first passes; scripts/demo/README.md:92 said it fails.
2. .claude/commands/okta-mfa-reset.md:236: the Verification checklist and Jira note cover only the reset path; the completed note needs "every read-back above passed".
3. checks.md:53: records fixes not in the tree (progress.md "fixed", the head battery "rerun").
4. progress.md:10: stale (Open issues none; Next action already done).
5. docs/aegis/demo/evidence/batch9b/T9m/summary.md:23: RESOLVED proves both simulated gates, the R2 reset included; a resolved answer is eligible for the run's replay store.
6. scripts/demo/customers/tickets-messy.json:170: T9m's expected_path still names the PREVIEW ONLY marker (printed by the dry run).
7. .claude/commands/okta-mfa-reset.md:97: the Gotcha leaves out L-13c (Classic Engine keeps the MFA cookie).
8. .claude/commands/okta-mfa-reset.md:77: altitude: a second copy of Phase C's gate; the PORTAL ACTION steps can drift.
9. .claude/commands/okta-mfa-reset.md:12: [NOT_BEFORE] not defined in the Placeholders line; the connector refuses any form but ISO 8601 UTC.
10. .claude/commands/okta-mfa-reset.md:33: the Fast path skips the loop section.
11. docs/aegis/demo/evidence/batch9b/tools/claude-cap.sh:9: replaces the desk's value instead of taking the smaller; misses the = form.
12. scripts/demo/sim/gates.js:75: the new entry copies Phase C's; the test re-imports SIM_GATES.
13. scripts/okta-verify-loop.test.js:152: a redundant assertion.
14. .claude/commands/okta-mfa-reset.md:99: the admin step is not in the numbered sequence.

Not checked by the review: CI with pwsh at the new head; the replay-store side of finding 5 was inferred, not seen in a run.

What was done with each finding: checks.md, "Review rounds".
