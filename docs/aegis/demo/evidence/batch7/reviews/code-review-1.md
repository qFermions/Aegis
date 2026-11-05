# Batch 7 code review round 1

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

I reviewed `e56f0ab..HEAD` and have 15 findings below, most severe first. The top finding is the only one that lets a change claim through the boundary check. Candidates were deduped but not separately verified, as the recipe says.

**What I ran**
- **Tests:** the seven touched test files gave 134 pass, 0 fail. Seven neighbouring files (judged CLI, judge, wiring, customers, G2 and G3 boundary) gave 56 pass, 0 fail.
- **`release-boundary-check.js`:** PASS.
- **Probes:** I ran concrete sentences through `checks.js`, ran `replay-demo.js` under a stale `TMPDIR` (it crashes), and ran the desk with `--budget-usd 1`, which exits 0 and starts no session.

**Side effects:** a safety hook blocked one of my commands because it contained `rm -rf` on a temp folder, so I dropped the deletion rather than work around the hook. Two small run folders remain in the scratchpad: `<tmp>` and `<tmp>`.

```json
[
  {
    "file": "scripts/eval/judged/checks.js",
    "line": 25,
    "summary": "NOT_NEGATED treats any following 'no' as a negation, so real change claims now pass the boundary and observed-output checks.",
    "failure_scenario": "Probed: 'I deleted no-reply@[DOMAIN] and its forwarding rule.', 'I disabled no longer used accounts.', 'I granted no-expiry access to the admin.' and 'I ran no commands. I ran no-reply cleanup.' all return boundary=pass, because `\\b` matches before a hyphen and 'no longer' is not a negation. By the same regex, 'I removed nothing but the admin role' also passes. Such an answer clears step 5 and can reach RESOLVED (SIMULATED) and the replay store. Tighten the lookahead to exclude no-<hyphen>, no@, 'no longer' and 'nothing but/except', and add these as must-fail sentences."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 60,
    "summary": "The deny rules claim to cover 'every run folder' but miss the judged runner's default folder and any earlier custom folder.",
    "failure_scenario": "`paths.defaultResultsDir` is `<repo>/.aegis-state/evals/<run-id>`, `runSut` calls `sutArgs` with no runRoot, and `readDenyRules().some(r => r.includes('.aegis-state'))` is false. A judged session can Read earlier `results.json` files holding answers and judge grades, which contaminates the measurement. An earlier desk run under another `--results-dir` also stays readable, because only the current run is denied. Add `.aegis-state/**` to READ_DENIED and pass the judged run's folder as runRoot."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 54,
    "summary": "READ_DENIED hides the ticket data, but the passing-answer template, the ticket-to-gate pairs and the grader stay readable.",
    "failure_scenario": "`scripts/demo/customer-desk.test.js` holds `good()` ('An answer that passes every check'), the MATCH ticket phrases and pairs such as T1 with mfa-require-reregister-portal and T6 with okta-user-lifecycle-deactivate-portal. `scripts/demo/README.md` lists the closing states, and `sim/gates.js` and `scripts/eval/judged/checks.js` are also open. The prompt tells the session to find SAFETY GATE ids, so a Grep for 'SAFETY GATE' lands on the template. This contradicts the comment 'answers from Aegis's runbooks and not from its own grading material' and the README's 'no read of ... the demo's expected answers'."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 53,
    "summary": "The budget guard assumes $2 per session, which is below its own evidence, and nothing caps a running session, so the limit can be passed.",
    "failure_scenario": "The comment cites a real session at 2.07 under the old 24-turn cap, and this batch raises the cap to 40. Extrapolating, about 3.45 is plausible. With `--budget-usd 20` and 17.90 spent, the guard sees 19.90, starts the session, and spend ends above 20, yet the dry run says 'The run stops before a ticket that could pass it'. The estimate elsewhere uses 2.50 per session, so the two figures disagree. `claude --help` lists `--max-budget-usd`: pass the remaining allowance to each session."
  },
  {
    "file": "scripts/eval/judged/checks.js",
    "line": 25,
    "summary": "The negation fix handles only the bare words no, nothing and none, so the false positive it targets survives in ordinary Markdown and phrasing.",
    "failure_scenario": "Probed: 'I ran **no** commands.', 'I ran zero commands.', 'I ran 0 commands.' and 'I ran not a single command.' all return boundary=fail and observed=fail. An honest Markdown answer closes the ticket FAILED and counts as a boundary failure, the same T6 false positive task 2 set out to remove. The new tests use only plain-text sentences."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 626,
    "summary": "A run the guard stopped exits 0, the same as a complete run.",
    "failure_scenario": "Ran `--only T1 --execute --budget-usd 1`: no ticket ran, yet the exit code was 0. A wrapper or the owner's script treats that as 'the run finished with no ticket FAILED', and neither the header comment nor the README exit-code list mentions the case. The tripwire stop exits 1. Give `run.not_run` a distinct code and document it. The test's `assert.equal(r.code, 0)` pins the current behavior."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 594,
    "summary": "The guard runs before TRIAGE, so it refuses a ticket that would be a free cache hit, and it stops every later ticket with it.",
    "failure_scenario": "With T8 after T4 and under 2.00 left, a T8 CACHE_HIT costs nothing ('A cache hit starts no session'), yet the guard charges likelyUsd and records T8 as not run. Replay is the first shape in the harness's order and is the cheap path meant for exactly this moment. The guard also stops at a 4.00 T2 even when T3 at 2.00 would fit, and each later not_run row's reason names T2 rather than itself. Do the lookup first, or charge the session only on a miss."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 62,
    "summary": "The run-folder deny rule uses `path.resolve`, not the real path, so a symlinked results folder gets a rule that may not match the real location.",
    "failure_scenario": "`readDenyRules('/tmp/some-run')` gives `Read(//tmp/some-run/**)`, while `/tmp` resolves to `/private/tmp` on this Mac. A Read of `<tmp>` may not match, and `$TMPDIR` under `/var/folders` has the same shape. `customer-desk.js:118-119` discards the effective path `checkResultsDir` already returned, and the test helper uses `realpathSync`, so it cannot see this. Not verified against the CLI's matcher. Deny both forms."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 54,
    "summary": "Denying `progress.md` conflicts with the one CLAUDE.md the session loads, which tells it to read that file first.",
    "failure_scenario": "`<repo>/CLAUDE.md` says: 'Read `progress.md` at session start and open the files it names before trusting its status.' Every session can therefore spend a turn on a refused read and may report it in the answer or enter the error-recovery path (one retry, then BLOCKED), which changes what is measured. The batch's tests and probe do not cover this interaction. Not observed in a real session, since none has run under these flags."
  },
  {
    "file": "scripts/adapters/socket-tripwire.js",
    "line": 48,
    "summary": "The stale-TMPDIR fix is a special case in one caller, while the other `os.tmpdir()` callers still crash and the stale value still reaches the child session.",
    "failure_scenario": "Ran `TMPDIR=/aegis-no-such-folder/x node scripts/replay/replay-demo.js`: ENOENT at mkdtemp. `scripts/eval/judged/judge.js:215` and `scripts/audit/trail-helper.js:51` have the same unguarded call, so a judged run or those tests hit the same crash. `sessionEnv` also passes the stale TMPDIR to the `claude` child, and the new test covers only a dry run. A shared helper that corrects `process.env.TMPDIR` once would cover all of them."
  },
  {
    "file": "scripts/account-name.test.js",
    "line": 45,
    "summary": "The account-name guard skips in CI, checks only the local user's name, and the name stays in the public repository's history.",
    "failure_scenario": "CI runs on ubuntu-latest, whose usual account 'runner' is in GENERIC, so the test would skip there and a capture with a local path passes CI. The header claims it catches a capture 'in any form', but it only knows the name of whoever runs it. The fix is forward only: `git grep` finds the name in e56f0ab's `security-review-1.md`, and `git branch -r --contains e56f0ab` lists `origin/feat/customer-desk-demo`, on a repo the saved report records as PUBLIC. A scanner rule for path shapes such as `/Users/<x>/` and `-Users-<x>-` would work in CI without knowing the name."
  },
  {
    "file": "docs/aegis/demo/evidence/batch7/tools/dev-verdicts.js",
    "line": 11,
    "summary": "The before-and-after DEV comparison is vacuous, because its one fixture answer never reaches the changed regexes.",
    "failure_scenario": "The fake CLI's DEFAULT_ANSWER has no 'I ran', 'I have run' or 'I pulled' (probed: false), so a wrong change such as deleting 'ran' from CHANGE_VERBS would leave `t2-dev-verdicts-before.txt` and `-after.txt` identical, yet this is listed as verified evidence. `~/.claude/CLAUDE.md`: 'For each new test, name one wrong implementation it would catch; if it catches none, fix the test.' Also, `t7-red.txt` lists 'an audit folder already set' as failing, which the red commit's helper caused by deleting the variable, not the missing fallback; that test does not depend on the fix."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 53,
    "summary": "The comment 'Proof the rules apply' overstates the probe, which shows the deny rules were loaded but never attempts a denied read.",
    "failure_scenario": "`isolation-probe.txt` is a local `/context` command with 0 turns, showing only the debug line 'Adding 9 deny rule(s)'. If the CLI's `Read(//...)` matching or Grep/Glob coverage differs from the assumption, sessions read denied files and every check stays green. `scripts/eval/README.md` repeats 'What loads and applies'. `scripts/demo/README.md:46` still cites the older probe, `docs/aegis/demo/evidence/isolation-probe.txt`, for the deny-rule claim. Add a no-cost or one-turn probe that attempts a denied Read."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 131,
    "summary": "The dry run's 'Each session: claude ...' line no longer shows the real command, because `--debug-file` is added only in `askAegis`.",
    "failure_scenario": "The dry run prints `sessionArgs` while the real run appends `--debug-file <ticket>-debug.log`, so an owner approving the plan does not see that a full CLI debug log will be written to the run folder. The log is outside `ctx.clean`'s path scrubbing, so it can hold home paths and is unsafe to copy into `docs/aegis/demo/evidence/full-run-1/` unscrubbed. Move the flag into `sessionArgs` with a placeholder path so there is one source of the command line."
  },
  {
    "file": "progress.md",
    "line": 7,
    "summary": "`progress.md` was not updated after the batch's tasks landed, and `checks.md` does not exist at HEAD.",
    "failure_scenario": "`<repo>/CLAUDE.md` says 'Rewrite `progress.md` after each meaningful stage' and 'Record acceptance checks in `checks.md`'. At 2aa1d67, line 7 says 'Outputs: none yet' and line 11 says 'Next action: save the baseline, then task 1', though tasks 1 to 8 have committed work, and root `checks.md` was moved away with no replacement. A fresh session is told to start over. The file's own verified-means, 'shows only backends.js, checks.js, socket-tripwire.js, scripts/eval/README.md and their tests', also omits the changed `scripts/eval/judged/fixtures/fake-claude.js`, with no deviation recorded."
  }
]
```

**Not checked:**
- No real `claude` session ran, so whether the CLI actually refuses a denied `Read(//...)` is unknown. That leaves the symlink, deny-enforcement and `progress.md` findings unconfirmed against the CLI.
- I did not run the full `node --test` suite or the `pwsh`-dependent tests.
- I did not read the 7,000-plus lines of baseline evidence, apart from a search for local paths that found none.
