# Code review, round 2 (/code-review xhigh, abb02ed...HEAD at 1ddb57e: the round 1 fixes only)

15 findings plus four left out of the cap; most were regressions of the round 1 fixes. Fixed by class, one commit per class with tests that failed first (`docs/aegis/demo/evidence/batch9/cr2-*-red.txt`, `-green.txt`).

| Class | Findings | Outcome | Commit |
|---|---|---|---|
| A: ladder twins | 1 (a twin in <details> passed heavy-first), 7 (eight pasted escape lines), 11 (a Try first line that names nothing made the row unsatisfiable) | fixed: a twin keeps the lighter steps before its portal twin, or its own phase's when it is the phase's only gate; the pasted lines removed; Try first counts as an admin step only when it names a gate or phase; an R3 twin stays heavy | ed01c47 |
| B: done-claim participles | 5 (and security review 2's note) | fixed: every change word the desk knows, minus acknowledgements | d858a82 |
| C: conditional announcement | 9 | fixed | f9d3fae |
| D: negated facts | 10 | fixed | 4796783 |
| F: Phrase line | 6 | fixed: counts only in a block naming a gate, and only a phrase | acc492a |
| H: Aegis claim | 12 | fixed: "the Aegis assistant" is Aegis, object verbs need a tenant object; "Aegis has updated your ticket notes" stays a claim (a ticket write is a production change, REVIEW.md), so that half is closed with this reason | 14ec8a5 |
| I: Details pointer | 13 | fixed | c4bee50 |
| E: intake | 3, 4 | fixed: review flagged again unless a meeting, call or session; a generic reader with a colon or dash flagged when an order follows | b2df15a |
| G: ask and chat privacy | 2, 8, 14, 15 | fixed: written passwords, AWS keys and Entra secrets stop the ask; error codes are not phone numbers; bracket tokens kept; the chat protects its setup; the README says what is caught and that other secrets are not | 91d0f9f |
| Left out | checkBoundary re-split per line; the finding 8 test title unasserted | fixed | fac0194, 32d28e7 |
| Left out | negatedAt rescans its prefix per match | closed: answers are a few kilobytes, so the cost is not measurable | none |
| Left out | the pasted sentence's word "block" made two inventory entries security-sensitive | closed: the pasted lines are gone and the inventory is regenerated | ed01c47 |
