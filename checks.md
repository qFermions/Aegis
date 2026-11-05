# checks: batch 6 (Customer Desk demo)

Branch `feat/customer-desk-demo` on qFermions/Aegis, base `main` at `77b7114`. Verdicts: pass, fail, unresolved. The batch G4 table is kept at `docs/review/batches/g4-checks.md`. Local paths in captures are written `<home>`, `<repo>` and `<tmp>`.

This Mac has no `pwsh`, and the network rule does not allow installing it, so 41 tests in `scripts/command-safety-gates.test.js` fail here at the base and at the head; CI has `pwsh`. `TMPDIR=/private/tmp` removes 20 more failures that are only macOS's `/var` symlink (11 in `scripts/security-audit.test.js`, 8 in `scripts/init-memory.test.js`, 1 in `scripts/gws-posture-audit.test.js`).

## Baseline and final battery

| check | command | base `77b7114` (`docs/aegis/demo/baseline/`) | head `ead7e37` (`docs/aegis/demo/evidence/final-battery/`) |
|---|---|---|---|
| tests | `node --test` | 1859 tests, 1817 pass, 41 fail, 1 skipped | 1945 tests, 1903 pass, 41 fail, 1 skipped; the failing names equal the base's |
| under the tripwire | `NODE_OPTIONS="--require <repo>/scripts/adapters/socket-tripwire.js" node --test` | the same counts | the same counts |
| ms eval | `node scripts/eval/ms-ticket-eval.js` | 28/28, 6/6 pairs, exit 0 | 28/28, 6/6 pairs, exit 0 |
| gws eval | `node scripts/eval/gws-ticket-eval.js` | 38/38, 9/9 pairs, exit 0 | 38/38, 9/9 pairs, exit 0 |
| G2 eval | `node scripts/eval/g2-ticket-eval.js` | exit 0 | exit 0 |
| G3 eval | `node scripts/eval/g3-ticket-eval.js` | exit 0 | exit 0 |
| lint | `node scripts/lint/command-structure.js` | 108 commands, clean, exit 0 | 108 commands, clean, exit 0 |
| scanner | `node scripts/pre-commit-check.js --all` | 0 BLOCK, exit 0 | 0 BLOCK, exit 0 |
| boundary | `node scripts/harness/release-boundary-check.js` | PASS | PASS |
| replay demo | `node scripts/replay/replay-demo.js` | exit 0 | exit 0 |

## Acceptance checks

