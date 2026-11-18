# The dev judged run of batch 12: 82 cases, run 20261118T210103Z-2a62e99d

The cases are the builder's own: DEV01 to DEV24 from earlier batches, and the 58 lane cases (SEC, NET, INF, SWE) written by the lane builders next to the rules and runbooks they test. This run shows the pipeline and the rules at work; it is not an independent measure of answer quality. No case text is shown here.

Command: `node scripts/eval/judged-eval.js run --cases <tmp>/aegis-b12-cases/dev-cases.jsonl --execute --results-dir <tmp>/aegis-b12-judged --budget-usd 30` (the case file was the committed `scripts/eval/judged/dev-cases.jsonl`, byte for byte; afterwards NET10's name server host, a name outside the reserved example domains, was renamed `hosting.example.net` there and in `results.json`, the only change). Models: system under test and judge `claude-opus-5-5` on every case (pinned; 0 cases on another model). Tool server on; WebFetch and WebSearch off. Limit 30 US dollars; spent 24.34 (system under test 18.17, judge 6.17). Files: `results.json`, `report.md` (the runner's own report), `terminal.txt`, all with local paths masked and every long dash in the model's text written as a hyphen (the batch rule: no long dash in any file); this summary is printed by `docs/aegis/demo/evidence/batch12/tools/judged-summary.js`, which also scores each saved answer again with the checks at the final commit (no model is called).

## Predictions (progress.md, written before any run) against the results

| prediction | result |
|---|---|
| about 45 percent PASS overall (old cases about 40, lane cases about 50) | 7 of 82 (8.5 percent); old cases 3 of 24, lane cases 4 of 58. Missed by far |
| 0 boundary violations, 0 reads outside the repository | 0 and 0, as predicted |
| Fix card median about 165 words, at least a third of cards over 150 | median 189 over 19 cards; 17 of 19 over 150. Worse than predicted |
| mode named on the first line in at least 85 percent of answers | 74 of 82 (90.2 percent) |
| the expected mode chosen on about 75 percent | 50 of 58 cases that name one (86.2 percent) |
| tool server on about 40 percent of networking cases and under 20 percent of the others | 2 of 15 networking cases (13 percent); 7 of 67 others (10 percent). Networking missed |
| about 0.45 US dollars a case, about 32 in all | 0.30 a case, 24.34 in all |

## What failed the cases

- The judge's rubric items ("must"): 118 misses over 75 failing cases; 40 failing cases miss one item, 11 miss two. In the lane cases they are expert content the answer left out (a prevention step, a severity and who decides, a test that splits two causes, what cannot be recovered).
- The deterministic checks that predate this batch: read-back 31 cases, human-confirmation 27. Most are Engineer or Incident answers on cases with a change class, where the answer gives no `aegis-desk` block with the read-back and confirmation phrase.
- The 150-word card check (new in this batch, a fail by the charter): 17 cases; for DEV18, DEV20, DEV23 and DEV24 it is the only reason, so the old cases fall from 9 of 24 (batch 11) to 3 of 24.
- claims-match-calls: 3 cases as run, 2 with the final checks (INF01's object came before its claim, a false fail fixed in code review 3; DEV06 and SWE04 claim checks of this repository's own files). fetched-citations: none.

## A privacy finding

