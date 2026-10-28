#!/usr/bin/env bash
# suite-counts.sh: tests, pass and fail of every test file batch G3 added or changed
# (`git diff --name-status f185071..HEAD -- '*.test.js'`) and of the contract suite it extended, at the checkout.
# Files added to the list later go at the end, so earlier line numbers in a capture stay put.
# Run from the repository root: bash docs/aegis/g3/evidence/tools/suite-counts.sh
for f in scripts/adapters/github-client.test.js scripts/adapters/okta-client.test.js scripts/adapters/msgraph-client.test.js \
  scripts/adapters/endpoint-sync.test.js scripts/adapters/g3-runbooks.test.js scripts/adapters/scope-preflight.test.js \
  scripts/adapters/contract-g3.test.js scripts/adapters/failure-messages.test.js scripts/adapters/readonly-contract.test.js \
  scripts/intake/intake.test.js scripts/audit/audit-log.test.js scripts/audit/change-record.test.js \
  scripts/eval/g3-ticket-eval.test.js scripts/eval/latency.test.js scripts/g3-boundary.test.js scripts/g2-boundary.test.js \
  scripts/readiness-gate.test.js scripts/risk_tier.test.js scripts/tier/tier-routing.test.js scripts/command-safety-gates.test.js \
  scripts/repository-structure.test.js scripts/jira-contract.test.js \
  scripts/adapters/linear-client.test.js scripts/gws-runbooks.test.js scripts/jira-client.test.js \
  scripts/untrusted/instruction-injection.test.js scripts/untrusted/poisoned-memory.test.js scripts/untrusted/wrong-customer.test.js; do
  if [ ! -f "$f" ]; then echo "$f: missing"; continue; fi
  out=$(node --test "$f" 2>&1)
  echo "$f: tests $(echo "$out" | grep -oP '^ℹ tests \K\d+') pass $(echo "$out" | grep -oP '^ℹ pass \K\d+') fail $(echo "$out" | grep -oP '^ℹ fail \K\d+')"
done
