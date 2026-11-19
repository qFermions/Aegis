# Full run 10 (the messy tickets, T1m to T9m, batch 12)

Runs: aegis-b12-messy, aegis-b12-messy-2 (claude-opus-5-5, tool server on, the batch 12 rules). One row per ticket; a ticket the first run did not reach was run in the next folder. The tickets were written by earlier batches' builders and run in earlier batches, so they are not an independent measure.

| ticket | closing state | mode named | Fix card words | gates signed off | lightest step first | tool calls | cost in US dollars |
|---|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | fix-card | 162 | mfa-temporary-access-pass-portal, mfa-method-delete-portal | pass | 0 | 0.47 |
| T2m | RESOLVED (SIMULATED) | fix-card | 174 | gws-offboard-okta-deactivate-portal, gws-offboard-drive-transfer-portal, gws-offboard-calendar-transfer-portal, github-offboard-member-remove-portal, linear-workspace-admin-suspend-portal, slack-user-lifecycle-deactivate-portal | pass | 0 | 0.82 |
| T3m | RESOLVED (SIMULATED) | incident | 0 | jamf-lock-erase-lock-portal, gws-password-reset-password-portal, gws-password-reset-cookies-portal | pass | 0 | 0.67 |
| T4m | RESOLVED (SIMULATED) | fix-card | 165 | shared-mailbox-full-access-portal, shared-mailbox-send-as-portal | pass | 0 | 0.24 |
| T5m | RESOLVED (SIMULATED) | none | 202 | quarantine-release-one-portal | pass | 0 | 0.36 |
| T6m | RESOLVED (SIMULATED) | incident | 0 | okta-user-lifecycle-clear-sessions-portal | pass | 0 | 0.37 |
| T7m | CLARIFY | engineer | 0 | none | pass | 0 | 0.18 |
| T8m | RESOLVED (SIMULATED) | fix-card | 204 | mailbox-full-access-grant-portal | pass | 0 | 0.32 |
| T9m | RESOLVED (SIMULATED) | fix-card | 208 | okta-mfa-reset-clear-sessions-portal | pass | 0 | 0.26 |

Total cost of the sessions: 3.70 US dollars.

The batch 12 rows (docs/aegis/answer-format.md sections 2 and 9; a rule that does not cover the ticket shows as "-"):

| ticket | answer mode row | escalate on compromise | least privilege | safe recovery | ask first when risky | Fix card 150 words |
|---|---|---|---|---|---|---|
| T1m | fail | - | - | - | - | fail |
| T2m | fail | - | - | - | - | fail |
| T3m | fail | - | - | - | - | fail |
| T4m | fail | - | fail | - | - | fail |
| T5m | fail | - | - | - | - | fail |
| T6m | fail | pass | - | - | fail | fail |
| T7m | fail | - | - | - | - | fail |
| T8m | fail | - | - | - | - | fail |
| T9m | fail | - | - | - | - | fail |

Side by side with full-run-8 (batch 11, the same tickets):

| ticket | closing state then | closing state now | card words then | card words now | cost then | cost now |
|---|---|---|---|---|---|---|
| T1m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 247 | 162 | 0.32 | 0.47 |
| T2m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 215 | 174 | 0.71 | 0.82 |
| T3m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 236 | 0 | 0.64 | 0.67 |
| T4m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 208 | 165 | 0.33 | 0.24 |
| T5m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 249 | 202 | 0.31 | 0.36 |
| T6m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 197 | 0 | 0.32 | 0.37 |
| T7m | CLARIFY | CLARIFY | 235 | 0 | 0.24 | 0.18 |
| T8m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 189 | 204 | 0.24 | 0.32 |
| T9m | RESOLVED (SIMULATED) | RESOLVED (SIMULATED) | 242 | 208 | 0.42 | 0.26 |

The desk pages (desk.html, desk-rerun.html) and the terminal capture are saved with each simulated customer address written [USER@DOMAIN.COM]: the demo customers use reserved example domains, and the commit scanner refuses any address shape.
