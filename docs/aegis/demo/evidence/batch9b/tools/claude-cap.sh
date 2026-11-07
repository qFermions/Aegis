#!/usr/bin/env bash
# claude-cap: put first on PATH for one desk run. Runs the real claude with every argument unchanged, except
# that the session budget becomes the smaller of the desk's --max-budget-usd value and CAP_USD (the batch 9b
# limit, 1.50), and appends one line per call to CAP_LOG. The desk's own guard assumes 2 US dollars a ticket,
# so it cannot pass a cap under 2. Both "--max-budget-usd X" and "--max-budget-usd=X" are read; with no
# value, CAP_USD is used. (Code review 1 of batch 9b, finding 11: it once raised a smaller desk value.)
real="${REAL_CLAUDE:?set REAL_CLAUDE to the real claude binary}"
cap="${CAP_USD:?set CAP_USD}"
smaller() { awk -v a="$1" -v b="$2" 'BEGIN { if (a == "" || a + 0 > b + 0) print b; else print a }'; }
out=(); asked=""; next=0
for a in "$@"; do
  if [ "$next" = 1 ]; then asked="$a"; next=0; continue; fi
  case "$a" in
    --max-budget-usd) next=1 ;;
    --max-budget-usd=*) asked="${a#--max-budget-usd=}" ;;
    *) out+=("$a") ;;
  esac
done
use=$(smaller "$asked" "$cap")
out+=("--max-budget-usd" "$use")
[ -n "${CAP_LOG:-}" ] && echo "claude-cap: --max-budget-usd $use (desk asked: ${asked:-none})" >> "$CAP_LOG"
exec "$real" "${out[@]}"
