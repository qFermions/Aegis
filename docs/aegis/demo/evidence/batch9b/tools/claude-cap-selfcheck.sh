#!/usr/bin/env bash
# claude-cap-selfcheck.sh: runs tools/claude-cap.sh with /bin/echo as the real claude and CAP_USD=1.50 over a fixed set
# of argument lists, and prints each list with what the wrapper passed on. Run: bash <this file> (from the repository root).
cap="$(dirname "$0")/claude-cap.sh"
run() { printf 'args: %s\n  -> ' "$*"; REAL_CLAUDE=/bin/echo CAP_USD=1.50 bash "$cap" "$@"; }
run -p x --max-budget-usd 2.00 --model y
run -p x --max-budget-usd 0.40
run -p x --max-budget-usd=2
run -p x --max-budget-usd=0.25
run -p x
run -p x --max-budget-usd
run -p x --max-budget-usd --model y
run -p x --max-budget-usd abc
run -p x --max-budget-usd -1
run -p x --max-budget-usd nan
run -p x --max-budget-usd 1.5.0
run -p x --max-budget-usd .5
run -p x --max-budget-usd 1.50
run -p x --max-budget-usd 10
