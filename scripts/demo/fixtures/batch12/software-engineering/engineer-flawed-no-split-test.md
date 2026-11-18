Mode: Engineer answer
## Engineer answer
**Evidence read:** the log shows `pg_dump: command not found` and exit 127 when cron runs `dump.sh`.
**Hypotheses:**
1. Cron's `PATH` is shorter than your shell's.
2. Cron runs the script as another user.
3. The job runs on another host.
**Recommendation:** set the path inside the script:

```diff
 #!/usr/bin/env bash
 set -euo pipefail
+PATH=/usr/local/bin:/usr/bin:/bin
```

Commit it on a branch and merge it through review.
**Blast radius:** one script on one server. Rollback: revert the commit. Stop if the next cron run still exits 127.
**Verify:** the next scheduled run logs exit 0.
**Ask next:** which user owns the cron job?

```aegis-desk
Gate: code-review-checklist-merge-portal
Phrase: ADD PULL REQUEST [PR_NUMBER] TO [BRANCH_NAME] IN [REPO_NAME]
```
