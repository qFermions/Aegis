#!/usr/bin/env bash
# battery.sh <out-dir>: the declared checks (EVALUATE.md Part A, as batch 7 ran them), one file per check,
# with this machine's paths written <home>, <repo> and <tmp>, and each long dash written - (the repo's rule). Prints one line per check with its exit code.
set -u
out="$1"; mkdir -p "$out"
repo="${REPO:-$(pwd)}"
cd "$repo"; echo "battery at $(git rev-parse --short HEAD), node $(node --version), no pwsh on this Mac: $(command -v pwsh || echo true)" > "$out/HEAD.txt"
tmp="${TMPDIR:-/tmp}"; tmp="${tmp%/}"
mask() { sed -e "s#/private$tmp#<tmp>#g" -e "s#$tmp#<tmp>#g" -e "s#$repo#<repo>#g" -e "s#$HOME#<home>#g" -e $'s#\xe2\x80\x94#-#g'; }
run() { local name="$1"; shift; "$@" > "$out/$name.raw" 2>&1; local code=$?; mask < "$out/$name.raw" > "$out/$name.txt"; rm -f "$out/$name.raw"; echo "exit $code" >> "$out/$name.txt"; echo "$name exit $code"; }
run node-test node --test
run node-test-tripwire env NODE_OPTIONS="--require $repo/scripts/adapters/socket-tripwire.js" node --test
run ms-ticket-eval node scripts/eval/ms-ticket-eval.js
run gws-ticket-eval node scripts/eval/gws-ticket-eval.js
run g2-ticket-eval node scripts/eval/g2-ticket-eval.js
run g3-ticket-eval node scripts/eval/g3-ticket-eval.js
run command-structure-lint node scripts/lint/command-structure.js
run pre-commit-check-all node scripts/pre-commit-check.js --all
run release-boundary-check node scripts/harness/release-boundary-check.js
run replay-demo node scripts/replay/replay-demo.js
for f in node-test node-test-tripwire; do grep -E '^# (tests|pass|fail|skipped)' "$out/$f.txt" | tr '\n' ' '; echo " ($f)"; done
