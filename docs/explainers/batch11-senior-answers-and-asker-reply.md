# Batch 11 in plain words: right on new tickets, and a reply a person can read

Aegis is the IT assistant in this repository. It tells a technician what to do; a person makes every change. A scoring tool grades its answers against test tickets; the practice desk runs it on made-up tickets against pretend company systems.

## What was wrong

- On 20 tickets nobody had shown Aegis, the commander's run passed 9. Aegis answered for the default Microsoft setup when the ticket named no system, and was graded against another platform.
- A ticket with nothing to go on ("The printer is broken.") got five steps, and its one useful question came last.
- The scoring tool failed an answer that quoted a planted instruction while refusing it.
- Answers missed four habits of a senior technician (below), and there was no short reply for the person who asked.

## What changed

- **The scoring tool can say what the company runs** (`setup`), and Aegis gets it as data, not instructions.
- **Aegis says which setup it assumed** when nobody said: one line under the heading.
- **Ask first**: a ticket with nothing to go on gets one question and nothing else.
- **Four habits**, written into the answer rules and 60 runbooks on Microsoft, Google, Okta, Jamf, Slack, GitHub and Linear: give a new way in before taking the old one away (a lost phone); after closing an access hole, check who else used it and what left; check how wide an outage is before why; show each change's risk class and its double-check. Plus: a supplier whose mail fails the sender checks fixes it on their side, and a leaver plan says where their mail goes, what it costs and when it is gone for good.
- **A reply to the person who asked**: `--reply-to asker` prints three short paragraphs in plain words, for you to send. Aegis sends nothing.
- **The exam wall**: Aegis cannot read the test answers; the tool records every file it read.
- **New in this session**: every test run names its model. Your settings default to Fable, which was rate-limited; every run here was on Opus 5.5 and records it. A run on another model does not count.

## What is not proved

- The 24 test tickets of the scoring run were written by the builder next to the rules, so they are not an independent measure. Only the commander's own 20 tickets are.
- No real tenant was touched; the new Microsoft check of the temporary pass was tested against pretend answers only.
- Some vendor facts are marked UNCONFIRMED; those steps say "check the vendor page".

## The runs (15.80 of the 18 US dollars allowed)

- **Scoring run, 24 builder tickets**: 9 passed, 15 failed, none unclear. Both ask-first tickets failed: Aegis asked two questions instead of one. No file outside the repository was read.
- **Six replies to the asker**: 91 to 147 words; 5 pass the form check; one talks about the new starter instead of to "you". Read them in `docs/aegis/demo/evidence/batch11/asker-replies.md`.
- **Messy practice set** (9 tickets): 8 fixed and checked in the pretend systems, 1 question back (T7m). The lost-phone ticket now gives the temporary pass first and removes the old phone after, though its answer still names no admin role for the pass.
- **Tidy set**: 5 of 8 ran (4 fixed, 1 question back); T2, T3 and T6 did not fit the money left.
- Every Fix card is still over the 150-word limit (154 to 249 words).

Quiz: `docs/explainers/batch11-senior-answers-and-asker-reply-quiz.md`. Details for the next engineer: `PROJECT_STATE.md`, "Changed by batch 11".
