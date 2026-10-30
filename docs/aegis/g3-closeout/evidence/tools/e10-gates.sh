#!/usr/bin/env bash
# e10-gates.sh <base>: every file under .claude, modules and docs whose SAFETY GATE count differs
# from <base>, and the changed lines since <base> in .claude/commands that are a gate marker or a
# gate field (Target, Effect, Scope, Reversibility, Required confirmation, Failure behavior,
# PORTAL ACTION), in either gate form (charter check E10: no gate moved). Run from the
# repository root.
BASE="$1"
[ -n "$BASE" ] || { echo "usage: e10-gates.sh <base commit>"; exit 1; }
echo "--- files whose SAFETY GATE count changed since $BASE (path: base -> here):"
for f in $(git diff --name-only "$BASE"..HEAD -- .claude modules docs); do
  b=$(git show "$BASE:$f" 2>/dev/null | grep -o 'SAFETY GATE' | wc -l)
  h=$( [ -f "$f" ] && grep -o 'SAFETY GATE' "$f" | wc -l || echo 0)
  [ "$b" != "$h" ] && echo "$f: $b -> $h"
done
echo "--- gate marker or gate field lines added or removed in .claude/commands since $BASE:"
git diff "$BASE"..HEAD -- .claude/commands | grep -E '^[-+]' | grep -v -E '^(\+\+\+|---) ' \
  | grep -c -E 'SAFETY GATE|\*\*(Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior):\*\*|^[-+]# (Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior):|PORTAL ACTION'
exit 0
