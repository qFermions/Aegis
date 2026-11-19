# Security review of batch 12d (round 1)

Run with /security-review on the range `80397eaa..cd5444b6`, by a fresh worker (opus, high effort) that wrote none of the code; read-only. First focus: the scope of net_dns, net_http and net_tls and the typed-file handoff (task 1). Second focus: the `.git` deny rules (task 2). `REVIEW.md` read first. The breaker's three rounds (`breaker.md`) were given as already covered.

Result: no finding in the range at the review's bar (0.8 confidence of real exploitability), and no project failure of `REVIEW.md`: no code path performs a production change, no ticket or page text is treated as instructions, no check is weakened beyond the two the owner approved, no secret or personal path is in the diff.

## Checked and held

- The scope check runs before any DNS query or connection in all three tools and on every redirect hop; it compares for equality only; no path skips it.
- Only the launchers' own fields and the chat hook's prompt can add to the typed set; the model's arguments, tool output and the repository add nothing.
- `readTypedFile` opens read-only, never through a link, regular files only; any error leaves only the two lists. A missing or malformed allowlist stops the server at start.
- `writeTyped` creates the file 0600, never through a link; every caller stops, or falls back to the two lists, when it throws.
- The typed file is always in a folder outside the repository that the session may not read, and a sealed session has no tool that writes.
- The chat hook runs in exec form with absolute paths; the prompt arrives on stdin and never becomes an argument; it writes only the prompt, prints nothing and exits 0.
- The inline settings and the server config are built with `JSON.stringify` and passed as single arguments with no shell.
- The new record fields hold the refused input cut at 500 characters and the reason; the audit file beside them already held both; `report.md` shows counts only.
- `gitDirs` reads only the repository's own `.git` file and `commondir`; following them can only add deny rules; the given and the resolved form of each folder are denied.
- The two narrowed checks match the owner's decisions; the ladder audit change moves 18 runbooks between rows and removes no failing row.

## Older than the batch, fixed in it

- The read-deny list named paths of the checkout only, while the agent worktrees under `.claude/worktrees/` are whole copies of it: each holds the case file, `progress.md`, `checks.md`, the demo's expected answers and a `.git` file with a local path, and none was denied. Confidence 0.75. Fixed: `.claude/worktrees/**` joins the deny list; test "the agent worktrees inside the repository are denied whole" in `scripts/eval/judged/git-wall.test.js`; runs `worktree-wall-red.txt` and `worktree-wall-green.txt`. The judged run of this batch started before the fix, so its reading record is checked for reads under that folder (the run's summary says what it found).

## Noted, not changed

- The chat's later messages go to the typed file as typed, without the privacy step the setup passes through. The file is 0600, outside the repository, and deleted when the chat ends; a launcher that is killed leaves it behind. Masking them would also mask the hosts in them, which the rule needs.
- Not checked, because each needs a real session: whether the CLI honours the hook's argument form and fires it only for the person's messages; whether Grep and Glob apply the read rules in every form; whether a subagent shares the tool server and its 30-call cap. A failure of the hook only means fewer typed hosts.
