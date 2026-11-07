# Code review, round 3, the last (/code-review xhigh, 57d48ef...HEAD at ebc6bae: the round 2 fixes)

15 findings. Tests for all of them were committed failing first (46a64e6, `cr3-red.txt`); each fix is its own commit. No fourth round is run (REVIEW.md: at most three); the security review is run once more on the range after the last one.

| # | Finding | Outcome | Commit |
|---|---|---|---|
| 1 | the written-password rule blocked ordinary password tickets | fixed: only a value that looks like a password, and not a placeholder | 33bb5a6 |
| 2, 7 | Aegis object claims passed; "the Aegis assistant" unknown to the body check | fixed: any object but Aegis's own text; the body's actor list knows it | b51f02b |
| 3 | fact negation reached past "and then open Intune" | fixed: clauses end at then, but, so, a dash or "and" with a new subject | fd12652 |
| 4, 9, 10, 13 | twin inheritance took later previews, same-section steps, the first gate's list for a whole scale block; twins matched by name only | fixed: pairs read from the runbooks' read-back lines, per-gate inheritance, nothing after a gate counts, a phase's only gate inherits its reason only | af52ac0 |
| 5 | "and ... when" excused a decided change | fixed | b0ab069 |
| 6 | password-reset's pointer line named the gate's own twin | fixed: the line is gone, the pairing finds the twin | af52ac0 |
| 8 | ticket routing read as done claims; modified and transferred misspelled | fixed | b33a35a |
| 11 | "the Details section of this answer" rejected as a pointer | fixed | 12c4137 |
| 12 | Tool:, Model: and Agent: field lines with a change verb flagged | fixed | 408b034 |
| 14 | the participle list duplicates checks.js CHANGE_VERBS | closed: answer.js is the desk's reader and does not depend on the grader; both lists are tested on their own cases | none |
| 15 | stale comments in checks.js, answer.js, ask-aegis.js | fixed with findings 2, 3 and in aa501a6 | b51f02b, fd12652, aa501a6 |

What keeps failing across rounds, and a different approach: the user-message, negation and fact checks are word lists and clause rules, and each round found the cases the previous rule missed (round 1: too wide; round 2: too narrow; round 3: in between). They now hold every case the three reviews named, as tests. The durable fix is not another rule: a labeled set of real answers (the runs of task 13 and the held-out set) scored against these rows, so a change to a rule is measured on many sentences at once. Recorded as a decision for the owner.
