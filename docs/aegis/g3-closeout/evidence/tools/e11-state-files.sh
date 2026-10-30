#!/usr/bin/env bash
# e11-state-files.sh <base>: CLAUDE.md's size (under 20,000 bytes) and diff since <base>, the batch
# G3 close-out entry under PRODUCT_CONTRACT.md "Changes in this batch", the close-out section of
# PROJECT_STATE.md, and progress.md's length and Next action line (charter check E11). Run from
# the repository root.
BASE="$1"
[ -n "$BASE" ] || { echo "usage: e11-state-files.sh <base commit>"; exit 1; }
echo "CLAUDE.md: $(wc -c < CLAUDE.md) bytes (limit 20000); lines changed since $BASE: $(git diff --numstat "$BASE"..HEAD -- CLAUDE.md | awk '{print $1+$2}' | grep . || echo 0)"
echo "PRODUCT_CONTRACT.md \"Changes in this batch\" heading: $(grep -n -i '^#.*Changes in this batch' PRODUCT_CONTRACT.md | head -1)"
echo "PRODUCT_CONTRACT.md lines naming the batch G3 close-out: $(grep -c -i 'G3 close-out' PRODUCT_CONTRACT.md)"
echo "PRODUCT_CONTRACT.md lines removed since $BASE: $(git diff --numstat "$BASE"..HEAD -- PRODUCT_CONTRACT.md | awk '{print $2}' | grep . || echo 0)"
echo "PROJECT_STATE.md close-out heading: $(grep -n -i '^#.*close-out' PROJECT_STATE.md | head -1)"
echo "progress.md: $(wc -l < progress.md) lines (limit 40); Next action: $(grep -c '^- \*\*Next action:\*\*' progress.md); last commit touching it: $(git log -1 --format=%h -- progress.md)"
