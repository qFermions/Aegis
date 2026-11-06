# Code review round 3

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

**Review of `4f195fc..HEAD`: 15 findings.** The verdict is not clean, because finding 1 changes closing states on shipped gates.

Evidence:
- `node --test scripts/demo/*.test.js scripts/eval/judged/*.test.js` gave 146/146 passing. That proves the existing cases hold, and every finding below is a case those tests don't cover.
- I ran findings 1-6, 8-13 against the real code, using the fake CLI and direct parser calls. Scripts are in `<tmp>`.
- Finding 7 and the stale line number in finding 14 come from reading the code. Finding 7 can't be reached with today's tickets, because T8 has T4's change class and probe.
- As asked, there was no separate verifier pass.

```json
[
  {
    "file": "scripts/demo/sim/gates.js",
    "line": 136,
    "summary": "The new no-op check compares each gate against the state left by the previous gate, so two gates with overlapping effects stop the whole ticket with a false 'changes nothing' reason.",
    "failure_scenario": "T2 answer naming okta-user-lifecycle-deactivate-portal and gws-offboard-okta-deactivate-portal: the second sets the status already set to DEPROVISIONED, so the run closes OPEN and applies nothing (run: exit 0, T2 OPEN). The same happens for gws-offboard-suspend-portal + gws-account-containment-suspend-portal, for mfa-session-revoke-portal + security-session-revoke-portal (one shared `now`), and for mfa-require-reregister-portal + mfa-method-delete-portal, where reversing the Gate lines avoids the stop. Test each gate against the original tenant state instead."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 60,
    "summary": "namedGates silently drops a gate named inside parentheses or after a leading 'none', although its comment says no advised change is dropped silently.",
    "failure_scenario": "'Gate: a-b (and also c-d)' returns ['a-b'], and 'Gate: None; mfa-require-reregister-portal' returns []. With 'Gate: mfa-require-reregister-portal (then mfa-session-revoke-portal)' only the first gate is approved, simulated and read back. The ticket should close RESOLVED (SIMULATED) and enter the replay store with the second change never handled (parser output run; the full close is read from the code)."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 72,
    "summary": "clarifies excludes '#' headings and '>' quotes but still counts bold pseudo-headings and checklist lines as questions, so a no-change answer closes CLARIFY when no question was asked of the customer.",
    "failure_scenario": "'**Why is it slow?**\\nThe ISP is at fault.\\nGate: none', 'Nothing to change.\\n**Did I miss anything?**\\nNo.\\nGate: none' and 'Nothing to change.\\n- Is it the ISP?\\nGate: none' all return true. The real T6 answer in docs/aegis/demo/evidence/smoke-run.txt contains that exact '**Did I miss anything?**' line. These should show OPEN, which the code comment names as the safe side."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 494,
    "summary": "A throw during a later read-back discards verdicts already collected in the same step, so a shown failure is reported as OPEN and its proof is lost; READ-BACK never fills the new `known` object.",
    "failure_scenario": "T2 with Okta and GitHub gates: the Okta read-back shows the change not done, then the GitHub transportFor throws. Run result: T2 OPEN, 'the desk could not finish', step 8 exit null with result 'failed: seam failed'. The Okta FAIL output is gone and the ticket is not FAILED. Put the verdicts and lines in `known`, and let a collected FAIL win."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 553,
    "summary": "The internal-error return comes before the FAILED check, so a run holding a real FAILED ticket exits 1 instead of the documented 2.",
    "failure_scenario": "--only T1,T7 with T1 hitting an internal error and T7 failing the boundary check ('I reset the password.'): run result exit 1 with T7 FAILED. A caller treating exit 2 as 'a ticket FAILED' (README, file header) misses the boundary failure. No test covers the two together, and the precedence is not documented."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 338,
    "summary": "When the tripwire stops the run, the in-flight ticket's record is thrown away and nothing marks the run as aborted, so a paid session's cost disappears despite the new keep-the-cost logic.",
    "failure_scenario": "A tripwire on the first ticket gives run.json false and desk.html false, with the paid session's cost recorded nowhere (run confirmed). On a later ticket, run.json would hold only the earlier tickets and read like a shorter finished run, with no desk.html (read from the code). Save the record and an aborted marker before rethrowing."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 510,
    "summary": "On a cache hit, `!rec.cache_hit` skips the whole unsettled branch, so the reason is dropped along with the wrong message, which contradicts the README row 'The reason says so when the answer did not pass every check'.",
    "failure_scenario": "A cached answer reused by a ticket with a different change_class or probe fails a check that now applies, for example human-confirmation or probe. It then closes RESOLVED (SIMULATED) with reason null and shows nothing about the failed check. Today's T4 and T8 data can't reach this, and commit 42b1c06 added no test for the branch. Keep the reason and change only the storage message."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 283,
    "summary": "draftNote takes the first line that opens with a label, so any bullet or sentence starting with the label replaces the real note; the test only covers a mid-line mention.",
    "failure_scenario": "A checklist item '- [ ] Ticket note posted' before '## 📝 Jira-ready note\\n> The real note.' produces the note 'posted\\n- [ ] User confirms'. 'Jira note below.' produces 'below.'. The response format puts the checklist before the note, so the real note is lost. Prefer a heading or 'label:' form, or the last match."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 269,
    "summary": "Removing the '**[A-Z]' and 'Gate:' stop markers lets the drafted note absorb later sections; only the bold '**Not checked' form was added back.",
    "failure_scenario": "'## Jira-ready note\\n> real\\n\\n**Verification:** run it\\n**Did I miss anything?** no\\nNot checked: live\\nGate: none' yields a note holding all of those lines. A Gate line that is not closing also stays in: 'Ticket note: real\\nGate: a-b\\nThanks.' keeps 'Gate: a-b', and the code comment says closing Gate lines are never part of the note, so that comment does not cover this case. Up to 1500 characters of internal text can land in the note."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 268,
    "summary": "The anchored NOTE_LABEL with `\\b` no longer finds label forms the old regex found, and it leaves markup behind on a qualified label.",
    "failure_scenario": "'## 📝 Jira-ready notes' (CLAUDE.md's own plural), '**Ticket Notes:** ...' and 'Suggested Jira note: the real note.' all fall back to the ticket title, so the model's note is dropped. '**Jira-ready note (paste this):** the real note.' produces '(paste this):** the real note.'."
  },
  {
    "file": "scripts/eval/judged/backends.js",
    "line": 38,
    "summary": "The stale-TMPDIR fix guards only the argument builder, and the same condition still crashes the desk and the judge; the test exercises only sutArgs.",
    "failure_scenario": "`TMPDIR=/nonexistent node scripts/demo/customer-desk.js --only T1` dies with an uncaught ENOENT and a Node stack trace from socket-tripwire.js:44 at require time, unless AEGIS_AUDIT_DIR is set (run confirmed). judge.js:215 calls mkdtempSync(os.tmpdir()) with no catch around it (read from the code). Handle it where the temporary folder is created, or refuse a stale TMPDIR once with a clear message."
  },
  {
    "file": "scripts/demo/catalog.js",
    "line": 60,
    "summary": "The gate-id regex has no word boundary, so a capitalized word is cut into a false id that appears in the customer-visible reason.",
    "failure_scenario": "'Gate: a-b Read-back' returns ['a-b', 'ead-back'], and 'Gate: Okta-user-lifecycle-suspend-portal' returns ['kta-user-lifecycle-suspend-portal']. The ticket stops OPEN, the safe side, but the reason names a gate nobody wrote and hides the real cause. Use `(?<![A-Za-z0-9])...(?![A-Za-z0-9])`."
  },
  {
    "file": "scripts/demo/customer-desk.js",
    "line": 534,
    "summary": "ctx.clean replaces the home path by plain string split, so HOME=/ turns every slash in a recorded reason into '~'.",
    "failure_scenario": "With HOME=/ (some containers), 'cannot open /etc/some/place' is recorded as 'cannot open ~etc~some~place' in the reason and step result (run confirmed). A checkout outside home also keeps its absolute path in the record, despite the comment 'no absolute path of this machine'. Match the home path only at a path boundary and skip '/'."
  },
  {
    "file": "docs/aegis/boundary-audit.md",
    "line": 75,
    "summary": "Row 41 still cites backends.js:148 for runChild, but this range moved it to line 152, and commit 42b1c06 edited this row without updating the number.",
    "failure_scenario": "An auditor following the reference lands on summarizeTurn's closing lines instead of the spawn call this row describes. This range changed that file's line numbers and this is the row that cites them, in a commit whose stated purpose is that the audit says what the code does now. Cost: the audit's line evidence is wrong."
  },
  {
    "file": "CLAUDE.md",
    "line": 225,
    "summary": "Conventions: fixes are bundled and the range has no progress.md or checks.md update, against two quoted rules in this file.",
    "failure_scenario": "Line 225: 'every finding fixed in its own commit or closed with a one-line reason in checks.md'. Commit 42b1c06 is 'code review 2 findings 13, 14, and the capped ones', and it puts behavior changes in customers.js and customer-desk.js under a docs(demo) prefix; 886569f bundles findings 5 to 9. Line 215: 'Rewrite `progress.md` after each meaningful stage ... and commit it with the work'. `git diff --stat 4f195fc..HEAD -- progress.md checks.md` is empty across 12 commits. Cost: the closure of those findings can't be traced."
  }
]
```

