# Failure catalog

Each entry: the symptom as it shows, the likely causes ranked (most likely first), the smallest test that splits them, the fix, and the rollback. Every fix reaches a shared branch only through a pull request a person reviews and merges; every rollback of a merged fix is a revert (`/git-recovery`). Read-only commands appear in backticks; a change is named by the runbook gate that holds it.

## A. Python

**A1. `ModuleNotFoundError: No module named 'x'` in CI or on a server, not on your laptop.**
- Causes: 1. the package is installed on the laptop but missing from the requirements or lockfile; 2. CI uses another Python interpreter or virtual environment than the one the packages went into; 3. the import name differs from the package name.
- Split: `python3 -m pip show x` in the failing environment (missing or present), and `python3 -m pip --version`, which prints the interpreter that pip installs into; compare it with the interpreter the job runs.
- Fix: add the package with an exact pin to the requirements or lockfile through a pull request; make CI install with the same interpreter it runs.
- Rollback: revert the pull request.

**A2. `AttributeError: 'NoneType' object has no attribute ...` or `KeyError` deep in our code.**
- Causes: 1. an upstream call returned nothing (no row, no key, an empty API answer) and the code did not check; 2. the input shape changed (an API version, a renamed field); 3. a race where the value is set later.
- Split: log or print the value one frame up, at the innermost frame of ours (`reading-evidence.md`, Python), for the failing input.
- Fix: validate the value where it enters our code and fail with a clear message, or handle the empty case on purpose; add the failing input as a test.
- Rollback: revert.

**A3. The traceback shows two exceptions joined by "During handling of the above exception, another exception occurred".**
- Causes: 1. the error handler itself failed (a bad log call, a missing variable in the except block); 2. a cleanup step failed after the real error.
- Split: read the first exception: it is the original failure (EV-45). Then read the line of the handler that raised the second.
- Fix: fix the original failure; make the handler unable to fail (no new lookups in it); use `raise ... from err` when wrapping on purpose.
- Rollback: revert.

**A4. `UnicodeDecodeError` or garbled text only on one machine or one file.**
- Causes: 1. the file is not UTF-8 (a spreadsheet export, a Windows code page); 2. the platform default encoding differs; 3. a byte-order mark at the start.
- Split: read the first bytes of the failing file in hex, and compare the locale of the two machines.
- Fix: open files with an explicit encoding; reject or convert other encodings at the input boundary with a clear error.
- Rollback: revert.

## B. Node.js

**B1. `Error [ERR_MODULE_NOT_FOUND]` or `Cannot find module` after a dependency bump.**
- Causes: 1. the package moved to ES modules only (`ERR_REQUIRE_ESM` with `require`); 2. a deep import path the package no longer exports; 3. the lockfile and `node_modules` are out of step.
- Split: read the package's `exports` and `type` fields in its `package.json` at the old and new version (`npm view [PACKAGE_NAME]@[PACKAGE_VERSION] exports type`), and run a clean `npm ci` in CI (it fails on drift, EV-31).
- Fix: pin the last working version on a branch (`/dependency-problem`), then migrate the import on purpose.
- Rollback: revert the pin's pull request.

**B2. The process exits with code 1 and an "unhandled promise rejection" trace.**
- Causes: 1. a missing `await` or `.catch` on a promise; 2. an async error in a callback nobody awaits; 3. an upgrade of Node.js where the default turned a warning into a crash (the default mode is `throw`, EV-48).
- Split: the trace's first frame of ours shows where the promise was created; check whether its caller awaits it.
- Fix: await the promise and handle the error where the code can decide; do not silence the default with a flag.
- Rollback: revert.

**B3. `FATAL ERROR: ... JavaScript heap out of memory`.**
- Causes: 1. the input grew (a bigger file, more rows loaded into memory at once); 2. a leak (a cache or listener that only grows); 3. the container memory limit is lower than the heap Node.js plans for.
- Split: run the same job on a small and a large input and compare peak memory; a leak grows with time on a fixed input, a size problem grows with the input.
- Fix: stream or page the input; remove the leak; raising the heap limit is a stopgap with an end date, not the fix.
- Rollback: revert.

