---
description: Fix a dependency or lockfile problem (npm and pip first) - version ranges, lockfile drift, a transitive break, a yanked or unpublished version, reproducible installs with npm ci or pip hashes, safe one-step upgrades, and when a dependency smell is a security escalation. Engineer answer; Incident answer for a suspected compromised package. Pinning one package on a new branch sits behind an exact-phrase gate (R1); the merge is a reviewed pull request. Placeholders only.
disable-model-invocation: true
---

# /dependency-problem

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human runs every step (HUMAN-RUN): Aegis never installs, pins, publishes or merges.

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[REPO_NAME]` · `[PACKAGE_NAME]` (one npm or PyPI package) · `[PACKAGE_VERSION]` (one exact version of it) · `[BRANCH_NAME]` (a new branch for the pin) · `[COMMIT_SHA]` · `[CVE_ID]` · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Answer mode:** Engineer answer. Incident answer when a package looks compromised (Phase D). Ask first when the ticket asks to "just upgrade everything", "force it" or "turn off the audit check" with no error text: ask for the failing command and its first error.

**Knowledge:** `knowledge/software-engineering/decision-trees.md` (tree 3), `failure-catalog.md` (sections B1, G), `reading-evidence.md` (npm and pip output).

## ⚠️ Admin / safety gate

- **Smell first.** A release that adds an install script, network calls or obfuscated code; a new maintainer just before a release; a name one letter off a popular package; a pinned version whose file hash changed: stop installing it anywhere and go to Phase D (judgment rule a).
- **Install scripts run code.** When a package is in doubt, nothing installs it with scripts on: `--ignore-scripts` keeps npm from running package scripts (EV-32).
- **One package, one step, one pull request.** A pin or an upgrade changes one package (and what its lockfile entry pulls), on its own branch, reviewed and merged by a person.
- **Never `npm audit fix --force` as a fix.** It installs outside your stated ranges, including major versions (EV-36).

## Fast path

1. Phase A: read the error, the lockfile diff and the chain that pulls the package in.
2. Phase B: reproduce with the lockfile (`npm ci` fails on drift, EV-31; pip hash checking, EV-39).
3. Phase C: pin or upgrade one package on a new branch (gate), then a pull request.
4. Phase D: a compromised package: Incident answer.

## Phase A: Read the evidence (R0)

**Purpose:** which package, which version, how it got here, and what changed.

1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → Advanced Security: read whether Dependabot alerts and security updates are on [unconfirmed: check in the GitHub UI]. A Dependabot security update proposes the minimum patched version, and cannot move a transitive dependency when its parent must change too (EV-22). Open alerts are triaged in `/github-security-alerts`.
2. Read the first error of the failing install or build, not the last line (`reading-evidence.md`).
3. Find what changed: the lockfile diff since the last green build, and whether the failing version came in through a range (`^` means compatible, `~` approximately equivalent, EV-35) or through a change of ours.
4. Find the chain that pulls the package in (`npm explain`, EV-38), and when each version was published.

<details>
<summary>Read-only commands (HUMAN-RUN; each prints and changes nothing)</summary>

```bash
# HUMAN-RUN read-only. Each line prints and changes nothing.
# the chain of packages that pulls this one into the project
npm explain [PACKAGE_NAME]
# the versions the registry has and when each was published
npm view [PACKAGE_NAME] time
# the install scripts a version declares, empty is what you hope to see
npm view [PACKAGE_NAME]@[PACKAGE_VERSION] scripts
# the lockfile and manifest changes since the last good commit
git diff [COMMIT_SHA] -- package.json package-lock.json
# known advisories against the locked tree, a non-zero exit means at least one was found
npm audit --audit-level=high
# signatures and provenance attestations of the installed packages
npm audit signatures
# Python: installed packages whose own requirements are not met
python3 -m pip check
```
</details>

`npm audit` exits non-zero when it finds a vulnerability at or above `--audit-level` (EV-37); `npm audit signatures` also verifies provenance attestations (EV-37); `pip check` verifies that installed packages have compatible dependencies (EV-40).

**Stop if:** `npm view ... scripts` shows an install script the previous version did not have, or the version was published hours ago with no release notes: Phase D.

**Verification checkpoint:** [ ] the package, the bad version, the last good version and the chain are in the ticket.

## Phase B: Reproduce with the lockfile (R0)

**Purpose:** prove the failure comes from the locked set, not from one machine.

1. The CI run is the clean reproduction: it installs from the lockfile on a fresh runner. Read its install step.
2. `npm ci` refuses when `package.json` and the lockfile disagree and never writes either file (EV-31): that error is lockfile drift, fixed by regenerating the lockfile on a branch (Phase C), never by switching CI to `npm install`.
3. pip: a `requirements.txt` with `==` pins and hashes installs the same files every time; hash checking is all or nothing (EV-39) and catches a file that changed without its version changing (EV-42). Constraints files only limit versions, they install nothing (EV-41).

The reproducible Python install a developer runs in a fresh virtual environment, after reading the requirements diff:

```bash
# PREVIEW ONLY [dependency-problem-python-pip-preview]
# Planning only: a developer runs this in a fresh virtual environment, never on a shared server.
# installs exactly the pinned files and refuses any file whose hash differs, wheels only so no build script runs
# pip install --require-hashes --only-binary :all: -r requirements.txt
```

**Verification checkpoint:** [ ] the failure reproduces from the lockfile, or the drift is named.

## Phase C: Pin or upgrade one package on a new branch (R1)

**Purpose:** a reviewed change of one package, with the lockfile regenerated and the tests run.

**Try first:** when the break came through a range and the last good version is known, pin that version (this gate); upgrading the code to the new version is a separate pull request. A transitive package the project does not list directly is pinned with an `overrides` entry (EV-34) in its own reviewed change, with a comment naming the upstream issue, an owner and an end date.

**Stop if:** the version to pin was published hours ago with no notes; the lockfile diff changes packages you did not name (a range pulled them in); `npm view ... scripts` shows a new install script; the working tree is not clean.

**Role needed:** write access to `[REPO_NAME]` to push a branch; the merge follows `/code-review-checklist`.

<details>
<summary>Pin one npm package on a new branch (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN: pin one npm package on a new branch and push that branch for a pull request, the developer runs this, Aegis never does
# SAFETY GATE [dependency-problem-pin-branch]
# Target: [PACKAGE_NAME] in [REPO_NAME] on the new branch [BRANCH_NAME]
# Effect: change [PACKAGE_NAME] to exactly [PACKAGE_VERSION] in package.json and the lockfile on [BRANCH_NAME], and push that branch
# Scope: one package in one repository, on a new branch only, the default branch is untouched until a person merges the pull request
# Reversibility: R1: undo is closing the pull request and deleting [BRANCH_NAME], after a merge the undo is a revert
# Required confirmation: type exactly "CHANGE [PACKAGE_NAME] TO [PACKAGE_VERSION] ON [BRANCH_NAME] IN [REPO_NAME]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
# the exact phrase to type
required_confirmation="CHANGE [PACKAGE_NAME] TO [PACKAGE_VERSION] ON [BRANCH_NAME] IN [REPO_NAME]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# precondition, checked before you type the phrase: a clean working tree on an up to date default branch, and the stop checks above are clear
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # starts the new branch from where you are
  git switch -c [BRANCH_NAME]
  # writes the exact version and regenerates the lockfile with package scripts off, then proves the lockfile installs clean, runs the tests, and only then commits and pushes the two files
  npm install --save-exact --ignore-scripts [PACKAGE_NAME]@[PACKAGE_VERSION] && npm ci --ignore-scripts && npm test && git add package.json package-lock.json && git commit -m "pin [PACKAGE_NAME] to [PACKAGE_VERSION]" && git push -u origin [BRANCH_NAME]
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the branch on the remote ends with the pin commit and changes only the two files
git log -1 --stat origin/[BRANCH_NAME]
```
</details>

