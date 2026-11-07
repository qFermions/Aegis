# Security review, round 4 (batch 8): the final pass

Range: `git diff 8e6e589..da7745d` (code review round 3's fixes). One review subagent.

**1 finding, Medium, confidence 8:** `scripts/demo/answer.js:26` (at da7745d). Round 3 narrowed the step pattern to at most one space of indent, which is right for parsing the card, but the same pattern chose which lines the INVESTIGATE change scan reads. A numbered change step indented two spaces or a tab was never scanned, with no card or under a stray label, so a Gate: none answer telling the tech to reset MFA could close INVESTIGATE ("Look first"). Nothing is applied; the label is wrong. Reproduced by the reviewer against both versions.
Fixed: the change scan and the no-card step list read any numbered line at any indent; the card keeps the narrow pattern; test "an indented numbered change line is still scanned"; red `batch8/sr4-red.txt`.

Checked and clean: unquoting a runbook argument cannot smuggle a flag, since values are filled as whole array elements from repository data and `--change` is still refused on the raw line (`catalog.js:23,43`, `customer-desk.js:213, 335-337`); the dictionary pattern takes only escaped `[@Aegion_*]` tokens from a repository file (`answer.js:137-148`); the CLARIFY changes only make CLARIFY rarer, and no closing label in that branch applies a gate (`customer-desk.js:555-556`); the lazy fence table and dedupe set give the same reads; `skipLater` keeps the tripwire path; render.js is not in the range.