**B4. A TypeScript stack points at the compiled `.js` lines, not the source.**
- Cause: source maps are not on at run time.
- Split: run with `--enable-source-maps` (EV-52) and compare the frames.
- Fix: enable source maps in the runtime command; publish the maps with the build.
- Rollback: remove the flag.

## C. PowerShell

**C1. The script prints red text and keeps going; the `catch` block never runs.**
- Causes: 1. the error is non-terminating, which does not trigger `catch` by default (EV-55); 2. the call is a native program, whose non-zero exit code never triggers `catch` (EV-56).
- Split: add `-ErrorAction Stop` to the one failing cmdlet and see whether `catch` runs; for a native program, read `$LASTEXITCODE` after it.
- Fix: `$ErrorActionPreference = 'Stop'` at the top of a script (or `-ErrorAction Stop` per call), and check `$LASTEXITCODE` after every native program (or turn on `$PSNativeCommandUseErrorActionPreference` in PowerShell 7.4 and later, EV-56).
- Rollback: revert.

**C2. In an advanced function, an error escalated with `Stop` still lets the next statement run.**
- Cause: in a function with `[CmdletBinding()]`, an escalated error is statement-terminating, so execution continues at the next statement after the call (EV-60).
- Split: call the function and print a line after the failing call; it prints.
- Fix: wrap the call in `try`/`catch` and `return` or `throw` in `catch`; or use `$PSCmdlet.ThrowTerminatingError()` so the caller decides.
- Rollback: revert.

**C3. `ParameterBindingException` or "A parameter cannot be found that matches parameter name".**
- Causes: 1. the module version on the failing host is older or newer than the one the script was written for; 2. a placeholder or an empty variable was passed; 3. a parameter set conflict.
- Split: `Get-Command <name> -Syntax` on both hosts, and `Get-Module <name> -ListAvailable` for the versions.
- Fix: pin the module version the script needs (`#Requires -Modules`), validate parameters with attributes.
- Rollback: revert.

## D. Bash

**D1. A script with `set -e` did not stop at a failing command.**
- Causes: 1. the command was in an `if` condition or in an `&&` or `||` list, where `set -e` does not stop the script; 2. the failure was inside a pipeline and `pipefail` was off; 3. the failure was inside a command substitution in an assignment with `local` [unconfirmed: check the vendor page, EV-67].
- Split: rerun with `bash -x` and read where the failing command sits.
- Fix: `set -euo pipefail`, and check the exit code of each command whose failure matters on its own line.
- Rollback: revert.

**D2. `$'\r': command not found` or `bad interpreter: /bin/bash^M`.**
- Cause: the file has Windows line endings.
- Split: `file <script>` reports CRLF line terminators.
- Fix: convert the file to LF and add a `.gitattributes` rule (`*.sh text eol=lf`) through a pull request.
- Rollback: revert.

**D3. Works by hand, fails from a scheduler with "command not found" (exit 127).**
- Causes: 1. the scheduler's `PATH` is shorter; 2. it runs as another user without the same tools or credentials; 3. a different working directory.
- Split: print `PATH`, the user and the working directory at the start of the script in both runs.
- Fix: use full paths or set `PATH` in the script; never depend on the working directory.
- Rollback: revert.

**D4. A file name with spaces breaks a loop, or a variable expands into two arguments.**
- Cause: an unquoted variable is split into words.
- Split: run on a test folder with a file name that has a space.
- Fix: quote every expansion (`"$var"`), loop with `find ... -print0` and `read -r -d ''`, run `shellcheck`.
- Rollback: revert.

## E. GitHub Actions

