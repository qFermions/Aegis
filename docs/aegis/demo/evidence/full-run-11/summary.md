# Full run 11 (the tidy tickets, T1 to T8, batch 12)

Runs: aegis-b12-tidy, aegis-b12-tidy-2 (claude-opus-5-5, tool server on, the batch 12 rules). One row per ticket; a ticket the first run did not reach was run in the next folder. The tickets were written by earlier batches' builders and run in earlier batches, so they are not an independent measure.

| ticket | closing state | mode named | Fix card words | gates signed off | lightest step first | tool calls | cost in US dollars |
|---|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | none | 197 | mfa-temporary-access-pass-portal, mfa-method-delete-portal | pass | 0 | 0.35 |
| T2 | RESOLVED (SIMULATED) | fix-card | 181 | okta-user-lifecycle-deactivate-portal, github-offboard-member-remove-portal, linear-workspace-admin-suspend-portal | fail | 0 | 0.84 |
| T3 | RESOLVED (SIMULATED) | none | 0 | jamf-lock-erase-lock-portal, gws-password-reset-cookies-portal | pass | 0 | 0.49 |
| T4 | RESOLVED (SIMULATED) | none | 173 | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0 | 0.28 |
| T5 | RESOLVED (SIMULATED) | none | 206 | quarantine-release-one-portal | pass | 0 | 0.53 |
| T6 | RESOLVED (SIMULATED) | incident | 0 | okta-user-lifecycle-suspend-portal, okta-user-lifecycle-reset-password-portal, okta-user-lifecycle-unsuspend-portal | pass | 0 | 0.26 |
| T7 | CLARIFY | ask-first | 0 | none | pass | 0 | 0.25 |
| T8 | RESOLVED (SIMULATED) | fix-card | 159 | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0 | 0.17 |

Total cost of the sessions: 3.17 US dollars.

The batch 12 rows (docs/aegis/answer-format.md sections 2 and 9; a rule that does not cover the ticket shows as "-"):

| ticket | answer mode row | escalate on compromise | least privilege | safe recovery | ask first when risky | Fix card 150 words |
|---|---|---|---|---|---|---|
| T1 | fail | - | - | - | - | fail |
| T2 | fail | - | - | - | - | fail |
| T3 | fail | pass | - | - | - | fail |
| T4 | fail | - | fail | - | - | fail |
| T5 | fail | - | - | - | - | fail |
| T6 | fail | fail | - | - | fail | fail |
| T7 | fail | - | - | - | - | fail |
| T8 | fail | - | - | - | - | fail |

Side by side with full-run-9 (batch 11, the same tickets):

| ticket | closing state then | closing state now | card words then | card words now | cost then | cost now |
|---|---|---|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 175 | 197 | 0.34 | 0.35 |
| T2 | not run | RESOLVED (SIMULATED) | - | 181 | - | 0.84 |
| T3 | not run | RESOLVED (SIMULATED) | - | 0 | - | 0.49 |
| T4 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 181 | 173 | 0.23 | 0.28 |
| T5 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 184 | 206 | 0.38 | 0.53 |
| T6 | not run | RESOLVED (SIMULATED) | - | 0 | - | 0.26 |
| T7 | CLARIFY | CLARIFY | 197 | 0 | 0.18 | 0.25 |
| T8 | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 181 | 159 | none | 0.17 |

The desk pages (desk.html, desk-rerun.html) and the terminal capture are saved with each simulated customer address written [USER@DOMAIN.COM]: the demo customers use reserved example domains, and the commit scanner refuses any address shape.
