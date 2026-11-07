#!/usr/bin/env bash
# claude-cap: put first on PATH for one desk run. Runs the real claude with every argument unchanged, except
# that the session budget becomes the smaller of the desk's --max-budget-usd value and CAP_USD (the batch 9b
# limit, 1.50), and appends one line per call to CAP_LOG. The desk's own guard assumes 2 US dollars a ticket,
# so it cannot pass a cap under 2. Both "--max-budget-usd X" and "--max-budget-usd=X" are read; with no
# value, CAP_USD is used. (Code review 1 of batch 9b, finding 11: it once raised a smaller desk value.)
real="${REAL_CLAUDE:?set REAL_CLAUDE to the real claude binary}"
cap="${CAP_USD:?set CAP_USD}"
# the smaller of two amounts. Only a positive decimal amount counts (5, 5., .5, 0.40); anything else (abc, nan,
# 1.5.0, 0, -1, empty) counts as no value, so the cap is used (code review 2, finding 3; code review 3, findings 6, 7)
smaller() {
  if ! [[ "$1" =~ ^([0-9]+\.?[0-9]*|\.[0-9]+)$ ]] || awk -v a="$1" 'BEGIN { exit !(a + 0 <= 0) }'; then echo "$2"; return; fi
  awk -v a="$1" -v b="$2" 'BEGIN { if (a + 0 > b + 0) print b; else print a }'
}
out=(); asked=""; next=0
for a in "$@"; do
  # a flag right after --max-budget-usd is not its value: keep it (code review 2, finding 3)
  # a flag right after --max-budget-usd is not its value: keep it; a negative number is a bad value: drop it
  # (code review 2, finding 3; code review 3, finding 7)
  if [ "$next" = 1 ]; then next=0; case "$a" in -[0-9]*|-.[0-9]*) asked="$a"; continue ;; -*) ;; *) asked="$a"; continue ;; esac; fi
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
