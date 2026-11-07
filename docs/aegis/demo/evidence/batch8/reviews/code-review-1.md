# Code review, round 1 (batch 8)

`/code-review xhigh abb6ea6..HEAD` at `bffecff` (34 commits, 105 files). 15 findings; two reproduced by the reviewer with the fake CLI (1, 2), three by direct probes (5, 6, 7).

| # | file:line at bffecff | finding | disposition |
|---|---|---|---|
| 1 | `scripts/demo/customer-desk.js:269` | a messy ticket's approval ref `DESK-2m` is refused by the audit trail, so Run B could not resolve any bound gate | fixed `f20eaaf`; test "a messy ticket gets past sign-off" |
| 2 | `customer-desk.js:629` | a tripwire thrown inside a read-back left steps 7 and 8 "not reached" after a gate was applied | fixed `74b2c9e`; test "a tripwire inside a read-back still records" |
| 3 | `scripts/demo/sim/gates.js:119` | the Jamf lock wrote `commandType`; the Jamf client reads `command` | fixed `86d32a8`; test runs the client's own verify-command (exit 5); red `cr1-f3-red.txt` |
| 4 | `scripts/demo/catalog.js:66` | an R1 gate needed every read in its section to pass, though some sections list alternatives | fixed `ea3657e`: only a section with exactly one read is used; red `cr1-f4-f9-red.txt` |
| 5 | `catalog.js:124` | CLARIFY counted a `?` in code or in the ticket's quoted question | fixed `52e726d`; red `cr1-f5-red.txt` |
| 6 | `scripts/demo/answer.js:68` | a blank line before the "Do this" list gave 0 steps | fixed `3e9abba`; red `cr1-f6-f7-f10-red.txt` |
| 7 | `answer.js:126` | every `[@Aegion_*]` token counted as a default-environment fact | fixed `3e9abba`: only the tokens CLAUDE.md's default block uses |
| 8 | `customer-desk.js:633` | after a read that ran and proved nothing, the loop applied the next gate (CLAUDE.md: verify each step, never continue past a failure) | fixed `74b2c9e`; two old tests rewritten to the new rule |
| 9 | `catalog.js:29` | a gate marker inside a bash fence started its section outside it | fixed `ea3657e` |
| 10 | `answer.js:24` | `words()` split `[FIRST_NAME]` into two words | fixed `3e9abba` |
| 11 | `scripts/demo/render.js:59` | `linear:verify-state` read as "The Linear account is paused" | fixed `74ab196` |
| 12 | `CLAUDE.md:115` | "no script command anywhere" could drop the human-run read-backs | fixed `f605701`, `91e4f31`: read-back commands go in the aegis-desk block |
| 13 | `catalog.js:18` | the desk copies change-record.js's line patterns; the desk inlined `says_none` | `says_none` fixed `87fa578`; the pattern copy closed: `scripts/audit` is outside the files this batch may change |
| 14 | `customer-desk.js:315` | `readPlain` repeated `readBack` | fixed `87fa578` |
| 15 | `answer.js:57` | label regexes compiled per line; one answer parsed several times | regexes fixed `3e9abba`; the repeated parse closed: answers are a few KB, eight per run, and the cost is not measurable next to a model session |

Dropped by the reviewer to stay at 15, closed: `likelyUsd` strips a trailing m rather than reading the `twin` field; the result is the same for every ticket in both sets.
