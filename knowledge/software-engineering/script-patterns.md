# Script patterns

How Aegis writes an automation script that a person will run against a real system. The worked example is one task in three languages: move files older than N days from a folder to an archive folder. Python is the complete, tested template; Bash and PowerShell are skeletons with the one changing line left for review. Every script Aegis writes is run by a person, through the `/safe-script` gate, after reading it and its dry run.

## The eight properties every script has

| Property | What it means | Python | Bash | PowerShell |
|---|---|---|---|---|
| Idempotent | A second run changes nothing that the first already changed | skip what is already done | same | same |
| Dry run first | The default run lists what it would change and changes nothing | `--apply` flag | `--apply` flag | `-Apply` switch, plus `-WhatIf` from `SupportsShouldProcess` (EV-59) |
| Count binding | The apply run refuses when its count differs from the dry run's | `--expect-count` | `--expect-count` | `-ExpectCount` |
| Logging | Timestamped lines to stderr, so the scheduler or `tee` keeps them | `logging` (the root logger starts at WARNING, so set INFO, EV-47) | `printf` to stderr | `Write-Information`, `Write-Verbose` |
| Errors and exit codes | Stop on the first failure, say what changed and what did not, exit non-zero | exceptions, `sys.exit` | `set -euo pipefail`, then check what matters on its own line | `$ErrorActionPreference = 'Stop'`, `try`/`catch` (EV-55), `$LASTEXITCODE` after a native program (EV-56) |
| Input validation | Every argument checked before anything is read or changed; folders it must never touch are refused | `argparse` exits 2 on bad arguments (EV-46) | `case` patterns, exit 2 | parameter validation attributes |
| No secrets in code | A credential comes from the environment or a secret store at run time; never from the code, an argument or the log | `os.environ` | an environment variable | `Get-Secret` or an environment variable |
| Tests | One test per rule above, each naming the wrong implementation it catches | `unittest` | a throwaway folder and the exit codes | Pester |

Exit codes used in every example: 0 done or nothing to do, 1 stopped part way, 2 bad arguments, 3 refused by a safety check.

More than ten objects is a mass operation (SR-2, R3): the dry run's count goes in the ticket before the apply run, and `MAX_FILES` refuses a run larger than the owner agreed.

## Python: the complete template

Tested on 2026-11-14 with Python 3.9.6: the five tests below pass, and each of five deliberate breaks (a dry run that moves files, no count check, a non-idempotent folder creation, no home-folder guard, zero days accepted) turns exactly its own test red.

```python
#!/usr/bin/env python3
"""Move files older than N days from one folder to an archive folder.

Dry run by default: it lists what it would move and changes nothing.
--apply moves them, and only when --expect-count equals what it found.
Exit codes: 0 done (or nothing to do), 1 stopped part way, 2 bad arguments,
3 refused by a safety check (a count that differs, a folder it will not touch).
"""
import argparse
import logging
import shutil
import sys
import time
from pathlib import Path

LOG = logging.getLogger("archive_old_files")
REFUSED_ROOTS = {Path("/"), Path.home()}
MAX_FILES = 500  # more than this is a mass change: split it or raise the limit on purpose


def parse_args(argv):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--source", required=True, type=Path, help="folder to read")
    p.add_argument("--archive", required=True, type=Path, help="folder to move old files into")
    p.add_argument("--days", required=True, type=int, help="age in days, 1 or more")
    p.add_argument("--pattern", default="*.log", help="file name pattern, default *.log")
    p.add_argument("--apply", action="store_true", help="move the files (default: dry run)")
    p.add_argument("--expect-count", type=int, help="with --apply: the count the dry run printed")
    args = p.parse_args(argv)
    if args.days < 1:
        p.error("--days must be 1 or more")  # argparse exits with status 2
    if args.apply and args.expect_count is None:
        p.error("--apply needs --expect-count, the number the dry run printed")
    return args


def candidates(source, archive, days, pattern, now=None):
    cutoff = (now if now is not None else time.time()) - days * 86400
    found = []
    for path in sorted(source.glob(pattern)):
        if not path.is_file() or path.is_symlink():
            continue
        if (archive / path.name).exists():
            continue  # already archived: a second run changes nothing (idempotent)
        if path.stat().st_mtime < cutoff:
            found.append(path)
    return found


def main(argv=None):
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, stream=sys.stderr,
                        format="%(asctime)s %(levelname)s %(message)s")
    source, archive = args.source.resolve(), args.archive.resolve()
    if source in REFUSED_ROOTS or archive in REFUSED_ROOTS or source == archive:
        LOG.error("refused: source %s or archive %s is a folder this script never touches", source, archive)
        return 3
    if not source.is_dir():
        LOG.error("refused: source %s is not a folder", source)
        return 3

    files = candidates(source, archive, args.days, args.pattern)
    LOG.info("found %d file(s) older than %d day(s) in %s", len(files), args.days, source)
    if len(files) > MAX_FILES:
        LOG.error("refused: %d files is more than %d; split the run", len(files), MAX_FILES)
        return 3
    if not args.apply:
        for path in files:
            LOG.info("dry run: would move %s", path)
        LOG.info("dry run: nothing changed; to apply, rerun with --apply --expect-count %d", len(files))
        return 0
    if args.expect_count != len(files):
        LOG.error("refused: --expect-count %d but found %d; run the dry run again", args.expect_count, len(files))
        return 3

    archive.mkdir(parents=True, exist_ok=True)
    moved = []
    for path in files:
        try:
            shutil.move(str(path), str(archive / path.name))
        except OSError as err:
            LOG.error("stopped at %s: %s", path, err)
            LOG.error("moved %d of %d; not moved: %s", len(moved), len(files),
                      ", ".join(str(p) for p in files[len(moved):]))
            return 1
        moved.append(path)
        LOG.info("moved %s", path)
    LOG.info("done: moved %d file(s) to %s", len(moved), archive)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Its tests, run with `python3 -m unittest test_archive_old_files` from the script's folder:

```python
import os
import tempfile
import time
import unittest
from pathlib import Path

