# Code review round 2

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

15 findings (the cap; three lesser ones were cut and are listed below the JSON).

```json
[
  {
    "file": "scripts/demo/customers/e/tenant.json",
    "line": 20,
    "summary": "The new C and E seed users hold only a password method, so `mfa-require-reregister-portal` changes nothing, yet `verify-mfa-cleared` passes and the answer is stored as verified and replayed. Also at scripts/demo/customers/c/tenant.json:16.",
    "failure_scenario": "Ran with the fake CLI: `--only T4,T8`, both answers closing `Gate: mfa-require-reregister-portal`. T4 closes RESOLVED (SIMULATED) with `Stored and verified in E's own replay store as case-0001`, and T8 is CACHE_HIT via shape. The read-back proved a state that was already true, so this is the REVIEW.md failure 'an unverified suggestion stored or served as approved knowledge'. At dae3c51 the empty `methods` made the same gate throw. The new test (customer-desk.test.js, 'a Microsoft gate...') only uses session revoke, so it cannot see this. Fix: seed an Authenticator method as tenant A does, or have `applySimulatedGates` refuse a change that leaves the state identical."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 293,
    "summary": "The new catch in `workTicket` swallows `NetworkTripwireError`, which the connector and contract deliberately rethrow (msgraph-client.js:330, readonly-contract.js:641), so a request that missed the seam becomes an ordinary OPEN and exit 0.",
    "failure_scenario": "Ran `deps.transportFor: () => undefined`, and separately a transport that throws the tripwire error. Both gave exit=0, T1 OPEN, reason 'the desk could not finish this ticket: Network tripwire fired'. At dae3c51 nothing caught it, so `main` rejected and the run exited 1. boundary-audit.md:77 and README.md still rely on 'throws' as the control, and the no-vendor test only checks `attempts` on the happy path. Fix: rethrow when `e.name === 'NetworkTripwireError'`, and add that test."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 292,
    "summary": "The new broad catches turn internal errors into normal closing states with exit 0, relabel their cause, can overwrite a decided state, and still do not keep the run alive. Instances: lines 292-293 and 426-427, plus line 273 outside the try.",
    "failure_scenario": "(a) A `TypeError` in any step closes OPEN and line 505 returns 0; before the diff it exited 1. Tests that assert only OPEN (customer-desk.test.js:265, :275) would pass for the wrong reason. (b) Ran an `apply` with a programming bug: the reason reads 'the simulated tenant does not hold what ... acts on (Cannot read properties of undefined...)'. ENOSPC and the outside-the-run-folder refusal get the same label, and `e.message` can put an absolute path into run.json and desk.html. (c) If `close('FAILED', ...)` throws on its note write, the catch re-closes OPEN, so a boundary failure can read OPEN with exit 0. (d) `prepareCustomer` at line 273 and the second `close` in the catch can still throw, so the run dies with no desk.html, contrary to the comment at line 269."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 182,
    "summary": "`timed` records a step only after `fn` returns, so a step that throws is then recorded by `notReached` as 'not reached' and its cost is lost, contrary to the comment at line 270.",
    "failure_scenario": "Ran with the stream write failing with ENOSPC after a session that cost 0.5: step 4 says 'not reached', cost_usd is null, and the summary shows `model_sessions 0, total 0`. In the tripwire runs, step 8 also says 'not reached' although the connector ran. A throw in CUSTOMER or INTAKE leaves steps 1 and 2 unrecorded, because `actors` has no entry for them (line 186). Fix: catch in `timed`, push a failed step with what is known, record the cost before any file write, then rethrow."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 248,
    "summary": "The rewritten `draftNote` extraction produces wrong notes: `[*:\\s]*` eats the newline and `**` that the stop pattern needs, `\\*\\*[A-Z]` cuts a multi-field note, the first mention of the label wins, and the Gate stop is narrower than catalog.js `GATE_LINE`.",
    "failure_scenario": "Ran the same regex on these inputs. '## Jira-ready note\\n**Issue:** locked out\\n**Action:** reset' gives 'Issue:** locked out'. 'I put a Jira note at the end.\\n\\n## Fix...' gives 'at the end.'. 'Ticket note:\\nGate: none' gives 'Gate: none'. '## Jira-ready note\\n## Verification\\ncheck it' gives the next section. 'Ticket note: real note\\n- Gate: none' keeps the Gate line, as do 'gate: none', '*Gate: none*' and a backticked Gate line, though the test is titled 'never the Gate lines'. Fix: parse `closingGateLines(answer).body`, and match the label only at the start of a heading or line."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 69,
    "summary": "`clarifies` counts any line ending in a question mark, including a quoted ticket line or a heading, so advice closing `Gate: none` reads as CLARIFY. The comment at lines 64-66 says errors fall toward OPEN, and `GATE_LINE` already treats a quote as the ticket's text.",
    "failure_scenario": "Ran: 'Nothing to change, the ISP is at fault.\\n> Why is the internet slow?\\nGate: none' returns true, and '## Why is it slow?\\nThe ISP is at fault...\\nGate: none' returns true. The saved T6 answer (smoke-run.txt, from before the isolation fix) holds such lines: '**Did I miss anything?**' and numbered quiz questions. Fix: skip `>` and `#` lines, or look only at the paragraph just before the Gate lines."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 454,
    "summary": "`worst = exits.find((e) => e !== 0)` returns the first non-zero exit, not the worst, so step 8 can pair a FAIL result with another read-back's exit code.",
    "failure_scenario": "Read-backs in order exit 5 (INCONCLUSIVE) then exit 2 (FAIL): the result says 'FAIL: 0 of 2', but `exit_code` is 5. The expression returns 5 for [5,2] when run; I did not produce a real exit 5 end to end. The test at customer-desk.test.js:661 only uses a failure first, so it cannot tell `find` from worst. Fix: prefer 2 when present, and add the [5,2] case."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 35,
    "summary": "Dropping the `m` flag and splitting on '\\n' stops `GATE_LINE` matching CRLF lines, and `#` was removed from the prefix with no test or comment (the comment explains only `>`).",
    "failure_scenario": "Ran: `namedGates('Advice\\r\\nGate: mfa-session-revoke-portal\\r\\n')` returns [] and `clarifies('Which site?\\r\\nGate: none\\r\\n')` returns false, while the LF forms work. `.` will not consume `\\r`, and `$` no longer matches before it. Those answers close OPEN with 'names no gate', and a paid session is wasted. By reading, a closing '## Gate: x' also no longer selects a gate. Fix: `split(/\\r?\\n/)`, and either restore `#` or record the choice."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 57,
    "summary": "`namedGates` silently drops any gate on a Gate line that is not comma-separated or that follows a word, so an advised change is never approved, applied or read back.",
    "failure_scenario": "Ran: 'Gate: a-b and c-d' returns ['a-b']. By reading the anchored regex, 'Gate: a-b, then c-d' drops c-d too. The ticket can close RESOLVED with '1 of 1 read-back(s) passed' while the second change is unproved and invisible. The split shape predates the diff, but the function was rewritten here. Fix: a value that does not parse fully should stop the ticket OPEN."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 36,
    "summary": "`fs.realpathSync(os.tmpdir())` adds a filesystem call that can throw to a function that only built arguments, so a stale TMPDIR now breaks the judged runner's dry run.",
    "failure_scenario": "Ran `TMPDIR=/nonexistent/x node scripts/eval/judged-eval.js run --cases <copy of dev-cases.jsonl>`: exit 1, 'a file could not be read or written (ENOENT)'. With a valid TMPDIR it exits 4. `commandPreview` calls `sutArgs`, which reaches this line; the dae3c51 version made no filesystem call there. The desk itself already fails earlier in the tripwire's `mkdtempSync` (pre-existing). Fix: catch the realpath failure and keep `os.tmpdir()`."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 42,
    "summary": "`dirs.delete(repoRoot)` applies to both sessions, so the judge is not excluded from the repository's CLAUDE.md when its temporary folder sits below the checkout, contradicting the comment at lines 14-15 that the judge loads none.",
    "failure_scenario": "Ran with TMPDIR inside the repository: `excludedMemoryFiles()` omits `<repo>/CLAUDE.md`, and so do `judgeArgs`. The judge's upward walk would then find Aegis's instructions and grade under them; a checkout at home with TMPDIR beneath it has the same shape, by reading. I did not run the CLI to see the load. isolation-probe.txt was not re-run and only probes from the repository root, so the judge claim has no proof. Fix: give `judgeArgs` an exclusion list that keeps the repository, and probe from a judge folder."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 234,
    "summary": "Pre-existing: exit 2 is read as FAIL, but `exitCodeFor` (readonly-contract.js:955) also returns READ_FAILED for network errors, timeouts and invalid responses, so a read that never ran is reported as proof the change was not done.",
    "failure_scenario": "Ran with a transport that throws a plain Error for okta: `okta:verify-status: exit 2`, so that read-back's verdict is FAIL. The ticket's close reason is 'a read-back shows the change was not done' and the run exits 2. (In that run the second read-back also failed.) The comment two lines later says a read with no verdict proves nothing. The diff's step 8 and close logic build on this. Fix: tell `verified === false` apart from a failed read, using the JSON state rather than the exit code."
  },
  {
    "file": "scripts/demo/customers.js",
    "line": 90,
    "summary": "`writeReplacing` is another copy of an atomic write that is weaker than audit-log.js:360 `writeAtomic`, sits in the data loader, and leaves the 'only the simulator writes a tenant' guard test blind to it.",
    "failure_scenario": "It has no fsync and no 0600 mode, unlike `writeAtomic`, and by reading a failed rename (for example when desk.html is a directory) leaves a `.tmp` file behind. customer-desk.test.js:561 filters only `fs.write...` calls naming `tenantFile`, so `data.writeReplacing(tenantFile, ...)` in customer-desk.js would pass it. Fix: export one helper from a small shared module, remove the temp file on failure, and widen the guard to this helper."
  },
  {
    "file": "scripts/demo/README.md",
    "line": 48,
    "summary": "Docs no longer match the code: README says a resolved ticket enters the replay store, the OPEN row omits the new causes, and boundary-audit row 41 lost its connecting word.",
    "failure_scenario": "customer-desk.js:463-464 now closes RESOLVED without storing when a check did not pass, which contradicts README.md:48 and the test header at customer-desk.test.js:14. README.md:68 omits 'the desk could not finish' and 'the tenant does not hold'. boundary-audit.md:75 now reads 'for the system under test by scripts/eval/judged/judge.js', which misstates who calls `runChild` for which session, because the comma or 'and' is gone. A reader of the audit row gets the wrong caller."
  },
  {
    "file": "progress.md",
    "line": 10,
    "summary": "None of the 18 commits updates progress.md, and three bundle several review findings, against two rules in <repo>/CLAUDE.md.",
    "failure_scenario": "Rule: 'Rewrite `progress.md` after each meaningful stage ... and commit it with the work.' `git log dae3c51..HEAD -- progress.md` is empty, and line 10 still says to finish `/code-review xhigh`, so a fresh session trusts stale state. Rule: 'every finding fixed in its own commit or closed with a one-line reason in checks.md.' fa462b6 holds findings 3, 4 and 8, 514ed9f holds 10, 11 and 12, and 9c5428d is 'the capped cleanups'. checks.md does not exist at HEAD (removed in 9225ba7), so no closure row exists."
  }
]
```

**Evidence**
- `node --test scripts/demo/*.test.js` passed 67 of 67, and `scripts/eval/judged/backends.test.js` passed its 10. This proves the current tests are green, not that the cases above are covered.
- The fake-CLI runs used two throwaway scripts, `probe2.js` and `probe3.js`, in `<tmp>`. Parser and regex checks are in `probe.js` there. The working tree stayed clean.
- Both `.b64` files decode to the exact bytes of the original PNGs (SHA-256 match). I viewed `desk-1280.png` and saw nothing sensitive.

**Cut by the cap**
- `customer-desk.js:463` runs its "not stored" branch before the `cache_hit` check, so a replayed answer could be reported as not stored. The current ticket data cannot reach this.
- `customer-desk.js:34` imports the whole judged runner for one constant. Moving it to `backends.js` is simpler.
- The `.b64` files keep a 336 KB image in the repository in a form the binary refusal cannot see, and they add 4,375 lines to diffs with no `-diff` attribute.

**Not checked**
- No real `claude` session was run.
- I did not view `desk-390.png`.
- I did not run the full repository test suite or CI.
- Findings 7, 8 (the `#` part), 9 (the "then" form), 11 and 13 rest partly on reading or on the expression alone, as each one says.
