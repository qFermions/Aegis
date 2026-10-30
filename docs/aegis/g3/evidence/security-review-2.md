# Security review 2 (batch G3, `/security-review`)

Scope: the changes after the first security review, `c1e60ec..a237fac` (61 commits, 30 files; the capture text files `docs/aegis/g3/evidence/*.txt` left out): code review rounds 1 to 3 and the evidence tools. Method: one reviewer sub-task at high effort, read-only, in its own worktree, with the skill's full instructions and exclusions; no candidate reached the confidence bar, so no false-positive filter tasks were needed.

**Result: no HIGH or MEDIUM findings.**

Candidates considered and why each fell below the bar:

- `scripts/audit/change-record.js` `checkReadBack` and `hasCommandKey`: the regular expression is built from operator input only after that input passed `READ_BACK` (`[a-z0-9-]` only); the connector is looked up with `hasOwnProperty` in a frozen map of fixed repository paths, so no path traversal; the file is read as text, never loaded as code.
- `change-record.js` `link`: the kind, approval, order, verified and owner checks only refuse more links; the guard runs under the write lock and closes the double-link race. The trail is a local, unkeyed hash chain, so anyone who can write its folder can forge it; that was already true at `c1e60ec` and is stated in the doctrine.
- `scripts/audit/audit-log.js` `checkEntry`: the new `read_back` field passes `matches()`, so the credential-shape refusal still applies; the change-linked procedure rule only refuses more entries. The CLI `procedure` now refuses `--change`.
- `audit-log.js` `folderTakesNewFiles`: a random probe name, opened `wx` with mode 0600 in the audit folder and removed at once, on Windows only after EPERM or EACCES; the worst case is a writer that waits (DoS, excluded).
- `scripts/jira-client.js`: adds `read_back: null` to a procedure entry; no behaviour change.
- `scripts/graph/engine.js`, `scripts/tier/tier-guard.js`: comments and one label string; no logic is keyed on labels; the floor patterns are unchanged in this range.
- `scripts/eval/g3-ticket-eval.js`, `scripts/eval/latency.js`: a title built from a frozen constant, and a comment.
- `docs/aegis/g3/evidence/tools/*.js`: every git call uses `execFileSync` with an argument array, never a shell; regular expressions are built from the repository's committed source and never run as code; refs come from the developer's command line (trusted); `inventory-diff.js` parses repository JSON only.
- `docs/aegis/g3/evidence/tools/*.sh`: developer-run and read-only; `$BASE` comes from the command line; an unquoted loop over file names would need a hostile file name committed first, and it only feeds `grep -c` or `node --test`.
- Test files and markdown are excluded by the review rules.

No file was edited, nothing was committed, and no network service was called by the reviewer.

## Addendum: `a237fac..ae88348`

The code and tool changes made after this review (the evidence review's fixes): `scripts/readiness-gate.test.js` (a test), `scripts/eval/latency.js` (a comment), and the evidence tools `leak-grep.js`, `head-checks.sh` (new) and `fixtures-and-mocks.sh`. Same method, one reviewer sub-task at high effort, read-only. **No findings at the bar.** The base argument is checked (`^[0-9a-f]{7,40}$` in `leak-grep.js`, `git rev-parse --verify` in `head-checks.sh`); git runs through `execFileSync` with an argument list or with quoted shell arguments; nothing printed is run; an `xargs grep` over committed file names could at worst miscount if a file named like an option were committed first. No change adds a network call, a write outside the repository or a connector write path. Commits after `ae88348` change docs and captures only.
