# Evidence review

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

16 findings: 11 important, 5 nits. Most of the code rows hold, and the T6 FAILED explanation is accurate. T10 and the CI claim fail, several claims have no saved output, and the explainer goes further than the evidence.

## Verdict table

Short file names are expanded under "Files cited" at the end.

| requirement | verdict | evidence opened | correction |
|---|---|---|---|
| Baseline and final battery counts | pass | `baseline/node-test.txt:2021-2027`; `final-battery/node-test.txt:2107-2113`; both tripwire captures; all eval, lint, scanner, boundary and replay captures | The 41 failure names match in the first block; the second block's count matches. New tests add up: 6+62+9+7+2 = 86. The scanner capture has no BLOCK line and exits 0, with 219 warnings (`pre-commit-check-all.txt:593`). |
| T1 customers, tickets, schema, domains, people, intake | pass | `customers.test.js:32-105`; `t1-green.txt:8-10`; `customers.json`; `tickets.json`; T4, T5, T6 and T8 raw items | None. |
| T2 runner: modes, steps, closing states, named cases | pass | `customer-desk.js:47,103-115,591-612`; `customer-desk.test.js:83,137,218,229,358,518,603,658` (62 tests counted); `t2-red.txt` | None. The red capture is a missing module, not 62 individual failures. |
| T2 and V2: T8 CACHE_HIT only with a fixture gate | pass | `customer-desk.test.js:632-674,676-683`; `customer-desk.js:155,396-403` | The row does not overclaim. V2 could add that the T4 answer is also fake. |
| T3 TENANT_MISMATCH and T8's store | pass | `customer-desk.test.js:685-712,714-721` | The pass covers intake, replay stores and folders, not what a session can read (finding 8). |
| T4 terminal lines and page | pass | `render.js:51-54,108-146`; `render.test.js` (9 tests); `customer-desk.test.js:783` | None. The tests use a fixture run. |
| T4 Chrome claims: 0 px overflow, 0 requests, both themes | unresolved | Search of `docs/aegis/demo` (excluding `.b64`) for overflow, scrollWidth, Playwright, Chromium and network request: no file | Save the measurements, or mark them as not evidenced. |
| T4 two screenshots | unresolved | First bytes of each `.b64`, decoded by hand: PNG 1280x900 and 390x844; `reflog:24,29` | The files exist at those sizes. I cannot view the content or theme. See finding 7. |
| T5 summary and exact sentence | pass | `render.js:7,41-48`; `customer-desk.test.js:797-828`; `smoke-run.txt:237-240`; charter sentence compared | Nit 1. |
| T6 README, explainer length, wiring test, CI step | pass | `README.md`; explainer (36 lines); `wiring.test.js` (7 tests); `ci.yml:167-174`; `final-battery/node-test.txt:1395,1400` | Finding 6: the cited capture holds 6 tests, not 7. |
| T6 "the CI run below" | fail | `checks.md:31,83` | The CI section holds only the placeholder `CIRUN`. Fill it in, or mark the clause unresolved. |
| T7 what stays untouched | unresolved | `checks.md:32`; no saved diff in `docs/aegis/demo` | Save the diff output, and widen its scope (finding 3). |
| T8 real run of T4 and T6 | pass | `smoke-run.txt:1,9,87,93,234,237-242`; `reflog:18-20` | Figures match; the run folder time fits the commit time. Nits 4 and 5. |
| T6 FAILED explanation (V5) | pass | `smoke-run.txt:185,230-234`; `checks.js:18,24,45,126` | "I ran" at line 185 is the only match I found by reading. V5 is right about the boundary, observed-output and probe results. Add that `injection probes refused 0` (`smoke-run.txt:238`) comes from the same false alarm, though the answer flagged the line at `:98`. |
| T9 flags pinned by a test | pass | `backends.test.js:61-78,87-97`; `backends.js:35-52,97,102`; `t9-red.txt`; `t9-exclude-red.txt` | None. |
| T9 init: no user-level MCP server or plugin | pass | `smoke-T4-init.json:12,363-364`; `smoke-T6-init.json:12,322-341,363-364`; `isolation-probe.txt:24` | Applies to the real runs; at the head it comes from one summary line. |
| T9 init: no user-level skill ("the CLI's bundled ones") | unresolved | `smoke-init-check.txt:6`; `smoke-T4-init.json:124-142` | The init event gives names, not sources, so "bundled" is an inference. `graphify` appears nowhere, which helps but proves only that one. Probe B lists no skills. Finding 5. |
| T9 statement on the user-level CLAUDE.md | pass | `isolation-probe.txt:3-25`; `smoke-run.txt:74,191,201,203,209`; `checks.md:34`; project rule files searched, wording absent | "WAS loaded in both" is inferred from a later same-flag probe plus the wording. Neither init file lists memory files. Say so (finding 5). |
| T10 reviews, draft pull request, CI | fail | `checks.md:35,50,83`; `progress.md:4-5,7`; `checks.md:78` | Pass with no evidence: see finding 1. Set it to unresolved until the placeholders are filled. |
| Product boundary: simulator, session tools, row 43 | pass | `gates.js:129-145`; `vendors.js`; `customer-desk.test.js:187-214,741-764`; `boundary-audit.md:75-77`; `smoke-T6-init.json:6` | Finding 10 on row 43. |
| Product boundary: "No connector changed" | unresolved | Depends on the unsaved T7 diff | Cite the saved diff. |
| Secrets, paths, names at the head | pass | `wiring.test.js:77-89`; my search of the batch files found only that test's own rule | The test reads `.b64` as text, so it cannot see anything shown in the screenshot pixels. |
| Secrets: `git log -p` holds no account name | unresolved | `checks.md:37`; `reflog:26` shows the rewrite | Save the command and its output. |
| No em-dash | pass | `wiring.test.js:91-100`; my search for em and en dashes over `checks.md`, `progress.md`, `scripts/demo`, `docs/aegis/demo`, batch 6 explainers: 0 | None. |

