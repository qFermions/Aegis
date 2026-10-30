# Evidence tools (batch G3)

The scripts behind the batch G3 captures in `docs/aegis/g3/evidence/`, so every capture names a
command a reviewer can run again. Run each from the repository root with Node 24 on the PATH.
Each one only reads: the repository, `git show` of a named commit, and test runs (which load
no network module). None writes outside a temporary folder it removes. A capture's `# commit:`
line names the commit it ran at, followed by "(plus uncommitted changes in the working tree)" if
any tracked file differed from it or an untracked file was present; only the files directly in
`docs/aegis/g3/evidence/` (the captures and records) are left out of that check, never these
tools. Captures made before that check counted untracked files (the `t1` to `t4`, `t5a` to `t5d`
and `t6` red and green runs, taken as each task landed) say only what the working tree held.

| Tool | Capture | What it prints |
|---|---|---|
| `suite-counts.sh` | `t7-head-suite-counts.txt` | tests, pass and fail of every test file batch G3 added or changed, and of the contract suite it extended, at the checkout |
| `inventory-diff.js <base>` | `t5-inventory-base-to-head.txt` | the state-change inventory at `<base>` against the checkout: entries added (per file and mode), removed, and any entry whose mode changed |
| `test-counts.sh <base-dir>` | `d9-test-counts.txt` | `node:test` count per test file in a checkout of the base and in this one, and the whole-run counts (D9) |
| `leak-grep.js <base>` | `d10-leak-grep.txt` | the charter's D10 grep over `git log -p <base>..HEAD`, grouped by file and keyword; a personal path or mail on any line; a pass for real credential shapes over added lines; every URL host and mail domain added lines name |
| `head-checks.sh <base>` | `t8-head-checks.txt` | the four ticket evals, the command lint, the scanner's BLOCK and WARN counts, the release boundary, CLAUDE.md's size and diff, PRODUCT_CONTRACT.md lines removed and its boundary sentence, SAFETY GATE markers (total and any file whose count fell), and U+2014 in what this batch added (D5, D7, D9, D11, D15) |
| `fixtures-and-mocks.sh <base>` | `d12-fixtures-and-mocks.txt` | the fixtures this batch added and how each changed test file is kept off the network |
| `floor-times.js <before> <after>` | `t5a-floor-cubic-before-after.txt` | the floors that chained two gaps, timed at two commits on lines built to never complete them (5 KB both, 20 KB after) |
| `floor-times.js <before> <after> 20kb` | `t5a-floor-20kb-before.txt` | the same floors at `<before>` on a 20 KB line (minutes); a floor over 2 s on 5 KB is shown at 1, 2 and 4 KB instead |
| `floor-diff.js <before> <after>` | `t5a-floor-rewrite-differential.txt` | every floor whose pattern differs between two commits, compared on the corpora, the test sentences and 40,000 random sentences each |
