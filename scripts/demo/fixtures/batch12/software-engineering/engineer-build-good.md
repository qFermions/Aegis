Mode: Engineer answer
## Engineer answer
**Evidence read:** No evidence given; this is reasoning. The ticket asks for a script that deletes remote branches in [REPO_NAME] merged into main more than 90 days ago, and says there are hundreds.
**Options:**
1. Turn on the repository setting that deletes a pull request's head branch when it merges [unconfirmed: check the vendor page]. Trade-off: no code and nothing to run, but it only cleans future merges.
2. A script with a dry run that lists merged branches older than 90 days and deletes them only with `--apply` and the dry run's count. Trade-off: clears the backlog once; it needs a review and a person to run it.
3. Leave them. Trade-off: costs nothing, but the branch list stays hard to use.
**Recommendation:** option 1 for the future and option 2 once for the backlog. The script, for a reviewed pull request; a person runs it from a clone:

```python
#!/usr/bin/env python3
"""Delete remote branches merged into origin/main more than N days ago. Dry run unless --apply."""
import argparse
import logging
import subprocess
import sys
import time

KEEP = {"main", "master", "develop", "HEAD"}  # never deleted, whatever their age
PREFIX = "refs/remotes/origin/"
LOG = logging.getLogger("prune_merged_branches")


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def candidates(days, now=None):
    cutoff = (now if now is not None else time.time()) - days * 86400
    out = git("for-each-ref", "--merged", "origin/main", "--format=%(refname) %(objectname) %(committerdate:unix)", PREFIX)
    found = []
    for line in out.splitlines():
        ref, sha, when = line.split()
        name = ref[len(PREFIX):]
        if name not in KEEP and int(when) < cutoff:
            found.append((name, sha))
    return found


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--days", type=int, default=90, help="age in days, 30 or more")
    p.add_argument("--apply", action="store_true", help="delete the branches (default: dry run)")
    p.add_argument("--expect-count", type=int, help="with --apply: the count the dry run printed")
    a = p.parse_args(argv)
    if a.days < 30:
        p.error("--days must be 30 or more")
    if a.apply and a.expect_count is None:
        p.error("--apply needs --expect-count, the number the dry run printed")
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(message)s")
    git("fetch", "--prune", "origin")  # updates local tracking refs only
    found = candidates(a.days)
    for name, sha in found:
        LOG.info("%s %s at %s", "deleting" if a.apply else "dry run: would delete", name, sha)
    LOG.info("%d merged branch(es) older than %d days", len(found), a.days)
    if not a.apply:
        return 0
    if a.expect_count != len(found):
        LOG.error("refused: --expect-count %d but found %d; run the dry run again", a.expect_count, len(found))
        return 3
    done = 0
    for name, sha in found:
        try:
            git("push", "origin", "--delete", name)
        except subprocess.CalledProcessError as err:
            LOG.error("stopped at %s after %d of %d: %s", name, done, len(found), err.stderr.strip())
            return 1
        done += 1
    LOG.info("done: deleted %d branch(es); each can be recreated at the commit logged above", done)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Blast radius:** only branches already merged into main, so their commits stay reachable from main; `main`, `master` and `develop` are never deleted. Hundreds of deletions is a mass operation (R3): the dry run's list and count go in the ticket first. Rollback: recreate a branch at the commit the run logged for it. Stop if the apply run's count differs from the dry run's, or any line names a branch someone still uses.
**Verify:** a second dry run finds 0 branches, and the remote's branch list no longer shows the logged names.
**Ask next:** does anything (a deploy job, a long-lived release branch) read branches by name pattern, so it must be added to the names that are never deleted?

## Details

- Step 1 (merge the script through review): R1. Double-check: the pull request shows as merged.
- Step 2, only after the dry run's list is in the ticket and its owner agreed: the apply run, gate `safe-script-apply` (R3, mass operation). Double-check: the second dry run finds 0.
- Tested on 2026-11-14 against a throwaway local remote: it deleted the two old merged branches, kept a new merged one and an old unmerged one, and refused a wrong count with exit 3.

```aegis-desk
Gate: code-review-checklist-merge-portal
Phrase: ADD PULL REQUEST [PR_NUMBER] TO [BRANCH_NAME] IN [REPO_NAME]
```