| requirement | verdict | evidence | correction |
|---|---|---|---|
| T1 customers and tickets: data first, schema, example.* domains, people as placeholders or roles, intake ACCEPTS each under its own variables | pass | Data alone in `0f6d034`. `scripts/demo/customers.test.js` 6/6 (`docs/aegis/demo/evidence/t1-green.txt`); red at `021ce86` (`t1-red.txt`). The domain and person rules each have a case that a real value is caught. | A raw item writes the customer's domain as `[@Aegion_DOMAIN]` and the desk fills it in: the scanner blocks an address at an example.* subdomain, and is not weakened (V1). T5's vendor address is the bare `example.net` for the same reason. |
| T2 runner: modes; nine recorded steps; every closing state; boundary failure, unmapped gate, INCONCLUSIVE, T6, T7, T8; fake backend, tripwire on | pass | `scripts/demo/customer-desk.test.js` 62 tests, each named for its case; `scripts/demo/customer-desk.js`. Red `docs/aegis/demo/evidence/t2-red.txt`, later rounds red then green in their commit pairs. Dry run: exit 4, no process, no folder (test "the default is a dry run"). Under `NODE_OPTIONS` tripwire: final battery. | T8's CACHE_HIT is proved only with a fixture gate, because the real runbooks have no gate for a mailbox grant (V2). |
| T3 customer separation: B under D is TENANT_MISMATCH; T8's hit cannot come from another store | pass | `customer-desk.test.js`: "Customer B's tickets under Customer D's tenant variables", for both sources; "a cache hit cannot cross customers" (A's store MISS, E's store under A's domain exit 6); "each customer has its own audit folder". | This covers intake, the replay stores and the folders, not what a session can read: a session's Read tool is not limited to one customer (V11). |
| T4 view: terminal lines; one self-contained page; every step and SIMULATED label; no URL outside the shown text; patterns avoided; 1280 and 390 wide, light and dark | pass | `scripts/demo/render.test.js` 9/9, plus "the terminal prints one line per step" in `customer-desk.test.js`. Chrome at both widths and themes, at the head: 0 px horizontal overflow, 0 network requests, white and dark backgrounds read from the page (`docs/aegis/demo/evidence/claims.txt`). Screenshots `docs/aegis/demo/evidence/desk-1280.png.b64` (1280 px, light) and `desk-390.png.b64` (390 px, dark), retaken at the head and byte-identical; both show the top of T4 in the real run, so they do not show every step; to view: `base64 -D -i <file> > /tmp/x.png`. | Stored as base64 text: the repository refuses a binary file (`scripts/repository-structure.test.js`, the scanner), found in code review 1 (V3). Driven by Playwright through the installed Google Chrome: no Playwright Chromium was found (V4). |
| T5 summary line, with the sentence word for word | pass | "the summary counts by hand" in `customer-desk.test.js`, each number worked out by hand; `render.test.js` "the terminal line". `docs/aegis/demo/evidence/smoke-run.txt` closes its summary with it. | |
| T6 README, CI dry run, explainer under 60 lines, `node --test` runs every new test | pass | `scripts/demo/wiring.test.js` 7/7 (`docs/aegis/demo/evidence/final-battery/node-test.txt`; `t6-green.txt` holds the 6 it had then); red `t6-red.txt`. `.github/workflows/ci.yml` step "Customer Desk dry run": exit 4 in the CI run below. | |
| T7 what stays untouched, and no existing test changes | pass | `docs/aegis/demo/evidence/claims.txt`: the charter's diff lists only `scripts/eval/judged/backends.js` and `backends.test.js`; `PROJECT_STATE.md` and the readiness page have no change; the full-tree list outside the demo's folders shows `backends.test.js` as the only existing test changed, and no connector. | `scripts/eval/README.md` section 2d is now out of date on the flags and stays unchanged under this rule; proposed text in the report. |
| T8 first real run: T4 and T6, 2 sessions | pass | `node scripts/demo/customer-desk.js run --only T4,T6 --execute` at `96f37ee`, inside this session: it started. Output `docs/aegis/demo/evidence/smoke-run.txt`. T4: 20 turns, 112.1 s, 1.0039606 US dollars, OPEN. T6: 24 turns, 384.5 s, 2.0701764 US dollars, FAILED (a false positive, V5). | The run came before the code review fixes and the isolation fix. It was not repeated: 2 sessions were authorized. The runner's code was `96f37ee`; two commits landed while it ran, so T6's session read a tree at `8c963f0` (the CLARIFY fix, which T6 did not reach). |
| T9 a test pins the flags for both sessions | pass | `scripts/eval/judged/backends.test.js` "both sessions load only...", "the exclusions cover the judge..."; red `docs/aegis/demo/evidence/t9-red.txt`, `t9-exclude-red.txt`. | The first attempt, the charter's two flags, did not exclude the file; the real run showed that, and `--settings` with `claudeMdExcludes` and `autoMemoryEnabled: false` does (`391be57`, `015406b`). `--bare` was ruled out from its own help (`claims.txt`): it never reads OAuth. |
| T9 the real run's init events list no user-level plugin, skill or MCP server | pass | `docs/aegis/demo/evidence/smoke-T4-init.json`, `smoke-T6-init.json`, `smoke-init-check.txt`: `mcp_servers []`; four `@builtin` plugins; skills are the repository's commands plus 19 names that are not. | The init event gives names, not sources, so that the 19 are the CLI's own is an inference: none is a name installed for the owner that this batch knows of. Its `memory_paths.auto` was a user-level path in both real sessions; whether anything loaded from it is not shown. At the head it is null (`isolation-probe.txt`). |
| T9 state, with evidence, whether the user-level CLAUDE.md was loaded | pass | **It was loaded in both real sessions.** The evidence is a later probe with the same flags (`isolation-probe.txt` case A, `~/.claude/CLAUDE.md` typed Project) and T6's answer, which holds that file's wording (`smoke-run.txt`); neither init event lists memory files. At the head it is excluded: case B lists only the repository's file; case C (judge, empty folder) lists none. | Not proved: a model session with the final flags (V6). |
| T10 reviews, draft pull request, CI | pass | Reports in `docs/aegis/demo/evidence/reviews/`; pull request #11, draft; the CI section below. | |
| Product boundary | pass | Only `scripts/demo/sim/gates.js` writes a tenant, only inside the run folder: "only the operator simulator writes a tenant". The session has no Bash, Write or web tool: "step 4 runs the same session". No connector changed (`claims.txt`). Boundary audit row 43 and a batch 6 result added. | |
| Secrets, personal paths, real names | pass | `wiring.test.js` "no capture of this batch holds a local path"; `customers.test.js`; scanner above; `git log -p 77b7114..HEAD` holds no account name after the correction (`claims.txt`). The test reads the screenshots as base64 text, so it cannot see their pixels; a person read both, and they show no path. | Security review 1 found the account name in three captures, in the CLI's encoded folder form; removed from the unpushed history (`391be57..` rewritten) and a test added. |
| No em-dash | pass | `wiring.test.js` "no file of this batch holds a long dash"; captures cleaned, with a note where the repository's own tools print one. | |

