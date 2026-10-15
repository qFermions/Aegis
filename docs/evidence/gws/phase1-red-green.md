# G1 Phase 1 — baseline, red runs, green runs (2026-10-15)

Every gate change in Phase 1 started with a test that fails on the unmodified
code and passes after the change. Lines below are copied from the runs; the
commands are exact. Environment: Linux, Node 22.22.0, PowerShell 7.4.6 (MIT,
installed so the PowerShell-dependent safety-gate tests run as they do in CI).

## Baseline on `0febaa9` (before any edit)

| Command | Result |
|---|---|
| `node --test` | `# tests 346` · `# pass 346` · `# fail 0` |
| `node scripts/lint/command-structure.js` | 58 commands, `clean` |
| `node scripts/eval/ms-ticket-eval.js` | `28/28 tickets · 6/6 dangerous pairs · 7 floored to T3 · 22 commands exercised` |
| `node scripts/pre-commit-check.js --all` | exit 0 · 0 BLOCK · 143 WARN |
| `node scripts/harness/release-boundary-check.js` | `RELEASE BOUNDARY: PASS` |
| `node scripts/harness/check-continuity.js` | exit 2 `STALE` (HEAD moved since the v8.8 snapshot — expected) |
| `node scripts/replay/replay-demo.js` | exit 0 |
| `node scripts/eval/gws-ticket-eval.js` | does not exist yet (exit 1, module not found) |

## 1.1 — safety-gate test sees the shell lane

Red — `node --test --test-name-pattern="G1" scripts/command-safety-gates.test.js` on the unmodified detector:

```text
not ok 1 - G1 detector: every gam, gcloud, HTTP-API, jamf and macOS administration mutation in a shell fence is a sink
ok 2 - G1 detector: read-only diagnostics stay live and are not sinks
not ok 3 - G1 fixtures: a GAM fence with no marker fails; the same fence with a correct marker passes
not ok 4 - G1 shell gate analyzer rejects bypass-shaped control flow
# pass 1
# fail 3
```

(The read-only test passes on main only because nothing was detected at all;
it must keep passing once detection exists.) The fixture failure on main was
`PowerShell gate is not in a PowerShell fence`; the detector failure listed
all 73 mutation forms as `→ []`.

Red — the portal-grammar test appended to main's version of the file:

```text
not ok 1 - G1 portal grammar: Google, Okta and Jamf breadcrumbs that end in an action are mutation candidates
# pass 0
# fail 1
```

Green — `node --test scripts/command-safety-gates.test.js` after the change:

```text
# tests 184
# pass 184
# fail 0
```

(179 existing + 5 new.) Each bypass fixture was checked to fail for its own
reason (for example `whitespace-trimming-read` → "exactly one read, the
canonical `IFS= read -r confirmation`"; `dead-wrapper` → "nested inside
another block"; `sink-after-fi` → "not dominated by the positive confirmation
branch").

## 1.2 — structure lint

Red — `node --test --test-name-pattern="G1" scripts/lint/command-structure.test.js` before the lint change: `# pass 0` · `# fail 9` (all nine G1 tests).

Green — `node --test scripts/lint/command-structure.test.js`: `# tests 24` · `# pass 24` · `# fail 0`; `node scripts/lint/command-structure.js` still `clean` for the 58 Microsoft commands.

## 1.3 — tier guard and graph engine

Red — `node --test --test-name-pattern="G1" scripts/tier/tier-routing.test.js` on the unmodified guard and engine:

```text
not ok 1 - G1 ESCALATION: every new Google/Okta/Jamf consequential wording floors in the guard and the graph engine
ok 2 - G1 routine: the Google-lane counterparts (backup codes, add to group, move one OU, one licence, enroll one Mac) stay clean
not ok 3 - G1 folding: homoglyphs and invisible characters cannot hide a new floor (guard and engine)
# pass 1
# fail 2
```

Green — `node --test scripts/tier/tier-routing.test.js`: `# tests 21` · `# pass 21` · `# fail 0`; `node scripts/eval/ms-ticket-eval.js` still `28/28 tickets · 6/6 dangerous pairs`.

Found during 1.3 and fixed in its own commit (`fix(tier-guard)`): on `0febaa9`
`assess("Disable [first.last]'s account today")` returned `floor: none` (also
`Delete [first.last]'s mailbox before Friday`, `Remove [first.last] from the
finance group`, `Remove the [first.last] licence`, `Revoke [USER@DOMAIN.COM]
sessions`, `Exclude [first.last] from the MFA policy`) because `[^.]*` stopped
at the dot inside the token. Red: `not ok 1 - a dot inside a token … — existing
floors hold` (`must floor: Disable [first.last]'s account today`). Green: 18/18.

## 1.4 — scanner secret formats

Red — `node --test scripts/pre-commit-check.test.js` with the tests but no patterns:

```text
not ok 31 - blocks a Google API key without printing the value or source line
not ok 32 - blocks a Google OAuth client secret without printing the value or source line
not ok 33 - blocks a Google service-account key JSON type marker without printing the source line
not ok 34 - blocks a Google service-account key JSON private_key_id without printing the value
not ok 35 - blocks an Okta SSWS API token header without printing the value or source line
not ok 36 - blocks a bare Okta API token without printing the value or source line
not ok 37 - blocks a Bearer credential in an Authorization header without printing the value
not ok 38 - blocks a Basic credential in an Authorization header without printing the value
# tests 40
# pass 32
# fail 8
```

Green: `# tests 40` · `# pass 40` · `# fail 0`; `node scripts/pre-commit-check.js --all` exit 0, 0 BLOCK, 143 WARN (unchanged).

Follow-up fix (`fix(scanner)`): the GOCSPX label received "replace with a
placeholder" guidance instead of "revoke or rotate". Red: `not ok 1 - every
new secret-format BLOCK gets revoke-or-rotate guidance` (`a credential finding
fell through to placeholder guidance`). Green: 41/41.

## 1.5 — dictionary

Tokens registered; `node scripts/pre-commit-check.js --all` exit 0 and the
replay sanitizer returns `[]` for every new token (no exemption change). Drift
fix (`fix(dictionary)`): red — the new repository-structure test listed
`[@Aegion_SITE_COUNT]`, `[@Aegion_SITE_3]`, `[@Aegion_SITE_4]`,
`[@Aegion_DOMAIN_SP]`, `[@Aegion_DOMAIN_SHORT]` as used but undefined; green
8/8 after the rows were added.

## Phase 1 acceptance

| Command | Result |
|---|---|
| `node --test` | `# tests 375` · `# pass 375` · `# fail 0` |
| `node scripts/lint/command-structure.js` | 58 commands, `clean` |
| `node scripts/eval/ms-ticket-eval.js` | `28/28 tickets · 6/6 dangerous pairs` |
| `node scripts/pre-commit-check.js --all` | exit 0 · 0 BLOCK · 143 WARN |
