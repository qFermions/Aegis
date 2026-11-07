#!/usr/bin/env bash
# claude-cap: put first on PATH for one desk run. Runs the real claude with every argument unchanged, except
# that the value after --max-budget-usd becomes CAP_USD (the batch 9b limit, 1.50), and appends one line per
# call to CAP_LOG. The desk's own guard assumes 2 US dollars a ticket, so it cannot pass a cap under 2.
real="${REAL_CLAUDE:?set REAL_CLAUDE to the real claude binary}"
cap="${CAP_USD:?set CAP_USD}"
out=(); seen=0; next=0
for a in "$@"; do
  if [ "$next" = 1 ]; then out+=("$cap"); next=0; seen=1; continue; fi
  [ "$a" = "--max-budget-usd" ] && next=1
  out+=("$a")
done
[ "$seen" = 1 ] || { out+=("--max-budget-usd" "$cap"); }
[ -n "${CAP_LOG:-}" ] && echo "claude-cap: --max-budget-usd $cap (desk asked: $(printf '%s ' "$@" | grep -o -- '--max-budget-usd [0-9.]*' || echo none))" >> "$CAP_LOG"
exec "$real" "${out[@]}"
