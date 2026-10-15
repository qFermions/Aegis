# G1 acceptance checks — Google Workspace / Okta / Jamf lane

One row per acceptance check in Phases 1–4 of the batch instruction, plus the
done conditions in its section 1 and the rules in its section 4. Verdicts are
**pass**, **fail** or **unresolved**. Evidence is a file path with line, a source
link that was opened, or an exact command with its output. The final-battery
outputs are the `battery-*.txt` files in this folder (section 5.3 of the
instruction); `phase1-red-green.md` holds the Phase 1 baseline, red and green
runs; `phase2-gws-eval-red.txt` holds the Phase 2 expected-red run.

Branch claude/aegis-google-okta-jamf-wibzp6, base `0febaa9`, draft PR
qFermions/Aegis#2. Checked 2026-10-15.

**Counts:** 77 rows — 75 pass, 1 fail (F9, a reported deviation), 1 unresolved (E9, a structural check conflict).
Six fresh-context reviews rejected earlier states of this branch; their findings and the commits that answer them are in section H.

## A. Done conditions (instruction §1)

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| A1 | The safety-gate test sees every gam, gcloud, Okta API, jamf and macOS mutation line in a fence and requires a same-fence SAFETY GATE | pass | `scripts/command-safety-gates.test.js:208` (`CLI_COMMAND_START`: line start or a copied prompt, macOS zsh, versioned-shell, venv and Windows forms included, `SHELL_PROMPT` `:207`, separators, `$(`, backtick, `do`/`then`/`else`/`elif`/`if`/`while`/`until`, `! `), `:198`–`:199` (wrapper group, wrappers also by path, `arch`), `:209` (`CLI_BOUNDARY`: quoted or escaped tool name; `.exe` in `cliInvocations`), `:221` (`INDIRECT_EXEC`: interpreter one-liners, `at`/`batch`/`crontab`, `sudo -s`/`-i`, shells, ssh, substitutions), `:242`–`:248` (`HTTP_METHOD_WRITE`: any explicit method other than GET/HEAD/OPTIONS/TRACE, or one from `$VAR`/`${…}`/`$(…)`; glued short values), `:273` (`G1_CLI_SINKS`), `:151` (comment stripper: bash boundary and backslash escape in shell fences), `:370` (`mutationHits` joins continued lines), `:13` (console and shell-session fences scanned as shell); tests `:2089` (189 mutation forms × 5 fence languages), `:2100` (58 read-only forms), `:2189` (fixtures), `:2368` (bash comment boundaries, continued lines, console transcripts, sibling-fence gate variables and shadowing); `battery-node-test.txt` | WARDEN pass 1 **fail** (wrapped and indirect forms) → `3cff27f`; pass 2 **fail** (glued `#`, continued lines, keyword starts, more indirect shapes) → `0f0cd25`; pass 3 **fail** (`${#var}`/`{#`/`}#` hid a sink; `-X "${METHOD}"` not a write; path-prefixed wrappers; interpreter one-liners, `at`, `sudo -s`, `arch`, quoted names) → `8398b4a`, `e53e7f8`, `6fac100`, `d4b310f`; pass 4 **fail** (prompt-prefixed lines and console transcripts; `.exe`, glued curl values, lowercase short method) → `b59ea52`, `41fdf76`; pass 5 **fail** (more prompt shapes; methods other than DELETE/POST/PUT/PATCH) → `53b5fd7`, `a50f74b`; pass 6 minors (two more prompts; native sinks behind a wrapper; a `#` inside backticks; `-XGET` read as a write) → `4106cd0`, `241f7f9`, `b7f1706`, `b38c300`. Remaining limits stated in `docs/security/COMMAND_RISK_METADATA.md` |
| A2 | The structure lint holds G1 runbooks to the Microsoft contract (exact breadcrumb first, CLI collapsed and commented, one checklist, one note, fresh paths) | pass | `scripts/lint/command-structure.js:89` (G1 roots), `:120` (`STALE_PORTAL_PATHS_G1`), `:333` (`cli-collapsed`); suite `scripts/lint/command-structure.test.js:182`–`:345`; `battery-lint.txt`: "77 commands … clean" | — |
| A3 | Tier guard and graph engine floor the Google-shaped consequential wordings | pass | `scripts/tier/tier-guard.js:59`–`:73`, `scripts/graph/engine.js:39`–`:52`; tests `scripts/tier/tier-routing.test.js:258` (floor), `:270` (routine stays clean), `:278` (folding) | — |
| A4 | The scanner blocks Google, Okta and Jamf secret formats | pass | `scripts/pre-commit-check.js:168`–`:174`; one test per format `scripts/pre-commit-check.test.js:603`–`:658` | — |
| A5 | Google corpus ≥ 28 tickets and ≥ 6 dangerous pairs passes `gws-ticket-eval.js`, wired into `node --test` | pass | `battery-gws-ticket-eval.txt`: "38/38 tickets · 9/9 dangerous pairs · 16 floored to T3"; `scripts/eval/gws-ticket-eval.test.js` runs in `battery-node-test.txt` | — |
| A6 | The 19 Phase 3 runbooks pass lint, eval and the safety-gate test | pass | `battery-lint.txt` (A:36 B:19, clean), `battery-gws-ticket-eval.txt` (every route resolves), `battery-node-test.txt` (one per-gate test per gate in the 19 files, all ok) | — |
| A7 | `docs/gws-reversibility.md` and `docs/portal-nav-google-2026.md` exist with a citation URL and a check date on every row | pass | `grep -E '^\| ' docs/gws-reversibility.md \| grep -v 2026-10-15` → 0 of 41 rows; `grep -E '^- ' docs/portal-nav-google-2026.md \| grep -v 'checked 2026-10-15'` → no lines | — |
| A8 | The claim ledger says exactly what is proven and what is pending | pass | `docs/evidence/claim-ledger.md:29` (row "Microsoft and Google coverage"), G1 section `:44`–`:56` (PROVEN rows by named script; the two gate rows read "PROVEN (documented grammar)" — the gate row adds "bash" — and list the limits that remain, including what the harness does not execute; PENDING: lab excerpts, rubric run) | WARDEN passes 1–5 **fail** — the gate rows claimed more than the gates proved at the time (pass 4: the sibling-shadowing sentence; a test count read from a battery file that predated it; pass 5: "any command position" while quoted names, a case label and code-bearing sibling comments still passed; pass 6: "a quoted or escaped name" and "no other fence naming the gate variables" while locale/ANSI-C quoting, brace expansion and split names still passed). Reworded after each round of fixes (`ea660b4`, `8b4cd7d`, `e1ffc7d`, `6d151e6`, `07a5bfc`, and the pass-6 docs commit, which names the residual limit) |
| A9 | `node --test`, the lint, both evals, `pre-commit-check --all` and `release-boundary-check` are green | pass | the final battery, run at the commit just before the evidence commit that saves it (see G3): `battery-node-test.txt` (490 pass, 0 fail), `battery-lint.txt`, `battery-ms-ticket-eval.txt` (28/28 · 6/6), `battery-gws-ticket-eval.txt` (38/38 · 9/9), `battery-pre-commit-check.txt` (exit 0, 0 BLOCK), `battery-release-boundary-check.txt` (PASS) | WARDEN pass 4 **fail**: the saved battery predated the pass-3 code commits while this row cited 490 → re-run and re-saved after the last code commit |
| A10 | One draft pull request to main is open | pass | qFermions/Aegis#2 — `state: open`, `draft: true`, base `main` (GitHub API `pull_request_read get`, 2026-10-15) | — |

