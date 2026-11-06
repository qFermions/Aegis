# Code review, round 3 (batch 8), the last round

`/code-review xhigh 4b60407..HEAD`, read at `1775639`. 14 findings. Each fix below is in its own commit, one class per commit.

| # | file:line at 1775639 | finding | disposition |
|---|---|---|---|
| 1 | `scripts/demo/catalog.js:140` | round 2's quote fix brought back round 1's bug: a quoted ticket question ("Is our email broken???") closes CLARIFY | fixed `397a6b2`: a question found word for word in the ticket is the ticket's; a question mark must follow a word; red `cr3-f1-red.txt` |
| 2 | `scripts/demo/customer-desk.test.js:1371` | round 2's "shown failure wins over a desk fault" test never caused a desk fault | fixed `b0d7c39`: the fault is caused and asserted |
| 3 | `scripts/demo/answer.js:20` | an indented numbered sub-item counted as a step | fixed `f2b9d09` (with 4: what counts as a step); red `cr3-f3-f4-red.txt` |
| 4 | `answer.js:20` | `**1.** Open` was never a step | fixed `f2b9d09` |
| 5 | `answer.js:76` | a later part whose label lacks a colon (`**Done when** ...`) is folded into the last step | closed: such a card already fails the parts check (it has no "Done when"), and folding can only keep a ticket from closing INVESTIGATE, the safe side |
| 6 | `catalog.js:38` | a quoted value in an R1 read line kept its quotes, so it could never be filled | fixed `175b9d9`; red `cr3-f6-red.txt` |
| 7 | `checks.md:53` | round 2's eleven fixes went in one commit, against "every finding fixed in its own commit" | recorded as a fail row in checks.md: history is not rewritten; round 3's fixes are one class per commit |
| 8 | `code-review-2.md:18` | finding 12 was marked fixed though its test caught nothing | fixed `b0d7c39`: the test and the row |
| 9 | `progress.md:11` | progress.md not rewritten for the review stages | fixed in the commit that records this round |
| 10 | `answer.js:144` | the default organization's token list was another hand copy of the dictionary | fixed `012d124`: read from the dictionary at load (with 11) |
| 11 | `answer.js:144` | the same token pattern pasted twice | fixed `012d124` |
| 12 | `customer-desk.js:621` | "mark later gates not applied" in three places | fixed `87ce218` |
| 13 | `catalog.js:38` | two dedupe styles in one file | fixed `ccff469` |
| 14 | `catalog.js:69` | the fence table built for every file | fixed `98226c3` |
