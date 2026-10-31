# Tools for the batch G3 close-out 3 (2026-10-31)

Nothing is installed from the repository: it has no package manifest and no lockfile (`clone.txt`), and this batch adds none. The session container already held the two tools the batch G3 close-out installed (`docs/aegis/g3-closeout/baseline/dependencies.md`); nothing new was installed.

| tool | version | license | how it was installed |
|---|---|---|---|
| Node.js | v24.22.2 (matches `.nvmrc` 24) | MIT | unchanged from the batch G3 close-out (and its close-out 2): the release tarball from nodejs.org, checked against its SHASUMS256.txt, unpacked to /opt/node24 |
| PowerShell | 7.6.9 | MIT | unchanged from the batch G3 close-out (and its close-out 2): the Microsoft package repository |
