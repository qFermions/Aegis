# Software engineering lane (batch 12): notes

- **Hypothesis (written 2026-11-15 05:24 UTC, before the first lane edit):** a senior engineer's method for this lane fits in a small module: read the evidence from the innermost own frame or the first red step outward, rank two to four causes each with the one test that splits them, and send every change through a branch, a pull request and a person; six runbooks (stack traces, CI failures, dependencies, code review, safe scripts, git recovery) can carry it with about ten gates, because most of the lane's changes reach shared state only through a merge or a push. I expect the gate grammar to force the Bash and PowerShell script templates into preview form (functions and logging lines next to a gated fence break the sibling rules), and the gate-count tests to need their counts raised.
- **Verified means:** the eight required commands of the lane brief exit as the baseline does (the four named suites green, the command lint clean, the ladder audit check exit 0, the pre-commit scan with no BLOCK), the full `node --test` run fails on no name outside `docs/aegis/demo/evidence/batch12/baseline/failing-names.txt`, every dev case parses with `readCaseFile`, and every vendor fact marked CONFIRMED quotes a page fetched in this session.
- **How the hypothesis held:** the module and six runbooks carry the method with 8 gates (not about ten). The Bash and PowerShell skeletons did go to preview form, and the gate counts (351 to 359) and the runbook count (108 to 114) had to be raised. Not expected: a `<details>` block is its own ladder section, so a "Try first" line had to sit inside each block that holds a heavy gate.

## What I built

- `knowledge/software-engineering/`: the eight required files plus `script-patterns.md` (the tested Python template, Bash and PowerShell skeletons) and `postmortem.md`.
- Six runbooks: `/debug-stack-trace` and `/ci-failure` and `/dependency-problem` (variant B), `/code-review-checklist` and `/safe-script` and `/git-recovery` (variant A). Gates: `ci-failure-rerun-portal` (R1), `code-review-checklist-merge-portal` (R1), `dependency-problem-pin-branch` (R1), `safe-script-apply` (R1 to R3, read as R3), `git-recovery-revert-commit`, `git-recovery-revert-merge`, `git-recovery-restore-branch` (R1 each), `git-recovery-local-reset` (R2). Previews: `ci-failure-cache-delete-preview`, `ci-failure-token-default-preview` (portal), `dependency-problem-python-pip-preview`, `git-recovery-history-rewrite-preview`, and in the knowledge files `software-engineering-history-rewrite-preview`, `script-patterns-bash-skeleton`, `script-patterns-powershell-skeleton`.
- `docs/aegis/batch12/vendor-facts-software-engineering.md`: 66 facts, 61 CONFIRMED, 5 UNCONFIRMED.
- `scripts/demo/fixtures/batch12/software-engineering/`: 9 answers (3 good, 6 flawed) for the Engineer, Incident and Ask first modes, indexed in `fixtures.json` like the rules fixtures.
- `docs/aegis/batch12/lanes/software-engineering-dev-cases.jsonl`: SWE01 to SWE15.
- `docs/aegis/batch12/lanes/software-engineering-capability-rows.md`: 17 rows; `docs/aegis/batch12/lanes/evidence/software-engineering-checks.txt`: the captures behind the `verified now` rows.

## Decisions and why

