# Batch G2: an IT department on Google Workspace, Fleet, Jamf Pro, Slack and Linear

For the owner. One page. Details: `docs/aegis/lanes/g2.md` (the lane spec and its sources), `docs/aegis/capability-map.md` (rows 37 to 62), `docs/aegis/boundary-audit.md` (rows 20 to 28), `PROJECT_STATE.md`, `checks.md`.

## What a ticket gets now

- 25 new runbooks, operator-only: Fleet 5, Linear 4, Slack 6, Jamf Pro 5, Google Workspace 5. Each gives the admin-console steps first, the CLI or API version collapsed and commented, the role each change needs, stop conditions, the read-back that proves the fix, the rollback and its limits, one checklist and one ticket note.
- Linear is the ticket system for this lane: every runbook ends with a Linear-ready note. Aegis prints the note and its SHA-256; a person posts it; `node scripts/adapters/linear-client.js verify-comment` proves the post by a read. The Jira path stays beside it.
- Slack runbooks write message drafts; a person posts them, and `verify-posted` reads the channel afterwards.
- A Google Workspace posture audit (`node scripts/gws-posture-audit.js`): 8 checks, each with its read-only Admin console path, a GAM read and a dated Google source; it reads a GAM export and writes one local report behind an exact phrase.

## The boundary: Aegis advises, a person executes

- Five read-only adapters (`scripts/adapters/`) share one contract: allow-listed GET reads, Linear GraphQL query documents, and each vendor's token exchange. Every other request is refused before a credential is read. Each adapter is a dry run until the bare `--execute`.
- No code path writes to Google, Fleet, Jamf, Slack or Linear (boundary audit, rows 20 to 28). Every state change in the 25 runbooks is behind an action-local gate the administrator answers, or is an inert preview: 177 inventory entries, 142 gated, 35 preview.
- Tests never touch a network: every adapter test loads a tripwire that throws on any socket.

## What is proven, and what is not

- Proven by deterministic checks: 63/63 G2 corpus tickets and 12/12 dangerous pairs, each platform scored on its own (Fleet 13, Linear 11, Slack 14, Jamf 12, Google 13); the tier floor per platform; the gate grammar; the adapters' read-only behaviour; the posture audit. `node --test`: 998 tests, 998 pass (588 at batch 1).
- Microsoft and the batch 1 Google corpora are unchanged: 28/28 with 6/6 pairs, 38/38 with 9/9 pairs.
- Not proven: answer quality (no model-judged run), and vendor facts. This session's network refused the vendor documentation hosts, so every breadcrumb, privilege name and API path rests on a vendor repository (Fleet's docs source, Linear's schema, Slack's SDK and OpenAPI spec, Google's discovery documents) or on a search excerpt (Jamf, Slack help, Linear help, Google help). The runbooks mark each one; the report lists them for a hand check.
- Never run against a real tenant: mocks and fixtures only, no credentials.

## Decisions for you

- `/gws-audit-log` still sends a Google compromise to the Microsoft-only `/security-alert-triage` (`.claude/commands/gws-audit-log.md:40`, `:73`, `:79`, `:91`, `:123`); pointing it at `/gws-account-containment` is a one-file change this batch did not make.
- Allow the vendor documentation hosts in the environment's network policy, then re-check the facts marked as search excerpts.
- "SLA breached" floors through the compromise rule (it fails safe); the corpus words that ticket "missed its SLA".
- A dead clause in the Microsoft portal grammar (`scripts/command-safety-gates.test.js:630`, the `\\s` in a regex literal) hides 9 Microsoft gate candidates; fixing it changes Microsoft rows.
