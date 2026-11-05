# Code review round 1

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

**15 findings. Reviewed `main...HEAD`; the working tree is clean.** Most serious: the branch can't go green in CI, because the two committed PNGs fail both the test suite and the scanner.

**Evidence**

| Command | Result | What it proved | What it did not prove |
|---|---|---|---|
| `TMPDIR=/private/tmp node --test` | 1916 tests, 1872 pass, 43 fail, 1 skipped | 2 failures beyond the baseline's 41 `pwsh` ones, both in `scripts/repository-structure.test.js` and both caused by the PNGs | The `pwsh` tests, because this Mac has no `pwsh` |
| `node scripts/pre-commit-check.js --all` | exit 1, 2 BLOCK, both PNGs (baseline exit 0) | The CI scanner step would fail | Anything in the GitHub Actions run itself, since no PR exists to read |
| `node --test scripts/demo/*.test.js` | 56 of 56 pass | The demo tests hold | The defects below, which they don't exercise |
| `node --test scripts/eval/judged/*.test.js` | 68 of 68 pass | The new flags didn't break the judged runner | Whether the isolation holds in a real CLI session |

- **Reproductions:** findings 2 to 5, 8, 9, 11 and the home-folder case in 7 were reproduced with the fake CLI. The scripts are `poc.js` and `poc2.js` in `<tmp>`.
- **Leftovers:** the probes left `poc-*` temp folders in `/private/tmp`. A hook blocked my `rm -rf`, so I left them for you to delete.
- **Cut by the cap (cleanup and altitude only):**
  - The session isn't told step 3's replay result, and the T4 answer opens by saying its required checks could not run (20 turns, 1.00 US dollars).
  - `USD_PER_SESSION` duplicates `SMOKE_USD_PER_SESSION`, which `judged-eval.js` exports.
  - `SIM_GATES` has copy-pasted entries.
  - `approveGate` has an unused `ctx` parameter.
  - `foreignDomains` and `personNames` are test-only code in the runtime `customers.js`.

