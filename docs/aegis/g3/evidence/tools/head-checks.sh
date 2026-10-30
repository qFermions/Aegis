#!/usr/bin/env bash
# head-checks.sh <base>: the declared checks and the D7, D9, D11 and D15 facts at the checkout,
# in one capture: the four ticket evals' summary lines, the command lint, the scanner's BLOCK
# and WARN counts, the release boundary, CLAUDE.md's size and diff, the PRODUCT_CONTRACT.md
# lines removed since <base> and its boundary sentences, SAFETY GATE markers at <base> and here,
# and U+2014 in the files and lines this batch added.
# Run from the repository root: bash docs/aegis/g3/evidence/tools/head-checks.sh f185071
BASE="$1"
git rev-parse -q --verify "$BASE^{commit}" >/dev/null || { echo "usage: head-checks.sh <base commit>"; exit 1; }
EM=$(printf '\xe2\x80\x94')
for e in ms gws g2 g3; do
  out=$(node "scripts/eval/$e-ticket-eval.js" 2>&1); code=$?
  echo "node scripts/eval/$e-ticket-eval.js: exit $code; $(echo "$out" | grep -E '^[0-9]+/[0-9]+ tickets' | cut -d' ' -f1-6)"
done
out=$(node scripts/lint/command-structure.js 2>&1); code=$?
echo "node scripts/lint/command-structure.js: exit $code; $(echo "$out" | grep -oE '[0-9]+ commands' | head -1); $(echo "$out" | grep -oE '^clean' | head -1)"
out=$(node scripts/pre-commit-check.js --all 2>&1); code=$?
echo "node scripts/pre-commit-check.js --all: exit $code; BLOCK lines $(echo "$out" | grep -c 'BLOCK  Line'), WARN lines $(echo "$out" | grep -c 'WARN  Line')"
out=$(node scripts/harness/release-boundary-check.js 2>&1); code=$?
echo "node scripts/harness/release-boundary-check.js: exit $code; $(echo "$out" | grep -oE 'RELEASE BOUNDARY: [A-Z]+' | head -1)"
echo "CLAUDE.md: $(wc -c < CLAUDE.md) bytes; lines changed since $BASE: $(git diff "$BASE"..HEAD -- CLAUDE.md | grep -cE '^[-+][^-+]')"
echo "PRODUCT_CONTRACT.md lines removed since $BASE:"
git diff "$BASE"..HEAD -- PRODUCT_CONTRACT.md | grep -E '^-[^-]|^-$' | sed 's/^/  /'
echo "boundary sentences: 'AEGIS ADVISES. HUMAN ADMINISTRATORS EXECUTE.' in PRODUCT_CONTRACT.md $(grep -c 'AEGIS ADVISES. HUMAN ADMINISTRATORS EXECUTE.' PRODUCT_CONTRACT.md) (at $BASE $(git show "$BASE":PRODUCT_CONTRACT.md | grep -c 'AEGIS ADVISES. HUMAN ADMINISTRATORS EXECUTE.')); 'AEGIS ADVISES; HUMAN ADMINISTRATORS' in CLAUDE.md $(grep -c 'AEGIS ADVISES; HUMAN ADMINISTRATORS' CLAUDE.md)"
markers() { git grep -c 'SAFETY GATE' "$1" -- .claude modules docs | awk -F: '{s+=$NF} END {print s}'; }
echo "SAFETY GATE markers in .claude, modules and docs: $(markers "$BASE") at $BASE, $(markers HEAD) here"
fell=$(join -t "$(printf '\t')" <(git grep -c 'SAFETY GATE' "$BASE" -- .claude modules docs | sed "s/^$BASE://" | awk -F: '{print $1"\t"$NF}' | sort) <(git grep -c 'SAFETY GATE' HEAD -- .claude modules docs | sed 's/^HEAD://' | awk -F: '{print $1"\t"$NF}' | sort) -a 1 -e 0 -o 0,1.2,2.2 | awk -F'\t' '$3 < $2 {print "  " $1 ": " $2 " -> " $3}')
echo "files whose SAFETY GATE count fell since $BASE: $(printf '%s' "$fell" | grep -c .)"
[ -n "$fell" ] && echo "$fell"
echo "files added since $BASE holding U+2014: $(git diff --name-only --diff-filter=A "$BASE"..HEAD | xargs grep -l "$EM" 2>/dev/null | wc -l)"
echo "added lines since $BASE holding U+2014: $(git diff "$BASE"..HEAD | grep '^+' | grep -v '^+++' | grep -c "$EM")"
