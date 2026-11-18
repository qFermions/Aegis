# Decision trees

Each tree is a list of questions in order. Take the first branch whose question is "yes". Every branch ends in a runbook, a file of this module, or an escalation.

## Tree 1: a stack trace or an error log arrives

1. Does the trace or log show a secret, a token, a key or a password in clear text? Yes: judgment rule a. Tell the security on-call now, and say the secret must be revoked before anything else (`escalation.md`). Keep working the bug in the same answer.
2. Is there more than one error? Yes: work the first one (`method.md`, step 2). The later ones are usually consequences.
3. Is the innermost frame in our own code? Yes: start there: the inputs it received and the exception type. No (only library or runtime frames): look for the outermost frame of ours above them; the call we made into the library is the suspect. No frame of ours at all: the failure is in the environment (the runtime version, a missing native library, a permission, memory); go to question 6.
4. Is it a chained exception (Python "direct cause" or "during handling", Node.js `cause`)? Yes: read the first exception in the chain first.
5. Can you reproduce it with the same versions? Yes: write the minimal failing test (`/debug-stack-trace`, Phase C). No: compare the two environments (versions, data, secrets, permissions, time); the difference is the lead.
6. Is it a resource or a platform signal (out of memory, a killed process, exit 137, a timeout, a disk full)? Yes: it is about the environment or the input size, not the line of code; read `failure-catalog.md` section F and ask the owner of the host or runner.
7. It worked before? Yes: bisect (`method.md`, step 5).

## Tree 2: a CI job failed

1. Is the vendor's status page showing an incident for Actions, Packages or Git operations (EV-21)? Yes: nothing to fix on our side; wait, and say so. Check this before any change.
2. Does the job log or the workflow change show a smell (a secret printed, an action reference changed to a new owner or tag, a step that downloads and runs a script from an unknown host, a `pull_request_target` workflow that checks out the pull request's code)? Yes: judgment rule a, Incident answer (`/ci-failure`, Phase D).
3. Which step is the first red one? Read only from there (EV-11).
4. Did it fail only on a pull request from a fork, with an empty secret or "Resource not accessible by integration"? Yes: secrets are not passed to fork runs and the token is read-only there (EV-01, EV-02). The fix is the workflow design, never a wider token (`/ci-failure`, Phase C).
5. Did the runner image, the runtime version or a cached dependency change since the last green run? Yes: compare the "Runner Image" and setup lines of the last green and the first red run; pin the version that worked, then upgrade on purpose.
6. Does the same commit pass on a re-run, or fail in a different test each time? Yes: a flaky test. One re-run is allowed to confirm it (`/ci-failure` gate); then the test is quarantined or fixed through a pull request. A real failure fails the same way twice.
7. Does it fail the same way locally with the locked dependencies? Yes: it is a code or dependency bug: tree 1 or tree 3.

## Tree 3: a dependency install or a build broke

1. Did a package release that day add an install script, a new maintainer, network calls or obfuscated code, or is the name one letter off a popular package? Yes: judgment rule a. Do not install it again anywhere. Security on-call (`/dependency-problem`, Phase D).
2. Does `npm ci` say the lockfile and the manifest do not match (EV-31), or does pip say a hash does not match (EV-39)? Yes: lockfile drift or a changed file. Regenerate the lockfile on a branch from the manifest that is committed; a hash mismatch on an unchanged pin is a smell (question 1).
3. Did the failing version arrive through a range (`^`, `~`, an unpinned requirement) and not through a change of ours? Yes: a transitive or minor release broke it. Pin the last good version on a branch, then report it upstream (`/dependency-problem`, Phase C).
4. Was the version unpublished, yanked or deprecated? Yes: move to a published version; an npm version number can never be reused (EV-33).
5. Is it a peer dependency or resolver conflict (ERESOLVE, ResolutionImpossible)? Yes: find the chain with `npm explain` (EV-38) or the resolver message, and change the one top-level package that forces it.
6. Is it a Docker build? Yes: find the first failing instruction; a change in one layer rebuilds every layer after it (EV-62); a moving base tag is a change you did not make (EV-63).

## Tree 4: git history is wrong

1. Was a secret committed? Yes: judgment rule c, in this order: revoke or rotate the secret at its issuer, review its use, and only then, with the repository owner, clean the history (EV-25, EV-26). Security on-call.
2. Are the bad commits only on your machine (never pushed)? Yes: a backup branch first, then move your branch (`/git-recovery`, gate `git-recovery-local-reset`).
3. Are they on a shared branch? Yes: revert them on a new branch and merge the revert through a pull request (`git-recovery-revert-commit`, or `git-recovery-revert-merge` for a merge commit, EV-24). Never reset or force push a shared branch from this runbook.
4. Was work lost (a deleted branch, a reset, a bad rebase)? Yes: find it in the reflog of the clone where it happened (EV-27), then recreate it as a new branch (`git-recovery-restore-branch`) and check it before anything else.
5. Did someone force push over others' commits? Yes: the commits are in the reflogs of the clones that had them; restore to a new branch and ask the owner. An unexplained force push to a protected branch is a smell: security on-call.

## Tree 5: someone asks for a script (a build request)

1. Does the script change a system (accounts, files on a server, cloud resources, tickets)? Yes: it gets a dry run by default, an `--apply` flag, a confirmation before the destructive step, logging and exit codes (`/safe-script`). No (a read-only report): still validate inputs and use exit codes, and say it changes nothing.
2. Does it need a credential? Yes: it reads it from the environment or a secret store at run time, never from the code, the arguments or the log.
3. Will it touch more than ten objects? Yes: R3 (mass operation, SR-2): the dry run's count goes in the ticket first, and the apply run stops when the count differs.
4. Does a vendor tool or an existing runbook already do it? Yes: point to it instead of writing code.

## Tree 6: which answer mode

1. The ticket says what thing, but no symptom, error text, who or since when; or the cause is unclear and the obvious fix widens a permission, turns off a check or changes a policy: **Ask first**. The question asks for the one piece of evidence that would show the cause (the run link, the first red step's log, the exact error line).
2. The main point is a smell of compromise: **Incident answer**.
3. A trace, a log, a CI run, a dependency problem, a review, a script or a git recovery: **Engineer answer**.
4. A person's own access or account: **Fix card**, routed to the GitHub runbooks.
