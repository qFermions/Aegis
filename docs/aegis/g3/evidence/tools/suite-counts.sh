#!/usr/bin/env bash
# suite-counts.sh: tests, pass and fail of every batch G3 test file at the checkout.
# Run from the repository root: bash docs/aegis/g3/evidence/tools/suite-counts.sh
for f in scripts/adapters/github-client.test.js scripts/adapters/okta-client.test.js scripts/adapters/msgraph-client.test.js \
  scripts/adapters/endpoint-sync.test.js scripts/adapters/g3-runbooks.test.js scripts/adapters/scope-preflight.test.js \
  scripts/adapters/contract-g3.test.js scripts/adapters/failure-messages.test.js scripts/adapters/readonly-contract.test.js \
  scripts/intake/intake.test.js scripts/audit/audit-log.test.js scripts/audit/change-record.test.js \
  scripts/eval/g3-ticket-eval.test.js scripts/eval/latency.test.js scripts/g3-boundary.test.js scripts/g2-boundary.test.js \
  scripts/readiness-gate.test.js scripts/risk_tier.test.js scripts/tier/tier-routing.test.js scripts/command-safety-gates.test.js \
  scripts/repository-structure.test.js; do
  if [ ! -f "$f" ]; then echo "$f: missing"; continue; fi
  out=$(node --test "$f" 2>&1)
  echo "$f: tests $(echo "$out" | grep -oP '^ℹ tests \K\d+') pass $(echo "$out" | grep -oP '^ℹ pass \K\d+') fail $(echo "$out" | grep -oP '^ℹ fail \K\d+')"
done
