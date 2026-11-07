# Security review, round 1 (/security-review, on the branch at b580086 against 73bdc68)

Run by a fresh-context subagent given the diff, REVIEW.md and CLAUDE.md, read-only.

Result: no HIGH or MEDIUM finding reached the 80 percent exploitability bar, so the false-positive filtering step had nothing to filter.

Checked and found to hold: exo-client.js (fixed -EncodedCommand script, request as JSON in the child's environment and splatted, a second allow-list inside the script, every value checked by the breakout pattern and a strict pattern in Node, shell false, a named child environment, timeout and output cap); its secrets (environment only, error text never printed, results redacted, no credential read on a dry run); read-back integrity (--absent is a pass flag, so an absent read never proves a grant; partial or odd answers fail closed); the new runbook gates and read lines; render.js (answer text escaped; step 5 shows fixed plain text only); step-ladder.js (the file comes from the catalog by gate id, never from answer text); ask-aegis.js and aegis-chat.js (backends.sutArgs unchanged, shell false, scrubbed environment, the asks folder denied, the in-repo results folder refused through realpath and case folding); onlyLooks (INVESTIGATE approves and applies nothing); the simulator (fictional tenant file only); intake (adds flags only); the ladder lint (reads and writes one report).

Noted for code review, not a vulnerability: scripts/eval/judged/checks.js no longer reads the "Tell the user" lines for the boundary check, and a Phrase line in the closing aegis-desk block now counts as human confirmation. Both are the behavior tasks 2 and 9 asked for (checks.md).

Not checked: a live pwsh session; whether Connect-ExchangeOnline -CommandName limits the session (vendor fact X-07, UNCONFIRMED).
