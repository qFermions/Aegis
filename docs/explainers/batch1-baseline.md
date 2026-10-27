# Batch 1: what Aegis can do today, and what changed

For the owner. One page. Details: `docs/aegis/capability-map.md`, `docs/aegis/boundary-audit.md`, `PROJECT_STATE.md`, `checks.md`.

## What Aegis can do today

- The capability map has 35 rows across the five capabilities, Microsoft and Google kept apart: 17 verified now, 1 implemented but unverified, 13 partial, 4 missing. Every "verified now" row cites a test or command run in this session.
- Verified now: ticket routing and risk floors on both corpora (28/28 Microsoft tickets, 38/38 Google tickets, every dangerous pair floored), Okta and Jamf routing, the advisory-only gates in every runbook (77 commands lint clean), the ticket graph, the replay and memory engines, the scanner, and the Jira client's GET-only boundary.
- Not proven: answer quality. The ticket evals check routing and runbook structure; nobody has scored the answers with the model-judged rubric yet.
- Test battery: 588 tests, 588 pass in a clean clone (505 at the start, 83 added by this batch). Capture: `docs/baseline/branch/node-test.txt:746-749`.

## What the boundary audit found

- 19 paths that could change something outside this machine were checked, file and line.
- 1 violation: the Jira client could create, comment on and transition tickets after an `--execute` flag and a confirm phrase that the preview itself printed, so a model with a shell could finish the write alone. Fixed: the client now sends GET only, prints each write as a HUMAN-RUN procedure (portal steps, a bash line, a PowerShell 7 line), and the `verify-*` read-backs prove the administrator's own write (payload digest, a not-before time, the expected status).
- 3 rows have no code gate and are left for you: the support agents and the development agents hold a shell (rows 4 and 5), and the checklist runner runs whatever a checklist names (row 12). Closing them changes the agents' tools, a hook in `.claude/settings.json`, or the checklist format.

## Untrusted input

57 new tests cover instruction injection, poisoned memory and a case that mixes two tenants. The expected decision was committed before any test body. They found and fixed: markers hidden by zero-width or look-alike letters, instruction text accepted into the replay cache, memory records edited on disk being served as verified, a tenant literal disguised the same way, a second org's tokens in a case, and stores that served one tenant's knowledge to another (each store now binds to one tenant and refuses the rest, exit 6).

## Other changes

- CLAUDE.md went from 39,948 bytes to 19,041; every moved passage is in `docs/aegis/` and the four lost passages are restored. A test fails at 20,000 bytes.
- PRODUCT_CONTRACT.md carries the boundary and the standing rules, with a "Changes in this batch" section.
- Three review rounds: 45 findings, 42 fixed with a test each, 3 closed with a reason (`checks.md`, "Review rounds").

## What batch 2 should be

Microsoft 365 account-access recovery: locked account, password reset, MFA re-registration, a Conditional Access sign-in block. 12 of the 28 Microsoft corpus tickets are this class, and the rows it rests on (routing, compromise floors, tier floor, replay and memory, runbook gates, Jira boundary) are verified now. It needs a scored model-judged run on those 12 tickets, sanitized sign-in log fixtures, and the Jira note wired to `verify-comment`; the Google 2-Step Verification counterpart is proven separately afterwards.

## Decisions for you

- Rows 4, 5 and 12 of the boundary audit: whether to give the agents a code gate.
- Whether replay case files get a seal like the memory store, which would withhold every existing verified case until it is verified again.
- The open items you already hold: `.env` deny rules, branch protection, held-out eval cases.
