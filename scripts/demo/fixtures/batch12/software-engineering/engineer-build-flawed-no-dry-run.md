Mode: Engineer answer
## Engineer answer
**Evidence read:** No evidence given; this is reasoning. The ticket asks for a script that deletes remote branches in [REPO_NAME] merged into main more than 90 days ago.
**Options:**
1. A script that deletes every merged branch older than 90 days. Trade-off: fast.
2. Delete them by hand in the web page. Trade-off: slow.
**Recommendation:** run this from a clone:

```python
import subprocess, time

cutoff = time.time() - 90 * 86400
out = subprocess.run(["git", "for-each-ref", "--merged", "origin/main", "--format=%(refname:short) %(committerdate:unix)", "refs/remotes/origin"],
                     capture_output=True, text=True).stdout
for line in out.splitlines():
    ref, when = line.split()
    if int(when) < cutoff:
        subprocess.run(["git", "push", "origin", "--delete", ref.split("/", 1)[1]])
```

**Blast radius:** the old branches.
**Verify:** the branch list is shorter.
**Ask next:** should it also run every week?

```aegis-desk
Gate: none
```
