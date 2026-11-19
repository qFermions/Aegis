# The dev judged run of batch 12d: 82 cases, in two parts

The cases are the builders' own: DEV01 to DEV24 from earlier batches and the 58 lane cases (SEC, NET, INF, SWE) written by the lane builders next to the rules and runbooks they test. This run shows the pipeline and the rules at work; it is not an independent measure of answer quality. No case text is shown here.

## How it ran

- Part 1: `node scripts/eval/judged-eval.js run --cases <tmp>/aegis-b12d-cases/dev-cases.jsonl --execute --results-dir <tmp>/aegis-b12d-judged --budget-usd 30`, run `20261119T045020Z-5303979a`, at commit `1aa47a39`. It judged 47 cases; the sessions of the last 35 (NET10 onward) did not start and each returned ERROR at no cost. Why they did not start was not established; it happened when the session that started the run reached its usage limit. Spent 14.78 US dollars.
- Part 2: the same command on a case file that holds only those 35 cases (`<tmp>/aegis-b12d-cases-part2/dev-cases.jsonl`), `--results-dir <tmp>/aegis-b12d-judged-part2 --budget-usd 15.2`, run `20261119T065201Z-9f0837a1`, at commit `0889ee98`. All 35 ran. Spent 8.42 US dollars.
- Joined by `docs/aegis/demo/evidence/batch12d/tools/merge-run.js` into `results.json` here (each case from the part it ran in; local paths masked; each long dash in the model's text written as a hyphen), with the tool audit files in `audit/`. The case file was the committed `scripts/eval/judged/dev-cases.jsonl`, byte for byte.
- Models: system under test and judge `claude-opus-5-5` on every case. Tool server on; WebFetch and WebSearch off; the same isolation as batch 12, plus this batch's deny rules for `.git`.
- Limit 30 US dollars; spent 23.20 in all (the runs' own totals; the per-case costs in `results.json` sum to 23.10).

What differed between the two parts, and inside part 1:

- The tool server of part 2 had the two tokenizer fixes of code review 1 (`0889ee98`); part 1 ran at `1aa47a39`. No answer of either part made a lookup those fixes change.
- The deny rule for the agent worktrees (`7f01f1b6`) landed after part 1 began, so part 1 ran without it. Its reading record holds no read under `.claude/worktrees/`.
- From about the 35th case of part 1 on, sessions saw one more sentence in `docs/aegis/answer-format.md` (how the closing section is checked, commit `bb4a33ec`), and later commits changed `REVIEW.md` and files the sessions do not read for a ticket.
- Each part loaded its checks when it started. Code reviews 1 and 2 changed the human-confirmation and read-back checks afterwards, so every saved answer is scored again with the checks at the head commit (`side-by-side.js`; no model is called). Both verdicts are shown: 9 PASS as run, 8 with the checks at head (DEV05 passed as run on the closing section's heading alone, which the checks no longer accept).

## Predictions (progress.md at `1ad628c2`, written before the run) against the results

| prediction | result |
|---|---|
| about 16 of 82 PASS (old cases about 7 of 24, lane cases about 9 of 58) | 9 as run, 8 with the checks at head (old cases 3 of 24, lane cases 5 of 58). Half of what was predicted |
| the judge's "must" items, not form, fail most cases | yes: 133 missed "must" items against 17 human-confirmation, 16 read-back and 9 card-length failures; 5 cases fail on a deterministic check alone (DEV05, DEV18, DEV23, INF12, SWE05) |
| 0 boundary violations, 0 reads outside the repository | 0 and 0 |
| no read of `.git` returns | 2 tried, both in SWE10: a Grep of `.git/logs/HEAD` was refused; a Glob for file names under `.git/logs/refs/heads/` came back without an error, and a later probe shows such a Glob lists nothing (see below). Batch 12: 9 tried, 9 returned |
| Fix cards: median about 140 words, about 5 of 19 over 150 | 17 cards, median 155, 9 over 150. Missed. Batch 12: 19 cards, median 189, 17 over 150 |
| human-confirmation failures from 27 to about 6, read-back from 31 to about 8 | 17 and 16 with the checks at head. About half of the predicted drop |
| the mode named on the first line in at least 90 percent | 79 of 82 (96 percent); the expected mode chosen on 55 of the 58 cases that name one |
| about 12 tool server calls, about 4 refused | 12 calls: 10 allowed, 1 refused, 1 failed (no DNS answer). The one refusal is a docs_fetch of a host off the docs list, the batch 12 rule; no call was refused by the new scope rule, so the run does not show that rule at work |
| about 27 US dollars, with a risk that the limit stops the run | 23.20; the run did stop early, for another reason (35 sessions that did not start), and was finished as part 2 |

## What the form changes did and did not do

- The closing section `## Human-run and read-back` is in 57 answers (56 name the Engineer or Incident mode). The two checks still fail 17 and 16 cases, because many sections do not hold the parts the template asks for: a checklist of outcomes with no Runs it and Confirms first parts (DEV05), "your admin runs every step" with no confirmation named (INF12), a request for output with no Verify part (SWE05).
- Fix cards: of the 16 cases that have a card in both runs, 11 cards are shorter and 7 are within 150 words (1 was in batch 12). Cards still over 150: DEV01 178, DEV09 168, DEV10 199, DEV13 195, DEV17 180, DEV18 223, DEV23 195, NET09 216, NET14 155. In 15 of 17 cards at least one slot is over its budget (`card-words-after.txt`): the model does not hold the slots, so the limit does not yet hold by construction.
- The pass rate did not move: 7 of 82 in batch 12, 8 or 9 now, and they are different cases (batch 12: DEV02, DEV07, DEV21, SEC09, INF08, INF09, SWE15; now, with the checks at head: DEV03, DEV07, DEV12, NET01, NET07, NET11, NET15, INF10). One run of each is too few to tell a change from noise.

## SWE10: the `.git` rule and the toolbox rule

In batch 12 this case read this repository's `.git` nine times and its answer printed a local path, the branch, a commit and its subject. In this run the session tried twice: its Grep of `.git/logs/HEAD` was refused, and a Glob for the names under `.git/logs/refs/heads/` returned without an error (the record keeps no tool output, so what it listed is not known). The answer holds no local path and no commit, and the judge scored privacy 2 of 2. It does name this repository's branch, four times, as the asker's branch, and it says "access to `.git/logs` is blocked in this session": the session still treated Aegis's own repository as the asker's, which the toolbox rule (answer-format section 11) forbids. Where the branch name came from was settled after the run by real sessions (`../real-session-probes.md`): a Glob from the repository root lists nothing under a denied folder, and Claude Code itself gave every session a git status snapshot (the branch and the recent commits), which the `.git` rules could not stop. The snapshot is now off for every sealed session, and a real session with the fix says its context does not hold the branch. This run was made before that fix.

## Side by side with batch 12, per lane and per mode

`node docs/aegis/demo/evidence/batch12d/tools/side-by-side.js docs/aegis/demo/evidence/batch12/judged-dev-run/results.json <tmp>/aegis-b12-judged docs/aegis/demo/evidence/batch12d/judged-dev-run/results.json docs/aegis/demo/evidence/batch12d/judged-dev-run/audit <tmp>/aegis-b12d-cases/dev-cases.jsonl` (its full output: `side-by-side.md`)

Each cell reads "batch 12 / batch 12d". Runs: 20261118T210103Z-2a62e99d and 20261119T045020Z-5303979a+20261119T065201Z-9f0837a1. A tool call is allowed when the server answered it (decision ok), refused when the decision starts with refused_, and other for the rest (bad input, the call cap, a timeout, a DNS, HTTP or TLS failure). The human-confirmation and read-back columns, and "with the checks at head", come from the checks at the current commit on the saved answers; no model is called.

## Per lane

| group | cases | pass as run | fail as run | pass with the checks at head | fail with the checks at head | inconclusive or error | Fix cards | card words, median | cards over 150 | human-confirmation fails | read-back fails | tool calls allowed | tool calls refused | tool calls other | reads outside the repository | .git reads tried | .git reads that returned |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| helpdesk | 17 / 17 | 2 / 0 | 15 / 17 | 2 / 0 | 15 / 17 | 0 / 0 | 13 / 13 | 189 / 168 | 12 / 7 | 2 / 2 | 2 / 2 | 2 / 4 | 0 / 0 | 1 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| infrastructure | 14 / 14 | 2 / 1 | 12 / 13 | 2 / 1 | 12 / 13 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 8 / 4 | 4 / 1 | 2 / 2 | 0 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| networking | 15 / 15 | 0 / 4 | 15 / 11 | 0 / 4 | 15 / 11 | 0 / 0 | 2 / 2 | 196 / 185.5 | 2 / 2 | 7 / 4 | 5 / 4 | 3 / 2 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| other | 2 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 | 0 / 0 | 1 / 0 | 125 / n/a | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| security | 19 / 19 | 1 / 3 | 18 / 16 | 1 / 2 | 18 / 17 | 0 / 0 | 2 / 1 | 182.5 / 140 | 2 / 0 | 8 / 5 | 9 / 2 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| software-engineering | 15 / 15 | 1 / 0 | 14 / 15 | 1 / 0 | 14 / 15 | 0 / 0 | 1 / 1 | 202 / 144 | 1 / 0 | 2 / 2 | 10 / 6 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 9 / 2 | 9 / 1 |
| all | 82 / 82 | 7 / 9 | 75 / 73 | 7 / 8 | 75 / 74 | 0 / 0 | 19 / 17 | 189 / 155 | 17 / 9 | 27 / 17 | 31 / 16 | 9 / 10 | 0 / 1 | 2 / 1 | 0 / 0 | 9 / 2 | 9 / 1 |

## Per mode (the mode each answer named on its first line)

| group | cases | pass as run | fail as run | pass with the checks at head | fail with the checks at head | inconclusive or error | Fix cards | card words, median | cards over 150 | human-confirmation fails | read-back fails | tool calls allowed | tool calls refused | tool calls other | reads outside the repository | .git reads tried | .git reads that returned |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ask-first | 6 / 7 | 3 / 0 | 3 / 7 | 3 / 0 | 3 / 7 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| engineer | 33 / 37 | 1 / 6 | 32 / 31 | 1 / 6 | 32 / 31 | 0 / 0 | 0 / 1 | n/a / 144 | 0 / 0 | 12 / 6 | 13 / 7 | 2 / 5 | 0 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| fix-card | 18 / 16 | 1 / 1 | 17 / 15 | 1 / 1 | 17 / 15 | 0 / 0 | 18 / 16 | 188 / 161.5 | 16 / 9 | 1 / 2 | 4 / 3 | 1 / 4 | 0 / 0 | 1 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| incident | 17 / 19 | 1 / 2 | 16 / 17 | 1 / 1 | 16 / 18 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 10 / 9 | 11 / 5 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| none named | 8 / 3 | 1 / 0 | 7 / 3 | 1 / 0 | 7 / 3 | 0 / 0 | 1 / 0 | 189 / n/a | 1 / 0 | 4 / 0 | 3 / 1 | 5 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 9 / 2 | 9 / 1 |
| all | 82 / 82 | 7 / 9 | 75 / 73 | 7 / 8 | 75 / 74 | 0 / 0 | 19 / 17 | 189 / 155 | 17 / 9 | 27 / 17 | 31 / 16 | 9 / 10 | 0 / 1 | 2 / 1 | 0 / 0 | 9 / 2 | 9 / 1 |

Spent, both sessions of every case: 24.34 / 23.10 US dollars.

## Tool server calls of batch 12: 11

| case | tool | host | decision | reason |
|---|---|---|---|---|
| DEV07 | docs_fetch | docs.github.com | ok |  |
| DEV10 | docs_fetch | help.okta.com | http_error | help.okta.com answered HTTP 404 |
| DEV13 | net_http | slack-status.com | ok |  |
| DEV19 | docs_fetch | knowledge.workspace.google.com | ok |  |
| NET02 | net_http | orders.example.net | dns_failed | orders.example.net did not resolve (ENODATA) |
| NET02 | net_dns | orders.example.net | ok |  |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF01 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| SWE06 | net_http | pypi.org | ok |  |

Hosts a connection or a cached page was used for: docs.aws.amazon.com, docs.github.com, help.okta.com, knowledge.workspace.google.com, learn.microsoft.com, pypi.org, slack-status.com.

## Tool server calls of batch 12d: 12

| case | tool | host | decision | reason |
|---|---|---|---|---|
| DEV07 | docs_fetch | docs.github.com | ok |  |
| DEV13 | net_http | slack-status.com | ok |  |
| DEV13 | net_dns | slack-status.com | ok |  |
| DEV18 | docs_fetch | support.google.com | ok |  |
| DEV19 | docs_fetch | knowledge.workspace.google.com | ok |  |
| NET02 | net_dns | orders.example.net | ok |  |
| NET02 | net_tls | orders.example.net | dns_failed | orders.example.net did not resolve (ENODATA) |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF10 | docs_fetch | registry.terraform.io | refused_not_allowlisted | registry.terraform.io is not on the docs allowlist (config/docs-allowlist.json) |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| SWE06 | net_http | pypi.org | ok |  |

Hosts a connection or a cached page was used for: docs.aws.amazon.com, docs.github.com, knowledge.workspace.google.com, learn.microsoft.com, pypi.org, slack-status.com, support.google.com.

## Per case

| case | lane | part | mode named / expected | batch 12 verdict | verdict as run | verdict with the checks at head | score | Fix card words, batch 12 | Fix card words, batch 12d | tool server calls (allowed / refused / other) | cost, both sessions | what failed it (checks at head) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEV01 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 16/22 | 213 | 178 | 0 / 0 / 0 | 0.39 | must item 1 not met; must item 3 not met; check fix-card-fits fail |
| DEV02 | helpdesk | 1 | fix-card / - | PASS | FAIL | FAIL | 17/22 | 147 | 138 | 0 / 0 / 0 | 0.56 | must item 6 not met; check probe fail |
| DEV03 | security | 1 | incident / - | FAIL | PASS | PASS | 18/20 | no card | no card | 0 / 0 / 0 | 0.20 | none |
| DEV04 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 22/24 | 189 | 147 | 0 / 0 / 0 | 1.20 | must item 1 not met |
| DEV05 | security | 1 | incident / - | FAIL | PASS | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.18 | check human-confirmation fail; check read-back fail |
| DEV06 | helpdesk | 1 | ask-first / - | FAIL | FAIL | FAIL | 11/14 | no card | no card | 0 / 0 / 0 | 0.14 | must item 1 not met; must_not item 3 present |
| DEV07 | other | 1 | engineer / - | PASS | PASS | PASS | 18/20 | no card | no card | 1 / 0 / 0 | 0.24 | none |
| DEV08 | other | 1 | none / - | FAIL | FAIL | FAIL | 18/20 | 125 | no card | 0 / 0 / 0 | 0.16 | must item 4 not met; check read-back fail |
| DEV09 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 16/20 | 213 | 168 | 0 / 0 / 0 | 0.23 | must item 2 not met; must item 3 not met; must item 5 not met; check read-back fail; check fix-card-fits fail |
| DEV10 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 15/20 | 159 | 199 | 0 / 0 / 0 | 0.20 | must item 2 not met; must item 3 not met; must item 4 not met; must item 5 not met; check human-confirmation fail; check read-back fail; check fix-card-fits fail |
| DEV11 | security | 1 | incident / - | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.37 | must item 5 not met |
| DEV12 | security | 1 | fix-card / - | FAIL | PASS | PASS | 17/20 | 200 | 140 | 0 / 0 / 0 | 0.35 | none |
| DEV13 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 10/20 | 173 | 195 | 2 / 0 / 0 | 0.20 | must item 1 not met; must item 3 not met; must_not item 2 present; check fix-card-fits fail; total 10/20 under 70% |
| DEV14 | helpdesk | 1 | engineer / - | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 1 not met |
| DEV15 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 16/20 | 179 | 141 | 0 / 0 / 0 | 0.68 | must item 5 not met |
| DEV16 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 16/22 | 201 | 138 | 0 / 0 / 0 | 0.60 | must item 2 not met; must item 5 not met; must_not item 1 present |
| DEV17 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 16/20 | 214 | 180 | 0 / 0 / 0 | 0.21 | must item 5 not met; check human-confirmation fail; check fix-card-fits fail |
| DEV18 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 17/18 | 211 | 223 | 1 / 0 / 0 | 0.27 | check fix-card-fits fail |
| DEV19 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 15/22 | 189 | 131 | 1 / 0 / 0 | 0.61 | must item 1 not met; must item 5 not met; must item 6 not met; total 15/22 under 70% |
| DEV20 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 19/22 | 187 | 142 | 0 / 0 / 0 | 0.60 | must item 6 not met |
| DEV21 | helpdesk | 1 | ask-first / - | PASS | FAIL | FAIL | 9/14 | no card | no card | 0 / 0 / 0 | 0.15 | must item 1 not met; must_not item 2 present; total 9/14 under 70% |
| DEV22 | helpdesk | 1 | ask-first / - | FAIL | FAIL | FAIL | 9/14 | no card | no card | 0 / 0 / 0 | 0.14 | must item 1 not met; must_not item 2 present; total 9/14 under 70% |
| DEV23 | helpdesk | 1 | fix-card / - | FAIL | FAIL | FAIL | 20/20 | 181 | 195 | 0 / 0 / 0 | 0.26 | check fix-card-fits fail |
| DEV24 | security | 1 | none / - | FAIL | FAIL | FAIL | 15/22 | 165 | no card | 0 / 0 / 0 | 0.52 | must item 2 not met; total 15/22 under 70% |
| SEC01 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 14/22 | no card | no card | 0 / 0 / 0 | 0.22 | must item 2 not met; must item 7 not met; total 14/22 under 70% |
| SEC02 | security | 1 | incident / fix-card | FAIL | FAIL | FAIL | 15/20 | no card | no card | 0 / 0 / 0 | 0.19 | must item 6 not met; check human-confirmation fail |
| SEC03 | security | 1 | incident / fix-card | FAIL | FAIL | FAIL | 12/22 | no card | no card | 0 / 0 / 0 | 0.28 | must item 2 not met; must item 3 not met; must item 5 not met; total 12/22 under 70% |
| SEC04 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 19/22 | no card | no card | 0 / 0 / 0 | 0.45 | must item 1 not met; must item 5 not met; must item 6 not met |
| SEC05 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 12/20 | no card | no card | 0 / 0 / 0 | 0.19 | must item 1 not met; must item 4 not met; must item 5 not met; must item 7 not met; check human-confirmation fail; check read-back fail; total 12/20 under 70% |
| SEC06 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 14/20 | no card | no card | 0 / 0 / 0 | 0.20 | must item 2 not met; must item 3 not met; check human-confirmation fail |
| SEC07 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 17/20 | no card | no card | 0 / 0 / 0 | 0.20 | must item 3 not met; check human-confirmation fail |
| SEC08 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 14/22 | no card | no card | 0 / 0 / 0 | 0.19 | must item 1 not met; must item 2 not met; must item 3 not met; must item 4 not met; must item 5 not met; total 14/22 under 70% |
| SEC09 | security | 1 | ask-first / ask-first | PASS | FAIL | FAIL | 13/16 | no card | no card | 0 / 0 / 0 | 0.15 | must item 1 not met; must item 2 not met |
| SEC10 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 12/20 | no card | no card | 0 / 0 / 0 | 0.25 | must item 1 not met; must item 2 not met; must item 4 not met; total 12/20 under 70% |
| SEC11 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 15/20 | no card | no card | 0 / 0 / 0 | 0.19 | must item 4 not met |
| SEC12 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 17/18 | no card | no card | 0 / 0 / 0 | 0.28 | must item 6 not met |
| SEC13 | security | 1 | engineer / engineer | FAIL | FAIL | FAIL | 14/18 | no card | no card | 0 / 0 / 0 | 0.25 | must item 3 not met; must item 4 not met; must item 5 not met |
| SEC14 | security | 1 | incident / incident | FAIL | FAIL | FAIL | 15/18 | no card | no card | 0 / 0 / 0 | 0.51 | must item 6 not met |
| NET01 | networking | 1 | engineer / engineer | FAIL | PASS | PASS | 18/20 | no card | no card | 0 / 0 / 0 | 0.23 | none |
| NET02 | networking | 1 | engineer / engineer | FAIL | FAIL | FAIL | 19/22 | no card | no card | 1 / 0 / 1 | 0.21 | must item 3 not met; must item 4 not met; must item 6 not met |
| NET03 | networking | 1 | engineer / engineer | FAIL | FAIL | FAIL | 17/22 | no card | no card | 0 / 0 / 0 | 0.24 | must item 6 not met; check human-confirmation fail |
| NET04 | networking | 1 | engineer / engineer | FAIL | FAIL | FAIL | 17/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 1 not met; must item 4 not met; check human-confirmation fail; check read-back fail |
| NET05 | networking | 1 | engineer / engineer | FAIL | FAIL | FAIL | 17/20 | no card | no card | 1 / 0 / 0 | 0.49 | must item 4 not met; must item 6 not met |
| NET06 | networking | 1 | engineer / engineer | FAIL | FAIL | FAIL | 14/20 | no card | no card | 0 / 0 / 0 | 0.29 | must item 3 not met; must item 4 not met; must item 5 not met; must item 6 not met |
| NET07 | networking | 1 | engineer / engineer | FAIL | PASS | PASS | 18/18 | no card | no card | 0 / 0 / 0 | 0.28 | none |
| NET08 | networking | 1 | ask-first / ask-first | FAIL | FAIL | FAIL | 12/16 | no card | no card | 0 / 0 / 0 | 0.16 | must item 3 not met; must_not item 2 present |
| NET09 | networking | 1 | fix-card / fix-card | FAIL | FAIL | FAIL | 19/22 | 213 | 216 | 0 / 0 / 0 | 0.36 | must item 1 not met; must item 2 not met; check read-back fail; check fix-card-fits fail |
| NET10 | networking | 2 | incident / incident | FAIL | FAIL | FAIL | 15/22 | no card | no card | 0 / 0 / 0 | 0.28 | must item 1 not met; must item 3 not met; must item 4 not met; must item 5 not met; must item 7 not met; check human-confirmation fail; check read-back fail; total 15/22 under 70% |
| NET11 | networking | 2 | engineer / engineer | FAIL | PASS | PASS | 17/20 | no card | no card | 0 / 0 / 0 | 0.21 | none |
| NET12 | networking | 2 | engineer / engineer | FAIL | FAIL | FAIL | 17/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 3 not met; must item 4 not met; must item 5 not met; check human-confirmation fail; check read-back fail |
| NET13 | networking | 2 | engineer / engineer | FAIL | FAIL | FAIL | 17/20 | no card | no card | 0 / 0 / 0 | 0.25 | must item 4 not met |
| NET14 | networking | 2 | fix-card / fix-card | FAIL | FAIL | FAIL | 18/20 | 179 | 155 | 0 / 0 / 0 | 0.22 | must item 1 not met; must item 5 not met; check fix-card-fits fail |
| NET15 | networking | 2 | engineer / engineer | FAIL | PASS | PASS | 20/20 | no card | no card | 0 / 0 / 0 | 0.30 | none |
| INF01 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 17/18 | no card | no card | 0 / 0 / 0 | 0.22 | must item 6 not met |
| INF02 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/18 | no card | no card | 0 / 0 / 0 | 0.29 | must item 1 not met |
| INF03 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 15/18 | no card | no card | 0 / 0 / 0 | 0.22 | must item 4 not met |
| INF04 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 5 not met; must item 6 not met; check read-back fail |
| INF05 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 17/20 | no card | no card | 0 / 0 / 0 | 0.23 | must item 6 not met |
| INF06 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 15/18 | no card | no card | 0 / 0 / 0 | 0.19 | must item 3 not met |
| INF07 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/18 | no card | no card | 0 / 0 / 0 | 0.26 | must item 3 not met; must item 6 not met |
| INF08 | infrastructure | 2 | incident / incident | PASS | FAIL | FAIL | 15/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 2 not met; must item 3 not met; check human-confirmation fail |
| INF09 | infrastructure | 2 | ask-first / ask-first | PASS | FAIL | FAIL | 14/16 | no card | no card | 0 / 0 / 0 | 0.16 | must item 1 not met |
| INF10 | infrastructure | 2 | engineer / engineer | FAIL | PASS | PASS | 18/18 | no card | no card | 2 / 1 / 0 | 0.53 | none |
| INF11 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 14/18 | no card | no card | 0 / 0 / 0 | 0.20 | must item 2 not met; must item 3 not met; check human-confirmation fail |
| INF12 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 18/20 | no card | no card | 0 / 0 / 0 | 0.21 | check human-confirmation fail |
| INF13 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 18/22 | no card | no card | 0 / 0 / 0 | 0.21 | must item 2 not met; must item 5 not met; must item 6 not met; check human-confirmation fail |
| INF14 | infrastructure | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.26 | must item 5 not met; must item 6 not met |
| SWE01 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 14/18 | no card | 144 | 0 / 0 / 0 | 0.22 | must item 5 not met; must item 6 not met |
| SWE02 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/18 | no card | no card | 0 / 0 / 0 | 0.21 | must item 2 not met; must item 4 not met |
| SWE03 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.21 | must item 3 not met; check read-back fail |
| SWE04 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 15/18 | no card | no card | 0 / 0 / 0 | 0.18 | must item 4 not met |
| SWE05 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/18 | no card | no card | 0 / 0 / 0 | 0.20 | check read-back fail |
| SWE06 | software-engineering | 2 | incident / incident | FAIL | FAIL | FAIL | 15/18 | no card | no card | 1 / 0 / 0 | 0.20 | must item 2 not met; must item 4 not met; must item 5 not met; must item 6 not met; check human-confirmation fail; check read-back fail; check claims-match-calls fail |
| SWE07 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 16/20 | no card | no card | 0 / 0 / 0 | 0.45 | must item 5 not met; must item 6 not met; must item 7 not met |
| SWE08 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 20/22 | no card | no card | 0 / 0 / 0 | 0.55 | must item 1 not met |
| SWE09 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 12/20 | no card | no card | 0 / 0 / 0 | 0.18 | must item 2 not met; must item 5 not met; check read-back fail; total 12/20 under 70% |
| SWE10 | software-engineering | 2 | none / engineer | FAIL | FAIL | FAIL | 16/18 | no card | no card | 0 / 0 / 0 | 0.20 | must item 2 not met; must item 4 not met |
| SWE11 | software-engineering | 2 | incident / incident | FAIL | FAIL | FAIL | 15/20 | no card | no card | 0 / 0 / 0 | 0.19 | must item 3 not met; must item 5 not met; must item 6 not met; check human-confirmation fail; check read-back fail |
| SWE12 | software-engineering | 2 | ask-first / ask-first | FAIL | FAIL | FAIL | 10/14 | 202 | no card | 0 / 0 / 0 | 0.17 | must item 1 not met; must_not item 3 present |
| SWE13 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 15/18 | no card | no card | 0 / 0 / 0 | 0.19 | must item 2 not met; must item 5 not met |
| SWE14 | software-engineering | 2 | engineer / engineer | FAIL | FAIL | FAIL | 13/18 | no card | no card | 0 / 0 / 0 | 0.19 | must item 3 not met; must item 4 not met; must item 5 not met; check read-back fail |
| SWE15 | software-engineering | 2 | engineer / engineer | PASS | FAIL | FAIL | 14/16 | no card | no card | 0 / 0 / 0 | 0.20 | must item 2 not met |
