# Batch 6 quiz: the Customer Desk demo

Answer all five before you merge. The answers are collapsed below.

1. What does `node scripts/demo/customer-desk.js` do with no flags, and what does `run --execute` add?
2. In `scripts/demo/customer-desk.js`, which single condition lets a ticket close as RESOLVED (SIMULATED), and why is exit 0 from the connector not enough on its own?
3. T4 asks for a shared mailbox with Full Access and Send As. Why does it end OPEN in a real run, and what does that do to T8?
4. How do you undo this batch, and what does the undo leave behind on the Mac?
5. Name one thing this work did not verify.

<details>
<summary>Answers</summary>

1. With no flags it is a dry run: it prints the plan and an allowance estimate, starts no model, creates no folder and exits 4. `run --execute` runs the tickets: up to one real Aegis session each, on your subscription, with results in `~/aegis-demo-runs/<run-id>/`.
2. Every read-back must pass: `verdicts.every((v) => v.state === 'PASS')` in `workTicket`. Exit 0 is not enough because `readBack` also links the audit entry to the change and asks `change-record.js status`; only a change that reads done counts as PASS. An exit 0 with a change that does not read done is INCONCLUSIVE.
3. `.claude/commands/mailbox-permissions.md` has only a PREVIEW ONLY marker for the grant (`mailbox-grant-portal`), not a SAFETY GATE, and no connector reads Exchange delegation, so nothing can be approved or proved. Since T4 is not verified, nothing enters Customer E's replay store, and T8 is a replay MISS that gets its own session. The CACHE_HIT is proved only in a test with a fixture gate.
4. `git revert` the merge commit of the pull request. It removes `scripts/demo/`, `docs/aegis/demo/`, the explainers, the CI step and the flag change in `scripts/eval/judged/backends.js`, and puts the G4 tables back. Run folders stay in `~/aegis-demo-runs/`, outside the repository; delete them by hand if you want them gone.
5. Any of: the six tickets not run (T1, T2, T3, T5, T7, T8) with a real model; answer quality, since the builder wrote the tickets; the connectors against a real vendor, since every answer comes from the simulated tenant; the 41 PowerShell tests on this Mac, which has no `pwsh` (CI runs them).
</details>
