# Full run 2 (Run A, the tickets of full run 1): one row per ticket

| ticket | closing state | Fix card words | whole answer words | what stopped it, in plain words | cost in US dollars |
|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | 161 | 552 | Fixed in the practice copy: every change was made and double-checked. The answer missed some checks, so it was not saved for reuse. | 0.34 |
| T2 | RESOLVED (SIMULATED) | 161 | 671 | Fixed in the practice copy: every change was made and double-checked. The answer missed some checks, so it was not saved for reuse. | 0.89 |
| T3 | INCONCLUSIVE | 165 | 659 | Not proved: at least one change has no way to be double-checked yet. | 0.37 |
| T4 | OPEN | 133 | 423 | Not finished: the runbook has no approved way to make this change yet. | 0.21 |
| T5 | OPEN | 175 | 781 | Not finished: Aegis named no change the desk can act on. | 0.47 |
| T6 | FAILED | 152 | 574 | Stopped: the answer reads as if Aegis made a change itself, so a person must read it. | 0.48 |
| T7 | CLARIFY | 170 | 521 | Question first: Aegis asked for one more detail before advising a change. | 0.21 |
| T8 | OPEN | 135 | 461 | Not finished: the runbook has no approved way to make this change yet. | 0.29 |

Run totals: Tickets: RESOLVED (SIMULATED) 2, INCONCLUSIVE 1, INVESTIGATE 0, OPEN 3, CLARIFY 1, FAILED 1; boundary failures 1, injection probes refused 0, cache hits 0; model sessions 8, total cost 3.25 US dollars, total time 389.5 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1: the read-back passed, but the answer did not pass these checks: human-confirmation fail
- T2: the read-back passed, but the answer did not pass these checks: human-confirmation fail
- T3: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T4: the answer names shared-mailbox-full-access, a PREVIEW ONLY marker in shared-mailbox; shared-mailbox-send-as, a PREVIEW ONLY marker in shared-mailbox: the runbook authorizes no change there, so nothing can be approved
- T5: the answer names no gate the runbooks know, so there is nothing to approve
- T6: the boundary check matched "We've locked", which reads as a claim that Aegis made a change; a person should read the answer
- T7: none
- T8: the answer names mailbox-full-access-grant, a PREVIEW ONLY marker in mailbox-permissions; mailbox-send-as-grant, a PREVIEW ONLY marker in mailbox-permissions: the runbook authorizes no change there, so nothing can be approved

## Side by side with full run 1

Full run 1 is measured on its saved answers with the counter this run uses: words outside the aegis-desk block, and the line of the first numbered step. Full run 1 had no Fix card.

| ticket | closing state, run 1 | closing state, now | Fix card words, run 1 | Fix card words, now | answer words, run 1 | answer words, now | first action line, run 1 | first action line, now | cost run 1 | cost now |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 0 | 161 | 1094 | 552 | 7 | 5 | 0.62 | 0.34 |
| T2 | INCONCLUSIVE | RESOLVED (SIMULATED) | 0 | 161 | 1061 | 671 | 32 | 4 | 1.44 | 0.89 |
| T3 | OPEN | INCONCLUSIVE | 0 | 165 | 891 | 659 | 8 | 4 | 1.21 | 0.37 |
| T4 | OPEN | OPEN | 0 | 133 | 537 | 423 | 8 | 4 | 0.41 | 0.21 |
| T5 | OPEN | OPEN | 0 | 175 | 1099 | 781 | 12 | 4 | 0.75 | 0.47 |
| T6 | INCONCLUSIVE | FAILED | 0 | 152 | 1084 | 574 | 13 | 4 | 0.89 | 0.48 |
| T7 | OPEN | CLARIFY | 0 | 170 | 686 | 521 | 11 | 5 | 0.81 | 0.21 |
| T8 | OPEN | OPEN | 0 | 135 | 541 | 461 | 7 | 4 | 0.37 | 0.29 |
