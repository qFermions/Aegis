# Evidence review 1, batch 9b (the evidence-reviewer agent, at d914023)

The reviewer could not run git; commit order came from the list it was given plus the captures. Its report, as returned (13 findings: 5 important, 5 nits, 3 pre-existing):

## Verdicts it gave

- Baseline: pass. Task 1 rewrite: pass (nits: the marker check read only top-level files; the field comparison skipped a reused Phase C id). Task 1 red before green: pass (the test fix after the runbook edit is disclosed and does not weaken the test).
- Task 2 marker replaced, user checks and last resort untouched: pass; Source line matches the owner's text. Gate fields equal Phase C's: pass, all seven identical, PORTAL ACTION steps 2 and 3 identical, step 1 adds only the Dashboard route; the own id is justified by command-safety-gates.test.js:1440 and :1504.
- Task 2 Gotcha: fail. The runbook said More Actions is offered only for active users; Okta and L-13b say the Clear User Sessions action is active-only, and the repo itself uses More Actions on a Locked Out user (okta-user-lifecycle.md:109). Same wording in the quiz answer 3 and, ambiguously, explainer line 14.
- Task 2 not tuned to T9m: pass for the new text; pre-existing: the Purpose line's "(already done, per the ticket)".
- Task 2 lints: pass for the exits; unresolved for "no lint change" (no saved output).
- Task 3 inventory through its generator: pass. L-13: pass for link and date; it noted the quoted owner's words differ from the OWNER LINE and could not open the owner's original message. PROJECT_STATE: pass (the 9b table leaves out the T9m run, task 5 and the moved counts). No PREVIEW ONLY use: pass at 8533733, not rerun at d914023. Full battery: pass at 9523ad7, unresolved at d914023.
- Task 4 prediction before the run: pass (the 208 words missed the predicted 170 to 200, not called out). T9m run: pass; the desk simulated the last-resort reset too, disclosed. No desk change made to force a pass: pass, owner to confirm (the entry copies Phase C's effect, changes no check, the real read-back still decides, and the hypothesis predicted it before the first edit).
- Task 5: pass (title). Tests for each changed behavior and count pins: pass. No em dashes: pass.
- No names: fail. dash-and-name-check.txt itself held the two words it searched for. Employer names were never searched.
- Scan after git add: fail for 0fbbce0; unresolved for the rest (no saved outputs). Push after the battery at the pushed commit: unresolved (no saved push output).
- Explainer: pass for length (29 lines); fail for completeness: no mention of the simulator entry or the 208-word card.

## Findings

Important: 1. the name-check capture held the names; 2. the Gotcha named the wrong control; 3. the battery, marker grep and dash check not rerun at the head; 4. the scan row marked pass despite a deviation; 5. the explainer left out two facts.
Nits: 1. progress.md stale; 2. the marker check not recursive; 3. a reused Phase C id not field-checked; 4. "no lint change" without a capture; 5. the T9m summary did not call out the missed word count.
Pre-existing: 1. the Purpose line tied to T9m; 2. the T9m session holds the Task tool while shell-holding agents are registered; 3. the desk runs every gate in a block, including one the answer calls conditional.

Not verified by the reviewer: commit order, the push, the content of 6e37786's diff; the L-13 quotes only through a summarizing fetch.

What was done with each finding: `checks.md`, section "Evidence review 1".
