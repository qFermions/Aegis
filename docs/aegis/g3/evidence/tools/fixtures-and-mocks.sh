#!/usr/bin/env bash
# fixtures-and-mocks.sh <base>: the fixtures this batch added since <base>, and how each test
# file it added or changed is kept off the network (charter check D12). Run from the
# repository root: bash docs/aegis/g3/evidence/tools/fixtures-and-mocks.sh f185071
BASE="$1"
[ -n "$BASE" ] || { echo "usage: fixtures-and-mocks.sh <base commit>"; exit 1; }
echo "--- fixture files added (data read by tests or the corpus scorer):"
git diff --name-only --diff-filter=A "$BASE"..HEAD | grep -E '(fixtures?/|g3-intake/|\.eml$|\.json$|\.html$)' | grep -vE '^docs/'
echo "--- test files added or changed: socket tripwire loaded, lines with an injected transport, network modules required:"
for f in $(git diff --name-only "$BASE"..HEAD | grep -E '\.test\.js$'); do
  [ -f "$f" ] || continue
  t=$(grep -c "socket-tripwire" "$f")
  i=$(grep -cE "transport\s*:|deps\.transport" "$f")
  n=$(grep -cE "require\(['\"](node:)?(http|https|net|tls|dgram)['\"]\)" "$f")
  echo "$f: tripwire $t, injected transport lines $i, network module requires $n"
done
echo "--- tenant and host values the added test lines use:"
git diff "$BASE"..HEAD -- '*.test.js' | grep '^+' | grep -oE "(FLEET_URL|JAMF_URL|OKTA_ORG_URL|LINEAR_ORG|GITHUB_ORG|MS_TENANT_ID)\s*:\s*'[^']*'" | sort | uniq -c
