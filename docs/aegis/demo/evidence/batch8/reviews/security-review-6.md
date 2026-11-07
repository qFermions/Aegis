# Security review, round 6 (batch 8): the pass on round 5's fix, and the last

Range: `git diff b68ab07..de55c4d`. One review subagent. **No findings** at 80% confidence or more.

Checked: `plainText` is used only in `answerSteps` and `onlyLooks` (`answer.js:203, 216`); the Gate lines, the named gates, the five answer checks and CLARIFY still read the raw answer, so the fold cannot change which gate is approved or any check's verdict; `onlyLooks` is called only when no gate is named and picks only INVESTIGATE or OPEN (`customer-desk.js:558-561`); full-width backticks cannot hide lines; the new patterns have no overlapping repeats; T5's full-run-1 answer still closes INVESTIGATE; `node --test scripts/demo/answer.test.js scripts/demo/customer-desk.test.js`: 106 of 106 pass.

Below the threshold, label only, recorded as known limits (no code change, the code is frozen for the runs):
- A bold-number Details line (`**2.** Reset ...`) under a card is not a list line for the scan (`LIST_LINE` lacks the optional bold); the fix is `(?:\*\*)?` before the number.
- With no card, a `>` quoted numbered line and a line starting with a number ("10.5 GB free") count as steps, so such an answer can close INVESTIGATE rather than OPEN.
- A full-width `＃＃` heading or hyphen folds into a plain one; the plain versions already passed before.
