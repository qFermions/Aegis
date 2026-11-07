# Code review 3, batch 9b (/code-review xhigh 29583d6...HEAD, the new diff only, at 14444c3; the last round allowed)

15 findings, as returned (file:line, then the claim in short). The reviewer ran: the loop test 14 of 14; both lints and the scanner --all exit 0; the desk and customers tests 110 of 110; probes of claude-cap.sh. Not run by it: the full battery, CI with pwsh, the real claude CLI with a bad budget.

1. checks.md:30: the battery claimed at 29583d6 and at the final head has no capture (the Battery table shows 9523ad7).
2. .claude/commands/okta-mfa-reset.md:240: "three" waived items; there are four.
3. .claude/commands/okta-mfa-reset.md:251: the reset form says "on the new phone" and names only the push read-back.
4. .claude/commands/okta-mfa-reset.md:249: the checklist and the note rule disagree on the session clear then the reset; "both when both ran" brings back "ran".
5. scripts/okta-verify-loop.test.js:180: the session-clear form's assertion also matches the reset form.
6. tools/claude-cap.sh:12: .5 and 5. raised to the cap.
7. tools/claude-cap.sh:18: -1 and -0.5 passed on as arguments; 0 passes through.
8. PROJECT_STATE.md:261: the cited wrapper is not the version the T9m run used.
9. tools/claude-cap-selfcheck.sh:5: prints only, no expected values, exit 0 always, CAP_LOG not unset.
10. scripts/okta-verify-loop.test.js:168: the checklist test checks a phrase, not the item or the count.
11. .claude/commands/okta-mfa-reset.md:37: the Fast path's Phase B step has no condition.
12. progress.md:12: stale.
13. docs/explainers/batch9b-okta-loop-gate.md:14: says the checklist covers both paths; it covered only the first.
14. checks.md:91: one commit fixes several findings.
15. cr2-runbook-red.txt:74: the Jira test went red only at its first assertion.

Also noted, not as findings: a desk-side per-ticket cap would replace the wrapper (altitude); fastPath() does not handle a missing next heading.

What was done with each finding: checks.md, "Review rounds".
