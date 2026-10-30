#!/usr/bin/env bash
# mutation-check.sh <file> <old> <new> <test-name-pattern> <test-file>: replace one exact string
# in <file> in the working tree, run the named test (expected to fail), then restore <file> with
# git checkout, so the tree is unchanged afterwards. Shows that a guard test fails when the code
# it guards loses the thing it checks. Run from the repository root.
FILE="$1"; OLD="$2"; NEW="$3"; NAME="$4"; TEST="$5"
[ -n "$TEST" ] || { echo "usage: mutation-check.sh <file> <old> <new> <test-name-pattern> <test-file>"; exit 1; }
git diff --quiet -- "$FILE" || { echo "$FILE has uncommitted changes; refusing"; exit 1; }
node -e 'const fs=require("fs");const [f,o,n]=process.argv.slice(1);const s=fs.readFileSync(f,"utf8");if(s.split(o).length!==2){console.error("the old string must occur exactly once");process.exit(1)}fs.writeFileSync(f,s.replace(o,()=>n))' "$FILE" "$OLD" "$NEW" || exit 1
echo "--- mutation in $FILE:"; git diff -U0 -- "$FILE" | grep '^[-+][^-+]'
echo "--- node --test --test-name-pattern \"$NAME\" $TEST (expected to fail):"
node --test --test-name-pattern "$NAME" "$TEST"; code=$?
git checkout -- "$FILE"
echo "--- test exit $code; $FILE restored: $(git diff --quiet -- "$FILE" && echo yes || echo NO)"
[ "$code" -ne 0 ]
