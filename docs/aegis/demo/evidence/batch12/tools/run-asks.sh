#!/usr/bin/env bash
# run-asks.sh <tickets.tsv> <out-root> <limit-usd-per-ask>: one ask-aegis --reply-to asker per line (id<TAB>ticket),
# each into its own results folder <out-root>/<id>, stdout and stderr saved beside it. Skips an ask when the running
# total of reported cost plus one more ask would pass TOTAL_LIMIT (env, US dollars).
set -u
tickets="$1"; root="$2"; per="$3"; total_limit="${TOTAL_LIMIT:-4.00}"
mkdir -p "$root"
spent=0
while IFS=$'\t' read -r id ticket; do
  [ -z "$id" ] && continue
  if python3 -c "import sys; sys.exit(0 if $spent + $per > $total_limit else 1)"; then echo "$id NOT RUN: $spent spent, one more could pass $total_limit"; continue; fi
  ( cd "${REPO:-$(git rev-parse --show-toplevel)}" && node scripts/ask-aegis.js "$ticket" --reply-to asker --results-dir "$root/$id" --max-budget-usd "$per" > "$root/$id.stdout" 2> "$root/$id.stderr" ); code=$?
  cost=$(grep -oE 'Cost: [0-9.]+' "$root/$id.stderr" | grep -oE '[0-9.]+' | head -1)
  [ -z "$cost" ] && cost=$per
  spent=$(python3 -c "print(f'{$spent + $cost:.4f}')")
  echo "$id exit $code cost $cost spent $spent"
done < "$tickets"
