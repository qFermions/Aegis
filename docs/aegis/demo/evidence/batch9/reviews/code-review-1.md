# Code review, round 1 (/code-review xhigh, 73bdc68...HEAD at abb02ed)

15 findings. Each fix is its own commit with a test that failed first (`docs/aegis/demo/evidence/batch9/cr1-NN-red.txt` and `-green.txt`).

| # | File | Finding | Outcome | Commit |
|---|---|---|---|---|
| 1 | scripts/aegis-chat.js | no SIGINT handler: one Ctrl-C left claude on the terminal | fixed | 19362d2 |
| 2 | scripts/eval/judged/checks.js | an Aegis claim inside a user message passed the boundary check | fixed | 517d1cb |
| 3 | scripts/ask-aegis.js | the typed ticket skipped the intake's redaction and credential block | fixed | a53d763 |
| 4 | .claude/commands/email-quarantine.md | unquoted [MESSAGE_ID] and [MESSAGE_IDENTITY_GUID] break in a shell | fixed | 329e9e0 |
| 5 | scripts/demo/answer.js | a plan word anywhere in a clause hid a done claim before it | fixed | c17a2cb |
| 6 | scripts/demo/answer.js | "has been <any participle>" failed acknowledgements | fixed | 5ae3c87 |
| 7 | scripts/demo/answer.js | a negation anywhere earlier in a clause cancelled a change word; Details list lines unread | negation fixed (f0a9c50); Details closed: task 9 asks Details lines to be read as mentions, and INVESTIGATE approves and applies nothing | f0a9c50 |
| 8 | scripts/lint/ladder-audit.js | Try first and Lighter step lines not counted as lighter admin steps by the desk row | fixed; the device-full-wipe case (its only lighter step is a PREVIEW ONLY marker, so the row fails a wipe-first answer) closed: that is the rule, a row that never stops a ticket | 1bc9516 |
| 9 | scripts/lint/ladder-audit.js | twins inside <details> filed under the last heading | fixed (5bce2cc), and eight reference blocks in scope given their line (8a4612b) | 5bce2cc, 8a4612b |
| 10 | scripts/intake/assistant-address.js | field lines (Model:, Agent:, Tool:) and "skip the review meeting" flagged | fixed | faaa495 |
| 11 | scripts/eval/judged/checks.js | "Phrase: none" counted as a confirmation | fixed | 6bc2118 |
| 12 | scripts/demo/answer.js | the Details pointer under the when-done line joined the message; a long intro line left the count | fixed | 0e51156 |
| 13 | .claude/commands/jamf-lock-erase.md, mailbox-permissions.md | the API wipe twin and the Full Access removal named no read | fixed | ee9ca8c, a1e1107 |
| 14 | .claude/commands/email-quarantine.md | [MESSAGE_ID] defined in a runbook, not in the placeholder dictionary | fixed (the dictionary is outside the charter's list; CLAUDE.md wins) | 1ddb57e |
| 15 | scripts/ask-aegis.js | copied desk constants; a budget that rounds to 0.00 | rounding fixed (b37b3e8); the copy closed: customer-desk.js does not export sessionEnv or its limits, exporting them changes the desk module's interface, and the copy carries a comment naming its source | b37b3e8 |