**E1. A secret is empty, or a step gets "Resource not accessible by integration", only on pull requests from forks.**
- Causes: 1. secrets are not passed to runs triggered from a fork (EV-01); 2. the token is read-only in those runs (EV-02).
- Split: compare the run's event and the head repository with a run from a branch of the same repository.
- Fix: keep secret-needing steps out of fork runs (run them after merge, or on a trusted event); never switch to `pull_request_target` to get the secrets while checking out the fork's code (EV-06). Widening the token does not help and is a smell if proposed.
- Rollback: revert the workflow change.

**E2. "Resource not accessible by integration" on a branch run after someone added a `permissions` block.**
- Cause: once one permission is set, every permission left out is set to none (EV-04).
- Split: read the job's "GITHUB_TOKEN Permissions" section in the log's set-up step and compare it with what the failing step calls.
- Fix: add the one permission the step needs, at job level, read before write (EV-03, EV-05).
- Rollback: revert.

**E3. A job that passed yesterday fails today with no code change.**
- Causes: 1. the runner image moved under a `-latest` label (GitHub calls these "the latest stable images", EV-15; that a label moves to a newer image over time is [unconfirmed: check the vendor page]); 2. a dependency range picked up a new release; 3. an action reference by tag moved; 4. a restored cache is stale.
- Split: compare the "Runner Image" and tool versions in the set-up step of the last green and the first red run; compare resolved dependency versions; check whether the action reference is a full commit SHA (EV-16).
- Fix: pin the image label and the versions that worked, pin actions to a full commit SHA, then upgrade on purpose in its own pull request.
- Rollback: revert the pin.

**E4. A test fails on one run and passes on the next with the same commit.**
- Causes: 1. a flaky test (time, ordering, shared state, a network call); 2. a race in the code itself; 3. a runner resource limit.
- Split: one re-run of the failed jobs (`/ci-failure` gate, EV-07, EV-09); then run the one test many times locally with a fixed seed.
- Fix: fix the test or the race; quarantine with an owner and an end date if the fix takes time. Re-running until green is not a fix.
- Rollback: revert the quarantine when the fix lands.

**E5. The job stops at about six hours, or at the `timeout-minutes` you set.**
- Causes: 1. a hang (a prompt waiting for input, a deadlock, a network call with no timeout); 2. a real slowdown.
- Split: the last log line before the stop, and the step's duration in earlier green runs; the default job timeout is 360 minutes (EV-14).
- Fix: a timeout on every network call and a non-interactive flag on every tool; set `timeout-minutes` close to the normal duration so a hang fails fast.
- Rollback: revert.

**E6. A later job cannot find a file an earlier job built.**
- Causes: 1. jobs run on separate runners; files pass between jobs as artifacts, not caches (EV-20); 2. the artifact name or path differs; 3. a cache was used where an artifact was needed.
- Split: read the upload step's artifact name and the download step's name.
- Fix: upload and download the same artifact name; use a cache only for files that rarely change (EV-20).
- Rollback: revert.

**E7. A restored cache brings back an old or broken dependency set.**
- Causes: 1. the cache key does not include the lockfile hash, so a stale entry matches; 2. a restore key matched an older prefix (EV-13).
- Split: read the cache key the step printed and the lockfile hash.
- Fix: put the lockfile hash in the key; a cache cannot be changed once created (EV-13), so a new key is the fix. Deleting the entry is the second choice (`/ci-failure`, Phase B).
- Rollback: revert the key change.