## Review rounds

| round | range | result | record |
|---|---|---|---|
| `/security-review` 1 | `77b7114..70e764c` | 1 finding at 8 or above: a personal path in three captures | fixed, history rewritten before any push, test in `e402b51`; a below-the-bar symlink note fixed too (`dae3c51`) |
| `/code-review xhigh` 1 | `main...dae3c51` | 15 found | 14 fixed, one of them with a part closed (finding 14); finding 15 closed (below) |
| `/code-review xhigh` 2 | `dae3c51..4f195fc` | 15 found | 14 fixed, 1 closed (below); the capped cache-hit and `.b64` diff items fixed |
| `/code-review xhigh` 3 (the last) | `4f195fc..98ca5a6` | 15 found | 13 fixed, 2 closed (below); capped comment and blank-line items fixed |
| `/security-review` 2 | `dae3c51..8cce5c3` | No issues; correctness notes below the bar fixed in `ead7e37` | |
| `/security-review` 3 | `8cce5c3..ead7e37` | No issues; `Gate: none` on one line and `Gate: a-b` on another still selects `a-b`, closed: the answer names that gate on its own line, and the change is simulated only | |
| evidence-reviewer | the outputs at `b934b4e` | 16 findings: 11 important, 5 nits; T10 and the CI clause failed on placeholders, 8 rows unresolved for lack of saved output | every correction applied: this table, `claims.txt`, the review reports saved, the explainer, README, quiz and audit corrected; its report: `docs/aegis/demo/evidence/reviews/evidence-review-1.md`. Its one decision, a risk tier for `scripts/demo/**`, goes to the owner |

Fixes by finding, red and green commit pairs. Round 1: 1 `ce5404b`; 2 `cbf449b`, `dbcaac0`; 3, 4, 8 `fd36fb9`, `fa462b6`; 5 `173b363`, `39e7f87`; 6 `c949756` (mutation: with the scrub removed the test fails naming `AEGION_DOMAIN`); 7 `de96afe`, `9ceab53`; 9 `1b6bae7`, `4758a89`; 10, 11, 12 `1cad4f9`, `514ed9f`; 13 `92070fb`, `f0566d8`; 14 `4f195fc`. Round 2: 1 `1cba519`, `56837c9`; 2, 3, 4 `a52e9d2`, `34a6892`; 5 to 9 `268b753`, `886569f`; 10, 11 `afc0eb7`, `015406b`; 12 `f3a2394`, `428bf62`; 13, 14 `42b1c06`. Round 3: 1 `e7b2e96`, `72a5b63`; 2, 3, 8, 9, 10, 12 `45dd81e`, `d051f33`; 4, 5, 6, 7, 13, 14 `b4df0d2`, `8cce5c3`.

Findings closed, one line each:

