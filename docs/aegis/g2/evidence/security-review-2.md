# Security review, batch G2 (round 2)

Run on 2026-10-28 with `/security-review` over `35b0415..2b35aa1`: the 72 commits the three code review rounds and the evidence review added after round 1 (`security-review.md`). The skill diffs against `origin/HEAD`, which this clone does not have, so a local-only `refs/remotes/origin/HEAD` was pointed at `35b0415` for the run and deleted after it; nothing was pushed. Code in the range: 10 files, +239 / -110 (`git diff --stat 35b0415 2b35aa1 -- scripts/ ':!*.test.js'`): the contract and the five adapters, `scripts/graph/engine.js`, `scripts/pre-commit-check.js`, `scripts/tier/tier-guard.js` and the adapters README.

Steps, as the skill sets them: one finder subagent (read-only, no file written) read the range and the code around it and tested candidates with `node -e` against the module at the head and at `35b0415` and `d5fc8c0` (scratch extracts by `git archive`); one false-positive filter subagent per candidate; candidates under 8 of 10 dropped.

**Result: No findings.** One candidate reached the finder's 0.7 line; the filter scored it 2 of 10 (below the bar of 8), so the report has nothing to fix as a security finding.

## The one candidate, below the bar

- **What:** a tier floor narrowed inside this PR. At `35b0415` "Delete the phishing message from all inboxes", "Purge the phishing message from everyone's inbox", "Unenroll [FIRST_NAME] from Intune" and "Unenroll [FIRST_NAME]'s Surface from Intune" floored to T3 in the guard and R3 in the engine; at `2b35aa1` all four route with no floor (`scripts/tier/tier-guard.js:64`, `:92`; `scripts/graph/engine.js:47`, `:68`). Introduced by `dae91cd` (the Slack deletion floor needs a Slack anchor, the unenroll floor a device word), `3aa4aef` and `6532359` (the purge floor reads the verb purge only, with every, all, each or across) and `b7cfc05` (the word Intune dropped from the unenroll anchors).
- **Finder:** 0.7, Low. On main's merge base `d5fc8c0` all four also route with no floor, so nothing that shipped loses a floor; a concrete plan with `New-ComplianceSearchAction ... -Purge` or the Intune retire cmdlet still floors R3.
- **Filter:** false positive as a vulnerability, 2 of 10: no regression against main; the guard is a backstop that reports and never gates (the lead routes by judgment, the T1 and T2 agents answer `ESCALATE:` for the SR-2 list, the SR-2 confirmation gate holds on every tier); Aegis advises and a human runs every step; a ticket writer can always word around a keyword list (exclusion 7, hardening). It is a routing-fidelity defect against the round 2 and round 3 commits' own claims ("a message purge across mailboxes floors on its own", "an Intune device unenroll still floors").
- **Fixed anyway** (a gap in two of this batch's own review fixes, in a file this batch edits), test first, each in its own pair of commits:

| gap | red test | fix | red run | green run |
|---|---|---|---|---|
| delete or purge with the mailboxes named as many (plural inboxes or mailboxes; every, all, each or across within two words of inbox, mailbox or users; everyone's inbox; org-, company-, tenant- or domain-wide; the entire company) floors as a purge; one person's own inbox clean-up and a Teams "delete for everyone" stay clean | `cafd3c3` | `83d1318` | `node --test scripts/tier/tier-routing.test.js`: tests 52, pass 51, fail 1 (`guard: "Delete the phishing message from all inboxes." → none`) | tests 52, pass 52 |
| Intune or the Company Portal anchors an unenroll again, unless a course or training word follows Intune ("the Intune basics course", "the Intune training" stay clean) | `77392d4` | `9b35dd7` | same command: tests 54, pass 53, fail 1 (`guard: "Unenroll [FIRST_NAME] from Intune." → none`) | tests 54, pass 54 |

Both fixes are mirrored in the engine with line gaps; the mirror test (`scripts/tier/tier-routing.test.js`, "every G2 floor in the guard has the same pattern in the graph engine") pins the pattern sources. The new purge alternative is lookaheads from the verb, so the purge timing test (a 10 KB line, under 1000 ms in guard and engine) still passes.

Left as designed, not changed: "Delete the IT project and all its cycles" (no Linear anchor: round 1 finding 7 asked that G2 floors not match other platforms' wordings) and "Delete issue Eng-142" (a mixed-case key reads as a product name such as Office-365: round 2 finding 5 and round 3 findings 1 and 6).

## Checked and refuted by the finder, one line each

- Contract `get()` and `plan()` (`7cff8a3`): the host comes from `resolveHost`, the method is a fixed GET, each parameter is tested against its route's anchored pattern (no `/`, `%`, `?` or `#`), `.` and `..` are refused, and the value is percent-encoded; no path or host escape and no non-GET request.
- GraphQL comment handling for a bare carriage return (`b69c918`): only stricter; documents are defined in code and the body must equal one of them.
- Timeout cancel, oversized body, token lifetime (`5a4160e`, `e5b6c23`, `02a1d60`): fixed error text; no token or credential path changed.
- Google `PERSONAL_PATH` anchoring and alias withholding: withholds strictly more than at `35b0415`.
- Slack `QUOTED_FIELDS` allow-list: at `35b0415` every flag was quoted, so the head only withholds more; route keys are constants.
- Scanner tenant-literal BLOCK and display path (`ada71f0`, `5a1c13f`, `87ac665`): the folded forms include the raw line and the needles the lower-cased literal, so no BLOCK the old check made is lost.
- Scanner `METHOD_FLAG` and the shared injection markers: they only add matches, and both are WARN.
- Intake wrong-customer check (`8575df0`, `47425c3`): over 31 tokens, 17 newly refused and 0 newly accepted; the lower-case exemption of `0995f92` is reverted.
- Engine chat-handle note (`80ef80d`, `ab89a1b`): a fixed label; the intake still refuses (exit 3) and offers no rewrite.
- The Linear deletion floor as an object with `test()`: every consumer calls `assess()` or `pattern.test`, so the floor cannot silently skip.
- `realCalendarTime` and `--not-before`: validation only.

## Battery after the fixes (at `9b35dd7`)

| check | result |
|---|---|
| `node --test` | tests 1045, pass 1045, fail 0, exit 0 (1041 at `2b35aa1`, same command, before any change; the 4 added are the two suites' ESCALATION and routine tests) |
| `node scripts/eval/ms-ticket-eval.js` | 28/28 tickets, 6/6 pairs, 7 floored (unchanged) |
| `node scripts/eval/gws-ticket-eval.js` | 38/38 tickets, 9/9 pairs, 16 floored (unchanged) |
| `node scripts/eval/g2-ticket-eval.js` | Fleet 13/13 3/3, Linear 11/11 2/2, Slack 14/14 3/3, Jamf 12/12 2/2, Google 13/13 2/2 (unchanged) |
| `node scripts/lint/command-structure.js` | 102 commands, clean |
| `node scripts/pre-commit-check.js --all` | 485 files, 0 BLOCK, 197 WARN (unchanged) |
| `node scripts/harness/release-boundary-check.js` | PASS |
| `node scripts/replay/replay-demo.js` | exit 0 |