- **Six runbooks, the postmortem in knowledge.** A postmortem changes no system and `/incident-report` already writes a report shell; the blameless template, its rules and Aegis's draft checks fit in `postmortem.md`.
- **Fixes leave through a pull request.** The debug, CI and dependency runbooks hand the merge to `/code-review-checklist`, so one merge gate covers them, instead of a merge gate in every runbook.
- **Re-run as a portal gate.** `gh run rerun` is not a sink the scanner knows, so a shell gate would own nothing; the portal form holds the same ceremony. A deploy workflow is out of scope for the gate (stop condition).
- **The apply run's sink is `tee`.** The script invocation is not a detected sink; `tee -a` keeps the run log the ticket needs and is detected, so the gate owns a real write.
- **Python carries the complete template.** The scanner reads shell and PowerShell fences only; a working Bash or PowerShell template would need live `mv` and `Move-Item` lines and functions, which no gate grammar allows beside them. Bash and PowerShell show the same shape with the changing line commented under PREVIEW ONLY. The template's own count binding is the in-script gate, and its apply run sits behind `safe-script-apply`.
- **Count binding (`--expect-count`) instead of a second typed phrase inside the script.** It ties the apply run to what the dry run showed, as CLAUDE.md contract rule 3 asks ("a count you did not predict means stop").
- **New tokens:** `[COMMIT_SHA]`, `[PR_NUMBER]`, `[RUN_ID]`, `[PACKAGE_NAME]`, `[PACKAGE_VERSION]`, added to the placeholder dictionary under the lane's name. `[FILE_NAME]` is reused for script and workflow files, `[N]` for the dry run's count (the dictionary's note-template fill-in).
- **Registries changed, each because a test asked:** `VARIANTS` (lint), `MIXED_STATE_COMMANDS`, the runbook count in `scripts/repository-structure.test.js` (108 to 114), the gate counts in `scripts/gate-r-class.test.js` and `scripts/audit/read-back-field.test.js` (351 to 359; the naming count stays 114, no lane gate names a connector read-back). Regenerated: `docs/security/STATE_CHANGE_INVENTORY.json`, `docs/aegis/ladder-audit.md`, `docs/aegis/owner/vendor-facts-priority.md` (its runbook count).
- **Base commit.** The worktree started at `046cdde`, not the brief's `08963bf`; it was fast-forwarded to `08963bf` before any edit. On the coordinator's request, `feat/batch12-expert-lanes` (at `0c0a493`) was merged in with a plain merge, and the inventory regenerated under the widened scanner.

## What I left out

- A Fix card fixture: the lane routes a person's own access to the existing GitHub runbooks and writes no Fix card of its own.
- A `/postmortem` runbook (above), and dev cases for postmortems and the Fix card.
- A cache-deletion gate and a repository token-default gate: both are previews, since the fix is a key change or a per-job permission in a pull request.
- Running the PowerShell skeleton (no pwsh here).

## Open questions and things the lead should know

- `scripts/lint/ladder-audit.js` files every runbook without a vendor prefix under "Microsoft" unless it is in its `GENERAL` set, so the six lane runbooks show as Microsoft in `docs/aegis/ladder-audit.md`. Adding them to `GENERAL` (or a lane prefix) is a one-line change outside the registries the brief lets a lane edit.
- The other three lanes raise the same counts (gates, runbooks) and regenerate the same inventory and ladder page; the merge will need one recount and one regeneration.
- Known limit of the Python template: a file whose name already exists in the archive is skipped, so a newer file reusing an archived name is never moved. Good enough for log rotation; a template for other data should add a timestamp to the archived name.
- Evidence quotes come from a fetch tool that returns a model's reading of each page; the quotes are as it returned them.

## Did I miss anything? (self-review before the report)

- A wrong cross-reference in `method.md` (tree 6, "step 4") was fixed.
- Citations that said more than the page: EV-15 (the `-latest` label) and EV-50 (Node's own error codes) were narrowed and marked; EV-18, EV-19 and EV-61 were fetched but unused, and gained their uses.
- A commit message overstated the catalog size (37, not 30 entries); fixed on the unpushed commit.
- Not done in this lane: an independent fresh-context review. The brief says not to start subagents, so the batch's evidence reviewer has to read this lane.

<details>
<summary>Five questions for the owner before merging (answers below each)</summary>

1. What does this lane add? A software engineering module under `knowledge/software-engineering/`, six runbooks with 8 gates, 66 vendor facts, 9 fixtures and 15 dev cases. *Answer check: the module plus six runbooks; Aegis writes code and procedures, a person runs, reviews and merges.*
2. Why is the apply run of `/safe-script` read as R3 when many scripts are R1? *Its Reversibility says "R1 to R3 by what the script changes", and the repository reads the highest class named; the ceremony before the gate follows the class written in the ticket.*
3. What happens when a revert of a shared commit conflicts? *The gate's chain stops before the push (`&&`), nothing reaches the remote, and the runbook says to stop and let the owner choose a forward fix or a wider revert.*
4. How is it undone? *Revert the lane's commits (`882fcc5`, `77322f8`, `09c5cbb`, `ba2cccf`, `2440f30`, `4d01cd5` and the notes commit), then lower the three counts back, remove the six names from `VARIANTS` and `MIXED_STATE_COMMANDS`, and regenerate the inventory, the ladder page and the vendor-facts priority page.*
5. What was not checked? *No judged run of the dev cases or fixtures with a model; the PowerShell skeleton never ran; the GitHub UI labels marked unconfirmed were not seen on screen.*

</details>

## Lines a reviewer must read

About 30 lines of registry and count changes in `scripts/`; the code inside the lane's Markdown (the Python template and its test, about 150 lines; the Bash and PowerShell skeletons, about 130; the eight gate fences, about 200; the prune script in a fixture, about 65); the prose of six runbooks (1023 lines) and ten knowledge files (about 1200 lines) is content, not code.

## Not checked

- No model-judged run: the dev cases and fixtures prove form, not that Aegis answers this way.
- The PowerShell skeleton was never run.
- GitHub UI labels marked "[unconfirmed: check in the GitHub UI]" were not seen on a real screen.
