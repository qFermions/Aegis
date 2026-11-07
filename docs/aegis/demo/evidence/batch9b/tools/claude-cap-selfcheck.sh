#!/usr/bin/env bash
# claude-cap-selfcheck.sh: runs tools/claude-cap.sh with /bin/echo as the real claude and CAP_USD=1.50, compares each
# result with the expected one, prints every case, and exits 1 on any mismatch. CAP_LOG is unset, so a desk run's
# cap log gets no lines from it. Run: bash <this file> (from the repository root).
cap="$(dirname "$0")/claude-cap.sh"
fail=0
check() {
  local want="$1"; shift
  local got; got=$(env -u CAP_LOG REAL_CLAUDE=/bin/echo CAP_USD=1.50 bash "$cap" "$@")
  if [ "$got" = "$want" ]; then printf 'ok    %s\n      -> %s\n' "$*" "$got"; else printf 'FAIL  %s\n      -> %s (wanted: %s)\n' "$*" "$got" "$want"; fail=1; fi
}
check "-p x --model y --max-budget-usd 1.50" -p x --max-budget-usd 2.00 --model y
check "-p x --max-budget-usd 0.40" -p x --max-budget-usd 0.40
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd=2
check "-p x --max-budget-usd 0.25" -p x --max-budget-usd=0.25
check "-p x --max-budget-usd 1.50" -p x
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd
check "-p x --model y --max-budget-usd 1.50" -p x --max-budget-usd --model y
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd abc
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd -1
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd -0.5
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd nan
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 1.5.0
check "-p x --max-budget-usd .5" -p x --max-budget-usd .5
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 5.
check "-p x --max-budget-usd 1." -p x --max-budget-usd 1.
check "-p x --max-budget-usd 0.9" -p x --max-budget-usd 2 --max-budget-usd 0.9
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 0
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 0.00
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 1.50
check "-p x --max-budget-usd 1.50" -p x --max-budget-usd 10
exit $fail