If any step after the phrase fails, nothing is pushed: the `&&` chain stops at the first failure, and the branch stays on your machine. Read the failing step, then delete the local branch or fix it.

**Read-back:** `git log -1 --stat origin/[BRANCH_NAME]` lists only `package.json` and `package-lock.json`. Then the developer opens the pull request with the lockfile diff, the release notes read, and the rollback (a revert).

**Verification checkpoint:** [ ] the pull request changes one package and its lockfile entries · [ ] its CI run, which installs with `npm ci`, is green.

## Phase D: A package that looks compromised (Incident answer)

**Purpose:** stop the spread, keep the evidence, escalate (judgment rule a).

1. **Contain:** stop installing it: no `npm install`, no `npm ci`, no re-run of a job that installs it, until the security on-call decides. If a build already installed it with scripts on, treat that runner or laptop and every secret it could reach as exposed.
2. **Preserve:** the lockfile, the CI logs of the installs, the package version, its publish time and its install script (read with `npm view`, never by installing).
3. **Escalate:** the security on-call, with the package and version, when it was published, where it was installed (repositories, runners, laptops), whether install scripts ran, and which secrets those places hold (`knowledge/software-engineering/escalation.md`).
4. **Then:** pin the last good version through Phase C on the security on-call's word. A version unpublished from npm can never be reused (EV-33).

**Verification checkpoint:** [ ] the security on-call has the evidence · [ ] no new install of the suspect version happened after it was found.

## ⚠️ Risk warning

- **`npm audit fix --force` can jump major versions** (EV-36): read the plan, then change one package at a time.
- **Switching CI from `npm ci` to `npm install` hides drift** and can write a different lockfile on every run (EV-31).
- **An override is a debt.** It hides a real conflict; give it an owner and an end date.
- **A brand-new release is the riskiest version.** Prefer a version that has been public for some days, unless it is the security fix.
- **Install scripts run with the installer's rights.** Keep them off when a package is in doubt (EV-32).

## ✅ Verification checklist

- [ ] The package, the bad and good versions, and the chain are in the ticket.
- [ ] The failure reproduces from the lockfile, or the drift is named.
- [ ] The pin or upgrade is one package on one branch, behind the gate, with its tests run.
- [ ] Its pull request is reviewed and merged by a person; its CI run with `npm ci` is green.
- [ ] Any smell went to the security on-call before any further install.

## 📝 Jira-ready note

> [Completed, only when the pull request is merged and its run is green] Dependency `[PACKAGE_NAME]` in `[REPO_NAME]`: (error, one line). Cause: (range picked up [PACKAGE_VERSION] / lockfile drift / transitive break / unpublished version). Fix: pinned to (version) on [BRANCH_NAME], pull request (link) merged by [ADMIN_NAME] at (time); CI with `npm ci` green. Upstream issue: (link or none). Rollback: revert of that pull request. Not checked: (what). Time spent: [X] min.
>
> [Partial state, keep open] Seen: (error). Suspect version: (version). Escalated: (no / security on-call at time). Next owner: [ADMIN_NAME]; next step: (one line).

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-software-engineering.md`):** docs.npmjs.com npm ci (EV-31, EV-32), unpublish policy (EV-33), package.json (EV-34, EV-35), npm audit (EV-36, EV-37), npm explain (EV-38) · pip.pypa.io secure installs, pip check, user guide, repeatable installs (EV-39 to EV-42) · docs.github.com Dependabot security updates (EV-22).
