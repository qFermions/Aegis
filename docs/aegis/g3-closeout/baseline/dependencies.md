# Tools installed for the batch G3 close-out (2026-10-30)

Nothing is installed from the repository: it has no package manifest and no lockfile, and this batch adds none.

| tool | version | license | how it was installed |
|---|---|---|---|
| Node.js | v24.22.2 (matches `.nvmrc` 24) | MIT (`/opt/node24/LICENSE`, first line "Node.js is licensed for use as follows") | `https://nodejs.org/dist/latest-v24.x/node-v24.22.2-linux-x64.tar.xz`, checked against the same release's `SHASUMS256.txt` (`sha256sum -c`: OK), unpacked to `/opt/node24` and put first on PATH for each command (the container image's Node v22.22.0 stays installed and unused) |
| PowerShell | 7.6.9 | MIT (`/opt/microsoft/powershell/7/LICENSE.txt`: "Copyright (c) Microsoft Corporation.", "MIT License") | `apt-get install powershell` from the Microsoft package repository (`packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb`); `pwsh --version`: PowerShell 7.6.9 |

Both were installed in this session's container before the first commit; nothing was added to the repository.
