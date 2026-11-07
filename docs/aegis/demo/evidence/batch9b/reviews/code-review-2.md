# Code review 2, batch 9b (/code-review xhigh 2eb7ee7...HEAD, the new diff only, at 29583d6)

15 findings, as returned (file:line, then the claim in short). The reviewer ran: the loop and customers tests 20 of 20; both lints exit 0; command-safety-gates 477 tests, 41 fail (the pwsh-only baseline); the desk tests for 9b, T9m and sessions 16 of 16; the scanner --all exit 0; the release-boundary check; the wrapper with 17 argument sets; the README's ladder sentence against the real catalog (accurate).

1. .claude/commands/okta-mfa-reset.md:249: "every read-back this ticket ran passed" lets a skipped read-back count as passed.
2. checks.md:81: the battery was not rerun though the row says fixed.
3. tools/claude-cap.sh:9: non-numeric values (abc, -1, nan, 1.5.0) pass unclamped; a flag after --max-budget-usd is taken as its value.
4. checks.md:40: the /code-review row still says not run; row 30 cites the 9523ad7 battery.
5. .claude/commands/okta-mfa-reset.md:253: no completed Jira form for the session clear then the reset.
6. scripts/demo/step-ladder.js:25: altitude: the README describes the false pass instead of fixing it.
7. checks.md:74: round 1 fixed several findings per commit.
8. cr1-runbook-red.txt:28: only the first failing assertion shows red; the mutation claim has no capture.
9. claude-cap-selfcheck.txt:1: a description, not a command; no committed script.
10. docs/explainers/batch9b-okta-loop-gate.md:16: stale (the shared entry; the runbook changes; the ladder decision).
11. PROJECT_STATE.md:251: cites 9/9; no rows for round 1's changes.
12. scripts/okta-verify-loop.test.js:131: the PORTAL ACTION test does not assert the gate or its block.
13. .claude/commands/okta-mfa-reset.md:240: "the items below do not apply" can swallow the compromise item.
14. .claude/commands/okta-mfa-reset.md:36: the Fast path names only Phase B as the last resort.
15. scripts/okta-verify-loop.test.js:173: an unused variable.

Not checked by the review: CI with pwsh; the full battery at HEAD; how the real claude CLI parses a bad or repeated --max-budget-usd.

What was done with each finding: checks.md, "Review rounds".
