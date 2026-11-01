#!/usr/bin/env bash
# runbook-diff-lines.sh <from> <to>: batch G4, D2 and D3. The lines .claude/commands gained and lost
# between two commits, and how many of them are not a gate's Read-back field line. Read-only.
# Run from the repository root.
FROM="$1"; TO="$2"
git rev-parse -q --verify "$FROM^{commit}" >/dev/null && git rev-parse -q --verify "$TO^{commit}" >/dev/null || { echo "usage: runbook-diff-lines.sh <from> <to>"; exit 1; }
diff=$(git diff "$FROM" "$TO" -- .claude/commands | grep -E '^[-+]' | grep -vE '^(\+\+\+|---) ')
echo "lines added: $(printf '%s\n' "$diff" | grep -c '^+'); lines removed: $(printf '%s\n' "$diff" | grep -c '^-')"
echo "lines added that are a Read-back field: $(printf '%s\n' "$diff" | grep -cE '^\+(- \*\*Read-back:\*\* |# Read-back: )')"
echo "lines removed that are a Read-back field: $(printf '%s\n' "$diff" | grep -cE '^-(- \*\*Read-back:\*\* |# Read-back: )')"
echo "other lines added or removed:"
printf '%s\n' "$diff" | grep -vE '^[-+](- \*\*Read-back:\*\* |# Read-back: )' | grep -E '^[-+]' | cut -c1-200 | sed 's/^/  /'
