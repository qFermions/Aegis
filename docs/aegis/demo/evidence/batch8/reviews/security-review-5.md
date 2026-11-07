# Security review, round 5 (batch 8): the pass on round 4's fix

Range: `git diff da7745d..b68ab07`. One review subagent, with 21 probe shapes run through `onlyLooks` at both commits.

The commit made nothing worse and opened no way for answer text to apply, run or hide anything (`ANY_STEP` feeds only the no-gate branch, which ends INVESTIGATE or OPEN; the card's own parsing keeps the narrow pattern).

**1 finding, pre-existing, Low, confidence 8:** `scripts/demo/answer.js:200-211`. A change step still escaped the INVESTIGATE scan in other forms: `(2) Reset`, a no-break space after the number or as indent, a `>` quote, a bullet before the number, no space after the number, a full-width digit, a zero-width space inside the word, a numbered or bulleted line under Details, and prose in another card part ("Done when: you have reset ..."). Label only: neither state applies anything.
Fixed: text is folded to plain characters first (NFKC, zero-width characters removed); with a card, the scan reads the whole card and every list line in the answer; with no card, every numbered line in any form. Not taken: the reviewer's "scan every line", because full run 1's look-first T5 answer says "don't release" and "don't delete it" in its prose and would never close INVESTIGATE, which the charter's task 6 test requires; the remaining gap (an older-format answer's prose and plain bullets) is a recorded shortcut in the code. Test "a change in any step form, in odd characters, in another card part or in a Details list is still seen"; red `batch8/sr5-red.txt`.
