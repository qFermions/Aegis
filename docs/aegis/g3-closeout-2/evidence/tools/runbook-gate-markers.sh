#!/usr/bin/env bash
# runbook-gate-markers.sh <base>: the SAFETY GATE markers (marker comments and fenced gate
# comments) per runbook in .claude/commands at <base> and in the working tree, every file
# whose count changed, and both totals (F1: the count rises by exactly the gates added and no
# file's count falls). Run from the repository root.
BASE="$1"
[ -n "$BASE" ] || { echo "usage: runbook-gate-markers.sh <base commit>"; exit 1; }
PAT='<!-- SAFETY GATE \[|^# SAFETY GATE \['
before=$(git grep -h -E "$PAT" "$BASE" -- .claude/commands | wc -l)
after=$(grep -h -E "$PAT" .claude/commands/*.md | wc -l)
echo "--- files whose count changed (base -> here):"
for f in .claude/commands/*.md; do
  b=$(git show "$BASE:$f" 2>/dev/null | grep -c -E "$PAT"); h=$(grep -c -E "$PAT" "$f")
  [ "$b" != "$h" ] && echo "$f: $b -> $h"
done
echo "total: $before at $BASE, $after here"
echo "--- gate ids removed (<) or added (>) here:"
diff <(git grep -h -o -E '(<!-- |^# )SAFETY GATE \[[^]]+\]' "$BASE" -- .claude/commands | sed -E 's/.*\[([^]]+)\]/\1/' | sort) <(grep -h -o -E '(<!-- |^# )SAFETY GATE \[[^]]+\]' .claude/commands/*.md | sed -E 's/.*\[([^]]+)\]/\1/' | sort) | grep '^[<>]'
exit 0