No charter requirement lacks a row. Task 7's "any existing test" has a row but no check (finding 3).

## Findings

### Important

1. **T10 and CI are marked pass on placeholders.**
   - `checks.md:83` is `CIRUN`, and `checks.md:50` is `EVIDENCE`.
   - `checks.md:78` says `gh` "opened the pull request", while `progress.md:5` says it is "in progress".
   - `progress.md:4` defines verified as including green CI, and V8 at `checks.md:76` relies on it. No CI result exists.
   - Fix: set T10 and the CI clause to unresolved now. Pass them only with the run link and result.

2. **Several claims have no output anyone can open.** One class, all instances:
   - `checks.md:29`: the Chrome measurements.
   - `checks.md:32`: the T7 diffs.
   - `checks.md:37`: `git log -p`.
   - `checks.md:5`: the 20 failures removed by `TMPDIR`.
   - `checks.md:72`: V4, six Playwright versions.
   - `checks.md:75`: V7, 10 `/context` runs, with only 3 in `isolation-probe.txt:4,13,21`.
   - `checks.md:79`: V11, "T6's session read `progress.md`". `smoke-run.txt` never mentions it, and the stream is outside the repository.
   - `checks.md:34`: the `--bare` help text.
   - `checks.md:44-48`: the review finding counts. Only commit subjects corroborate them (`reflog:29-66`).
   - Fix: save each output under `docs/aegis/demo/evidence/`, or mark the claim unresolved.

3. **T7's check is narrower than its requirement.** The command at `checks.md:32` covers `.claude`, `CLAUDE.md`, `PRODUCT_CONTRACT.md`, `scripts/adapters`, `scripts/eval`, and separately `PROJECT_STATE.md` and `production-readiness.md`. The charter also forbids changing any existing test, wherever it lives. Fix: save a full-tree name-status diff from `77b7114` and list every changed path outside `scripts/demo` and `docs/aegis/demo`.

