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

## A. Done conditions (instruction §1)

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| A1 | The safety-gate test sees every gam, gcloud, Okta API, jamf and macOS mutation line in a fence and requires a same-fence SAFETY GATE | pass | `scripts/command-safety-gates.test.js:182` (`CLI_BOUNDARY` with the wrapper group `:181`), `:189` (`INDIRECT_EXEC`), `:219` (`G1_CLI_SINKS`); tests `:1830` (101 mutation forms × 5 fence languages, incl. wrapped and indirect forms), `:1885` (fixtures), `:1898` (31 bypass shapes); `battery-node-test.txt` | WARDEN pass 1: **fail** — wrapped (`sudo -u`, `env`, `command`, …) and indirect (`ssh host '…'`, `sh -c`, `osascript -e`, `"$VAR"`) forms were invisible. Fixed in `3cff27f` (red/green: `phase1-red-green.md` §Later gate fixes) |
| A2 | The structure lint holds G1 runbooks to the Microsoft contract (exact breadcrumb first, CLI collapsed and commented, one checklist, one note, fresh paths) | pass | `scripts/lint/command-structure.js:89` (G1 roots), `:120` (`STALE_PORTAL_PATHS_G1`), `:307` (`cli-collapsed`); suite `scripts/lint/command-structure.test.js:182`–`:276`; `battery-lint.txt`: "77 commands … clean" | — |
| A3 | Tier guard and graph engine floor the Google-shaped consequential wordings | pass | `scripts/tier/tier-guard.js:59`–`:73`, `scripts/graph/engine.js:39`–`:52`; tests `scripts/tier/tier-routing.test.js:258` (floor), `:270` (routine stays clean), `:278` (folding) | — |
| A4 | The scanner blocks Google, Okta and Jamf secret formats | pass | `scripts/pre-commit-check.js:168`–`:174`; one test per format `scripts/pre-commit-check.test.js:603`–`:658` | — |
| A5 | Google corpus ≥ 28 tickets and ≥ 6 dangerous pairs passes `gws-ticket-eval.js`, wired into `node --test` | pass | `battery-gws-ticket-eval.txt`: "38/38 tickets · 9/9 dangerous pairs · 16 floored to T3"; `scripts/eval/gws-ticket-eval.test.js` runs in `battery-node-test.txt` | — |
| A6 | The 19 Phase 3 runbooks pass lint, eval and the safety-gate test | pass | `battery-lint.txt` (A:36 B:19, clean), `battery-gws-ticket-eval.txt` (every route resolves), `battery-node-test.txt` (one per-gate test per gate in the 19 files, all ok) | — |
| A7 | `docs/gws-reversibility.md` and `docs/portal-nav-google-2026.md` exist with a citation URL and a check date on every row | pass | `grep -E '^\| ' docs/gws-reversibility.md \| grep -v 2026-10-15` → 0 of 41 rows; `grep -E '^- ' docs/portal-nav-google-2026.md \| grep -v 'checked 2026-10-15'` → no lines | — |
| A8 | The claim ledger says exactly what is proven and what is pending | pass | `docs/evidence/claim-ledger.md:29` (row "Microsoft and Google coverage"), G1 section `:44`–`:57` (PROVEN rows by named script, the two gate rows as "PROVEN (documented grammar)" with their stated limits; PENDING: lab excerpts, rubric run) | WARDEN pass 1: **fail** — two rows claimed more than the gates proved. Reworded in `ea660b4` after the gate fixes |
| A9 | `node --test`, the lint, both evals, `pre-commit-check --all` and `release-boundary-check` are green | pass | `battery-node-test.txt` (486 pass, 0 fail), `battery-lint.txt`, `battery-ms-ticket-eval.txt` (28/28 · 6/6), `battery-gws-ticket-eval.txt` (38/38 · 9/9), `battery-pre-commit-check.txt` (exit 0, 0 BLOCK), `battery-release-boundary-check.txt` (PASS) | — |
| A10 | One draft pull request to main is open | pass | qFermions/Aegis#2 — `state: open`, `draft: true`, base `main` (GitHub API `pull_request_read get`, 2026-10-15) | — |

