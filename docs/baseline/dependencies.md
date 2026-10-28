# Baseline: runtime, dependencies and tools (batch 1)

Recorded 2026-10-27 at commit `d5fc8c0` (the merge of PR #3) on a fresh shallow clone at `/tmp/fresh` (`clone.txt`), before any change.

## Runtime

| Item | Version | Where declared |
|---|---|---|
| Node.js | v24.22.1 | `.nvmrc` (`24`), `EVALUATE.md` ("Node.js 24"), `ci.yml` (`node-version-file: .nvmrc`), `release-gate.yml` (`node-version: 24`) |
| npm | 11.19.1 (bundled with Node; unused, no manifest) | none |
| PowerShell (pwsh) | 7.5.4 | `EVALUATE.md` ("You need"), `ci.yml` prerequisite step |
| git | 2.43.0 | `EVALUATE.md` |
| bash | 5.2.21 | not declared; used by the shell-gate tests in `scripts/command-safety-gates.test.js` |

## Declared dependencies

None. The repository has no `package.json` and no lockfile (`clone.txt` shows both absent), so Phase 0 installed nothing from the repo. Every script runs on Node.js built-ins (`node:test`, `node:assert`, `node:fs`, `node:child_process`, `node:crypto`, `node:https`).

## Tools installed in this session (outside the repo)

| Tool | Version | License | How installed |
|---|---|---|---|
| Node.js | 24.22.1 | MIT (`LICENSE` in the install tree) | `nvm install 24` with the container's nvm at `/opt/nvm` (nvm itself: MIT); checksum verified by nvm |
| PowerShell | 7.5.4 | MIT (`/opt/pwsh7/LICENSE.txt`) | `powershell-7.5.4-linux-x64.tar.gz` from `github.com/PowerShell/PowerShell/releases`, sha256 `1fd7983fe56ca9e6233f126925edb24bf6b6b33e356b69996d925c4db94e2fef`, extracted to `/opt/pwsh7`, linked at `/usr/local/bin/pwsh` |

No repository dependency was added by this batch.
