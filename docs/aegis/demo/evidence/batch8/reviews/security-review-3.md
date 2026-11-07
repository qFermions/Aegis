# Security review, round 3 (batch 8)

Range: `git diff 4b60407..8e6e589` (the code review round 2 fixes). One review subagent.

**1 finding, Low to Medium, confidence 8:** `scripts/demo/answer.js:76` (at 8e6e589). Text in "Do this" before the first numbered step, the text on the "Do this:" label line, and a numbered step filed under another part after a stray label were never scanned for change words, so a Gate: none answer that asks for a change there could close INVESTIGATE ("Look first"). Nothing is applied either way; the label and its reason are wrong. The behavior was the same at 4b60407.
Fixed: `onlyLooks` also scans the "Do this" text outside the steps and every numbered line of the card; test "a change hidden before the first step, on the label line, or after a stray label still counts"; red `batch8/sr3-red.txt`.

Checked and clean: the answer's Read-back lines are never parsed or run (`catalog.js:71-76`, `customer-desk.js:293-311`); the CLAUDE.md change only moves where a command may sit; an R1 read keeps `[CHANGE_ID]` and the guard stops it (`customer-desk.js:333-337`); comparing the old and new catalog over all 571 runbook gates found 0 differences from the dedupe and the fence table; the tripwire is still rethrown (`customer-desk.js:620-647`); CLARIFY can only move a Gate: none answer between labels; the fact list only feeds a shown check; the page escapes the card and the answer (`render.js:144-145`).