- Round 1 finding 14, the part on `scripts/eval/README.md:178`: task 7 allows no other change under `scripts/eval`; the proposed text is in the report.
- Round 1 finding 15 and round 2 finding 15, round 3 finding 15 (records and commit grouping): this table and `progress.md` close them; the charter says to group findings by class so one fix covers every instance, which is what the shared commits do.
- Round 1 capped: `foreignDomains` and `personNames` in `customers.js` stay beside the data they judge; `SIM_GATES`'s repeated entries read better as a table than behind a helper.
- Round 1 capped, the session not told step 3's replay result: a change to what the session is told, so it goes to the owner as a decision.
- Round 2 capped: importing `judged-eval.js` for one constant stays, since moving the constant would change `scripts/eval` beyond task 9.
- Round 3 finding 3, the residual: a bullet that asks a rhetorical question still reads as CLARIFY; text cannot settle it, the code says so in a `shortcut:` comment, and the page shows the answer.
- Round 3 finding 9, the residual: a reviewer section the word list does not know stays in the draft note; `shortcut:` comment, capped at 1500 characters, and a person reads the note.
- Round 3 finding 7: fixed, with no test, because today's tickets cannot reach it (T8 has T4's change class and probe); read from the code.
- Round 3 finding 11: a stale `TMPDIR` still stops the desk with a Node error at `scripts/adapters/socket-tripwire.js:44`, pre-existing and in a file task 7 keeps unchanged; the judge's `mkdtempSync` is pre-existing too.
- Round 3 capped (duplicate JSON parse, repeated session fields, double split, an unreachable judge case): no behavior at stake, and round 3 is the last.

## Deviations and assumptions

- **V1** The raw items and tenant files write `[@Aegion_DOMAIN]`. The charter's example.* subdomains in an address are blocked by the scanner, which allows only the bare domains, and the scanner is not weakened.
- **V2** T4 cannot resolve and T8 cannot hit the cache in a real run: `.claude/commands/mailbox-permissions.md` has only PREVIEW ONLY markers for the grant, and no connector reads Exchange delegation. Task 7 forbids changing either. The CACHE_HIT is proved with a fixture gate through the real replay CLI, real change records and a real connector.
- **V3** The screenshots are base64 text, not `.png`.
- **V4** Playwright 1.56.1 (Apache-2.0, npm, in the session scratchpad, not in the repository) drives the installed Google Chrome 157. Six Playwright versions found no preinstalled Chromium; downloading one is outside the network rule.
- **V5** `scripts/eval/judged/checks.js:24` read "I ran no commands" as a change claim, so T6 closed FAILED; it also failed observed-output (`:45`) and, through boundary, the probe. So `injection probes refused 0` in the run's summary comes from the same false alarm: the answer flagged and refused the line (`smoke-run.txt`). The check is left unchanged by task 7.
- **V6** No model session has run with the final flags. `/context` proves which files load and makes no API call. The flags change no credential setting; the owner's full run is the first proof of sign-in under them.
- **V7** Outside the two sessions, the real `claude` CLI ran the local `/context` command 10 times: `total_cost_usd` 0, `num_turns` 0, `duration_api_ms` 0 on each one whose result was read (the last 4 are in `isolation-probe.txt`). It is no model session, and it is the evidence task 9 asks for.
- **V8** The battery cannot be fully green on this Mac (41 `pwsh` tests); "the full battery passes" is read as: the same failing set as the base here, and green in CI, which has `pwsh`.
- **V9** The commits after `391be57` were rewritten before any push, to remove the account name (a branch this batch created; nothing had left the machine). Earlier, the first data commit was reset and redone to separate it from the baseline, whose first capture was wrong (exit 127, a zsh word-splitting slip). So history cannot show the hypothesis came before the first edit; it was the first file written.
- **V10** The charter says no `gh` on this Mac; it is at `/opt/homebrew/bin/gh`, signed in, and is what opened the pull request.
- **V11** A session's Read tool is not limited to the repository or to one customer (`--allowedTools Read`, unscoped), so it may be able to read another customer's folder from an earlier run; not tried, and the data is fictional. T6's session read `progress.md`, which held this batch's hypothesis, as CLAUDE.md tells a session to (`claims.txt`), and could read `scripts/demo/customers/tickets.json`; its answer says it chose not to. For the owner in the report.

## CI

Pull request #11, at `b934b4e`: CI run 41983611059, https://github.com/qFermions/Aegis/actions/runs/41983611059: `verify` pass (`node --test` 1945 tests, 1945 pass, 0 fail, 0 skipped, with `pwsh`), `evals` pass (with "Customer Desk dry run": exit 4), `risk-tier` pass, `detect` pass. Release gate run 41983610947: Ubuntu and Windows pass. The final push re-runs them; the report gives that result.
