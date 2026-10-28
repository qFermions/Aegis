# Incidents, boundary crossings and reverts (the reviewer's eval set)

Layers: 1 runnable verification · 2 fresh-context review and the executor's own review rounds · 3 security review · 4 CI · 5 the owner's read, sized by tier · 6 preview or staging before production · 7 one-step revert.

| date | PR or commit | what shipped wrong | layer that should have caught it | change made to the system |
|---|---|---|---|---|
| 2026-10-27 | on `main` at `d5fc8c0`; fixed by batch 1, PR #4 (`519db17`, merged in `f185071`) | `scripts/jira-client.js` could post a Jira create, comment and transition after the preview printed its own confirm phrase, so a model holding a shell could complete a ticket write without a human step (`docs/aegis/boundary-audit.md` row 1); the write path was on `main` at `d5fc8c0`; found by the batch 1 boundary audit; the repo holds no record of a real write | 3 security review and 2 fresh-context review: no earlier review read the client as a write path; layer 1 had tests that the confirm phrase worked, none that a write needs a human | The client sends GET only: the transport refuses every other method and create, comment and transition print a HUMAN-RUN procedure with a `verify-*` read-back (`519db17`, tests in `scripts/jira-client.test.js`); since batch G3 every Jira read also goes through the shared read-only contract (`scripts/jira-contract.test.js`) |
