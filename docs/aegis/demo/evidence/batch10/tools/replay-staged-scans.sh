#!/usr/bin/env bash
# replay-staged-scans.sh <base> <scratch-dir>: for each commit after <base> on this branch, check out its parent in a
# throwaway worktree, stage exactly the files that commit changed, and run the staged pre-commit scan there, as the
# rule asks between git add and git commit. Prints one line per commit with the scan's exit code. Deleted files are
# staged as deletions. The worktree is removed after each commit; nothing in the working copy changes.
set -u
base="$1"; scratch="$2"
repo="$(git rev-parse --show-toplevel)"
for c in $(git -C "$repo" rev-list --reverse "$base"..HEAD); do
  wt="$scratch/scan-$c"
  git -C "$repo" worktree add -q --detach "$wt" "$c^" >/dev/null 2>&1 || { echo "$(git -C "$repo" log -1 --format=%h "$c") worktree failed"; continue; }
  changed=$(git -C "$repo" diff --name-only --diff-filter=d "$c^" "$c")
  deleted=$(git -C "$repo" diff --name-only --diff-filter=D "$c^" "$c")
  [ -n "$changed" ] && git -C "$wt" checkout -q "$c" -- $changed
  [ -n "$deleted" ] && git -C "$wt" rm -q --cached $deleted >/dev/null
  out=$(cd "$wt" && node scripts/pre-commit-check.js 2>&1); code=$?
  verdict=$(printf '%s\n' "$out" | grep -E 'Clean|BLOCK|blocked|issue' | tail -1)
  echo "$(git -C "$repo" log -1 --format='%h %s' "$c" | cut -c1-90) | staged files $(printf '%s\n' "$changed" "$deleted" | grep -c .) | scan exit $code | ${verdict:-no verdict line}"
  git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1
done
