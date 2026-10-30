#!/usr/bin/env bash
# test-counts.sh <base-dir>: the node:test count of every test file in a checkout of the base
# (<base-dir>, for example a detached worktree of f185071) and in this checkout, the per-file
# difference, and both whole-run counts. The sum of the differences must equal the rise of
# the whole run (charter check D9). Run from the repository root.
BASE="$1"
[ -d "$BASE" ] || { echo "usage: test-counts.sh <base-dir>"; exit 1; }
HEAD_DIR=$(pwd)
count() { (cd "$1" && node --test "$2" 2>&1 | grep -oP '^ℹ tests \K\d+'); }
files=$( (cd "$BASE" && git ls-files '*.test.js' '*.test.mjs'; cd "$HEAD_DIR" && git ls-files '*.test.js' '*.test.mjs') | sort -u | grep -v '^shared/')
added=0; removed=0
for f in $files; do
  b=0; h=0
  [ -f "$BASE/$f" ] && b=$(count "$BASE" "$f")
  [ -f "$HEAD_DIR/$f" ] && h=$(count "$HEAD_DIR" "$f")
  d=$((h - b))
  [ "$d" -ne 0 ] && echo "$f: base $b head $h ($d)"
  [ "$d" -gt 0 ] && added=$((added + d))
  [ "$d" -lt 0 ] && removed=$((removed - d))
done
echo "files: $(echo "$files" | wc -l); tests added $added; tests removed $removed"
echo "whole run: base $(cd "$BASE" && node --test 2>&1 | grep -oP '^ℹ tests \K\d+'), head $(node --test 2>&1 | grep -oP '^ℹ tests \K\d+')"
