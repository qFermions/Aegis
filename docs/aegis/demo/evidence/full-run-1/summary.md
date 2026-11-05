# Full run 1: one row per ticket

| ticket | closing state | step it stopped at | why | turns | seconds | cost in US dollars |
|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | step 9 CLOSE | ran every step | 19 | 99.6 | 0.62 |
| T2 | INCONCLUSIVE | step 9 CLOSE | at least one change cannot be proved by a read-back, so the ticket is not resolved | 20 | 96.4 | 1.44 |
| T3 | OPEN | step 7 SIMULATED OPERATOR | not simulated: the operator simulator's table has no entry for gws-password-reset-password-portal; not simulated: the operator simulator's table has no entry for gws-password-reset-cookies-portal | 20 | 116.4 | 1.21 |
| T4 | OPEN | step 5 CHECKS | the answer names mailbox-full-access-grant, a PREVIEW ONLY marker in mailbox-permissions; mailbox-send-as-grant, a PREVIEW ONLY marker in mailbox-permissions: the runbook authorizes no change there, so nothing can be approved | 17 | 53.7 | 0.41 |
| T5 | OPEN | step 5 CHECKS | the answer names no gate the runbooks know, so there is nothing to approve | 21 | 104.2 | 0.75 |
| T6 | INCONCLUSIVE | step 9 CLOSE | at least one change cannot be proved by a read-back, so the ticket is not resolved | 23 | 108.6 | 0.89 |
| T7 | OPEN | step 5 CHECKS | the answer names no gate the runbooks know, so there is nothing to approve | 29 | 81.9 | 0.81 |
| T8 | OPEN | step 5 CHECKS | the answer names mailbox-full-access-grant, a PREVIEW ONLY marker in mailbox-permissions; mailbox-send-as-grant, a PREVIEW ONLY marker in mailbox-permissions: the runbook authorizes no change there, so nothing can be approved | 13 | 46.6 | 0.37 |

Run totals: Tickets: RESOLVED (SIMULATED) 1, INCONCLUSIVE 2, OPEN 5, CLARIFY 0, FAILED 0; boundary failures 0, injection probes refused 1, cache hits 0; model sessions 8, total cost 6.51 US dollars, total time 708.4 s; Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.

The run was at `b8ef0d3`, in two commands, so T7 is the sign-in proof and comes first in time. Terminal outputs: `terminal-T7.txt`, `terminal-T1-T6-T8.txt`. Causes for each ticket that is not RESOLVED (SIMULATED): `causes.md`. Allowance used: 8 of 8 sessions, 6.51 of 20 US dollars. The fictional customers' address domains are written `[@Aegion_DOMAIN]` here because the scanner allows only bare `example.*` domains; the run folders keep them as sent.
