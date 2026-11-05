# Security review 3

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

No issues

**Evidence.** I reviewed `ead7e37` by reading the code and running the real functions in memory. I wrote no file and did not run the test suite.

- **Can a ticket or answer select a change it could not before? No.**
  - The only new code on the selection path is the early `close('OPEN', ...)` at `scripts/demo/customer-desk.js:446`. It sits before `namedGates` at line 447 and can only stop a ticket.
  - It is the only new caller of the parsers. `grep` found no other route to the approval step.
  - I ran 16 Gate-line shapes through `namedGates` and through the old inline pattern. The results differed on 0 of them, so moving the pattern into `GATE_ID_SOURCE` changed nothing.
  - `GATE_ID` has no `g` flag, and repeated calls gave stable results, so there is no `lastIndex` state bug.
  - `Gate: none-such` now stops on the new check instead of the unknown-gate check. Both close OPEN, and `.claude/commands` has no `none-*` id that this could block.
- **Can a local path now get through `cleanPaths`? No.**
  - The lookahead at `scripts/demo/customer-desk.js:541` only gained `'` and `"`, so it matches everything it matched before and more.
  - `'<home>'` and `"<home>"` now clean to `'~'` and `"~"`.
- **Can the built regular expression throw on a path? No.**
  - I ran 23 hostile directories, each with 6 endings, through the source text of `cleanPaths`. The directories included `o'brien`, `a"b`, `[z-a]`, `(?<n>`, a trailing backslash, `C:\Users\x` and non-BMP characters.
  - None threw and none left the directory in the output. The quotes sit inside a character class, and the escape covers every metacharacter that needs it.

**Below 8 (all pre-existing, not added by this diff):**
- `Gate: a-b, none`, `Gate: (none) a-b` and `Gate: none` followed by a separate `Gate: a-b` line still select `a-b`, as they did before. The new check only catches a line that starts with none. A model answer could still pick a known gate this way (confidence 3 as a new vulnerability; nothing newly reachable).
- A path followed by `.`, `>`, `]` or a backtick stays uncleaned, as does the remainder of a sibling such as `<home>'y/z` becoming `~'y/z`. The first group was already uncleaned, and the sibling's `,`/`:`/space forms already cleaned the same way (confidence 2; the quote case does not widen the leak).

**What the checks did not prove:** I did not run a full desk run or `customer-desk.test.js`. The `cleanPaths` check ran the function on its own, not through `ctx.clean` with the real `run.json` and page output. I saw `esc` on the step output and reason at `scripts/demo/render.js:95` and `:102`.

**Other note:** `git status` shows an untracked `docs/aegis/demo/evidence/final-battery/`. It appeared after the session started and is outside this diff, so I did not read it.

**Files read:**
- `<repo>/REVIEW.md`
- `<repo>/scripts/demo/catalog.js`
- `<repo>/scripts/demo/customer-desk.js` (lines 425-626, plus `grep` hits elsewhere)
- `<repo>/scripts/demo/render.js` (`grep` hits for escaping only)
- `git diff 8cce5c3..ead7e37` for the four named files, including `scripts/demo/README.md` and `scripts/demo/customer-desk.test.js`
