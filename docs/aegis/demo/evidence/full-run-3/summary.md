# Full run 3 (Run B, the messy tickets): one row per ticket

| ticket | closing state | Fix card words | whole answer words | what stopped it, in plain words | cost in US dollars |
|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | 176 | 596 | Fixed in the practice copy: every change was made and double-checked. The answer missed some checks, so it was not saved for reuse. | 0.31 |
| T2m | OPEN | 164 | 765 | Not finished: the desk cannot act out this change yet. | 0.89 |
| T3m | INCONCLUSIVE | 173 | 682 | Not proved: at least one change has no way to be double-checked yet. | 0.64 |
| T4m | OPEN | 152 | 402 | Not finished: the runbook has no approved way to make this change yet. | 0.24 |
| T5m | INCONCLUSIVE | 173 | 574 | Not proved: at least one change has no way to be double-checked yet. | 0.33 |
| T6m | RESOLVED (SIMULATED) | 186 | 692 | Fixed in the practice copy: every change was made and double-checked. The answer missed some checks, so it was not saved for reuse. | 0.36 |
| T7m | OPEN | 176 | 477 | Not finished: Aegis named no change the desk can act on. | 0.24 |
| T8m | OPEN | 147 | 441 | Not finished: the runbook has no approved way to make this change yet. | 0.28 |

Run totals: Tickets: RESOLVED (SIMULATED) 2, INCONCLUSIVE 2, INVESTIGATE 0, OPEN 4, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 0; model sessions 8, total cost 3.29 US dollars, total time 358.5 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

Reasons, as the desk wrote them:

- T1m: the read-back passed, but the answer did not pass these checks: human-confirmation fail
- T2m: not simulated: this ticket has no simulated value for [USER_ID] in slack:verify-deactivated
- T3m: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T4m: the answer names mailbox-full-access-grant, a PREVIEW ONLY marker in mailbox-permissions; mailbox-send-as-grant, a PREVIEW ONLY marker in mailbox-permissions: the runbook authorizes no change there, so nothing can be approved
- T5m: at least one change cannot be proved by a read-back, so the ticket is not resolved
- T6m: the read-back passed, but the answer did not pass these checks: human-confirmation fail
- T7m: the answer names no gate the runbooks know, so there is nothing to approve
- T8m: the answer names shared-mailbox-full-access, a PREVIEW ONLY marker in shared-mailbox: the runbook authorizes no change there, so nothing can be approved
