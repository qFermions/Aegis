# Batch 11 quiz (for the owner, before merging)

Answer all five in your own words, then open the answers.

1. A technician asks Aegis "Email not working" and nothing else. What should Aegis answer, and what did it actually do in the scoring run?
2. Why does every test run now say `--model claude-opus-5-5`, and what happens to a scored ticket whose session ran on another model?
3. Give one way a lost-phone answer can still fail the "new way in before the old way out" check, from the practice runs.
4. How would you undo this batch if you merged it and regretted it?
5. Name one thing this batch did not check.

<details>
<summary>Answers</summary>

1. One question and nothing else, asking what happens, for whom and since when (`docs/aegis/answer-format.md` section 7). In the scoring run (DEV22) it asked two separate questions, so the case failed on "answers with one question and nothing else" and "asks more than one question" (`docs/aegis/demo/evidence/batch11/judged-dev-run/summary.md`).
2. Without `--model`, a session runs on the default model in your settings file, which named Fable, and the commander's measure was made on Opus 5.5. Every runner now passes `claude-opus-5-5` unless told otherwise (`scripts/eval/judged/backends.js`, `PINNED_MODEL`), and a scored case whose session reports another model, or none, is INCONCLUSIVE, never a pass (`scripts/eval/judged/judge.js`, `caseVerdict`).
3. Any of: in the tidy T1 answer no step names the checked channel the temporary pass travels on (a call to the number on file, in person, through the manager); in the messy T1m answer the step that issues the pass names no admin role (`full-run-9/summary.md`, `full-run-8/summary.md`).
4. Before merging, close the pull request. After merging, revert the merge commit with `git revert -m 1 <merge commit>` on main and push. Nothing outside the repository was changed apart from the practice runs' local folders under `~/aegis-demo-runs/` and the session's temporary folder, where the scoring run and the six asks were saved.
5. Any of: answers on tickets nobody wrote (only the commander's own cases measure that); a real Microsoft, Google, Okta or Jamf tenant; the tidy tickets T2, T3 and T6; the PowerShell tests, which need `pwsh` and run only in CI; whether the replies sound right to a real person, which you should read.

</details>
