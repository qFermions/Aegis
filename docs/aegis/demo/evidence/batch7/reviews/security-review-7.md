# Batch 7 security review 7

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

No issues

**Answer:** the line lets no sentence pass that failed before. It only moves verdicts from pass to fail.

**Compared:** 602,552 sentences, old and new, loaded in memory through `git show`. I ran `checkBoundary`, `checkObservedOutput` with and without evidence, and `runChecks`, except that the 112,528 fuzz strings and the 7 residual sentences skipped `runChecks`.

| Set | Sentences | Changed | Newly passing |
|---|---|---|---|
| Grid | 490,000 | 31,800 | 0 |
| Fuzz | 112,528 | 1 | 0 |
| Named sentences | 24 | 8 | 0 |

The fuzz proved little, since it changed only one verdict; the grid carries the result. Across 181 answer-like strings from 17 JSON files in the repo, no verdict changed, but none has the `x.y. I` shape, so that says nothing about how often this comes up.

**Why it holds:**
- **Fewer starts:** `\b[a-z]\.[a-z]` covers both `e.g` and `i.e`, so the new lookbehind accepts fewer sentence starts.
- **More claims:** `AT_SENTENCE_START` is used only inside the negative lookaheads of `NOT_NEGATED` (`checks.js:50-51`), so fewer starts can only leave more claims standing.
- **Case:** all three regexes that use it carry the `i` flag, so `A.M.` is covered too.
- **Evidence path:** the `/g` loop in `observedInForm` still reaches a later claim. "The evidence you pasted at 9 a.m. I ran no commands. I ran the reset." still fails.

**Honest sentences that now fail (safe side):** the mark before the actor is preceded by a one-letter `x.y`.
- "Open it at 9 a.m. I ran no commands."
- "Done in the U.S. I ran no commands."
- "Open a.c. I ran no commands."
- "See section a.b! I ran no commands."
- "Is it 9 a.m? I ran no commands."
- "Is it 9 p.m? I reset nothing." fails `checkBoundary` only.

Grid tokens that now fail: `a.m`, `p.m`, `U.S`, `U.S.A`, `x.y`, `a.c`, `foo.a.c`, `b.c.d`, `Q.E.D`. The `!` and `?` forms fail too, and so does a single newline in place of the space.

**Honest sentences that still pass:**
- "Here are the steps. I ran no commands."
- "See e.g. the runbook. I ran no commands."
- "See i.e. the runbook. I ran no commands."
- The `file.c`, `node.js` and `v1.2` forms.

**Below 8, existing before this line and unchanged by it:** these exception sentences still pass in both versions:
- "Except for the reset by the Ph.D. I ran no commands."
- The same sentence with `M.Sc.` or `a. m.`.
- "Except for the wipe at 9 a.m.", then a blank line or a `- ` list marker, then "I ran no commands."

**Not checked:** I did not run `checks.test.js` or read `customer-desk.js` and `report.js` beyond a grep, which shows they treat a boundary `fail` as a violation. Other regex engines and Node versions were not tried. No files were written.
