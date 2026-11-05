# Batch 6: the Customer Desk demo, for the owner

**What you get.** One command plays a support desk end to end, so you can watch how far Aegis has come, step by step, on tickets a customer would really send. Details: `scripts/demo/README.md`.

```bash
node scripts/demo/customer-desk.js
node scripts/demo/customer-desk.js run --execute
```

The first line is a dry run: it shows the plan and the allowance and starts nothing. The second runs all eight tickets, up to 8 sessions on your subscription.

**What it is not.** It is not an evaluation. The builder wrote the tickets, so a run shows the pipeline works, not that the answers are good. The held-out evaluation measures quality.

**The nine steps of every ticket.**

1. CUSTOMER sends the raw email or Slack thread (SIMULATED: fictional customers).
2. INTAKE (REAL) checks the tenant, redacts, flags injected text, makes the case.
3. TRIAGE (REAL) looks in the replay cache and reads the risk floor.
4. AEGIS (REAL) answers: a real session, read-only, loading only this repository's settings; or a replay of a verified answer, with no model.
5. CHECKS (REAL) grade the answer. A boundary failure stops the ticket: FAILED.
6. APPROVAL (REAL code, SIMULATED person) opens the change record and records the approval.
7. SIMULATED OPERATOR makes the change, in the simulated tenant file inside the run folder. This is the only code that changes anything.
8. READ-BACK (REAL connector, SIMULATED tenant) runs the connector's own code and shows PASS, FAIL or INCONCLUSIVE.
9. CLOSE records RESOLVED (SIMULATED), INCONCLUSIVE, OPEN, CLARIFY or FAILED, and drafts the note.

**What you will see, and why it is useful.** The demo does not tune a runbook to pass a ticket, so the gaps show:

- T4 (shared mailbox) ends OPEN. The runbook has only a PREVIEW ONLY marker for the grant, and no connector reads Exchange delegation.
- T8 therefore misses the cache and gets its own session. The cache hit is proved only in a test, with a fixture gate. Closing this gap is a decision for you.
- T3 and T5 end INCONCLUSIVE: their gates say `Read-back: none`.

**What changed outside the demo.** One thing: `scripts/eval/judged/backends.js` now gives both sessions `--setting-sources project --strict-mcp-config` and a `--settings` value that excludes every CLAUDE.md above the repository and turns auto memory off, so a demo or an evaluation measures Aegis, not whatever is on the machine that day. The first real run showed why the exclusion is needed: with project settings alone your `~/.claude/CLAUDE.md` still loaded (`docs/aegis/demo/evidence/isolation-probe.txt`). The two real sessions ran before this fix.

**The first real run (T4 and T6, 3.07 US dollars).** T4 ended OPEN, as expected. T6 ended FAILED, on a false alarm: the answer refused the injected line and was sound, but its sentence "I ran no commands" tripped the boundary check in `scripts/eval/judged/checks.js`, which does not read a negation. That sentence came from your own rules leaking in. The check is left as it is, for you to decide. Output: `docs/aegis/demo/evidence/smoke-run.txt`.

**How to undo it.** Everything lives under `scripts/demo/`, `docs/aegis/demo/` and these explainer files, plus that one flag change, one CI step and the moved tables. Revert the merge; a run writes only to `~/aegis-demo-runs/`, which you can delete.