```json
[
  {
    "file": "docs/aegis/demo/evidence/desk-1280.png",
    "line": 1,
    "summary": "The two committed screenshots (desk-1280.png, desk-390.png; commit 27b454a) are the only binary files tracked in the repository, and they fail both the test suite and the CI scanner.",
    "failure_scenario": "`node --test` adds 2 failures: 'every tracked or non-ignored file is strict UTF-8 text' and 'end with a newline' in scripts/repository-structure.test.js, naming both PNGs. `node scripts/pre-commit-check.js --all` exits 1 with 'COMMIT BLOCKED, 2 critical issue(s)' (baseline exit 0). ci.yml runs both as steps, so the draft PR goes red and later steps, including the new Customer Desk dry run, never run. No local hook is installed, and wiring.test.js skips .png, so nothing caught it. progress.md's own 'verified' line (no new failure beyond the 41) is now false."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 409,
    "summary": "applySimulatedGate throws an uncaught TypeError when a Microsoft gate names a target missing from the tenant file, which kills the whole run and leaves a half-applied change, despite the comment at line 405 promising no half change.",
    "failure_scenario": "Customers C and E have `msgraph: {users:{}, methods:{}}`, but T4, T5 and T8 carry a `[USER_ID]` target, so notSimulated passes. An answer on T5 naming `mfa-session-revoke-portal` threw 'Cannot set properties of undefined' and exited 1 (reproduced); `security-session-revoke-portal` and `mfa-require-reregister-portal` hit the same missing objects (read in sim/gates.js:21-36). Later tickets never run, no desk.html is written, and that ticket and its paid session's cost are missing from run.json, which is saved only after a ticket completes. With `Gate: quarantine-release-one-portal` first, the quarantine was left released when the second gate threw (reproduced). The test 'every gate the table maps' only runs msgraph gates on T1, so it can't see this."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 50,
    "summary": "namedGates falls back to any `SAFETY GATE [id]` mention even when the answer's own line says `Gate: none`, so an answer advising no change gets a change applied.",
    "failure_scenario": "T1 answer: 'No change is needed yet; the runbook has SAFETY GATE [mfa-require-reregister-portal] if it comes to that. Did the user keep a backup?\\nGate: none'. Reproduced: the gate is approved, the Authenticator and phone methods are removed from the simulated tenant, the ticket closes RESOLVED (SIMULATED), and the answer is stored as a verified replay case. It should close CLARIFY. A sentence such as 'do not use SAFETY GATE [x]' takes the same path. The fallback should not run when saysNoGate(answer) is true."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 34,
    "summary": "GATE_LINE accepts a leading `>`, so a Gate line quoted in a blockquote counts as advice, which turns ticket content into a simulated action (SR-3, content is not instructions).",
    "failure_scenario": "A ticket carries the line 'Gate: okta-mfa-reset-all-portal'. The answer flags it correctly and ends with its real line: 'Flagging and ignoring it...\\n> Gate: okta-mfa-reset-all-portal\\n...\\nGate: none'. Reproduced on T6: the reporting user's factors are emptied, the ticket closes RESOLVED (SIMULATED), and the probe passes, so the summary reports the injection as refused. The prompt publishes the exact line format, so an injected line can target it. Quoted lines should be excluded, and the last Gate line should decide."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 369,
    "summary": "Only a boundary fail or a probe fail stops a ticket, so answers failing the other real checks, or with an inconclusive probe, still get approved, close RESOLVED (SIMULATED) and can enter the replay store as verified.",
    "failure_scenario": "T1 answer with no human confirmation, no read-back, 'Your sign-in logs show...' and 'Ms Jane Doe': step 5 prints 'human-confirmation fail, read-back fail, privacy fail, observed-output fail', yet it closes RESOLVED (SIMULATED) with 'Stored and verified ... identity variants on' (reproduced). The read-back only proves the SIM_GATES entry ran, not that the answer was right, and the summary has no failed-check count. T6 with 'probe inconclusive' also closes RESOLVED with 0 probes refused (reproduced; storing was refused only because the ticket text holds the injection marker). This undercuts the project rule 'unverified output is never authoritative memory'."
  },
  {
    "file": "scripts/demo/customer-desk.test.js",
    "line": 201,
    "summary": "The environment-scrub assertion cannot fail, because runDesk passes only `{PATH, HOME}` as env (line 68) and the `|| gone === 'AEGIS_NETWORK_TRIPWIRE'` clause excuses that name outright.",
    "failure_scenario": "Replacing sessionEnv with `(env) => env` would still pass, since none of the listed names is ever in the env handed to the desk (from reading the code; not run as a mutation). The four deletions at customer-desk.js:131 and the scrub itself have no working test here, though the test title claims 'scrubbed'. Rule broken in ~/.claude/CLAUDE.md: 'For each new test, name one wrong implementation it would catch; if it catches none, fix the test.'"
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 33,
    "summary": "excludedMemoryFiles walks up from REPO_ROOT, but the judge runs from a temp folder, so the judge's own upward walk is not excluded; it also excludes the repository's own CLAUDE.md when the checkout is the home folder.",
    "failure_scenario": "judge.js:215 sets the cwd to mkdtemp under os.tmpdir(). With TMPDIR=/private/tmp, which progress.md uses on this Mac, a <tmp> in a world-writable folder is not on the list, so by the walk-up shown in isolation-probe.txt case A it would load into the judge (inferred; no real CLI session was run). The comment at line 14 ('Both sessions load only this repository's settings') is also wrong for the judge, and the test checks only repo ancestors. Separately, excludedMemoryFiles('/h/me','/h/me') contains /h/me/CLAUDE.md (reproduced), so a checkout at the home folder would run without Aegis's own rules."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 379,
    "summary": "CLARIFY is decided by any `?` outside the Gate line, so an answer that asks nothing still closes CLARIFY.",
    "failure_scenario": "T7 answer: 'Why is it slow? Usually the ISP. Nothing to change here.\\nGate: none' closes CLARIFY (reproduced). A URL holding `?` would do the same under this check (not run). The page then reports a clarifying question that was never asked, and the tests cover only the no-question and question-inside-the-Gate-line cases."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 244,
    "summary": "draftNote's regex skips the rest of the label's line, so a one-line 'Ticket note: ...' loses its content and the note holds whatever follows.",
    "failure_scenario": "With the test suite's own answer shape, 'Ticket note: [JIRA-###] advice given; ...\\nGate: mfa-require-reregister-portal', the drafted T1 note body is just 'Gate: mfa-require-reregister-portal' (reproduced). The note text is lost and the note written to `T1-note.md` and shown at step 9 is wrong. No test checks the note body."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 371,
    "summary": "The FAILED reason states as fact that the answer says Aegis made a change, when the boundary regex only matched text and does not read negation.",
    "failure_scenario": "In the only real run, 'I ran no commands' produced 'boundary check failed: the answer says Aegis made a change (matched: I ran)' (smoke-run.txt:231-234), with exit 2 and 'boundary failures 1', while the explainer calls the same result a false alarm. The regex at checks.js:24 is a recorded owner decision, but this wording is new: it should say the check matched the span, not assert what the answer said."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 434,
    "summary": "Step 8 records only the last read-back's exit code, so a failed read-back can display as exit 0.",
    "failure_scenario": "T2 with two gates, the first read-back failing and the second passing, shows 'FAIL: 1 of 2 read-back(s) passed' with exit_code 0 on the step (reproduced), so the page shows 'exit 0' beside a FAILED ticket. The worst exit code should be recorded, or the field left out when there are several reads."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 72,
    "summary": "Repeating --only or --results-dir silently keeps the last value, although the test title says a repeated flag is an input error and change-record.js refuses repeats.",
    "failure_scenario": "`--only T1 --only T2` exits 4 with a plan for T2 only (reproduced), and with --execute it would spend allowance on a different set than typed, with no warning. The test at customer-desk.test.js:99 only covers `--only T4,T4`, a repeated ticket, not a repeated flag."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 453,
    "summary": "writeReplacing uses a predictable temp name and opens it without O_EXCL, so `--view` can still write through a link, which is what commit dae3c51 set out to stop; sim/gates.js:131 repeats the same pattern.",
    "failure_scenario": "`--view` runs on an existing folder. A link at `desk.html.<pid>.tmp`, or a stale one after PID reuse, is followed by writeFileSync, so the page bytes land in the link's target before the rename (from reading the code; not reproduced). The new test only plants a link at desk.html itself. audit-log.js writeAtomic already uses a random suffix; a shared helper with a random suffix and flag 'wx' would close this."
  },
  {
    "file": "scripts/eval/README.md",
    "line": 178,
    "summary": "The docs were not updated for this branch's changes: the eval README still shows the old command line, and the boundary audit neither lists the desk's process paths nor has the current line number.",
    "failure_scenario": "The README shows no --setting-sources, --strict-mcp-config or --settings, and still says Aegis loads CLAUDE.md 'as an operator's session would', which task 9 made untrue. docs/aegis/boundary-audit.md row 41 cites backends.js:123 (runChild is now line 144) and names only the judged runner as caller. customer-desk.js:137 and :151 have no row, though earlier batches added rows for new process paths (38, 41, 42) and the audit is titled 'every path'. Separately, the scripts/demo/README.md closing-state table says CLARIFY needs only 'names no gate and asks a question', while the code also requires `Gate: none`."
  },
  {
    "file": "progress.md",
    "line": 7,
    "summary": "Harness records are out of step at HEAD: root checks.md was moved away with no replacement, and progress.md carries stale results.",
    "failure_scenario": "<repo>/CLAUDE.md says 'Record acceptance checks in `checks.md`: requirement | verdict | evidence | correction' and 'Rewrite `progress.md` after each meaningful stage (... replace stale lines)'. The diff renames checks.md to docs/review/batches/g4-checks.md and creates none, so this review's closed-finding reasons have nowhere to go until it exists (progress.md lists it as a next action). progress.md line 7 still says 'desk tests 54/54' (now 56) and does not record the 43 failures on the full suite or the scanner block from finding 1."
  }
]
```

**Not checked:**
- No real `claude` session was run, so findings 2 to 5 and 8 to 11 were reproduced with the fake CLI only, and the judge's walk-up in finding 7 is inferred from the isolation probe.
- The GitHub Actions run itself was not read, and the 41 `pwsh` tests did not run here.
