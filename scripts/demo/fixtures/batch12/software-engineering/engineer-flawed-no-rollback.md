Mode: Engineer answer
## Engineer answer
**Evidence read:** the log shows `pg_dump: command not found` and exit 127 when cron runs `dump.sh`; by hand it works.
**Hypotheses:**
1. Cron's `PATH` lacks the folder `pg_dump` is in. Test: log `PATH` and `command -v pg_dump` at the start and compare a cron run with a run by hand.
2. Cron runs the script as another user. Test: log `id -un` and compare.
**Recommendation:** set the path inside the script:

```diff
 #!/usr/bin/env bash
 set -euo pipefail
+PATH=/usr/local/bin:/usr/bin:/bin
```

Commit it and merge it.
**Blast radius:** the backup script.
**Verify:** the next scheduled run logs exit 0.
**Ask next:** which user owns the cron job?

```aegis-desk
Gate: code-review-checklist-merge-portal
Phrase: ADD PULL REQUEST [PR_NUMBER] TO [BRANCH_NAME] IN [REPO_NAME]
```