import archive_old_files as tool


class ArchiveOldFilesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.source, self.archive = root / "logs", root / "archive"
        self.source.mkdir()
        old = time.time() - 40 * 86400
        for name in ("a.log", "b.log"):
            path = self.source / name
            path.write_text("old")
            os.utime(path, (old, old))
        (self.source / "new.log").write_text("new")

    def tearDown(self):
        self.tmp.cleanup()

    def run_tool(self, *extra):
        return tool.main(["--source", str(self.source), "--archive", str(self.archive), "--days", "30", *extra])

    def test_dry_run_changes_nothing(self):
        # catches: a dry run that moves files
        self.assertEqual(self.run_tool(), 0)
        self.assertEqual(sorted(p.name for p in self.source.iterdir()), ["a.log", "b.log", "new.log"])
        self.assertFalse(self.archive.exists())

    def test_apply_refuses_a_count_that_differs(self):
        # catches: an apply that ignores the dry run's count
        self.assertEqual(self.run_tool("--apply", "--expect-count", "5"), 3)
        self.assertFalse(self.archive.exists())

    def test_apply_moves_only_old_files_and_a_second_run_changes_nothing(self):
        # catches: moving new files too, or a second run that fails because the archive exists
        self.assertEqual(self.run_tool("--apply", "--expect-count", "2"), 0)
        self.assertEqual(sorted(p.name for p in self.archive.iterdir()), ["a.log", "b.log"])
        self.assertEqual([p.name for p in self.source.iterdir()], ["new.log"])
        self.assertEqual(self.run_tool("--apply", "--expect-count", "0"), 0)

    def test_refuses_the_home_folder(self):
        # catches: a missing guard on the folders it must never touch
        code = tool.main(["--source", str(Path.home()), "--archive", str(self.archive), "--days", "30"])
        self.assertEqual(code, 3)

    def test_bad_days_is_a_usage_error(self):
        # catches: accepting 0 days, which would archive everything
        with self.assertRaises(SystemExit) as stop:
            self.run_tool("--days", "0")
        self.assertEqual(stop.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
```

## Bash: the skeleton

Run on 2026-11-14 with bash 3.2 (the macOS default) on a throwaway folder: the dry run lists both old files, including one with a space in its name, and exits 0; a wrong count exits 3; `--apply` without a count exits 2; zero days exits 2; the home folder exits 3. The changing line is commented out: the skeleton changes nothing until a person writes and reviews it.

```bash
#!/usr/bin/env bash
# PREVIEW ONLY [script-patterns-bash-skeleton]
# A skeleton, not a finished tool: the one line that changes anything is commented out below. Write the change there, have it reviewed, and run it only through the /safe-script gate.
# usage: archive-old-files.sh --source DIR --archive DIR --days N [--apply --expect-count N]
# exit codes: 0 done or nothing to do, 1 stopped part way, 2 bad arguments, 3 refused by a safety check
set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
usage() { log "usage: archive-old-files.sh --source DIR --archive DIR --days N [--apply --expect-count N]"; exit 2; }

source_dir='' archive_dir='' days='' apply=0 expect=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --source) source_dir="${2:-}"; shift 2 ;;
    --archive) archive_dir="${2:-}"; shift 2 ;;
    --days) days="${2:-}"; shift 2 ;;
    --apply) apply=1; shift ;;
    --expect-count) expect="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

# validate every input before reading anything
[ -n "$source_dir" ] && [ -n "$archive_dir" ] || usage
case "$days" in ''|*[!0-9]*|0) log "--days must be a whole number, 1 or more"; exit 2 ;; esac
[ -d "$source_dir" ] || { log "refused: $source_dir is not a folder"; exit 3; }
if [ "$source_dir" = / ] || [ "${source_dir%/}" = "${HOME%/}" ]; then log "refused: $source_dir is a folder this script never touches"; exit 3; fi
if [ "$apply" -eq 1 ]; then
  case "$expect" in ''|*[!0-9]*) log "--apply needs --expect-count, the number the dry run printed"; exit 2 ;; esac