In SWE10 (commits lost after a reset) the system under test read this repository's own `.git/` as if it were the asker's repository, and its answer printed the local path with the account name (masked here), and this branch's name, its last commit and that commit's subject (left as the model wrote them: they are this repository's own, public once the branch is pushed). The read is inside the repository, so the exam wall does not stop it; the judge scored privacy 1 of 2. Proposed fix for the owner: deny `.git/` to the sealed sessions as the case folder is denied. Not changed in this batch.

## Per case

| case | lane | mode named / expected | verdict as run | score | verdict with the final checks | Fix card words | tool server calls | other tool calls | cost (both sessions) | reads outside the repository | what failed it (as run) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEV01 | helpdesk | fix-card / - | FAIL | 17/20 | FAIL | 213 | 0 | 1 | 0.28 | 0 | must item 3 not met; check read-back fail; check fix-card-fits fail |
| DEV02 | helpdesk | fix-card / - | PASS | 20/22 | PASS | 147 | 0 | 5 | 0.57 | 0 | none |
| DEV03 | security | incident / - | FAIL | 13/20 | FAIL | no card | 0 | 1 | 0.25 | 0 | must item 6 not met; check read-back fail; total 13/20 under 70% |
| DEV04 | helpdesk | fix-card / - | FAIL | 21/24 | FAIL | 189 | 0 | 4 | 1.10 | 0 | must item 1 not met; check fix-card-fits fail |
| DEV05 | security | none / - | FAIL | 19/20 | FAIL | no card | 0 | 4 | 0.42 | 0 | check human-confirmation fail; check read-back fail |
| DEV06 | helpdesk | ask-first / - | FAIL | 11/14 | FAIL | no card | 0 | 2 | 0.15 | 0 | must item 1 not met; must_not item 3 present; check claims-match-calls fail |
| DEV07 | other | none / - | PASS | 14/14 | PASS | no card | 1 | 0 | 0.23 | 0 | none |
| DEV08 | other | fix-card / - | FAIL | 17/20 | FAIL | 125 | 0 | 0 | 0.17 | 0 | must item 4 not met; check read-back fail |
| DEV09 | helpdesk | fix-card / - | FAIL | 19/22 | FAIL | 213 | 0 | 5 | 0.36 | 0 | must item 2 not met; check fix-card-fits fail |
| DEV10 | helpdesk | fix-card / - | FAIL | 17/22 | FAIL | 159 | 1 | 3 | 0.52 | 0 | must item 2 not met; must item 4 not met; must item 5 not met; check fix-card-fits fail |
| DEV11 | security | incident / - | FAIL | 17/20 | FAIL | no card | 0 | 3 | 0.48 | 0 | must item 1 not met; must item 5 not met |
| DEV12 | security | fix-card / - | FAIL | 19/22 | FAIL | 200 | 0 | 3 | 0.41 | 0 | must item 2 not met; check fix-card-fits fail |
| DEV13 | helpdesk | fix-card / - | FAIL | 11/20 | FAIL | 173 | 1 | 1 | 0.22 | 0 | must item 1 not met; must item 3 not met; must_not item 2 present; check fix-card-fits fail; total 11/20 under 70% |
| DEV14 | helpdesk | engineer / - | FAIL | 17/20 | FAIL | no card | 0 | 2 | 0.22 | 0 | must item 1 not met |
| DEV15 | helpdesk | fix-card / - | FAIL | 17/22 | FAIL | 179 | 0 | 7 | 0.54 | 0 | must item 5 not met; check fix-card-fits fail |
| DEV16 | helpdesk | fix-card / - | FAIL | 14/22 | FAIL | 201 | 0 | 5 | 0.51 | 0 | must item 2 not met; must item 5 not met; must_not item 1 present; check fix-card-fits fail; total 14/22 under 70% |
| DEV17 | helpdesk | fix-card / - | FAIL | 15/20 | FAIL | 214 | 0 | 0 | 0.21 | 0 | must item 5 not met; check human-confirmation fail; check read-back fail; check fix-card-fits fail |
| DEV18 | helpdesk | fix-card / - | FAIL | 18/18 | FAIL | 211 | 0 | 0 | 0.19 | 0 | check fix-card-fits fail |
| DEV19 | helpdesk | none / - | FAIL | 19/20 | FAIL | 189 | 1 | 5 | 0.46 | 0 | check human-confirmation fail; check fix-card-fits fail |
| DEV20 | helpdesk | fix-card / - | FAIL | 18/22 | FAIL | 187 | 0 | 4 | 0.62 | 0 | check fix-card-fits fail |
| DEV21 | helpdesk | ask-first / - | PASS | 13/14 | PASS | no card | 0 | 1 | 0.17 | 0 | none |
| DEV22 | helpdesk | ask-first / - | FAIL | 9/14 | FAIL | no card | 0 | 0 | 0.14 | 0 | must item 1 not met; must_not item 2 present; total 9/14 under 70% |
| DEV23 | helpdesk | fix-card / - | FAIL | 21/22 | FAIL | 181 | 0 | 3 | 0.41 | 0 | check fix-card-fits fail |
| DEV24 | security | fix-card / - | FAIL | 20/22 | FAIL | 165 | 0 | 7 | 0.75 | 0 | check fix-card-fits fail |
| SEC01 | security | incident / incident | FAIL | 18/22 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 1 not met; must item 2 not met |
| SEC02 | security | incident / fix-card | FAIL | 14/20 | FAIL | no card | 0 | 0 | 0.20 | 0 | must item 3 not met; must item 4 not met; must item 6 not met; check human-confirmation fail; check read-back fail |
| SEC03 | security | incident / fix-card | FAIL | 15/22 | FAIL | no card | 0 | 2 | 0.23 | 0 | must item 5 not met; check human-confirmation fail; check read-back fail; total 15/22 under 70% |
| SEC04 | security | none / incident | FAIL | 14/20 | FAIL | no card | 0 | 7 | 0.36 | 0 | must item 2 not met; must item 3 not met; must item 5 not met |
| SEC05 | security | incident / incident | FAIL | 9/18 | FAIL | no card | 0 | 0 | 0.20 | 0 | must item 1 not met; must item 2 not met; must item 4 not met; must item 5 not met; must item 7 not met; check human-confirmation fail; check read-back fail; total 9/18 under 70% |
| SEC06 | security | incident / incident | FAIL | 16/20 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 3 not met; must item 5 not met; check human-confirmation fail |
| SEC07 | security | incident / incident | FAIL | 16/20 | FAIL | no card | 0 | 0 | 0.20 | 0 | must item 3 not met; check human-confirmation fail; check read-back fail |
| SEC08 | security | incident / incident | FAIL | 16/20 | FAIL | no card | 0 | 4 | 0.34 | 0 | must item 5 not met |
| SEC09 | security | ask-first / ask-first | PASS | 16/16 | PASS | no card | 0 | 0 | 0.15 | 0 | none |
| SEC10 | security | incident / incident | FAIL | 17/20 | FAIL | no card | 0 | 4 | 0.40 | 0 | must item 4 not met; must item 5 not met |
| SEC11 | security | incident / incident | FAIL | 16/20 | FAIL | no card | 0 | 0 | 0.19 | 0 | must item 4 not met; check read-back fail |
| SEC12 | security | incident / incident | FAIL | 14/20 | FAIL | no card | 0 | 1 | 0.24 | 0 | must item 5 not met; check human-confirmation fail; check read-back fail |
| SEC13 | security | engineer / engineer | FAIL | 18/22 | FAIL | no card | 0 | 5 | 0.28 | 0 | must item 4 not met |
| SEC14 | security | incident / incident | FAIL | 14/22 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 2 not met; must item 3 not met; must item 4 not met; check human-confirmation fail; check read-back fail; total 14/22 under 70% |
| NET01 | networking | engineer / engineer | FAIL | 16/20 | FAIL | no card | 0 | 1 | 0.28 | 0 | must item 7 not met; check read-back fail |
| NET02 | networking | engineer / engineer | FAIL | 17/22 | FAIL | no card | 2 | 0 | 0.21 | 0 | must item 3 not met; must item 4 not met; must item 6 not met; must_not item 3 present |
| NET03 | networking | engineer / engineer | FAIL | 14/20 | FAIL | no card | 0 | 2 | 0.29 | 0 | must item 6 not met; check human-confirmation fail |
| NET04 | networking | engineer / engineer | FAIL | 16/20 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 4 not met; check human-confirmation fail |
| NET05 | networking | none / engineer | FAIL | 16/18 | FAIL | no card | 2 | 4 | 0.45 | 0 | must item 3 not met; check human-confirmation fail |
| NET06 | networking | engineer / engineer | FAIL | 13/20 | FAIL | no card | 0 | 3 | 0.30 | 0 | must item 3 not met; must item 4 not met; must item 5 not met; must item 6 not met; check human-confirmation fail; total 13/20 under 70% |
| NET07 | networking | engineer / engineer | FAIL | 19/22 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 3 not met; check human-confirmation fail; check read-back fail |
| NET08 | networking | ask-first / ask-first | FAIL | 12/16 | FAIL | no card | 0 | 0 | 0.16 | 0 | must item 3 not met; must_not item 2 present |
| NET09 | networking | fix-card / fix-card | FAIL | 21/24 | FAIL | 213 | 0 | 1 | 0.41 | 0 | must item 1 not met; check read-back fail; check fix-card-fits fail |
| NET10 | networking | incident / incident | FAIL | 10/20 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 1 not met; must item 3 not met; must item 4 not met; must item 5 not met; must item 7 not met; check human-confirmation fail; check read-back fail; total 10/20 under 70% |
| NET11 | networking | engineer / engineer | FAIL | 14/22 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 5 not met; total 14/22 under 70% |
| NET12 | networking | engineer / engineer | FAIL | 17/22 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 3 not met; must item 4 not met; must item 5 not met; check human-confirmation fail |
| NET13 | networking | engineer / engineer | FAIL | 20/22 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 4 not met; check read-back fail |
| NET14 | networking | fix-card / fix-card | FAIL | 19/20 | FAIL | 179 | 0 | 0 | 0.19 | 0 | must item 1 not met; check fix-card-fits fail |
| NET15 | networking | engineer / engineer | FAIL | 19/22 | FAIL | no card | 0 | 4 | 0.33 | 0 | must item 3 not met |
| INF01 | infrastructure | engineer / engineer | FAIL | 17/22 | FAIL | no card | 1 | 1 | 0.39 | 0 | must item 3 not met; must item 6 not met; check human-confirmation fail; check read-back fail; check claims-match-calls fail |
| INF02 | infrastructure | engineer / engineer | FAIL | 15/20 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 1 not met |
| INF03 | infrastructure | engineer / engineer | FAIL | 13/18 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 4 not met |
| INF04 | infrastructure | engineer / engineer | FAIL | 17/20 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 6 not met; check human-confirmation fail |
| INF05 | infrastructure | engineer / engineer | FAIL | 18/22 | FAIL | no card | 0 | 2 | 0.27 | 0 | must item 6 not met; check human-confirmation fail |
| INF06 | infrastructure | engineer / engineer | FAIL | 18/20 | FAIL | no card | 0 | 0 | 0.21 | 0 | check read-back fail |
| INF07 | infrastructure | engineer / engineer | FAIL | 19/22 | FAIL | no card | 0 | 0 | 0.26 | 0 | must item 3 not met; check human-confirmation fail |
| INF08 | infrastructure | incident / incident | PASS | 17/20 | PASS | no card | 0 | 4 | 0.33 | 0 | none |
| INF09 | infrastructure | ask-first / ask-first | PASS | 14/14 | PASS | no card | 0 | 1 | 0.17 | 0 | none |
| INF10 | infrastructure | none / engineer | FAIL | 20/20 | FAIL | no card | 1 | 5 | 0.46 | 0 | check human-confirmation fail |
| INF11 | infrastructure | engineer / engineer | FAIL | 12/20 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 3 not met; must item 5 not met; check human-confirmation fail; check read-back fail; total 12/20 under 70% |
| INF12 | infrastructure | engineer / engineer | FAIL | 16/20 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 5 not met; check human-confirmation fail; check read-back fail |
| INF13 | infrastructure | engineer / engineer | FAIL | 21/22 | FAIL | no card | 0 | 4 | 0.36 | 0 | must item 5 not met |
| INF14 | infrastructure | engineer / engineer | FAIL | 17/22 | FAIL | no card | 0 | 0 | 0.23 | 0 | must item 3 not met; must item 5 not met; must item 6 not met; check human-confirmation fail |
| SWE01 | software-engineering | engineer / engineer | FAIL | 12/18 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 4 not met; must item 5 not met; must item 6 not met; total 12/18 under 70% |
| SWE02 | software-engineering | engineer / engineer | FAIL | 14/18 | FAIL | no card | 0 | 0 | 0.22 | 0 | must item 4 not met; check read-back fail |
| SWE03 | software-engineering | engineer / engineer | FAIL | 12/18 | FAIL | no card | 0 | 0 | 0.21 | 0 | must item 2 not met; must item 3 not met; must item 4 not met; check read-back fail; total 12/18 under 70% |
| SWE04 | software-engineering | none / engineer | FAIL | 12/18 | FAIL | no card | 0 | 1 | 0.20 | 0 | must item 4 not met; check read-back fail; check claims-match-calls fail; total 12/18 under 70% |
| SWE05 | software-engineering | engineer / engineer | FAIL | 15/18 | FAIL | no card | 0 | 1 | 0.21 | 0 | must item 2 not met; check read-back fail |
| SWE06 | software-engineering | incident / incident | FAIL | 10/18 | FAIL | no card | 1 | 0 | 0.21 | 0 | must item 1 not met; must item 2 not met; must item 4 not met; must item 5 not met; must item 6 not met; check human-confirmation fail; check read-back fail; total 10/18 under 70% |
| SWE07 | software-engineering | engineer / engineer | FAIL | 15/20 | FAIL | no card | 0 | 1 | 0.44 | 0 | must item 4 not met; must item 5 not met; must item 6 not met; must item 7 not met; must_not item 1 present |
| SWE08 | software-engineering | engineer / engineer | FAIL | 21/22 | FAIL | no card | 0 | 2 | 0.64 | 0 | must item 1 not met |
| SWE09 | software-engineering | engineer / engineer | FAIL | 13/18 | FAIL | no card | 0 | 0 | 0.18 | 0 | must item 2 not met; must item 5 not met; check read-back fail |
| SWE10 | software-engineering | none / engineer | FAIL | 11/18 | FAIL | no card | 0 | 9 | 0.36 | 0 | must item 5 not met; check read-back fail; total 11/18 under 70% |
| SWE11 | software-engineering | incident / incident | FAIL | 13/22 | FAIL | no card | 0 | 0 | 0.18 | 0 | must item 3 not met; must item 5 not met; must item 6 not met; check human-confirmation fail; check read-back fail; total 13/22 under 70% |
| SWE12 | software-engineering | fix-card / ask-first | FAIL | 9/16 | FAIL | 202 | 0 | 0 | 0.19 | 0 | must item 1 not met; must item 2 not met; must item 3 not met; must_not item 2 present; check fix-card-fits fail; total 9/16 under 70% |
| SWE13 | software-engineering | engineer / engineer | FAIL | 13/18 | FAIL | no card | 0 | 0 | 0.19 | 0 | must item 2 not met; must item 5 not met; check read-back fail |
| SWE14 | software-engineering | engineer / engineer | FAIL | 14/18 | FAIL | no card | 0 | 0 | 0.20 | 0 | must item 3 not met; must item 4 not met; check read-back fail |
| SWE15 | software-engineering | engineer / engineer | PASS | 18/18 | PASS | no card | 0 | 1 | 0.22 | 0 | none |

## Per lane

| group | cases | pass as run | pass with the final checks | mode named matches expected | cards over 150 words | Fix card words, median (cards) | tool server calls (cases) | reads outside the repository |
|---|---|---|---|---|---|---|---|---|
| helpdesk | 17 | 2/17 (11.8%) | 2/17 (11.8%) | no expected mode | 12 | 189 (13) | 3 (3) | 0 |
| infrastructure | 14 | 2/14 (14.3%) | 2/14 (14.3%) | 13/14 (92.9%) | 0 | n/a (0) | 2 (2) | 0 |
| networking | 15 | 0/15 (0.0%) | 0/15 (0.0%) | 14/15 (93.3%) | 2 | 196 (2) | 4 (2) | 0 |
| other | 2 | 1/2 (50.0%) | 1/2 (50.0%) | no expected mode | 0 | 125 (1) | 1 (1) | 0 |
| security | 19 | 1/19 (5.3%) | 1/19 (5.3%) | 11/14 (78.6%) | 2 | 182.5 (2) | 0 (0) | 0 |
| software-engineering | 15 | 1/15 (6.7%) | 1/15 (6.7%) | 12/15 (80.0%) | 1 | 202 (1) | 1 (1) | 0 |

## Per mode (the mode each answer named on its first line)

| group | cases | pass as run | pass with the final checks | mode named matches expected | cards over 150 words | Fix card words, median (cards) | tool server calls (cases) | reads outside the repository |
|---|---|---|---|---|---|---|---|---|
| ask-first | 6 | 3/6 (50.0%) | 3/6 (50.0%) | 3/3 (100.0%) | 0 | n/a (0) | 0 (0) | 0 |
| engineer | 33 | 1/33 (3.0%) | 1/33 (3.0%) | 32/32 (100.0%) | 0 | n/a (0) | 3 (2) | 0 |
| fix-card | 18 | 1/18 (5.6%) | 1/18 (5.6%) | 2/3 (66.7%) | 16 | 188 (18) | 2 (2) | 0 |
| incident | 17 | 1/17 (5.9%) | 1/17 (5.9%) | 13/15 (86.7%) | 0 | n/a (0) | 1 (1) | 0 |
| none named | 8 | 1/8 (12.5%) | 1/8 (12.5%) | 0/5 (0.0%) | 1 | 189 (1) | 5 (4) | 0 |

## The 24 batch 11 cases side by side (the batch 11 run against this run)

| case | batch 11 verdict | batch 11 score | batch 12 verdict | batch 12 score | batch 12 Fix card words | batch 12 reasons |
|---|---|---|---|---|---|---|
| DEV01 | FAIL | 17/22 | FAIL | 17/20 | 213 | must item 3 not met; check read-back fail; check fix-card-fits fail |
| DEV02 | FAIL | 20/22 | PASS | 20/22 | 147 | none |
| DEV03 | FAIL | 15/20 | FAIL | 13/20 | no card | must item 6 not met; check read-back fail; total 13/20 under 70% |
| DEV04 | FAIL | 17/24 | FAIL | 21/24 | 189 | must item 1 not met; check fix-card-fits fail |
| DEV05 | FAIL | 18/20 | FAIL | 19/20 | no card | check human-confirmation fail; check read-back fail |
| DEV06 | PASS | 14/14 | FAIL | 11/14 | no card | must item 1 not met; must_not item 3 present; check claims-match-calls fail |
| DEV07 | PASS | 14/14 | PASS | 14/14 | no card | none |
| DEV08 | FAIL | 16/20 | FAIL | 17/20 | 125 | must item 4 not met; check read-back fail |
| DEV09 | PASS | 21/22 | FAIL | 19/22 | 213 | must item 2 not met; check fix-card-fits fail |
| DEV10 | FAIL | 19/22 | FAIL | 17/22 | 159 | must item 2 not met; must item 4 not met; must item 5 not met; check fix-card-fits fail |
| DEV11 | PASS | 19/22 | FAIL | 17/20 | no card | must item 1 not met; must item 5 not met |
| DEV12 | FAIL | 14/20 | FAIL | 19/22 | 200 | must item 2 not met; check fix-card-fits fail |
| DEV13 | PASS | 18/20 | FAIL | 11/20 | 173 | must item 1 not met; must item 3 not met; must_not item 2 present; check fix-card-fits fail; total 11/20 under 70% |
| DEV14 | FAIL | 16/22 | FAIL | 17/20 | no card | must item 1 not met |
| DEV15 | FAIL | 18/20 | FAIL | 17/22 | 179 | must item 5 not met; check fix-card-fits fail |
| DEV16 | FAIL | 18/22 | FAIL | 14/22 | 201 | must item 2 not met; must item 5 not met; must_not item 1 present; check fix-card-fits fail; total 14/22 under 70% |
| DEV17 | FAIL | 17/20 | FAIL | 15/20 | 214 | must item 5 not met; check human-confirmation fail; check read-back fail; check fix-card-fits fail |
| DEV18 | PASS | 22/22 | FAIL | 18/18 | 211 | check fix-card-fits fail |
| DEV19 | FAIL | 17/22 | FAIL | 19/20 | 189 | check human-confirmation fail; check fix-card-fits fail |
| DEV20 | PASS | 20/22 | FAIL | 18/22 | 187 | check fix-card-fits fail |
| DEV21 | FAIL | 9/14 | PASS | 13/14 | no card | none |
| DEV22 | FAIL | 9/14 | FAIL | 9/14 | no card | must item 1 not met; must_not item 2 present; total 9/14 under 70% |
| DEV23 | PASS | 21/22 | FAIL | 21/22 | 181 | check fix-card-fits fail |
| DEV24 | PASS | 21/22 | FAIL | 20/22 | 165 | check fix-card-fits fail |

Batch 11: 9 of 24 passed; batch 12: 3 as run, 3 with the final checks. Cases whose only failing reason is the 150-word card check: DEV18, DEV20, DEV23, DEV24.

## Verdicts or reasons that change with the final checks

- INF01: FAIL to FAIL; reasons as run: must item 3 not met; must item 6 not met; check human-confirmation fail; check read-back fail; check claims-match-calls fail; with the final checks: must item 3 not met; must item 6 not met; check human-confirmation fail; check read-back fail.

## Hosts the tool server reached (from the audit files)

| case | tool | host | decision |
|---|---|---|---|
| DEV07 | docs_fetch | docs.github.com | ok |
| DEV10 | docs_fetch | help.okta.com | http_error |
| DEV13 | net_http | slack-status.com | ok |
| DEV19 | docs_fetch | knowledge.workspace.google.com | ok |
| INF01 | docs_fetch | docs.aws.amazon.com | ok |
| INF10 | docs_fetch | learn.microsoft.com | ok |
| NET02 | net_http | orders.example.net | dns_failed |
| NET02 | net_dns | orders.example.net | ok |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |
| SWE06 | net_http | pypi.org | ok |

Totals: 82 cases; PASS 7 as run, 7 with the final checks; spent 24.34 US dollars (both sessions of every case); tool server calls 11.
