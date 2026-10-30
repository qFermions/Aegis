# Evidence review (batch G3, once)

The evidence-reviewer agent read `checks.md` rows D1 to D15 against the saved captures at `d0f2b3b`, read-only, with no commands and no web access. It reported 15 rows: 5 confirmed (D3, D10, D13, D14, D15), 6 wrong (D1, D2, D4, D6, D8, D12), 4 unverifiable from files (D5, D7, D9, D11), and 4 stale or inconsistent items outside `checks.md`. Every one is corrected below; the corrections are in the commits after `d0f2b3b`.

| row | verdict | what it found | correction |
|---|---|---|---|
| all | note | the `t1` to `t4`, `t5d` and `t6a`, `t6b` green captures carry "(plus uncommitted changes)": they ran on the working tree just before each commit | `checks.md` says so in its introduction and every such row now also cites a capture at the clean head (`t7-head-suite-counts.txt`, `t8-head-checks.txt`) |
| D1 | wrong (citation) | `t1-readiness-green.txt` is a landing capture | cites `t7-head-suite-counts.txt:19` (4/4 at head) |
| D2 | wrong | "64 existing Jira tests unchanged" (one assertion changed 0 to 4 for finding 7); batch 1 finding 12 missing; G2 65/65 13/13 had no capture at a committed head | the row states the changed assertion and finding 12; G2 cited at head (`t8-head-checks.txt:5`) |
| D3 | confirmed | | |
| D4 | wrong (citation) | landing captures only; the contract is 33/33 at head, not 32 | head citations added (intake 33/33, contract 10 + 23) |
| D5 | unverifiable | "lint 108 commands clean" was in no file; the six runbooks in the mixed-state list were not visible in the capture | lint in `t8-head-checks.txt:7`; the list cited at `scripts/command-safety-gates.test.js:44-46` |
| D6 | wrong (citation) | landing captures; the 19/19 is a landing figure | head citations added; the 19/19 is called a landing figure |
| D7 | unverifiable | `wc -c CLAUDE.md` had no saved output | `t8-head-checks.txt:10` |
| D8 | wrong (partly) | "CI green at ebb8cc1 and 19522d3" was in no file; round 3 finding 14 read "this commit" | `ci-runs.md` lists every run with its id; finding 14 names `d0f2b3b` |
| D9 | unverifiable | ms, gws and G2 evals had no capture at head | `t8-head-checks.txt:3-6` |
| D10 | confirmed, with caveats | the grep stopped at `a237fac`; it does not look for real names or internal hostnames | re-run at the final capture head; `leak-grep.js` now lists every URL host and mail domain an added line names; the row says names are guarded by the scanner and the placeholder dictionary |
| D11 | unverifiable | the evidence was a command | `t8-head-checks.txt:17-18` |
| D12 | wrong (unexplained line) | `scripts/jira-client.test.js` showed tripwire 0 and transport 0 | `fixtures-and-mocks.sh` now also counts an injected request or fetch (that file: 15 lines) |
| D13 | confirmed | | |
| D14 | confirmed | | |
| D15 | confirmed, with gaps | the PRODUCT_CONTRACT diff, "CLAUDE.md unchanged" and the marker counts had no saved output | `t8-head-checks.txt:10-16`, which also shows that no file's SAFETY GATE count fell |

Outside `checks.md`:

1. `docs/aegis/capability-map.md:93` named `ebb8cc1`: now the final capture head.
2. `docs/aegis/boundary-audit.md` row 40 named one new process call: now row 38 and the developer-run evidence tools.
3. Capability-map rows 59, 72 and 73 cited landing captures only: head citations added.
4. `scripts/readiness-gate.test.js` checked three of the five owner-only rows: it now requires all five and no other (`c9fff57`; mislabeling row 12 fails it).

The reviewer's limit, also corrected: a capture's commit line did not count untracked files. The capture script now does, the tools README says so, and the final captures ran with no changed or untracked file outside the captures.
