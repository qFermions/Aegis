# Safe changes

Every change in this lane is made by a person. Aegis writes the code, the commands and the pull request text; a person runs the commands, opens the pull request, reviews it and merges it. Each pattern below says who applies it, its blast radius, its rollback and when to stop. A change that has a gate is run only from its runbook, after the exact phrase; this file names the gate and does not repeat it.

## The classes in this lane (CLAUDE.md, R0 to R3)

| Change | Class | Gate or marker | Double-check |
|---|---|---|---|
| Read a log, a trace, a lockfile, the reflog | R0 | none | none needed |
| Push a new branch with a fix, a pin or a revert, for a pull request | R1 | `dependency-problem-pin-branch`, `git-recovery-revert-commit`, `git-recovery-revert-merge`, `git-recovery-restore-branch` | the branch shows on the remote with the expected commit |
| Merge a reviewed pull request | R1 | `code-review-checklist-merge-portal` | the target branch's latest commit is the merge, and its checks are green |
| Re-run the failed jobs of a run that only builds and tests | R1 | `ci-failure-rerun-portal` | the re-run's result, read in the run's page |
| Move your own unpushed branch back, after a backup branch | R2 | `git-recovery-local-reset` | `git log` shows the branch at the target commit and the backup branch at the old one |
| Run a reviewed script with `--apply` | R1 to R3, by what the script changes | `safe-script-apply` | the dry run read again shows nothing left to change |
| Rewrite shared history, force push | R3 | preview only, below | the owner's plan, not this file |

## Patterns

**1. A code fix.** Who: the author opens the pull request; a reviewer approves with `/code-review-checklist`; a maintainer merges. Blast radius: what the diff touches, and every caller of a shared function. Rollback: a revert of the pull request. Stop if: the diff holds changes unrelated to the fix, the new test passes on the old code, or a required check is red.

**2. A revert on a shared branch.** Who: any developer pushes a revert branch; the merge follows pattern 1. Blast radius: the reverted commit's changes, everywhere it shipped. Rollback: revert the revert. Stop if: later commits depend on the reverted one (the revert conflicts); then the owner decides between a forward fix and a wider revert. A merge commit is reverted with its mainline parent named, and reverting it means a later merge of the same branch brings back only commits made after the revert (EV-24).

**3. A dependency pin or upgrade.** Who: a developer, on a branch, through a pull request. Blast radius: everything that imports the package, and every package that depends on it. One package and one major version per pull request. Read the release notes between the two versions. Rollback: revert, which restores the old lockfile. Stop if: the lockfile diff changes packages you did not name (a range pulled them), a new install script appears, or the new release is hours old with no notice (a smell, `escalation.md`).

**4. A workflow permission change.** Who: a developer, through a pull request a code owner reviews. Least privilege: set `permissions` per job; every permission you leave out is set to none once any is set (EV-04); grant the minimum the step needs (EV-05). A wider repository default is the repository owner's decision and not the fix for one job.

```yaml
# one job's token: read the code, write one pull request comment, nothing else
jobs:
  report:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: write
```

**5. A re-run.** Who: a developer with write access to the repository. Blast radius: one run; it uses the same commit and ref as the original and the privileges of the person who first triggered it (EV-08). Rollback: none needed for a build and test run. Stop if: the workflow deploys, publishes or changes anything outside CI; that is a deploy and goes to its owner's process, not a re-run from this lane.

**6. A stale cache.** Who: a developer. The fix is a cache key that includes the lockfile hash, through a pull request; a cache entry cannot be changed once created (EV-13). Deleting an entry is a second choice (`/ci-failure`, Phase B).

**7. A script run with `--apply`.** Who: the person who owns the target system, after reading the script and its dry run. Blast radius: exactly what the dry run listed. Rollback: the script's own undo or the pre-state it saved; a script with no rollback path is R3 and needs the review CLAUDE.md asks for. Stop if: the apply run's count differs from the dry run's count.

**8. Your own unpushed commits.** Who: you, in your clone. A backup branch at the current commit first, then the move (`git-recovery-local-reset`). Uncommitted changes are not covered by the backup: commit or stash them first. Never on a branch others pulled.

**9. Shared history rewrite and force push.** Not authorized by any runbook of this lane. Only when the repository owner decides it, after the secret it removes is revoked and its use reviewed (EV-25), after open pull requests are merged or closed (EV-26), and with every person who cloned the repository told to re-clone, because a rewrite does not remove the data from their clones or from forks (EV-26).

```bash
# PREVIEW ONLY [software-engineering-history-rewrite-preview]
# Planning only: nothing here authorizes a rewrite or a force push. The repository owner decides, the secret is already revoked, and every open pull request is merged or closed first.
# git filter-repo is the tool Git recommends over filter-branch, it is installed separately
# git filter-repo --invert-paths --path [FILE_NAME]
# --force-with-lease refuses the push if someone else moved the branch since you fetched it
# git push --force-with-lease origin [BRANCH_NAME]
```

## Never, in this lane

- Never push to, reset or force push a shared branch from a runbook.
- Never widen a token, a role or a repository default to make one job pass.
- Never run `npm audit fix --force` as a fix: it installs outside your stated ranges, including major versions (EV-36).
- Never put a secret in code, a command line, a build argument (EV-65) or a log.
- Never delete the evidence (a commit, a log, a message) before the security on-call says so.
