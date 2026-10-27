# Baseline: runtime, dependencies and tools

Recorded 2026-10-27 at commit e7c445c on a fresh clone (`/tmp/fresh`), before any change.

## Runtime

| Item | Version | Where declared |
|---|---|---|
| Node.js | v24.22.1 (local run); CI uses `node-version: 24` | `EVALUATE.md` ("Node.js 24"), `.github/workflows/release-gate.yml` |
| npm | 11.19.1 (bundled with Node; unused, no manifest) | none |
| git | 2.43.0 | `EVALUATE.md` |
| PowerShell (pwsh) | 7.5.4 | not declared; required by `scripts/command-safety-gates.test.js` (see fresh-clone defect below) |
| bash | system bash | not declared; required by the shell-gate tests in the same file |

## Declared dependencies

The repository has no package manifest (`package.json`, lockfile) and no third-party runtime or dev dependency. Every script runs on Node.js built-ins (`node:test`, `node:fs`, `node:child_process`). License of the repository itself: see `LICENSE`.

## Tools used by this batch (installed into the session scratchpad, not the repo)

| Tool | Version | License | How installed |
|---|---|---|---|
| Node.js | 24.22.1 | MIT | `nvm install 24` (nvm shipped in the container at `/opt/nvm`) |
| PowerShell | 7.5.4 | MIT | tarball from `github.com/PowerShell/PowerShell/releases` (`powershell-7.5.4-linux-x64.tar.gz`), extracted to the scratchpad and put on PATH for the test run |
| actionlint | 1.7.7 | MIT | tarball from `github.com/rhysd/actionlint/releases` (`actionlint_1.7.7_linux_amd64.tar.gz`), extracted to the scratchpad |
| PyYAML (parser for check R6a) | 6.0.3 | MIT | already present in the container's Python 3 |

## Fresh-clone defect found by the baseline

`node --test` on a clone without PowerShell: 491 tests, 450 pass, 41 fail (`node-test.txt`). Every failure is `TypeError [ERR_INVALID_ARG_TYPE]: The "file" argument must be of type string. Received undefined` from `runPowerShell` in `scripts/command-safety-gates.test.js:839`: the engine list `POWER_SHELL_ENGINES` (line 792) filters to empty when `pwsh` is absent, and the tests at lines 1546 and 1636 and the per-gate harness tests index it anyway. With pwsh on PATH the same clone passes (`node-test-with-pwsh.txt`). GitHub's `ubuntu-latest` and `windows-latest` runners ship PowerShell, so CI is unaffected. The prerequisite is declared in `EVALUATE.md` by this batch; the test file itself is not changed (the opaque error is reported as a proposed fix in the batch report).
