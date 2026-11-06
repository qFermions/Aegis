# Code review, round 2 (batch 8)

`/code-review xhigh bffecff..HEAD`, read at `4b60407` (HEAD moved to the security round 2 fix during the review, so it is in scope). 15 findings. The reviewer ran old and new versions of the parsers on the same inputs and diffed the catalog over every R1 gate (3 gates changed: Okta group add, Okta activate, Slack guest time limit now have no read).

| # | file:line at 4b60407 | finding | disposition |
|---|---|---|---|
| 1 | `scripts/demo/answer.js:76` | an unindented second line of a step still ended "Do this" | fixed `6021cd8`: "Do this" runs to the next label |
| 2 | `answer.js:75` | a bullet after the list ("Do not reset or delete anything yet") joins the last step and reads as a change | closed: the safe side; it only keeps a ticket from closing INVESTIGATE, and the parser's comment says so |
| 3 | `scripts/demo/catalog.js:135` | round 1 dropped questions inside quote marks, the usual way an answer passes a question on | fixed `6021cd8`: they count again |
| 4 | `answer.js:136` | the token list missed default-organization tokens (`VOIP_URL`, `REMOTE_ACCESS`, `SITE_COUNT`) | fixed `6021cd8`: the list follows the placeholder dictionary |
| 5 | `scripts/demo/customer-desk.js:649` | a deliberate "not yet" read (exit 5) stops the later gates | closed: CLAUDE.md's "verify or it didn't happen, per step"; a person would wait for the read, and INCONCLUSIVE says so truthfully |
| 6 | `CLAUDE.md:115` | "no script command anywhere" against read-backs in the block; the example had no Read-back | fixed `6021cd8` |
| 7 | `answer.js:136` | `[@Aegion_JIRA_SPACE]` in two facts | fixed `6021cd8`: the Jira fact alone |
| 8 | `scripts/demo/README.md:72` | the steps 7 and 8 paragraph was stale | fixed `6021cd8` |
| 9 | `customer-desk.js:331` | an R1 read filled `[CHANGE_ID]` with null | fixed `6021cd8`: the placeholder stays and the guard stops it |
| 10 | `catalog.js:40` | a read written twice counted as two | fixed `6021cd8` |
| 11 | `customer-desk.js:618` | a tripwire stop did not name the unapplied gates | fixed `6021cd8` |
| 12 | `scripts/demo/customer-desk.test.js:397` | no test that a shown failure wins over a desk fault in one gate | test added in `6021cd8`, but it never caused a desk fault (code review 3, finding 2): fixed in the commit after `397a6b2`, which asserts the fault happened |
| 13 | `catalog.js:40` | altitude: an R1 gate's read is guessed from position; the Read-back field could name it | closed for the owner: `scripts/audit/read-back-field.test.js` requires every R1 field to say `none (R1: no change record)`, a contract outside this batch's files; recommended as the next change |
| 14 | `catalog.js:128` | altitude: CLARIFY keeps gaining regex exceptions; a `Question:` line in the aegis-desk block would mark it exactly | closed for the owner: a new block line is a change to the answer format the charter did not ask for; recommended |
| 15 | `catalog.js:31` | the fence state recounted per gate | fixed `6021cd8` |
