# Tools for batch G4 (2026-10-31)

Nothing is installed from the repository: it has no package manifest and no lockfile (`clone.txt`), and this batch adds none.

| tool | version | license | how it was installed |
|---|---|---|---|
| Node.js | v24.22.1 (matches `.nvmrc` 24) | MIT | already in the session container at /opt/node24; put first on PATH for every check |
| PowerShell | 7.6.9 | MIT | installed in this session from the Microsoft package repository for Ubuntu 24.04 (`packages-microsoft-prod.deb`, then `apt-get install powershell`) |
| Claude Code CLI | 2.1.316 | Anthropic commercial terms (not a repository dependency) | already in the session container at /opt/node22/bin/claude; used only by the B11 smoke, never by a test |