fi

# collect the candidates first, so the count is known before anything changes
files=()
while IFS= read -r -d '' file; do
  [ -e "$archive_dir/${file##*/}" ] && continue
  files+=("$file")
done < <(find "$source_dir" -maxdepth 1 -type f -name '*.log' -mtime +"$days" -print0)
log "found ${#files[@]} file(s) older than $days day(s) in $source_dir"

if [ "$apply" -eq 0 ]; then
  for file in "${files[@]+"${files[@]}"}"; do log "dry run: would move $file"; done
  log "dry run: nothing changed; to apply, rerun with --apply --expect-count ${#files[@]}"
  exit 0
fi
if [ "$expect" -ne "${#files[@]}" ]; then
  log "refused: --expect-count $expect but found ${#files[@]}; run the dry run again"
  exit 3
fi

moved=0
for file in "${files[@]+"${files[@]}"}"; do
  # the change, reviewed before it is uncommented:
  #   mv -n -- "$file" "$archive_dir/" || { log "stopped at $file after $moved moved"; exit 1; }
  moved=$((moved + 1))
  log "moved $file"
done
log "done: moved $moved file(s) to $archive_dir"
```

## PowerShell: the skeleton

Not run here (no PowerShell on the machine that wrote it): read it, run `Invoke-ScriptAnalyzer` on it, and run it with `-WhatIf` before anything else. The changing line is commented out.

```powershell
# PREVIEW ONLY [script-patterns-powershell-skeleton]
# A skeleton, not a finished tool: the one line that changes anything is commented out below. Write the change there, have it reviewed, and run it only through the /safe-script gate.
# exit codes: 0 done or nothing to do, 1 stopped part way, 2 bad arguments, 3 refused by a safety check
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    # the folder to read
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Source,
    # the folder to move old files into
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Archive,
    # age in days, 1 or more
    [Parameter(Mandatory)][ValidateRange(1, 3650)][int]$Days,
    # move the files; without it the run is a dry run
    [switch]$Apply,
    # with -Apply: the count the dry run printed
    [int]$ExpectCount = -1
)
Set-StrictMode -Version Latest
# every error stops the script, so a half-done run never looks finished
$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

# refuse the folders this script must never touch
$resolved = (Resolve-Path -LiteralPath $Source).ProviderPath.TrimEnd('\', '/')
if ($resolved -in @([IO.Path]::GetPathRoot($resolved).TrimEnd('\', '/'), $HOME.TrimEnd('\', '/'))) {
    Write-Error "refused: $resolved is a folder this script never touches" -ErrorAction Continue
    exit 3
}
if ($Apply -and $ExpectCount -lt 0) {
    Write-Error '-Apply needs -ExpectCount, the number the dry run printed' -ErrorAction Continue
    exit 2
}

# collect the candidates first, so the count is known before anything changes
$cutoff = (Get-Date).AddDays(-$Days)
$files = @(Get-ChildItem -LiteralPath $resolved -File -Filter '*.log' |
    Where-Object { $_.LastWriteTime -lt $cutoff -and -not (Test-Path -LiteralPath (Join-Path $Archive $_.Name)) })
Write-Information "found $($files.Count) file(s) older than $Days day(s) in $resolved"

if (-not $Apply) {
    $files | ForEach-Object { Write-Information "dry run: would move $($_.FullName)" }
    Write-Information "dry run: nothing changed; to apply, rerun with -Apply -ExpectCount $($files.Count)"
    exit 0
}
if ($ExpectCount -ne $files.Count) {
    Write-Error "refused: -ExpectCount $ExpectCount but found $($files.Count); run the dry run again" -ErrorAction Continue
    exit 3
}

$moved = 0
foreach ($file in $files) {
    if ($PSCmdlet.ShouldProcess($file.FullName, "Move to $Archive")) {
        try {
            # the change, reviewed before it is uncommented:
            # Move-Item -LiteralPath $file.FullName -Destination $Archive
            $moved++
            Write-Information "moved $($file.FullName)"
        } catch {
            Write-Error "stopped at $($file.FullName) after $moved moved: $_" -ErrorAction Continue
            exit 1
        }
    }
}
Write-Information "done: moved $moved file(s) to $Archive"
```

A Pester test for it follows the Python tests one for one: a dry run leaves the folder as it was, a wrong `-ExpectCount` exits 3, an apply moves only the old files, and the home folder is refused. Each `It` block builds its own files under Pester's `TestDrive:` folder.

## What the script never does

- It never reads a credential from its arguments or prints one to the log.
- It never deletes where it can move: an archive is the safe place a person checks before anything is purged (judgment rule c).
- It never runs past a failure: it stops, and says what changed and what did not (CLAUDE.md, contract rule 5).
- It never schedules itself. A schedule is a separate change the system owner makes through their own process.