4. **The explainer and README state more than the evidence.**
   - Explainer `:34`, "so the leak very likely caused it". No session has run with the final flags (V6), and T4 had the same leak without failing. Commit subject `reflog:25` says the text avoids a cause it cannot prove. Use "may have contributed; not tested".
   - Explainer `:3`, "tickets a customer would really send". The builder wrote them, against the required sentence.
   - Explainer `:12`, "the pipeline works". Two real sessions ran, one closing FAILED on a false alarm and neither reaching step 6. Use "shows the pipeline".
   - Explainer `:22`, "the only code that changes anything", plus `README.md:5` and `customer-desk.js:8`. The audit trail, replay store, case files and `run.json` also change. Say "changes a tenant".
   - Explainer `:28-30` and `README.md:76-78` give T3, T5 and T8 as "what you will see". Those tickets never ran on a real model, and the outcome depends on the gate the answer names. T6's gates were not simulated until after the real run (`reflog:23-24`). Label these as expected.
   - Explainer `:32`, "One thing", contradicts `:36` and quiz `:17`. Explainer `:36` also omits `backends.test.js`, the `.gitattributes` line and the audit row.
   - Explainer `:36`, "a run writes only to `~/aegis-demo-runs/`". `sutArgs` lacks the `--no-session-persistence` flag the judge uses (`backends.js:96-97` against `:102`), so transcripts probably persist under `~/.claude/projects`. Not checked, because the home folder was off limits. Quiz `:17` has the same gap.
   - `README.md:44` and explainer `:19` state isolation as fact. Add that no model session has run under the final flags.

5. **The T9 row's single pass covers two flag sets and an inference.** `checks.md:34` does not say auto memory was on in the real sessions, though `smoke-T4-init.json:363-364` and `smoke-T6-init.json:363-364` show a user-level path. Whether anything was loaded from it is not shown. Fix: split the row as in the table, state the auto-memory path, and say that "loaded" comes from a same-flag probe. Prove "bundled" with a `/context` run under an empty `HOME`.

6. **The T6 row cites a stale capture.** `checks.md:31` says 7/7 and cites `t6-green.txt`, which shows 6 tests (`t6-green.txt:8-10`). The seventh arrived later. Fix: cite `final-battery/node-test.txt:1395,1400`.

7. **The screenshots predate most of the code and cover fewer cases than the row implies.** They were added at `reflog:24` and only converted at `reflog:29`, before all three code-review rounds. `render.js:132` and the subject at `reflog:64` suggest the page changed later; I could not diff it. Two 900 and 844 px tall images cannot show two widths in both themes. Fix: state the commit and what each image shows, and retake them at the head if the page changed.

8. **The T3 pass does not cover session reach.** `--allowedTools Read` is unscoped (`backends.js:97`), so a session may be able to read another customer's folder from an earlier run. V11 mentions only the repository. The data is fictional and I did not prove the read works. REVIEW.md lists cross-tenant reach as a project failure, so state this limit in T3 or V11 and hand it to the owner.

9. **The "before the first edit" claim cannot be shown from history.** `progress.md:3-4` makes the claim. The reflog shows a data commit (`reflog:4`) about 199 seconds before a reset (`reflog:5`), then the hypothesis, baseline and data recommitted in the same second (`reflog:7-8`). The hypothesis may still have been written first, but history cannot prove it. V9 discloses only the later filter-branch. Fix: add a deviation that states the reset and the reason.

10. **Audit row 43 is thinner than its neighbors.**
    - `boundary-audit.md:77` has no line references for the new paths, and I found no saved batch 6 boundary grep.
    - It sits in the same table as G3 and G4, with no batch 6 result. `boundary-audit.md:81` still says the new paths are rows 41 and 42.
    - Row 41's verdict at `:75`, "the owner starts a real run", and "never run here" are stale after a builder-started run in T8.
    - Fix: add a batch 6 result and the grep, and update row 41.

11. **`scripts/demo/**` has no risk tier.** A search of `.github/risk-tiers.json` for `demo` finds nothing, so by `REVIEW.md:30-32` it falls to tier A. This pull request is tier C through `ci.yml`, but a later desk-only change would get the lightest review, though the desk spawns `claude` and writes change records. This is an owner decision.

### Nits

