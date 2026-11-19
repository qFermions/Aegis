#!/usr/bin/env bash
# commit.sh <slug> <git commit arguments...>: batch 12d, task 6. Runs the pre-commit scan on the staged set, saves
# its output under docs/aegis/demo/evidence/batch12d/precommit/<UTC time>-<slug>.txt (this machine's paths masked),
# stages that file and commits. A scan that does not exit 0 stops the commit. Run it after `git add`, from any
# folder of the working copy; a merge is staged with `git merge --no-ff --no-commit <branch>` first.
set -u
slug="$1"; shift
repo="$(git rev-parse --show-toplevel)"; cd "$repo" || exit 2
dir="docs/aegis/demo/evidence/batch12d/precommit"; mkdir -p "$dir"
file="$dir/$(date -u +%Y%m%dT%H%M%SZ)-$slug.txt"
tmp="$(mktemp)"
{ echo "staged for commit \"$slug\" on $(git rev-parse --abbrev-ref HEAD) at parent $(git rev-parse --short HEAD):"; git diff --cached --name-status; echo "--- node scripts/pre-commit-check.js ---"; } > "$tmp"
node scripts/pre-commit-check.js >> "$tmp" 2>&1; code=$?
echo "exit $code" >> "$tmp"
main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
# the scanner prints one long dash; the repository's rule is none in any file, so it is written as a hyphen
sed -e "s#$repo#<repo>#g" -e "s#$main#<repo>#g" -e "s#$HOME#<home>#g" -e $'s#\xe2\x80\x94#-#g' "$tmp" > "$file"; rm -f "$tmp"
if [ "$code" -ne 0 ]; then echo "pre-commit scan exit $code: not committed; see $file"; exit "$code"; fi
git add "$file" && git commit "$@"