**E8. A workflow should have started after a bot or another workflow pushed, and nothing ran.**
- Causes: 1. the push or the event was made with the run's own `GITHUB_TOKEN`, and events it triggers do not start new workflow runs (EV-18); 2. the workflow's trigger filters (branches, paths) exclude it; 3. the workflow is disabled.
- Split: read who or what made the push (the commit's author and the run that pushed it), and the trigger block of the workflow that did not run.
- Fix: trigger the next workflow on purpose (`workflow_dispatch` or `repository_dispatch`, exceptions the same page names, EV-18), or have a person or a dedicated app make the push; never put a person's long-lived token in the workflow to get around it.
- Rollback: revert the workflow change.

## F. Resources, containers and Docker

**F1. Exit code 137, "Killed", or a container that restarts.**
- Causes: 1. out of memory (killed by the kernel or the orchestrator); 2. killed by a timeout or a person.
- Split: the host's or orchestrator's event for the container (an out-of-memory kill is recorded there); exit 137 is 128 plus signal 9 [unconfirmed: check the vendor page, EV-66].
- Fix: lower the memory the job needs (stream the input) or raise the limit with the owner of the host.
- Rollback: restore the old limit.

**F2. A Docker build passes locally and fails in CI, or the other way.**
- Causes: 1. a moving base image tag (EV-63); 2. a stale local layer cache (EV-62); 3. another CPU architecture; 4. a secret passed as a build argument locally and missing in CI.
- Split: build with `--pull --no-cache` on both sides (EV-64) and compare the base image digest each build used.
- Fix: pin the base image by digest; pass secrets with secret mounts, never build arguments (EV-65).
- Rollback: revert to the previous digest.

## G. Dependencies

**G1. `npm ci` fails: the lockfile and `package.json` are not in sync.**
- Causes: 1. someone edited `package.json` and did not commit the regenerated lockfile; 2. two branches each changed the lockfile and the merge kept the wrong half.
- Split: `git log -p -- package.json package-lock.json` for the last change to each.
- Fix: regenerate the lockfile on a branch from the committed manifest (`/dependency-problem`, gate `dependency-problem-pin-branch`).
- Rollback: revert.

**G2. Install fails with `ERESOLVE` (npm) or `ResolutionImpossible` (pip).**
- Causes: 1. two packages need incompatible versions of a shared dependency; 2. a peer dependency range excludes the version you have.
- Split: `npm explain [PACKAGE_NAME]` (EV-38) or the resolver's message names the two requirers.
- Fix: upgrade or pin the one top-level package that forces the conflict; an `overrides` entry (EV-34) only with a comment, an owner and an end date. Forcing past the resolver hides the conflict.
- Rollback: revert.

**G3. A version that installed yesterday is gone today.**
- Causes: 1. it was unpublished within its window (npm: 72 hours, EV-33) or yanked (PyPI) [unconfirmed: check the vendor page, EV-43]; 2. a registry or mirror outage.
- Split: `npm view [PACKAGE_NAME] time` or the PyPI project page; the registry status page.
- Fix: move to a published version; a removed version is a reason to read the package's notice, and a removed version with no notice is a smell (tree 3).
- Rollback: none needed for a read.

**G4. A pip hash mismatch on a pin that did not change.**
- Causes: 1. the file on the index changed without a version change, which hash checking exists to catch (EV-42); 2. a proxy or mirror served a different file; 3. a different platform wheel.
- Split: compare the hash pip expected, the hash it got, and the file name (platform tag) it downloaded.
- Fix: a changed file under the same version is a smell: security on-call before any install. A platform difference: add the hash of that platform's file.
- Rollback: none; do not install.

## H. Git

**H1. Commits are gone after a reset, a rebase or a deleted branch.**
- Causes: 1. the branch pointer moved; the commits still exist and the local reflog lists them (EV-27); 2. the work was never committed (no recovery from git).
- Split: `git reflog` in the clone where it happened; look for the commit message.
- Fix: recreate the work as a new branch at that commit (`git-recovery-restore-branch`).
- Rollback: delete the restored branch.

**H2. A merge broke the main branch.**
- Causes: 1. the merge itself (a bad conflict resolution); 2. a commit inside the merged branch.
- Split: `git log --first-parent` on the main branch to find the merge, then test the parent before it.
- Fix: revert the merge with the mainline parent on a new branch (`git-recovery-revert-merge`, EV-24). To bring the work back later, revert the revert first.
- Rollback: revert the revert.
