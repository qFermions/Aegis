#!/usr/bin/env bash
# e6-hits.sh <base> <out>: the charter's E6 grep over `git log -p <base>..HEAD`, every hit line
# saved to <out>, then the hits grouped by the exact text matched (case kept) with a count, so
# each kind of hit can be explained. Run from the repository root.
BASE="$1"; OUT="$2"
[ -n "$OUT" ] || { echo "usage: e6-hits.sh <base commit> <hit-lines file>"; exit 1; }
PAT='api[_-]?key|secret|token|password|/Users/|C:\\\\Users|@gmail'
git log -p "$BASE"..HEAD | grep -n -i -E "$PAT" > "$OUT"
echo "hit lines: $(wc -l < "$OUT") (saved to $OUT)"
echo "--- matched text, case kept (count):"
grep -o -i -E "[A-Za-z0-9_.-]*($PAT)[A-Za-z0-9_.-]*" "$OUT" | sort | uniq -c | sort -rn
