Mode: Engineer answer
## Engineer answer
**Evidence read:** No evidence given; this is reasoning. The ticket says the internal wiki's search returns pages as they were last week, since the search node was resized on Friday.
**Hypotheses:**
1. The indexing job lost its schedule when the node was rebuilt. Test: read the job scheduler's last run time for the index job.
2. The job runs but writes to the old node's data path. Test: compare the index's last-modified time with the job's last run time.
**Recommendation:** if test 1 shows no run since Friday, the wiki's owner restores the job's schedule in the deployment config and runs one full reindex in a quiet hour:

```text
index job schedule: nightly 02:00 (now: none)
```

**Blast radius:** search only; pages stay readable. A full reindex slows search while it runs. Rollback: remove the schedule again. Stop if the reindex fails or search returns errors.
**Verify:** a page edited today shows in search results with today's text.
**Ask next:** did anything else move with the resize, such as the job's service account?

## Human-run and read-back
- **Restore the index job's schedule.** Runs it: the wiki's owner, in the deployment config. Confirms first: test 1 showed no run since Friday. Verify: the scheduler lists the job with a next run tonight. No runbook gate covers this.
- **Run one full reindex.** Runs it: the wiki's owner, in a quiet hour. Confirms first: the teams that rely on search know it will be slow for a while. Verify: a page edited today shows in search with today's text. No runbook gate covers this.

```aegis-desk
Gate: none
```
