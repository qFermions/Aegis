#!/usr/bin/env bash
# battery.sh <outdir> [base]: every declared check at HEAD, each output saved in <outdir>.
# Run from the repository root with Node 24 first on PATH and pwsh installed:
#   bash docs/aegis/g4/evidence/tools/battery.sh docs/aegis/g4/evidence/<name> 1f6647c
OUT="$1"; BASE="${2:-1f6647c}"
[ -n "$OUT" ] || { echo "usage: battery.sh <outdir> [base]"; exit 1; }
mkdir -p "$OUT"
echo "HEAD $(git rev-parse --short HEAD) node $(node --version) $(pwsh --version)" > "$OUT/head.txt"
node --test > "$OUT/node-test.txt" 2>&1; echo "exit $?" >> "$OUT/node-test.txt"
NODE_OPTIONS="--require $PWD/scripts/adapters/socket-tripwire.js" node --test > "$OUT/node-test-tripwire.txt" 2>&1; echo "exit $?" >> "$OUT/node-test-tripwire.txt"
for c in scripts/eval/ms-ticket-eval.js scripts/eval/gws-ticket-eval.js scripts/eval/g2-ticket-eval.js scripts/eval/g3-ticket-eval.js scripts/lint/command-structure.js scripts/replay/replay-demo.js scripts/harness/release-boundary-check.js; do
  n=$(basename "$c" .js); node "$c" > "$OUT/$n.txt" 2>&1; echo "exit $?" >> "$OUT/$n.txt"
done
node scripts/pre-commit-check.js --all > "$OUT/pre-commit-check-all.txt" 2>&1; echo "exit $?" >> "$OUT/pre-commit-check-all.txt"
bash docs/aegis/g3/evidence/tools/head-checks.sh "$BASE" > "$OUT/head-checks.txt" 2>&1; echo "exit $?" >> "$OUT/head-checks.txt"
node docs/aegis/g3/evidence/tools/leak-grep.js "$BASE" > "$OUT/leak-grep.txt" 2>&1; echo "exit $?" >> "$OUT/leak-grep.txt"
node scripts/harness/check-continuity.js > "$OUT/check-continuity.txt" 2>&1; echo "exit $?" >> "$OUT/check-continuity.txt"
