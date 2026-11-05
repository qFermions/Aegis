# Security review 1

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

1 finding: one personal-path leak in tracked evidence, low impact but a project failure under REVIEW.md. I found no exploitable code vulnerability in the demo. I reviewed by reading the code and running read-only greps, so no attack was executed and no files were written.

# Vuln 1: Data exposure (personal path in the repo): docs/aegis/demo/evidence/smoke-T4-init.json:364

**Severity:** Medium. It breaks a REVIEW.md rule, but it exposes no credential.

**Instances:**
- `docs/aegis/demo/evidence/smoke-T4-init.json:364`
- `docs/aegis/demo/evidence/smoke-T6-init.json:364`
- `docs/aegis/demo/evidence/smoke-init-check.txt:5`

**Description:** The captures were sanitized from `/Users/...` to `<home>`, but Claude's encoded project folder name was missed:

`"auto": "<home>/.claude/projects/-<project>-Code-Aegis/memory/"`

This exposes the owner's local macOS account name and project folder.

**Evidence:**
- `git grep thordsoul 77b7114` returns nothing, and `git grep` at HEAD outside `docs/aegis/demo` also returns nothing, so only this branch adds the name.
- Commit `dc2f14f` touched these captures (`git log` on `smoke-T4-init.json`).
- `gh repo view` reports `qFermions/Aegis` as PUBLIC.
- `git branch -r --contains dc2f14f` returns nothing, so the commit is not on a remote yet.

**Exploit Scenario:** Once the branch is pushed, anyone can read the local username in the public repo and use it for targeting or to link identities. That is the only impact.

**Recommendation:**
- Replace the value with `<home>/.claude/projects/<project>/memory/` in all three files.
- Rewrite `dc2f14f` before the first push, because a follow-up fix commit would leave the name in public history.
- Teach the capture sanitizer or `scripts/pre-commit-check.js` the `-Users-<name>-` slug form, and add a row to `docs/review/incidents.md`.

**Confidence:** 10 that it is present and would be published; the harm is low.

## Considered, below 8

| Issue | Location | Why it fell short | Confidence |
|---|---|---|---|
| `--view` overwrites through a symlink | `customer-desk.js:490-491` | `fs.writeFileSync` follows a planted `desk.html` symlink. Newlines and base64 survive `esc`, so a crafted `run.json` could write, say, a key line into `authorized_keys`. It needs the operator to run `--view` on someone else's folder, and the README only shows their own runs. Still cheap to fix by refusing a non-regular `desk.html` after `lstat`. | 6 |
| Answer text selects the gate | `customer-desk.js:376-409`, `catalog.js:40-52` | Any catalog gate the answer names is auto-approved and applied if the ticket has a target for that platform. A probe verdict of `inconclusive` also continues past line 373. The effect stays in the simulated tenant in the run folder, so no real state changes. | 3 |
| Answer stored as verified without its text being proved | `customer-desk.js:250-262`, `440` | The read-back proves the simulator's fixed change, not the answer's procedure. The store is always the run folder (`:151`), the evidence says SIMULATED, and `sanitizationHits` runs at record. T8 can replay it only within the same customer. | 4 |
| Session `Read` has no path limit | `backends.js` `sutArgs`, `isolationArgs` | `--allowedTools Read` is unscoped, the repo has no `.claude/settings.json`, and `--setting-sources project` drops any user-level deny rules. An injected ticket could ask for `.env`. This is the excluded AI-prompt class, tickets are checked-in fiction, no web or Bash tool exists, and output stays local. It becomes real if the demo ever takes real tickets. | 4 |
| Subagents with write tools | `backends.js` `SUT_TOOLS` | `Agent` is allowed and project agents such as `forge` declare Write and Bash. Bash is denied by flag. Write and Edit are not on the allowed list, and the init capture shows `permissionMode: default`. `SUT_TOOLS` predates this branch. | 3 |
| `constructor` or `__proto__` as a gate id | `catalog.js:50`, `customer-desk.js:382` | The fallback regex can yield `constructor`, but `Map.has` stops it before any `simTable` lookup. `__proto__` fails the regex, and no runbook has such an id. | 1 |
| XSS in `desk.html` | `render.js` | Every interpolation goes through `esc`, and the CSS rule and `href` use `safeId` (`[A-Za-z0-9_-]` only). The CSP also allows no script. A crafted non-numeric cost only throws. | 1 |
| Cross-tenant reach | `customer-desk.js:150-163`, `192-197`, `225` | Each customer has its own audit, replay, cases and tenant paths, with an explicit environment. `replay-cli.js` also binds a store to one tenant. | 1 |
| Command or path injection | `backends.js` `runChild`, `replayCli` | `shell: false` and array arguments are used, and the prompt starts with fixed text. Ticket ids and file names come from checked-in JSON, and `--results-dir` and `--view` are trusted flags. | 1 |
| Reaching a vendor host | `customer-desk.js:22`, `vendors.js` | The tripwire loads first and sets `AEGIS_NETWORK_TRIPWIRE`, which makes the default transport throw. Read-backs get an injected transport, and an unknown connector gets `INCONCLUSIVE`. | 1 |
| Secrets and home paths | `customer-desk.js:108`, `129-133`, `225` | Simulated keys stay in memory and reach only the read-back environment, never the session or argv. `--settings` home paths print in the dry run, but no `/Users/` path appears in any capture. | 1 |
| CI step | `ci.yml` | `contents: read`, no secrets, and the dry run exits before any spawn. | 1 |

## Files read
- **Demo code:** `REVIEW.md`, `scripts/demo/customer-desk.js`, `catalog.js`, `customers.js`, `render.js`, `sim/gates.js`, `sim/vendors.js`, and the T5 and T6 tickets. I read part of `customers.json` and `tickets.json`, and only the `--view` lines of `scripts/demo/README.md`.
- **Reused code, read in full:** `scripts/replay/replay-cli.js`, `scripts/audit/change-record.js`, `scripts/adapters/cli-support.js`, `scripts/adapters/socket-tripwire.js`, `scripts/eval/judged/paths.js`, `checks.js`, `backends.js`.
- **Reused code, grep-traced only:** `scripts/audit/audit-log.js`, `scripts/adapters/readonly-contract.js`, `scripts/intake/intake.js`, and the five connector clients.
- **Diff and captures:** the `.github` and `backends` diff, `smoke-T4-init.json` lines 1-30 and 318-385, `smoke-init-check.txt`, and `desk-1280.png`.

**Not checked:**
- A live `claude -p` run proving Write and Edit are blocked inside subagents; the row above rests on flags and the init capture.
- The `--view` symlink attack was not run, because of the no-files rule.
- `desk-390.png` was not viewed.
- The real tenant literal could not be grepped, because `.env` was off limits.
- The test files were not reviewed line by line.
- `~/.claude/settings.json` was out of scope, so I don't know which deny rules the isolation flags remove.
- I did not run `pre-commit-check.js` on the three evidence files.
