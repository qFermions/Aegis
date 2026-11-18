# Batch 12 in plain words: from helpdesk to expert

Aegis is the IT assistant in this repository. It tells a technician what to do; a person makes every change. A scoring tool grades its answers against test tickets; the practice desk runs it on made-up tickets against pretend company systems.

## What changed

- **Five habits, as rules**: send a smell of compromise to security, and say who decides; give the lowest access, through a group, with an approver and an end date; restore to a safe place and check it before replacing anything, and revoke a leaked secret before cleaning up; ask one question first when the cause is unclear and the obvious fix weakens a control; keep the Fix card to 150 words. They are in the answer rules and in 80 of the 108 older runbooks.
- **Four answer shapes**, named on the first line: Fix card (150 words), Engineer answer (400: evidence, ranked causes each with a test, the code, the blast radius), Incident answer (300: severity, contain first and who decides, evidence to keep), Ask first (one question).
- **Four new expert lanes**: security, networking, infrastructure and cloud, software engineering. Each has a knowledge folder, runbooks, checked vendor facts and test cases. 25 new runbooks; every change step sits behind a safety gate or is marked preview only (networking has no gate: all 16 of its change steps are previews).
- **Public lookups**: a small tool server lets Aegis read vendor documentation (29 allowed sites) and look up public DNS, web pages and certificates. It refuses private addresses, keeps a log of every call, and `--no-tools` turns it off.
- **No silent Microsoft default**: when no setup is given, the answer says what it assumed and invites you to say what the company runs.
- **The reply to the person who asked** may only say Aegis checked something when a lookup really happened.
- **Start Aegis**: double-click a file on a Mac or Windows PC; it asks one question and opens the chat.
- **The safety scanner** now reads cloud, Kubernetes, Terraform and server commands.

## What the runs showed (33.64 of the 45 US dollars allowed)

- **Scoring run, 82 builder tickets**: 7 passed. The builder's tickets are not an independent measure. Most failures were one or two expert points the answer left out, or an Engineer or Incident answer with no confirmation block; 17 of 19 Fix cards were over 150 words, which is now a fail by itself (4 of the old tickets failed only on that).
- **Eight replies to the asker**: 6 pass the form check; the two that ask one question fail the "talk to you" rule.
- **Practice desk**: messy set 8 fixed and checked, 1 question back; tidy set 7 fixed, 1 question back.
- **Lookups**: the tool server was used on 9 of the 82 scoring tickets and on none of the practice tickets.

## What you should know

- The lookups can reach any public website or name, not only the documentation list. After a planted instruction in a ticket, that could carry ticket text out. You decide: keep it, limit lookups to a list, or turn the server off by default.
- On one ticket about lost git commits, Aegis read this repository's own git history as if it were the asker's and printed your local folder path. The saved copy is masked; the proposed fix is to block the `.git` folder.
- No real tenant, cloud account or network was touched.

Quiz: `docs/explainers/batch12-expert-lanes-quiz.md`. Details for the next engineer: `PROJECT_STATE.md`, "Changed by batch 12".