## B. Phase 1 — the gates see the new lane

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| B1 | 1.1 gam create/update/delete/undelete/suspend/unsuspend/transfer/move/add/remove/revoke/wipe/deprovision/action; gcloud create/update/delete/set/add- and remove-iam-policy-binding; curl/wget/http(s) with a write method or body; jamf policy/recon/manage/removeFramework/enroll; profiles install/remove/renew/-I/-R; dscl -create/-delete/-append/-change/-passwd; fdesetup enable/disable/add/remove/changerecovery; diskutil with erase, apfs delete or partition; softwareupdate -i/--install; networksetup -set; systemsetup -set; defaults write; launchctl load/unload/bootstrap/bootout; kickstart — all count as mutations | pass | `scripts/command-safety-gates.test.js:2089` — every listed form in every shell fence language is a sink (red on main: all 73 original forms → `[]`, `phase1-red-green.md` §1.1); 116 wrapped, keyword-started, indirect, quoted, prompt-prefixed, method and native-behind-wrapper forms added across six reviews (189 in all) | WARDEN pass 1 and pass 2 **fail** (same gaps as A1) → `3cff27f`, `0f0cd25` |
| B2 | 1.1 `gam print/info/report/show/whatis` stay read-only | pass | `scripts/command-safety-gates.test.js:2100` (58 read-only forms are not sinks, incl. wrapped reads, a read inside a loop or condition, a quoted phrase naming a tool, a shebang comment, `\| python3 -m json.tool`, `crontab -l`, the PowerShell error-anatomy line `At <script …>`, a prompt-prefixed `$ gam info`, `gam.exe info`, `curl -o … -w …`, `-X HEAD`, `--request OPTIONS`, `http HEAD`, `-XGET`, `-sXOPTIONS`) | — |
| B3 | 1.1 `COMMAND_AT_BOUNDARY` behaviour for PowerShell untouched | pass | `git diff 0febaa9 -- scripts/command-safety-gates.test.js \| grep COMMAND_AT_BOUNDARY` → one context line, no `+`/`-` line | — |
| B4 | 1.1 shell confirmation logic is explicit and fail-closed, plain-text grammar, no pwsh | pass | `analyzeShellGate` `scripts/command-safety-gates.test.js:1110` (read inside the canonical comparison `SHELL_GATE_IF_LINE` `:1030`; inert own-line comments `SHELL_COMMENT_UNSAFE` `:1032`, no trailing comments; else exits 1–255 `SHELL_ELSE_EXIT_LINE` `:1035`; only comments before the marker; strict pre-comparison grammar `SHELL_PROMPT_LINE` `:1038`; shadowing rows `SHELL_SHADOWING` `:1072` in every shell command position `SHELL_COMMAND_POSITION` `:1046`, also on readings with ANSI-C escapes decoded and quotes and backslashes removed `unquotedShellWords` `:1060` and with brace expansions reduced to their first alternative (`shellReadings` `:1067`), on every line of the fence); `gateVariablesOutsideGates` `:2113` and `gateShadowingOutsideGates` `:2133` (sibling fences, read as bash reads them and with `#` as a plain word); `SHELL_ENGINES = ['bash']` `:1232`; 67 bypass shapes rejected `:2202`; the harness `:1237` runs the fence's own lines as a script, with `#` quoted as a plain word, and fed on stdin, proven by `:2326`; document-level tests `:2432`, `:2441` | WARDEN pass 1 **fail** (blocker: post-read overwrites; synthesized harness) → `3f281bc`; pass 2 **fail** (blocker: a glued `#` hid a pre-marker `readonly confirmation=…`) → `0f0cd25`; pass 3 **fail** (blocker: trailing comments opened every gate where `#` is not a comment — stock interactive zsh; plus a standalone `read` that took the next pasted line, found while fixing it; sibling-fence shadowing of `[`/`read`) → `06ddcc4`, `4a9e460`; pass 4 **fail** (shadowing behind a brace group, keyword, wrapper or backslash, and after `fi` in a gated fence; `exit 256`) → `097f603`, `1a2ae4e`; pass 5 **fail** (quoted or escaped names, a case label, a sibling comment that is code where `#` is a plain word) → `9255f51`; pass 6 **fail** (locale and ANSI-C quoting, escapes, brace expansion, quote-split gate-variable names) → `59e8713`, with the residual limit stated |
| B5 | 1.1 two committed fixtures: GAM fence without a marker fails; same fence with a correct marker passes | pass | `scripts/fixtures/command-safety-gates/gam-fence-no-marker.md.txt`, `gam-fence-gated.md.txt` (only comments precede its marker); test `:2189` | — |
| B6 | 1.1 inventory regenerated the way the test expects; risk metadata updated for the family | pass | `AEGIS_PRINT_STATE_CHANGE_INVENTORY=1 node scripts/command-safety-gates.test.js > docs/security/STATE_CHANGE_INVENTORY.json`; test "checked-in state-change inventory exactly matches" `:1302` ok; `docs/security/COMMAND_RISK_METADATA.md` G1 section | — |
| B7 | 1.2 `BREADCRUMB_ROOT` explicit allowlist (admin.google.com, Admin console, Okta Admin Console, Okta, Jamf Pro, Jamf, Apple Business Manager, Fleet, System Settings, Self Service, Finder, Terminal, Zoom Rooms, Zoom admin) | pass | `scripts/lint/command-structure.js:89` (also accepts the current name "Apple Business"); test `scripts/lint/command-structure.test.js:187` | — |
| B8 | 1.2 `cli-collapsed`, `cli-commented`, `gui-before-cli` for bash/sh/shell/zsh fences running the listed CLIs; read-only diagnostics need the comment but may sit outside `<details>` | pass | `scripts/lint/command-structure.js:333` (`cli-collapsed`) and neighbours (`CLI_WRAPPER_PATH`/`CLI_WRAPPER` `:180`–`:181`, `CLI_INDIRECT` `:182`, `SHELL_PROMPT` `:187` and `CLI_COMMAND_START` `:188` apply the detector's wrapper, indirect, prompt (all pass-5 shapes), `.exe` and quoted-name rules; its comment rule `shellCode` `:209` is stricter than the detector's — a `#` only after whitespace — so it sees at least what the detector sees; `segmentsOf` `:329` splits on `;`, `&&`, `\|\|`, `\|`, a background `&`); tests `command-structure.test.js:200`, `:216` (wrapped/indirect, path-prefixed wrappers, interpreter one-liners, `at`, `sudo -i`, `arch`, quoted names, prompts, `.exe`), `:262` (chained commands), `:275` (continued write), `:281`, `:294`; extra rules `cli-human-run` `scripts/lint/command-structure.js:334`, `cli-in-shell-fence` `scripts/lint/command-structure.js:279`–`:286` (console transcripts included, test `command-structure.test.js:304`) | WARDEN pass 1 and pass 2 (minor): wrapper and chaining gaps → `3cff27f`, `b40e743`, `b7b082d`; pass 3 ("mirror" overstated; N-4/N-6 shapes) → `6fac100`, `d4b310f`, wording here; pass 4 (stale citations; prompt and `.exe` shapes) → `b59ea52`, `41fdf76`, citations re-pointed; pass 5 (more prompt shapes; the lint shares them) → `53b5fd7`; pass 6 (two more prompts) → `4106cd0` |
| B9 | 1.2 `STALE_PORTAL_PATHS` Google table with at least the five named retired paths, each citing the current page and the check date; 2SV direction decided from the live page | pass | `scripts/lint/command-structure.js:120`–`:128` (8 entries, `source` + `checked: '2026-10-15'` each); test `command-structure.test.js:315`; direction fix `5ec5472` (top-level `Security → 2-step verification` is retired; the per-user path is current) | WARDEN pass 5 (P5-4): citations had kept `82cded8` line numbers → re-pointed |
| B10 | 1.2 `FRESHNESS_DOCS` gains the three G1 docs | pass | `scripts/lint/command-structure.js:373`; test `command-structure.test.js:345` | WARDEN pass 5 (P5-4): citations had kept `82cded8` line numbers → re-pointed |
| B11 | 1.2 every Phase 3 command classified in `VARIANTS` | pass | `scripts/lint/command-structure.js:56`; test `command-structure.test.js:338`; `battery-lint.txt` "(B:19 E:6 D:3 C:11 A:36 ALIAS:2)" | WARDEN pass 5 (P5-4): citations had kept `82cded8` line numbers → re-pointed |
| B12 | 1.2 tests per new rule: a failing fixture, a passing fixture, the stale-path table | pass | `scripts/lint/command-structure.test.js:182`–`:345` (28/28 in `battery-node-test.txt`) | WARDEN pass 5 (P5-4): citations had kept `82cded8` line numbers → re-pointed |
| B13 | 1.3 patterns for transfer, deprovision, powerwash, account/work profile off a device, OAuth/app-password/token revocation, admin-role grants, Vault/litigation hold/retention, Okta deactivate/deprovision/delete/clear sessions/reset all factors, Jamf erase/lock/lost mode/remove MDM profile/unmanage | pass | `scripts/tier/tier-guard.js:64`–`:73`; one floored ticket per pattern `scripts/tier/tier-routing.test.js:258` (G1_FLOORS) | — |
| B14 | 1.3 `scripts/graph/engine.js` `SR2_TRIGGER_PATTERNS` kept in sync | pass | `scripts/graph/engine.js:43`–`:52`; the same G1 test asserts both floor (`tier-routing.test.js:258`) | WARDEN pass 1: pass with a caveat — in sync on the tested set, not regex-identical (the engine keeps its `.*` style, a superset of the guard's `[^.]*`). Documented in both files (`931a2b8`) |
| B15 | 1.3 routine counterparts (reset backup codes, add to group, move one OU, assign one licence, enroll one Mac) stay clean; folding test runs on the new patterns | pass | `scripts/tier/tier-routing.test.js:270`, `:278` | — |
| B16 | 1.4 one test per credential pattern, temp-repo style, synthetic values, redacted output asserted | pass | `scripts/pre-commit-check.test.js:603`, `:608`, `:632`, `:637`, `:643`, `:648`, `:653`, `:658` (each asserts the value and the line are absent from output) | — |
| B17 | 1.5 tokens added by the dictionary's own process; existing tokens reused; no parallel set | pass | `modules/security/placeholder-dictionary.md:31`–`:33` (org tokens), `:48`–`:52` (generic tokens); `scripts/repository-structure.test.js:141` (every used `[@Aegion_*]` is defined) | the candidate @-shaped group token became `[GROUP_EMAIL]` (an @-form BLOCKs in the scanner; no exemption widened); `[BACKUP_CODE]` not added (no runbook prints a code) |
| B18 | Phase 1 acceptance: `node --test` green including the pwsh tests; lint 58 clean; MS eval 28/28 · 6/6; scanner exit 0; red and green quoted | pass | `phase1-red-green.md` (baseline 346/346 → 375/375 with PowerShell 7.4.6 installed; every red then green run) | — |

## C. Phase 2 — the Google corpus

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| C1 | 2.1 same schema as `ms-tickets.json`; ≥ 28 tickets; all four classes; ≥ 7 `expectFloor: "T3"`; placeholder-only text passing `sanitizationHits` | pass | `scripts/eval/gws-tickets.json` (38 tickets: QUICK_FIX 7, DIAGNOSTIC 11, PROCEDURE 18, REFERENCE 2; 16 T3); test `scripts/eval/gws-ticket-eval.test.js:25` (shape, classes, sanitization) | — |
| C2 | 2.1 duties covered: users/groups G01 G05 G06 · OUs G07 · app assignment G25 · licensing G08 G09 · audit logs G15 G16 G38 · 2SV G03 G04 · Drive sharing/ownership G10 G15 · Gmail G17 G18 · ChromeOS G19–G21 · Okta password/MFA/app G22 G24 G25 · Jamf enroll/lock/erase G26 G28 G29 · Zoom Room G30 · new-hire laptop G31 · macOS login G32 · FileVault G33 · Wi-Fi G34 · profile G35 · urgency probe G36 · compromise G37 | pass | `scripts/eval/gws-tickets.json` ids above; the probe and compromise rows are asserted in `gws-ticket-eval.test.js:25` | — |
| C3 | 2.1 no company, employer or customer name in any ticket | pass | `git diff 0febaa9 -U0 \| grep -E '^\+' \| grep -cE 'Inc\.\|LLC\|Ltd\|Corp\.\|GmbH\|Contoso\|Fabrikam\|Northwind\|Acme'` → 0; corpus uses `[@Aegion]` and dictionary tokens only | — |
| C4 | 2.2 ≥ 6 Google-shaped pairs incl. the six named; `floorsMustDiffer` from doctrine, ≥ 3 true; every pair differs on exact and shape key | pass | 9 pairs (G12/G13, G10/G11, G03/G04, G20/G21, G22/G23, G28/G29 + G05/G06, G08/G09, G26/G27); 5 true; key checks in `scripts/eval/ticket-eval-core.js`; `battery-gws-ticket-eval.txt` "9/9 dangerous pairs" | — |
| C5 | 2.3 eval + test built like the Microsoft pair; test pins corpus shape, the must-exercise list and the mutation case | pass | `scripts/eval/gws-ticket-eval.test.js:17` (MUST_EXERCISE, all 19), `:43`, `:54` (mutated expectation, dangling route, colliding pair) | — |
| C6 | 2.3 one shared evaluate module; no copy-paste; README gains the Google half | pass | `scripts/eval/ticket-eval-core.js`; test `gws-ticket-eval.test.js:73`; MS output byte-identical before/after (`phase1-red-green.md` Phase 2 note); `scripts/eval/README.md` §2b | — |
| C7 | Phase 2 acceptance: eval runs; pairs pass; every ticket fails only on "route /x does not exist" | pass | `phase2-gws-eval-red.txt`: "0/38 tickets · 9/9 dangerous pairs"; 40 problem lines, all `route … does not exist` (`grep -E '^\s+!' … \| grep -vc 'does not exist'` → 0) | — |

## D. Phase 3 — the 19 runbooks

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| D1 | All 19 exist (16 variant A, 3 variant B) | pass | `git diff --name-status 0febaa9 -- .claude/commands` → 19 `A`, 0 `M`; `battery-lint.txt` | — |
| D2 | Frontmatter; exact breadcrumb first, one click per arrow; phased steps; WAIT-UNTIL where a sync or push is involved | pass | lint rules `gui-steps-present`, `gui-before-cli`, `variant-mapped` in `battery-lint.txt`; WAIT UNTIL present in 17 of 19 (the two without, `gws-audit-log` and `gws-group-membership`, have no sync hand-off) | — |
| D3 | Scale version in a collapsed `<details>` with a GAM / Okta API / Jamf API / Terminal fence, a plain-English comment on every line, HUMAN-RUN label | pass | lint `cli-collapsed`, `cli-commented`, `cli-human-run`, `cli-in-shell-fence` clean on all 19 (`battery-lint.txt`) | — |
| D4 | `## ⚠️ Risk warning` on every variant B command and every variant A command with an R2/R3 step | pass | present in all 19 (`grep -c '^## ⚠️ Risk warning'` = 1 each) | — |
| D5 | Exactly one `## ✅ Verification checklist` (R0 read-backs) and one `## 📝 Jira-ready note` | pass | lint `one-final-checklist`, `paste-ready-note`, `checklist-before-note` clean (`battery-lint.txt`) | — |
| D6 | Every fence mutation and every portal mutation carries the SAFETY GATE grammar | pass | `battery-node-test.txt`: every G1 shell gate "explicit, dominates its sinks, and is fail-closed" and every G1 portal gate "action-local and fail-closed"; "every discovered manual portal mutation has one action-local gate or preview owner" ok | Portal grammar widened in `140abfb` (Apple Business, ChromeOS selected-devices controls) and `0f4b90e` (bare "Click **Action**" steps in G1 runbooks); every new candidate was already owned. Disclosure (WARDEN pass 3, N-8): the inventory changed one non-G1 entry in the batch — the README preview region `readme-hook-install` now records the `redirect-write` sink it owns, after the README line was fixed (`f414d0e`, `phase1-red-green.md`) |
| D7 | Trailing Sources line with URL and check date in each runbook | pass | `grep -c '^\*\*Sources (checked 2026-10-15):\*\*'` = 1 in each of the 19 | — |
| D8 | Okta first: `gws-offboard` and `okta-user-lifecycle` start in Okta and say what Okta provisioning does to the Google account, with `[org gap]` where unknown | pass | `.claude/commands/gws-offboard.md:24`, `:30`, `:36`; `.claude/commands/okta-user-lifecycle.md:55`–`:58` | — |
| D9 | OUs carry policy: `gws-ou-move` is a policy change | pass | `.claude/commands/gws-ou-move.md:16` | — |
| D10 | 2SV is not MFA; backup codes, security keys and passkeys are separate factors | pass | `.claude/commands/gws-2sv-reset.md:17`, `:27`–`:31` | — |
| D11 | Context-Aware Access is not Conditional Access | pass | `.claude/commands/gws-2sv-reset.md:33` (sources: knowledge.workspace.google.com/admin/security/about-context-aware-access, …/deploy-context-aware-access, checked 2026-10-15) | Added in `feda446` — no runbook stated it before |
| D12 | Suspend is R1 with the undo stated in the same step | pass | `.claude/commands/gws-offboard.md:71` (suspend gate Reversibility: undo path in the same place) | — |
| D13 | Delete is R3 with the restore window from the vendor page | pass | `.claude/commands/gws-offboard.md:127` (20 days; source knowledge.workspace.google.com/admin/users/restore-a-recently-deleted-user, checked 2026-10-15) | — |
| D14 | Drive ownership transfer is R2 with pre-state (owner, shared-item count) captured first | pass | `.claude/commands/gws-drive-transfer.md:16`, `:38` | — |
| D15 | Powerwash and deprovision are two different R3 actions with different undo stories | pass | `.claude/commands/gws-chromeos-device.md:16`–`:17`; separate gates `gws-chromeos-device-powerwash-portal`, `gws-chromeos-device-deprovision-portal` | — |
| D16 | Jamf remote lock is reversible with the PIN; erase is not | pass | `.claude/commands/jamf-lock-erase.md:16`; Lock is R2 in the runbook and the table (the PIN is pre-state) | WARDEN pass 1: Lock was R1 in the runbook, R2 in the table — aligned in `ff12c02` |
| D17 | `mac-new-hire-laptop`: Apple Business → ADE → Jamf PreStage → first boot → Okta → Google, a WAIT-UNTIL at each hand-off | pass | `.claude/commands/mac-new-hire-laptop.md:39`–`:43` (fast path), phase bodies `:51`–`:133` | — |
| D18 | `gws-audit-log` teaches Admin, User and Drive log events as a read-only procedure | pass | `.claude/commands/gws-audit-log.md:16`, `:18`, `:23` | — |
| D19 | Phase 3 acceptance: lint 77 clean; gws eval all pass; MS eval 28/28; `node --test` green incl. the 19 files; scanner exit 0, no new BLOCK, no new WARN beyond the documented dangerous-verb WARNs | pass | `battery-lint.txt`, `battery-gws-ticket-eval.txt`, `battery-ms-ticket-eval.txt`, `battery-node-test.txt`, `battery-pre-commit-check.txt`: 0 BLOCK; WARN 143 → 170 — all 27 new WARNs carry a G1 dangerous-verb label (23 on gated command lines, 3 on prose naming the command, 1 in the reversibility table) | Two false-positive WARN patterns fixed first (`523fe62`, `f1a4064`) |

## E. Phase 4 — the knowledge docs

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| E1 | 4.1 one row per listed action across Google, Okta and Jamf with action · R-class + reason · undo · window · URL · check date; blocked pages say `[unverified: fetch blocked]` | pass | `docs/gws-reversibility.md` (41 rows; all 29 listed actions present); no page was fetch-blocked for a row (`:9`); every G1 gate's Reversibility field leads with the same class as the table | WARDEN pass 1 **fail** — five actions had different classes in the table and the runbooks; set from the doctrine in both, and the 22 gates that named no class now do (`ff12c02`). Pass 2: one field did not lead with its class (`d582bc7`) |
| E2 | 4.2 nav doc for admin.google.com, Okta Admin Console, Jamf Pro, Apple Business Manager, Fleet, macOS System Settings; same layout; URL + date per path | pass | `docs/portal-nav-google-2026.md:21`, `:52`, `:60`, `:72`, `:83`, `:91`, `:96`, `:106` (also ChromeOS and Zoom Rooms) | — |
| E3 | 4.2 pointer line in `docs/portal-nav-2026.md` | pass | `docs/portal-nav-2026.md:8` | — |
| E4 | 4.3 `docs/evidence/gws/README.md`: log event per runbook, sanitizing, `evidence-<command>-<yyyy-mm-dd>.md`, no lab domain | pass | `docs/evidence/gws/README.md:9`–`:68` | The folder also holds this batch's evidence (this file, red/green, battery), as sections 5.1 and 5.3 require |
| E5 | 4.4 ledger: Google rows PROVEN by a named script or PENDING with what is missing; "Microsoft and Google coverage" says exactly what is proven and pending | pass | `docs/evidence/claim-ledger.md:29`, `:44`–`:56` | WARDEN pass 3 **fail** (the two gate rows omitted the pass-3 limits and the shell dependency) → reworded in `e1ffc7d`; pass 4 **fail** (the sibling-shadowing sentence overclaimed; 490 cited from a 489-test battery file) → `6d151e6` and the re-saved battery; pass 5 **fail** (the gate row's "any command position" overclaimed) → `07a5bfc`; pass 6 **fail** ("a quoted or escaped name" overclaimed) → the pass-6 docs commit |
| E6 | 4.4 README scope note and badge counts | pass | `README.md:16`–`:17` (Runbooks 77, ticket eval 28+38, lint 77) | — |
| E7 | 4.4 `PRODUCT_CONTRACT.md` unchanged (no sentence became false) | pass | `git diff --stat 0febaa9 -- PRODUCT_CONTRACT.md` → empty; `PRODUCT_CONTRACT.md:16` already names Google | — |
| E8 | 4.4 CHANGELOG v8.9; PROJECT_STATE version line | pass | `CHANGELOG.md:5`; `PROJECT_STATE.md:10` | — |
| E9 | 4.4 `tasks/continuity.md` refreshed so `check-continuity.js` passes | unresolved | `battery-check-continuity.txt`: "RESULT: PASS" — run at the commit just before the evidence commit, with the refreshed snapshot (bound to that commit) in the working tree | Check conflict, reported rather than worked around: the snapshot binds `HEAD: <sha>` and no commit can contain its own hash, so at the branch head the checker reports STALE (exit 2) by one commit — the evidence commit that adds the snapshot and the battery files. WARDEN pass 4 found the snapshot nine commits behind; it was re-bound after the last change. Changing the checker would rewrite an existing check; left unchanged (decision for the user) |
| E10 | 4.4 tier cards point at the nav doc and the runbook prefixes; every marker the tier suite asserts kept | pass | `.claude/agents/tier1-support.md:45`, `.claude/agents/tier2-support.md:55`; tier suite green in `battery-node-test.txt` | — |
| E11 | `CLAUDE.md` not edited | pass | `git diff --stat 0febaa9 -- CLAUDE.md` → empty | — |

## F. Rules (instruction §4)

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| F1 | No existing test, check, threshold or lint rule weakened, skipped or rewritten | pass | the 8 removed lines in `scripts/command-safety-gates.test.js` are each replaced by an extended form (marker kinds, vocabulary, portal conditions, inventory scope string); the comment stripper became stricter (bash word boundary in shell fences, PowerShell's own rule kept), never looser; `git diff 0febaa9 -- scripts/graph/engine.js` 14 insertions, 0 deletions; the G1 bypass and harness tests were written in this batch and re-expressed for the pass-3 gate grammar with every earlier case kept | Deviation reported: the exact count pin `scripts/repository-structure.test.js:27` moved 58 → 77 (still `strictEqual`), because 19 commands were added. Disclosures (WARDEN pass 3, N-8): the tier guard's `joinInTokenDots` changes `assess()` matching for every pattern, additively (`scripts/tier/tier-guard.js:88`, own test in `tier-routing.test.js`, CHANGELOG); the dictionary gained the non-G1 org tokens `[@Aegion_SITE_COUNT]`, `[@Aegion_DOMAIN_SP]` and `[@Aegion_DOMAIN_SHORT]` that were in use but undefined (`phase1-red-green.md` §1.5, own test) |
| F2 | The 58 Microsoft runbooks unchanged | pass | `git diff --name-status 0febaa9 -- .claude/commands \| grep -v '^A'` → empty | — |
| F3 | Replay and memory engines unchanged; graph engine behaviour unchanged (pattern additions only) | pass | `git diff --stat 0febaa9 -- scripts/replay scripts/memory` → empty; engine diff additions only; graph suite green | — |
| F4 | Placeholders only; the decoy `aegion.example.org` the only domain literal, where the dictionary allows it | pass | `battery-pre-commit-check.txt`: 0 BLOCK; domain literals in added lines are vendor documentation hosts and `toolbox.googleapps.com` | Two fixtures carried an example-domain hostname other than the decoy; replaced with `[@Aegion_DOMAIN]` (`b9a4f53`). `AEGION_DOMAIN` is not set in this session, so the configured-literal half of SR-8 was not exercised here; CI runs it where the variable is set |
| F5 | Zero npm dependencies; `package.json` absent | pass | `ls package.json` → "No such file or directory" | — |
| F6 | Markdown links in new docs pass `scripts/markdown-links.test.js` | pass | `battery-node-test.txt` (2/2) | — |
| F7 | No company, employer, client or customer name in the tree, corpus, fixtures, commit messages or PR | pass | row C3 grep on added lines → 0; `git log 0febaa9..HEAD --format=%B \| grep -cE '(same pattern)'` → 0; PR body reviewed | — |
| F8 | No new gate depends on pwsh | pass | the shell analyzer and its harness use bash only (`scripts/command-safety-gates.test.js:1232`); lint, tier, scanner and eval changes are pure Node | — |
| F9 | Phase 1: push the branch `g1-google-lane` | fail | the work is on `claude/aegis-google-okta-jamf-wibzp6`, the branch this cloud session was assigned (its instructions forbid pushing any other branch without explicit permission); claim id `g1-google-lane` | Deviation reported (WARDEN pass 1, minor); renaming means pushing a new branch and opening a new PR — a decision for the user |

## G. Phase 5 — review and evidence

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| G1 | 5.1 this table: one row per acceptance check, with requirement, verdict, evidence and correction | pass | this file | — |
| G2 | 5.2 WARDEN fresh-context review on the spec, the diff vs `0febaa9`, this table and the saved outputs; corrections applied; verdict recorded | pass | section H: passes 1–6 REJECT (pass 1: 1 blocker, 2 major, 7 minor; pass 2: 1 blocker, 2 major, 4 minor; pass 3: 1 blocker, 2 major, 4 minor, 1 info; pass 4: 2 major, 4 minor, 1 info; pass 5: 1 major, 3 minor, 3 info; pass 6: 1 major, 3 minor, 3 info), every blocker, major and minor finding corrected in its own commit; pass 7 recorded below | — |
| G3 | 5.3 final battery saved as `battery-<name>.txt` for the eight commands | pass | `battery-node-test.txt`, `battery-lint.txt`, `battery-ms-ticket-eval.txt`, `battery-gws-ticket-eval.txt`, `battery-replay-demo.txt`, `battery-pre-commit-check.txt`, `battery-release-boundary-check.txt`, `battery-check-continuity.txt` — run after the last code and docs change, at the commit just before the evidence commit that saves them | WARDEN pass 4 **fail**: the saved files predated the pass-3 code commits → re-run and re-saved last |

## H. WARDEN review

**Pass 1 — REJECT** (fresh context; given the spec, the diff against `0febaa9`,
this table, the battery outputs and the vendor fact sheet; it re-ran the battery
at `24d5ed4` and probed in a scratch copy). Findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| W1 | blocker | The shell gate analyzer accepted post-read overwrites (`printf -v`, `mapfile`/`readarray`, a loop variable, an array element) and its harness executed a re-synthesized script, never the fence's own lines | `3f281bc`: strict pre-comparison grammar, wider forbidden set, harness runs the source lines; 10 new bypass fixtures + a harness test |
| W2 | major | The CLI detector and the lint missed wrapped (`sudo -u`, `command`, `env`, `nohup`, `time`, `nice`, `caffeinate`, `exec`, `script`, `xargs`, quoted/variable paths) and indirect (`ssh host '…'`, `sh -c`, `osascript -e`, `eval`, `"$VAR"`) invocations, and curl `--config` / method-override headers | `3cff27f`: wrapper group and fail-closed `indirect-exec` sink in the detector, mirrored in the lint; 28 new detector forms; inventory unchanged |
| W3 | major | Five actions had different R-classes in `docs/gws-reversibility.md` and the runbooks | `ff12c02`: one doctrine-derived class in both; every G1 gate now names its class |
| W4 | minor | Continuity STALE at the head | Snapshot re-bound for the final commit; the one-commit lag is structural — row E9 left **unresolved** as a reported check conflict |
| W5 | minor | Ledger rows overclaimed the two gate properties | `ea660b4`: "PROVEN (documented grammar)" with the stated limits |
| W6 | minor | Guard and engine not regex-identical | `931a2b8`: the superset relation documented in both files; no behaviour change |
| W7 | minor | The lint's read-only allowlist judged only a line's first command | `b40e743`: every `;` / `&&` / `\|\|` / `\|` segment is judged |
| W8 | minor | A bare "Click **Action**" step in a G1 runbook was not a portal candidate; indented/inline code is outside the fence grammar | `0f4b90e` for the first; the second is a stated limit in `docs/security/COMMAND_RISK_METADATA.md` |
| W9 | minor | Branch name differs from the spec | Row F9, reported as a deviation |
| W10 | minor | `/gws-offboard` read a deletion back by listing suspended users | `e475f68`: `gam print users deleted_only` |
| W11 | info | Two claims in `/gws-gmail-delivery` not found in the fetched copies (`550 5.1.1` wording; the 0.3% spam rate) | Both verified on the live pages on 2026-10-15 and already cited in its Sources line: knowledge.workspace.google.com/admin/support/troubleshooting/gmail-smtp-errors-and-codes (via support.google.com/a/answer/3726730) and support.google.com/mail/answer/81126; no change needed |

Rows WARDEN marked **fail** (A1, A8, B1, B4, E1) are pass after the corrections
above, with the review result kept in each row's correction column; E9 stays
unresolved by design.

**Pass 2 — REJECT** (fresh context on the corrected branch at `221efd0`; it
discounted the correction column and re-derived each row from the tree). W3, W6,
W8, W10 and W11 closed; W4 and W9 closed as reported; W1 and W2 not closed as
classes; W5 and W7 partially. New findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| N1 | blocker | The comment stripper cut at any unquoted `#`; bash and PowerShell need a word boundary, so `true#;readonly confirmation="PHRASE"` before a marker pre-satisfied the gate (proven in bash on empty input) and `true#;gam delete …` hid a sink | `0f0cd25`: word-boundary comment rule; only comments may precede a marker in a gated fence; 4 new bypass fixtures and the "G1 statements" test. It also exposed a pre-existing README bug (a hook-install preview line that was not commented) — fixed first in `f414d0e` |
| N2 | major | A backslash-continued write (`curl … \` / `-X DELETE …`, `http \` / `DELETE …`) was not a sink | `0f0cd25`: continued lines are judged as one statement |
| N3 | major | More shapes of the W2 family: `sudo --`, path-prefixed shells, `$(which gam)`, backtick, `${GAM:-gam}`, `\| bash`, `bash <(…)`, `su -c`, `find -exec`, keyword-started commands, `timeout`, `doas`, `env -S`, `"$@"`; the lint also missed a background `&` | `0f0cd25` (detector), `b7b082d` (lint); what remains (`tmux`, `screen`, `watch`, `parallel`, script files run by name, code outside fences) is listed as a limit in `docs/security/COMMAND_RISK_METADATA.md` |
| N4 | minor | A variable HTTP method (`-X "$METHOD"`) or an unquoted `$…` curl argument was not a write | `0f0cd25` |
| N5 | minor | A sibling fence could set a gate's variables (`readonly confirmation=…`) | `0f0cd25`: in a document with a gated shell fence, no other shell fence may name them; tested on every real document |
| N6 | minor | Stale line citations in this table | refreshed in this revision |
| N7 | minor | One gate's Reversibility field did not lead with its class | `d582bc7` |
| N8 | note | "disable the chromebook … it was stolen" does not floor in the tier guard, while remote lock and lost mode do | not changed: Chromebook disable is R1 under the doctrine (one-action undo), and the spec's 1.3 list does not name it; reported as an observation |

**Pass 3 — REJECT** (fresh context on the corrected branch at `85de285`; no
implementer reasoning; probes on a scratch copy). W1, W2, W7, N1 (as a
pre-satisfaction vector), N2, N3, N6, N7 closed; W5, N4, N5 partially. New
findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| N-1 | blocker | Every gate template line carried a trailing comment; in a shell that does not treat `#` as a comment (stock interactive macOS zsh without `interactive_comments`), `required_confirmation="…" # …` became an env-prefixed command, `read` failed, and an empty answer reached the sink. While fixing it a second hazard was proven: pasted line by line (or fed on stdin), the standalone `read` took the next pasted line and the sink ran outside the gate | `06ddcc4`: all 42 gated fences and the fixture read inside the comparison (`if IFS= read -r confirmation && [ … ]; then`); comments on their own lines with no shell metacharacters; double-quoted phrase and comma failure sentence; the analyzer enforces it and the harness runs each fence as a script, with `#` quoted, and fed on stdin (`later-fixes-red.txt`: old form reaches the sink in both modes, new form stops) |
| N-2 | major | The comment stripper's boundary class included `{` and `}`, so `${#var}`, `{#;…` and `}#;…` hid a sink | `8398b4a`: bash boundary (whitespace, `;`, `&`, `\|`, `(`, `)`, `<`, `>`) and backslash escapes in shell fences; PowerShell's rule kept |
| N-3 | major | `-X "${METHOD}"`, `--request="${METHOD}"`, `-X"${METHOD}"` were not writes | `e53e7f8`: a method from `$name`, `${…}` or `$(…)` is a write (`-X`, `--request`, `--method`, short clusters) |
| N-4 | minor | Path-prefixed wrappers (`/usr/bin/sudo`, `/usr/bin/env`, `/usr/bin/nohup`) hid the tool, in the detector and the lint | `6fac100`: `CLI_WRAPPER_PATH` before every wrapper name in both |
| N-5 | minor | A sibling fence could shadow `[` or `read` (`[ () { return 0; }`, `alias '['=true`) without naming a gate variable | `4a9e460`: sibling shell fences in a gated document are held to the gate's alias/eval/trap/declare/unset/exec/source/builtin, dot-sourcing and function rows (now any function name) plus prompt and key hooks; new document-level test |
| N-6 | minor | Interpreter one-liners, `at`, `crontab`, `sudo -s`/`-i`, `arch`, quoted or escaped tool names, and a name running into an expansion were not seen | `d4b310f`, detector and lint; aliases and quote-split spellings stated as limits |
| N-7 | minor | The ledger gate rows, `COMMAND_RISK_METADATA.md` and row B8 overclaimed | `e1ffc7d` (rows A8, B8, E5 here) |
| N-8 | info | Disclosures missing from F1 and D6 (tier-guard `joinInTokenDots`, three non-G1 dictionary tokens, the README inventory entry) | added to rows F1 and D6 |

Rows WARDEN marked **fail** (A1, A8, B4, E5) are pass after the corrections
above, with the review result kept in each row's correction column; F9 and E9
stand as reported.

**Pass 4 — REJECT** (fresh context at `82cded8`; it re-ran the battery, ran
all 43 gates in its own harness in all three modes — all fail-closed — and
probed the analyzer and detector). N-1, N-2, N-3, N-4, N-6 and N-8 closed;
N-5 and N-7 partially. New findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| P4-1 | major | The shadowing rows were anchored at the line start or after `; & \| (`, so `{ readonly … }`, `if :; then alias …; fi`, `command alias …`, `\alias …` and `{ [ () { return 0; }; }` in a sibling fence passed, and a gated fence's own lines after `fi` were not held to the sibling rule; bash proved an empty answer then reached the mocked sink | `097f603`: `SHELL_SHADOWING` is judged in every command position the detector knows and behind any wrapper or a leading backslash, on every line of a gated fence and of its sibling fences; 13 of 14 sibling shapes and 3 after-`fi` shapes were accepted before (`later-fixes-red.txt`) |
| P4-2 | major | The saved battery and the continuity snapshot predated the pass-3 code commits while rows A9, G3 and the ledger cited 490 tests; E9 said one commit where it was nine | the battery is re-run and saved last, the snapshot re-bound; A9, G3, E9 reworded |
| P4-3 | minor | `exit 256` in the else branch passed the grammar and exits 0 | `1a2ae4e`: exit status 1–255 only |
| P4-4 | minor | Prompt-prefixed lines (`$ gam …`, `user@host:~$ …`) were not sinks and console / shell-session fences were not scanned | `b59ea52`: a copied prompt starts a command in the detector and the lint; console-family fences are scanned and can never host a gate |
| P4-5 | minor | `gam.exe`/`curl.exe`, glued curl values (`-d$BODY`, `-dname=value`) and `-sXpost` were not writes | `41fdf76` |
| P4-6 | minor | Stale citations in rows A2, B5, B6, B8 | re-pointed in `6d151e6` |
| P4-7 | info | `gam print … todrive` writes a Sheet to the administrator's Drive but is read-only by the batch's own list | not changed (the spec lists `gam print` as read-only); stated in `docs/security/COMMAND_RISK_METADATA.md` |

Rows WARDEN marked **fail** (A1, A8, A9, B4, E5, G3) are pass after the
corrections above, with the review result kept in each row's correction
column; F9 and E9 stand as reported (E9 text corrected).

**Pass 5 — REJECT** (fresh context at `a4d9acd`; its re-run of the battery
matched the saved files exactly; the report was cut short by a service error
and re-sent in part). P4-2, P4-3, P4-5 and P4-7 closed; P4-1, P4-4 and P4-6
partially. New findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| P5-1 | major | The shadowing rule still passed a quoted or escaped builtin name (`'alias'`, `al\ias`), a statement after a case label's `)`, and a sibling comment line or trailing comment carrying `; readonly …` (code where `#` is a plain word); bash proved an empty answer then reached the mocked sink; the metadata listed `)` among the judged positions | `9255f51`: the rows are also tried with quotes and backslashes removed; shell command positions only (`)` added, `=` and `:` dropped); sibling fences read both as bash reads them and with `#` as a plain word; claims reworded |
| P5-2 | minor | More copied prompts were not command starts: the macOS zsh default `user@host ~ % `, `bash-5.2$ `, `sh-3.2# `, a `(venv) ` prefix, `PS C:\> `, `C:\…> ` | `53b5fd7`, detector and lint |
| P5-3 | minor | An explicit method other than DELETE/POST/PUT/PATCH (PURGE, MOVE, COPY, LOCK; HTTPie's positional) was not a write | `a50f74b`: any explicit method other than GET, HEAD, OPTIONS or TRACE is a write |
| P5-4 | minor | Rows B9–B12 kept `82cded8` line numbers | re-pointed in `07a5bfc` |
| P5-5 | info | macOS tools outside the spec list (`dseditgroup`, `sysadminctl`, `scutil --set`, `spctl`, `pmset`, `security`, `tmutil`, `installer`, `nvram`, `chflags`, `xattr`) are not sinks; no runbook fence uses one | the family is named in the limits (`docs/security/COMMAND_RISK_METADATA.md`, ledger) |
| P5-6 | info | `cli-in-shell-fence` fires on a text fence whose line starts with `http`, `https` or `defaults` as an ordinary word | not changed: skipping text fences would let a CLI hide there unseen by both the lint and the detector; the false positive is the fail-closed side and no runbook hits it |
| P5-7 | info | Row E9 is the right verdict; the base release carried the same one-commit lag | none needed |

Rows WARDEN marked **fail** (A1, A8, B4, E5) are pass after the corrections
above, with the review result kept in each row's correction column; F9 and E9
stand as reported.

**Pass 6 — REJECT** (fresh context at `653de1a`; its battery matched the saved
files exactly; every invariant intact). P5-2 to P5-7 closed; P5-1 partially.
New findings and what was done:

| # | Severity | Finding | Correction |
|---|---|---|---|
| P6-1 | major | A builtin or gate-variable name written with locale quoting (`$"readonly"`), ANSI-C escapes (`$'\x72eadonly'`, `$'\141lias'`), brace expansion (`re{adonly,}`, `a{lias,}`) or split quotes (`required_confirm""ation`) passed in a sibling fence and after `fi`; bash proved an empty answer then reached the mocked sink; the ledger and metadata claimed "a quoted or escaped name" and "no other fence naming the gate variables" | `59e8713`: every gate rule and the gate-variable rule run on three readings — as written, with ANSI-C escapes decoded and quotes, `$"` and backslashes removed, and with brace expansions reduced to their first alternative; the claims now name exactly those readings and state the residual limit (a name built by a form they do not model) |
| P6-2 | minor | The pre-Catalina macOS bash prompt `host:~ user$ ` and the oh-my-zsh `➜  ~ ` were not command starts | `4106cd0`, detector and lint |
| P6-3 | minor | Native sinks behind a wrapper (`sudo rm`, `\| sudo tee`, `sudo chmod`, `xargs rm`) were not seen (present at `0febaa9`) | `241f7f9` |
| P6-4 | minor | A `#` inside a backtick substitution was read as a comment to the end of the line, hiding what followed | `b7f1706` |
| P6-5 | info | `curl -XGET` read as a write (fail-closed false positive) | `b38c300` |
| P6-6 | info | Row F4 named a non-decoy example domain | reworded in the pass-6 docs commit |
| P6-7 | info | The evaluator left an `aegis-eval-*` directory in the temp folder on every run (inherited from `0febaa9`) | `508002f` |

Rows WARDEN marked **fail** (A8, B4, E5) are pass after the corrections
above, with the review result kept in each row's correction column; F9 and E9
stand as reported.

**Pass 7** — recorded below once the next fresh-context re-review returns.

## Vendor pages that could not be opened (none used as a source)

| URL tried | Error | What was used instead |
|---|---|---|
| https://github.com/GAM-team/GAM/wiki | HTTP 403 from the session proxy | the same wiki pages from `raw.githubusercontent.com/wiki/GAM-team/GAM/<Page>.md` (Users-Drive-File-Counts and Users-Licenses there returned 404; syntax taken from Users-Drive-Files-Display, Licenses and Users) |
| help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-delete-users.htm, usgp-reset-user-password.htm, usgp-clear-user-sessions.htm, reports/syslog.htm | HTTP 404 | usgp-deactivate-user-account.htm, usgp-reset-individual.htm, oda/device-logout.htm |
| help.okta.com/oie/en-us/content/topics/oda/dps-macos/*.htm (guessed) | HTTP 404 | oda/macos-pw-sync/about-psso.htm, troubleshoot-macos-password-sync.htm |
| developer.okta.com/docs/api/openapi/okta-management/management/tag/UserLifecycle/ | HTTP 200, JavaScript-only | the official `.md` variant of each tag page |
| learn.jamf.com/…/page/*.html | HTTP 200, app shell only | the learn.jamf.com content API |
| developer.jamf.com/jamf-pro/docs/erase-device-command-options | HTTP 404 | the post_v2-mdm-commands schema page and Apple's erase page |
| fleetdm.com/docs/using-fleet/hosts | HTTP 404 | fleetdm.com/guides/lock-wipe-hosts |
| support.apple.com/guide/business/toc | HTTP 200, JavaScript-only | the Apple Business guide pages through the welcome page's content endpoints |
| support.zoom.com (curl) | blocked; read through the rendered fetch tool instead | the same KB pages, rendered |

## Claims the runbooks mark unverified (vendor page silent, not blocked)

- `.claude/commands/gws-2sv-reset.md` Phase E — the label of the turn-off control (the page confirms the option, prints no label).
- `.claude/commands/gws-gmail-delivery.md:104` — the control that stops DKIM signing.
- `.claude/commands/gws-license-assign.md:76`, `.claude/commands/gws-ou-move.md:75` — propagation time of a manual licence assignment / an OU move.
- `.claude/commands/mac-new-hire-laptop.md:144`, `.claude/commands/mac-troubleshoot.md:130` — the `-type enrollment` filter on `profiles show`.
- `.claude/commands/mac-troubleshoot.md:44` — the no-Platform-SSO password behaviour (inferred from the absence of a documented mechanism).