1. `checks.md:30` says `smoke-run.txt` "ends with" the sentence. It closes the summary at `:240`, and `:241-242` follow.
2. `checks.md:45` says "1 closed in part", but `:52,56-57` show finding 15 closed in full and finding 14 fixed with one part closed.
3. `README.md:76` and quiz `:16` name only `mailbox-grant-portal`. The runbook has three preview markers (`mailbox-permissions.md:18,44,46`), and the real answer named the other two (`smoke-run.txt:80-81`).
4. "At `96f37ee`" holds for the runner's loaded code. Two commits landed during the run (`reflog:19-20`), so by my arithmetic T6's session read a tree at `8c963f0`. This is unlikely to affect the outcome.
5. T6 used 24 turns against `--max-turns 24` (`smoke-run.txt:93`, `backends.js:53`). A larger ticket such as T2 might hit the cap and close OPEN in the owner's run, and nothing warns him.

### Pre-existing

`checks.js:24,45` do not read a negation. Task 7 keeps this unchanged and it is disclosed; the owner still needs to decide on it.

## Rows I could not judge

- **Screenshot content and theme:** the base64 cannot be viewed with my tools.
- **Chrome measurements:** no saved output.
- **T7 and "No connector changed":** no saved diff, and I cannot run git.
- **`git log -p` account-name check:** I searched only the working tree of the batch files.
- **Review finding counts and the T9 `--bare` reason:** no saved reports or help output.
- **V4, V7 beyond 3 runs, V11, and the 20 `TMPDIR` failures:** no saved evidence.
- **CI and the pull request:** placeholders only.

I read `.git/logs/HEAD` for commit order. I also ran one count-only search of `.env.example` for three variable names, without reading any values. I read no `.env` file and nothing in the home folder.

## Files cited

- `checks.md`: `<repo>/checks.md`
- `progress.md`: `<repo>/progress.md`
- `reflog`: `<repo>/.git/logs/HEAD`
- `customer-desk.js`: `<repo>/scripts/demo/customer-desk.js`
- `customer-desk.test.js`: `<repo>/scripts/demo/customer-desk.test.js`
- `customers.test.js`: `<repo>/scripts/demo/customers.test.js`
- `customers.json`: `<repo>/scripts/demo/customers/customers.json`
- `tickets.json`: `<repo>/scripts/demo/customers/tickets.json`
- `render.js`: `<repo>/scripts/demo/render.js`
- `render.test.js`: `<repo>/scripts/demo/render.test.js`
- `wiring.test.js`: `<repo>/scripts/demo/wiring.test.js`
- `gates.js`: `<repo>/scripts/demo/sim/gates.js`
- `vendors.js`: `<repo>/scripts/demo/sim/vendors.js`
- `README.md`: `<repo>/scripts/demo/README.md`
- `backends.js`: `<repo>/scripts/eval/judged/backends.js`
- `backends.test.js`: `<repo>/scripts/eval/judged/backends.test.js`
- `checks.js`: `<repo>/scripts/eval/judged/checks.js`
- `ci.yml`: `<repo>/.github/workflows/ci.yml`
- `risk-tiers.json`: `<repo>/.github/risk-tiers.json`
- `mailbox-permissions.md`: `<repo>/.claude/commands/mailbox-permissions.md`
- `REVIEW.md`: `<repo>/REVIEW.md`
- explainer: `<repo>/docs/explainers/batch6-customer-desk.md`
- quiz: `<repo>/docs/explainers/batch6-customer-desk-quiz.md`
- `boundary-audit.md`: `<repo>/docs/aegis/boundary-audit.md`
- `baseline/`: `<repo>/docs/aegis/demo/baseline/`
- `final-battery/`: `<repo>/docs/aegis/demo/evidence/final-battery/`
- `smoke-run.txt`, `smoke-T4-init.json`, `smoke-T6-init.json`, `smoke-init-check.txt`, `isolation-probe.txt`, `t1-green.txt`, `t2-red.txt`, `t6-green.txt`, `t9-red.txt`, `t9-exclude-red.txt`, and both `.b64` screenshots: all in `<repo>/docs/aegis/demo/evidence/`
