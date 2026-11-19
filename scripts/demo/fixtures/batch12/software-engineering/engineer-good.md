Mode: Engineer answer
## Engineer answer
**Evidence read:** the log you pasted: line 14 of `dump.sh` cannot find `pg_dump`, and the script exits 127, the shell's code for a command it cannot find. Run by hand it works, so the client is installed; the cron run does not see it.
**Hypotheses:**
1. Cron starts the script with a shorter `PATH` than your login shell, without the folder `pg_dump` is in. Test: add a first line that logs `PATH` and `command -v pg_dump`, then compare tonight's cron run with a run by hand.
2. Cron runs the script as another user whose environment lacks the PostgreSQL client. Test: log `id -un` in the same line and compare the two runs.
3. The job runs on another host or image than the one you tested on. Test: log `hostname` too.
**Recommendation:** set the path inside the script, so it no longer depends on who starts it, and stop with a clear message when the tool is missing:

```diff
 #!/usr/bin/env bash
 set -euo pipefail
+PATH=/usr/local/bin:/usr/bin:/bin
+command -v pg_dump >/dev/null || { echo "pg_dump not found on PATH=$PATH" >&2; exit 127; }
```

Use the folder `command -v pg_dump` prints in your own shell; `/usr/local/bin` above is a guess. Commit it on a branch and merge it through review.
**Blast radius:** one script on one server; nothing else reads its PATH. Rollback: revert the commit. Stop if the next cron run still exits 127: hypothesis 2 or 3 holds, and the path is not the cause.
**Verify:** the next scheduled run logs a finished dump and exit 0, and the dump file has today's date and a size like the last good one.
**Ask next:** under which user is this cron job installed, and does `crontab -l` for that user show the full path to `dump.sh`?

## Human-run and read-back
- **Set the path inside dump.sh and merge it.** Runs it: the script's owner, through a reviewed pull request; the runbook's merge gate covers the merge. Confirms first: the folder pg_dump lives in on that server. Verify: the next cron run logs a finished dump and exit 0.

## Details

- Step 1 (change the script): R1. Double-check: the next cron run's log line shows exit 0.
- No runbook covers this exact failure; the hypotheses are reasoning from the log (`knowledge/software-engineering/failure-catalog.md`, D3).

```aegis-desk
Gate: code-review-checklist-merge-portal
Phrase: ADD PULL REQUEST [PR_NUMBER] TO [BRANCH_NAME] IN [REPO_NAME]
```