**Dropped at the cap (lower-severity cleanups):**
- **Misleading exit code:** the `worstExit` comment at `customer-desk.js:271` says exit 2 means "shown not done", but line 252 says exit 2 can also be a failed read. Step 8 can show exit 2 on an INCONCLUSIVE result.
- **Duplicate parsing:** `shownNotDone` (line 233) and line 258 each parse the connector's JSON separately. The stderr added at line 254 isn't needed, because exit 2 prints to stdout, so one parse would do.
- **Duplicate fields:** lines 403 and 408-411 repeat the same session fields and the `started` expression.
- **Double split:** `closingGateLines` joins the body, and both callers split it again.
- **Blank line:** `git diff --check` reports a new blank line at the end of `customer-desk.js:593`.
- **Unreachable case:** `excludedMemoryFiles({ judge: true })` handles a temporary folder below the checkout, but `judge.js` already refuses that folder before calling `judgeArgs`.

**Scratchpad mistake:** my first probes wrote into the session's main scratchpad.
- **`probe2.js`:** I appended to this existing file by accident, then cut it back to its original 32 lines and confirmed with `node --check` that it still parses.
- **`probe.js`, `parse.js`, `cat.js`:** I wrote these with `>` without checking first. If earlier versions existed, they are overwritten. My versions are now in `review-xhigh/`.
- **Repository:** no repository files were changed.

**Reviewer load:** none, as I changed no code or tests.

**Not checked:**
- No real model session was run; all sessions used the fake CLI.
- I did not check whether the judge still picks up repository settings, skills or hooks through `--setting-sources project`.
- `render.test.js` and `customers.test.js` passed, but I did not review them line by line since they aren't in the diff.
