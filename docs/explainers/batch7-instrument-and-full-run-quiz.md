# Batch 7 quiz: the instrument and the full run

Answer all five before you merge. The answers are collapsed below.

1. What did this batch change, and what did it leave alone on purpose?
2. In `scripts/eval/judged/checks.js`, why does the negation count only when the actor starts the sentence? Give a sentence that this rule catches.
3. T6 closed INCONCLUSIVE even though the simulated operator applied all 3 gates. Why, and why does simply naming `verify-status` as the read-back not fix it?
4. How do you undo this batch, and what does the undo leave behind?
5. Name one thing this work did not verify.

<details>
<summary>Answers</summary>

1. It fixed the instrument: the grader's false positive, the sessions' read limits, the replay sentence in the prompt, 40 turns with no session record, tier C for `scripts/demo/**`, the account name in the tree, and the stale temp folder in the tripwire. It then ran all eight tickets. It left the runbooks, `CLAUDE.md`, `PRODUCT_CONTRACT.md` and the connectors' behavior alone, so the run is the honest "before" picture.
2. The check reads forward from the verb, so without this rule an exception placed before the actor is invisible. "Except for the reset, I ran no commands." claims a change, and it failed at `e56f0ab` but passed one version of tonight's fix until security review 4 caught it.
3. All three are R1 Okta gates, an R1 gate takes no change record, and the desk proves a read-back only through a change record, so 0 of 3 could be proved. Naming the read alone fails `scripts/audit/change-record.js:217`, which refuses a read-back on an R1 gate. Even after a re-class to R2, the desk applies every gate before any read-back, so `verify-status --status SUSPENDED` would read ACTIVE after the unsuspend and close T6 FAILED. Nothing was changed tonight.
4. Close PR #12 before a merge, or `git revert -m 1 <merge commit>` after one. The commit that put the account name in the tree stays in pushed history either way. Run folders stay in `<home>/aegis-demo-runs/`, outside the repository.
5. Any of: answer quality, since the builder wrote the tickets; any fix proposed in `causes.md`, none of which was built; a real vendor, since every answer comes from the simulated tenant; the grader sentences listed in `checks.md` that still pass; a judged run's custom `--results-dir`, which is not denied; the 41 PowerShell tests on this Mac (CI runs them).
</details>
