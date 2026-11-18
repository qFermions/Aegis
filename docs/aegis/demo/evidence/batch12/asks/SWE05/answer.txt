I'm writing the answer now: the ticket is a lockfile mismatch, and Aegis's runbook says to fix the lockfile, not to switch CI to `npm install`.

Mode: Engineer answer
## Engineer answer
**Evidence read:** the `npm ci` error you pasted, plus the software-engineering lane's runbooks for this failure (failure catalog G1 and `/dependency-problem`). `package.json` now asks for `dotenv@^17.0.0`, but the committed `package-lock.json` still has an older dotenv that doesn't satisfy that range. The locked version in your paste was replaced with an email placeholder when the ticket was cleaned of personal data. It's almost certainly a 16.x version. This isn't a prompt injection. `npm ci` stops when the two files disagree and never rewrites them, so every run will fail until the lockfile on main changes.

**Hypotheses:**
1. **Most likely:** the merged PR raised dotenv in `package.json` but didn't commit the regenerated lockfile. Test: run `git log -p -1 -- package.json package-lock.json` on main and see whether the merge commit touched only `package.json`.
2. **Less likely:** two branches both changed the lockfile, and the merge kept the wrong half. Test: the merge commit changes both files, but the lockfile diff shows dotenv still at 16.x.

**On switching to `npm install`:** no. It would make CI green by having CI rewrite the lockfile on every run. Builds would stop being reproducible, and CI would be installing versions nobody reviewed. The lockfile is what's wrong, so fix the lockfile.

**Recommendation:** a developer regenerates the lockfile on a new branch from main and opens a PR.

```bash
git switch main && git pull
git switch -c fix/lockfile-dotenv-17
npm install --ignore-scripts          # rebuilds package-lock.json from package.json
npm ci --ignore-scripts && npm test   # proves the new lockfile installs clean and the tests pass
git add package-lock.json
git commit -m "regenerate lockfile for dotenv ^17"
git push -u origin fix/lockfile-dotenv-17
```

**Blast radius:**
- **Scope:** one file, on a new branch. Main doesn't change until someone reviews and merges the PR.
- **Rollback:** close the PR, or revert the merge commit.
- **Stop if:**
  - The lockfile diff changes much more than dotenv and what dotenv depends on.
  - dotenv 17 breaks the tests. A major version can change behavior, so the PR that raised it should be revisited.

**Verify:**
- The PR's CI run passes `npm ci`.
- After the merge, the next run on main is green.

**Ask next:** which PR changed dotenv, and did its author mean to move to version 17?

```asker-reply
No, switching the pipeline to npm install isn't the right fix, though I understand why it's tempting. Your error shows that the last merge asked for dotenv version 17 but left the old version recorded in the lock file, so npm ci refuses to install.

Your idea would make the build pass by having CI quietly rewrite that lock file on every run. Builds would stop being repeatable, and nobody would review what gets installed. I haven't confirmed which merge caused it, but the error text points to the lock file not being updated.

There's nothing you need to do meanwhile. Next, a developer regenerates the lock file on a branch and opens a pull request. Once that PR's CI run passes and it's merged, main builds again.
```

```aegis-desk
Gate: dependency-problem-pin-branch
Phrase: CHANGE [PACKAGE_NAME] TO [PACKAGE_VERSION] ON [BRANCH_NAME] IN [REPO_NAME]
Change record: R1, none (R1: no change record)
Read-back: git log -1 --stat origin/[BRANCH_NAME]
```