# Tools installed for batch G2 (2026-10-27)

Nothing is installed from the repository: it has no package manifest and no lockfile, and this batch adds none.

| tool | version | license | how it was installed |
|---|---|---|---|
| Node.js | v24.22.1 (matches `.nvmrc` 24) | MIT (`/opt/node24/LICENSE`, first line "Node.js is licensed for use as follows") | `https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.xz`, checked against the same release's `SHASUMS256.txt` (`sha256sum -c`: OK), unpacked to `/opt/node24`, linked first on PATH |
| PowerShell | 7.6.9 | MIT | `apt-get install powershell` from the Microsoft package repository (`packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb`); the GitHub release download was refused by the session proxy (HTTP 403) |

The container image's Node v22.22.0 stays installed and unused (`/opt/node22`).