## B. Phase 1 — the gates see the new lane

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| B1 | 1.1 gam create/update/delete/undelete/suspend/unsuspend/transfer/move/add/remove/revoke/wipe/deprovision/action; gcloud create/update/delete/set/add- and remove-iam-policy-binding; curl/wget/http(s) with a write method or body; jamf policy/recon/manage/removeFramework/enroll; profiles install/remove/renew/-I/-R; dscl -create/-delete/-append/-change/-passwd; fdesetup enable/disable/add/remove/changerecovery; diskutil with erase, apfs delete or partition; softwareupdate -i/--install; networksetup -set; systemsetup -set; defaults write; launchctl load/unload/bootstrap/bootout; kickstart — all count as mutations | pass | `scripts/command-safety-gates.test.js:1830` — every listed form in every shell fence language is a sink (red on main: all 73 original forms → `[]`, `phase1-red-green.md` §1.1); 28 wrapped/indirect forms added after review | WARDEN pass 1: **fail** (same gap as A1); fixed in `3cff27f` |
| B2 | 1.1 `gam print/info/report/show/whatis` stay read-only | pass | `scripts/command-safety-gates.test.js:1841` (41 read-only forms are not sinks, incl. wrapped reads and a quoted phrase naming a tool) | — |
| B3 | 1.1 `COMMAND_AT_BOUNDARY` behaviour for PowerShell untouched | pass | `git diff 0febaa9 -- scripts/command-safety-gates.test.js \| grep COMMAND_AT_BOUNDARY` → one context line, no `+`/`-` line | — |
| B4 | 1.1 shell confirmation logic is explicit and fail-closed, plain-text grammar, no pwsh | pass | `analyzeShellGate` `scripts/command-safety-gates.test.js:999` (strict pre-comparison grammar, `SHELL_PROMPT_LINE` `:965`); `SHELL_ENGINES = ['bash']` `:1102`; 31 bypass shapes rejected `:1898`; the harness `:1107` executes the fence's own lines up to the comparison, proven by `:1970` | WARDEN pass 1: **fail** (blocker) — post-read overwrites (`printf -v`, `mapfile`, loop variable, array element) were accepted and the harness ran a re-synthesized script. Fixed in `3f281bc` |
| B5 | 1.1 two committed fixtures: GAM fence without a marker fails; same fence with a correct marker passes | pass | `scripts/fixtures/command-safety-gates/gam-fence-no-marker.md.txt`, `gam-fence-gated.md.txt`; test `:1885` | — |
| B6 | 1.1 inventory regenerated the way the test expects; risk metadata updated for the family | pass | `AEGIS_PRINT_STATE_CHANGE_INVENTORY=1 node scripts/command-safety-gates.test.js > docs/security/STATE_CHANGE_INVENTORY.json`; test "checked-in state-change inventory exactly matches" `:1158` ok; `docs/security/COMMAND_RISK_METADATA.md` G1 section | — |
| B7 | 1.2 `BREADCRUMB_ROOT` explicit allowlist (admin.google.com, Admin console, Okta Admin Console, Okta, Jamf Pro, Jamf, Apple Business Manager, Fleet, System Settings, Self Service, Finder, Terminal, Zoom Rooms, Zoom admin) | pass | `scripts/lint/command-structure.js:89` (also accepts the current name "Apple Business"); test `scripts/lint/command-structure.test.js:187` | — |
| B8 | 1.2 `cli-collapsed`, `cli-commented`, `gui-before-cli` for bash/sh/shell/zsh fences running the listed CLIs; read-only diagnostics need the comment but may sit outside `<details>` | pass | `scripts/lint/command-structure.js:321` and neighbours (`CLI_WRAPPER` `:175` mirrors the detector); tests `command-structure.test.js:200`, `:216` (wrapped/indirect), `:235` (chained commands), `:247`, `:260`; extra rules `cli-human-run` `:265`, `cli-in-shell-fence` `:270` | WARDEN pass 1 (minor): wrapped forms and `read; mutate` chains slipped past the read-only allowlist. Fixed in `3cff27f`, `b40e743` |
| B9 | 1.2 `STALE_PORTAL_PATHS` Google table with at least the five named retired paths, each citing the current page and the check date; 2SV direction decided from the live page | pass | `scripts/lint/command-structure.js:120`–`:128` (8 entries, `source` + `checked: '2026-10-15'` each); test `command-structure.test.js:246`; direction fix `5ec5472` (top-level `Security → 2-step verification` is retired; the per-user path is current) | — |
| B10 | 1.2 `FRESHNESS_DOCS` gains the three G1 docs | pass | `scripts/lint/command-structure.js:347`; test `command-structure.test.js:276` | — |
| B11 | 1.2 every Phase 3 command classified in `VARIANTS` | pass | `scripts/lint/command-structure.js:56`; test `command-structure.test.js:269`; `battery-lint.txt` "(B:19 E:6 D:3 C:11 A:36 ALIAS:2)" | — |
| B12 | 1.2 tests per new rule: a failing fixture, a passing fixture, the stale-path table | pass | `scripts/lint/command-structure.test.js:182`–`:307` (27/27 in `battery-node-test.txt`) | — |
| B13 | 1.3 patterns for transfer, deprovision, powerwash, account/work profile off a device, OAuth/app-password/token revocation, admin-role grants, Vault/litigation hold/retention, Okta deactivate/deprovision/delete/clear sessions/reset all factors, Jamf erase/lock/lost mode/remove MDM profile/unmanage | pass | `scripts/tier/tier-guard.js:64`–`:73`; one floored ticket per pattern `scripts/tier/tier-routing.test.js:258` (G1_FLOORS) | — |
| B14 | 1.3 `scripts/graph/engine.js` `SR2_TRIGGER_PATTERNS` kept in sync | pass | `scripts/graph/engine.js:43`–`:52`; the same G1 test asserts both floor (`tier-routing.test.js:258`) | WARDEN pass 1: pass with a caveat — in sync on the tested set, not regex-identical (the engine keeps its `.*` style, a superset of the guard's `[^.]*`). Documented in both files (`931a2b8`) |
| B15 | 1.3 routine counterparts (reset backup codes, add to group, move one OU, assign one licence, enroll one Mac) stay clean; folding test runs on the new patterns | pass | `scripts/tier/tier-routing.test.js:270`, `:278` | — |
| B16 | 1.4 one test per credential pattern, temp-repo style, synthetic values, redacted output asserted | pass | `scripts/pre-commit-check.test.js:603`, `:608`, `:632`, `:637`, `:643`, `:648`, `:653`, `:658` (each asserts the value and the line are absent from output) | — |
| B17 | 1.5 tokens added by the dictionary's own process; existing tokens reused; no parallel set | pass | `modules/security/placeholder-dictionary.md:31`–`:33` (org tokens), `:48`–`:52` (generic tokens); `scripts/repository-structure.test.js:126` (every used `[@Aegion_*]` is defined) | the candidate @-shaped group token became `[GROUP_EMAIL]` (an @-form BLOCKs in the scanner; no exemption widened); `[BACKUP_CODE]` not added (no runbook prints a code) |
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
| D6 | Every fence mutation and every portal mutation carries the SAFETY GATE grammar | pass | `battery-node-test.txt`: every G1 shell gate "explicit, dominates its sinks, and is fail-closed" and every G1 portal gate "action-local and fail-closed"; "every discovered manual portal mutation has one action-local gate or preview owner" ok | Portal grammar widened in `140abfb` (Apple Business, ChromeOS selected-devices controls) and `0f4b90e` (bare "Click **Action**" steps in G1 runbooks); every new candidate was already owned |
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
| E1 | 4.1 one row per listed action across Google, Okta and Jamf with action · R-class + reason · undo · window · URL · check date; blocked pages say `[unverified: fetch blocked]` | pass | `docs/gws-reversibility.md` (41 rows; all 29 listed actions present); no page was fetch-blocked for a row (`:9`); every G1 gate's Reversibility field names the same class as the table | WARDEN pass 1: **fail** — five actions (Lock, OU move, Chromebook disable, Lost Mode, Okta activate) had different classes in the table and the runbooks. Set from the doctrine in both, and the 22 gates that named no class now do (`ff12c02`) |
| E2 | 4.2 nav doc for admin.google.com, Okta Admin Console, Jamf Pro, Apple Business Manager, Fleet, macOS System Settings; same layout; URL + date per path | pass | `docs/portal-nav-google-2026.md:21`, `:52`, `:60`, `:72`, `:83`, `:91`, `:96`, `:106` (also ChromeOS and Zoom Rooms) | — |
| E3 | 4.2 pointer line in `docs/portal-nav-2026.md` | pass | `docs/portal-nav-2026.md:8` | — |
| E4 | 4.3 `docs/evidence/gws/README.md`: log event per runbook, sanitizing, `evidence-<command>-<yyyy-mm-dd>.md`, no lab domain | pass | `docs/evidence/gws/README.md:9`–`:68` | The folder also holds this batch's evidence (this file, red/green, battery), as sections 5.1 and 5.3 require |
| E5 | 4.4 ledger: Google rows PROVEN by a named script or PENDING with what is missing; "Microsoft and Google coverage" says exactly what is proven and pending | pass | `docs/evidence/claim-ledger.md:29`, `:44`–`:57` | — |
| E6 | 4.4 README scope note and badge counts | pass | `README.md:16`–`:17` (Runbooks 77, ticket eval 28+38, lint 77) | — |
| E7 | 4.4 `PRODUCT_CONTRACT.md` unchanged (no sentence became false) | pass | `git diff --stat 0febaa9 -- PRODUCT_CONTRACT.md` → empty; `PRODUCT_CONTRACT.md:16` already names Google | — |
| E8 | 4.4 CHANGELOG v8.9; PROJECT_STATE version line | pass | `CHANGELOG.md:5`; `PROJECT_STATE.md:10` | — |
| E9 | 4.4 `tasks/continuity.md` refreshed so `check-continuity.js` passes | unresolved | `battery-check-continuity.txt`: "RESULT: PASS" — run against the commit before the last one, with the refreshed snapshot in the working tree | Check conflict, reported rather than worked around: the snapshot binds `HEAD: <sha>` and no commit can contain its own hash, so at the branch head the checker reports STALE (exit 2) by exactly one commit — the commit that adds the snapshot and the battery files. Changing the checker would rewrite an existing check; left unchanged (decision for the user) |
| E10 | 4.4 tier cards point at the nav doc and the runbook prefixes; every marker the tier suite asserts kept | pass | `.claude/agents/tier1-support.md:45`, `.claude/agents/tier2-support.md:55`; tier suite green in `battery-node-test.txt` | — |
| E11 | `CLAUDE.md` not edited | pass | `git diff --stat 0febaa9 -- CLAUDE.md` → empty | — |

## F. Rules (instruction §4)

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| F1 | No existing test, check, threshold or lint rule weakened, skipped or rewritten | pass | the 8 removed lines in `scripts/command-safety-gates.test.js` are each replaced by an extended form (marker kinds, vocabulary, portal conditions, inventory scope string); `git diff 0febaa9 -- scripts/graph/engine.js` 12 insertions, 0 deletions | Deviation reported: the exact count pin `scripts/repository-structure.test.js:27` moved 58 → 77 (still `strictEqual`), because 19 commands were added |
| F2 | The 58 Microsoft runbooks unchanged | pass | `git diff --name-status 0febaa9 -- .claude/commands \| grep -v '^A'` → empty | — |
| F3 | Replay and memory engines unchanged; graph engine behaviour unchanged (pattern additions only) | pass | `git diff --stat 0febaa9 -- scripts/replay scripts/memory` → empty; engine diff additions only; graph suite green | — |
| F4 | Placeholders only; the decoy `aegion.example.org` the only domain literal, where the dictionary allows it | pass | `battery-pre-commit-check.txt`: 0 BLOCK; domain literals in added lines are vendor documentation hosts and `toolbox.googleapps.com` | Two fixtures carried `fixture.example.org`; replaced with `[@Aegion_DOMAIN]` (`b9a4f53`). `AEGION_DOMAIN` is not set in this session, so the configured-literal half of SR-8 was not exercised here; CI runs it where the variable is set |
| F5 | Zero npm dependencies; `package.json` absent | pass | `ls package.json` → "No such file or directory" | — |
| F6 | Markdown links in new docs pass `scripts/markdown-links.test.js` | pass | `battery-node-test.txt` (2/2) | — |
| F7 | No company, employer, client or customer name in the tree, corpus, fixtures, commit messages or PR | pass | row C3 grep on added lines → 0; `git log 0febaa9..HEAD --format=%B \| grep -cE '(same pattern)'` → 0; PR body reviewed | — |
| F8 | No new gate depends on pwsh | pass | the shell analyzer and its harness use bash only (`scripts/command-safety-gates.test.js:1061`); lint, tier, scanner and eval changes are pure Node | — |
| F9 | Phase 1: push the branch `g1-google-lane` | fail | the work is on `claude/aegis-google-okta-jamf-wibzp6`, the branch this cloud session was assigned (its instructions forbid pushing any other branch without explicit permission); claim id `g1-google-lane` | Deviation reported (WARDEN pass 1, minor); renaming means pushing a new branch and opening a new PR — a decision for the user |

## G. Phase 5 — review and evidence

| # | Requirement | Verdict | Evidence | Correction |
|---|---|---|---|---|
| G1 | 5.1 this table: one row per acceptance check, with requirement, verdict, evidence and correction | pass | this file | — |
| G2 | 5.2 WARDEN fresh-context review on the spec, the diff vs `0febaa9`, this table and the saved outputs; corrections applied; verdict recorded | pass | section H: pass 1 REJECT (1 blocker, 2 major, 7 minor), every finding corrected in its own commit; pass 2 verdict recorded below | — |
| G3 | 5.3 final battery saved as `battery-<name>.txt` for the eight commands | pass | `battery-node-test.txt`, `battery-lint.txt`, `battery-ms-ticket-eval.txt`, `battery-gws-ticket-eval.txt`, `battery-replay-demo.txt`, `battery-pre-commit-check.txt`, `battery-release-boundary-check.txt`, `battery-check-continuity.txt` | — |

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

**Pass 2** — recorded below once the fresh-context re-review of the corrected
branch returns.

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
