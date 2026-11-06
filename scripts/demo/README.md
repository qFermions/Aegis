# Customer Desk demo (batch 6)

One command that plays a support desk end to end. Fictional customers send tickets; the real Aegis code takes them in; a real Aegis session answers; the real checks grade the answer; a clearly labeled SIMULATED OPERATOR carries out the approved step on a simulated tenant; the real connector code reads it back and proves it or does not. Every step shows in the terminal and in one local HTML page.

AEGIS ADVISES; HUMANS EXECUTE. In this demo nothing Aegis runs can change a tenant. The only code that changes one is `sim/gates.js`, and it writes only the simulated tenant file inside the run folder.

This is a demo, not an evaluation. Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality. The held-out evaluation measures quality and is not part of this.

## How to run it

The dry run prints the plan and an allowance estimate, starts no model, creates no folder and exits 4:

```bash
node scripts/demo/customer-desk.js
```

The full run, then a subset. Run these from a plain signed-in terminal at the repository root, not from inside another Claude Code session:

```bash
node scripts/demo/customer-desk.js run --execute
node scripts/demo/customer-desk.js run --only T4,T6 --execute
```

The messy ticket set (batch 8): the same eight tickets written as real users write them, T1m to T8m, in the same customer folders (`customers/tickets-messy.json`). The tidy set stays the default.

```bash
node scripts/demo/customer-desk.js run --set messy --execute
```

Rebuild the page from a saved run, with no model call:

```bash
node scripts/demo/customer-desk.js --view ~/aegis-demo-runs/<run-id>
```

Results go to `~/aegis-demo-runs/<run-id>/`, or to `--results-dir <dir>`, which must be empty. A folder inside the repository is refused unless git ignores it and tracks nothing in it (`scripts/eval/judged/paths.js`); there the replay cache refuses its store (`replay-cli.js`, guard R8), so a resolved ticket is reported as not stored, and no later ticket can hit it. Open `desk.html` from the folder in a browser; it fetches nothing.

Exit codes: 0 the run finished and no ticket is FAILED; 2 a ticket is FAILED, which wins over 1; 3 the allowance guard stopped the run before every ticket ran; 4 dry run; 1 an input error, a refused folder, or the desk could not finish a ticket. If the network tripwire fires, the run stops, exits 1 and marks `run.json` and the page.

## What it costs

`--budget-usd N` stops the run before a ticket that could pass N, counting `--spent-usd N` from earlier commands, and names the tickets that did not run. It reads the likely cost of a ticket from `LIKELY_USD` in `customer-desk.js`: 2 US dollars, 4 for T2. Each session also gets `--max-budget-usd` with what is left, because a session can cost more than its likely figure. A session killed with no cost reported (at its 25-minute timeout or the output cap) stops the run too, because what it spent is unknown.

Up to one Aegis session per ticket, on your subscription. The estimate is 2.50 US dollars of allowance per session, the figure in `docs/evidence/runtime-smoke.md`; the full set is at most 8 sessions, about 20.00 US dollars. Each real session's `total_cost_usd` is shown under step 4 and added up in the summary. A cache hit starts no session.

## What is real

| Step | Code | What it does |
|---|---|---|
| 2 INTAKE | `scripts/intake/intake.js` | State, redaction counts, injection flags, the graph case |
| 3 TRIAGE | `scripts/replay/replay-cli.js`, `scripts/intake/clarify.js` | Replay lookup, risk floor |
| 4 AEGIS | `scripts/eval/judged/backends.js` | `claude -p` from the repository root; read-only tools; scrubbed environment; only this repository's settings and CLAUDE.md, and deny rules on this work's records, the demo's code and expected answers, the grader and ticket corpora, scored answers and the run folders the CLI can name (`isolationArgs`; what the CLI loads is in `docs/aegis/demo/evidence/batch7/isolation-probe.txt`, and what a real session did is in `docs/aegis/demo/evidence/full-run-1/`; a run under a custom folder from an earlier command is not denied); or a replay of a verified answer with no model |
| 5 CHECKS | `scripts/eval/judged/checks.js`, `answer.js` | Boundary, human confirmation, read-back, privacy, observed output, probe; then five answer checks that are shown and stop nothing: the Fix card first, its five parts in order, at most 150 words, no command outside the `aegis-desk` block, no default-environment fact the customer's profile lacks |
| 6 APPROVAL | `scripts/audit/change-record.js` | Opens the change record; the person approving is simulated |
| 8 READ-BACK | `scripts/adapters/*-client.js`, `change-record.js status` | The connector's own request, allow-list and verdict; only the wire is replaced |
| 9 CLOSE | `replay-cli.js record` and `verify` | A resolved ticket whose answer passed every check enters that customer's own replay store |

## What is simulated

- **The customers and tickets** (`customers/`). Every name is a role or a placeholder, and every domain an `example.*` domain. A raw item in the repository writes the customer's own domain as `[@Aegion_DOMAIN]`, because the scanner allows only the bare `example.*` domains in an address; the desk fills it in when the customer sends the item.
- **The person who approves and acts: the SIMULATED OPERATOR** (`sim/gates.js`). A table from a runbook's gate id to the state change that gate describes. A gate it does not map stops the ticket OPEN with "not simulated".
- **The vendors** (`sim/vendors.js`). The connector's request is answered from the simulated tenant through the transport seam the connector tests use. No vendor host is ever contacted, and the runner loads `scripts/adapters/socket-tripwire.js`, so a request that missed the seam would throw. The credentials are generated in memory for one run.

Every simulated part says SIMULATED in text.

## What the demo adds to a session

Desk sessions run with `--max-turns 40` and `--no-session-persistence`. The session is told the customer's label and platforms, the customer's own `profile.md` (`customers/<id>/profile.md`), marked as data that replaces CLAUDE.md's default environment for that ticket (batch 8), the replay lookup's real result (it has no shell to run the lookup itself), and to write one `Gate: <gate id>` line per change it advises, or `Gate: none`, in the `aegis-desk` block that closes its answer (`docs/aegis/answer-format.md`). Step 6 needs to know which gate the answer relies on. Only the Gate lines inside that closing block count; an answer in the older form, with no block, counts only the unquoted Gate lines that close it. So a `>` quote from the ticket, a line earlier in the answer or a mention in passing selects nothing. Nothing else is added: the ticket text goes in below the pasted-evidence header, as data, and no runbook is changed.

## One gate at a time

Steps 7 and 8 take the approved gates in order: the SIMULATED OPERATOR applies one gate, its read-back runs, then the next gate (batch 8). A read-back that shows the change not done stops the ticket there, FAILED; a read that ran and proved nothing (a "not yet" answer, a read that could not run) stops it too, INCONCLUSIVE, as CLAUDE.md's "verify or it didn't happen" asks. No later gate is applied, and step 7 names each one. Before the first gate, every gate is applied once to a copy in memory, so a gate the simulator cannot act out stops the ticket OPEN before anything changes. An R1 gate takes no change record; when its runbook section names exactly one read line (a `verify-*` line with no `--change`), that read runs and its exit 0 is the proof. A section with two different reads names alternatives or reads for other changes, so it gives none. A gate with no read proves nothing, the ticket ends INCONCLUSIVE, and the next gate still runs, since its runbook says its proof is the read its own step names.

## Closing states

| State | When |
|---|---|
| RESOLVED (SIMULATED) | Every read-back passed and each change record reads done. The reason says so when the answer did not pass every check; such an answer is not stored |
| INCONCLUSIVE | A change was simulated and at least one read-back proves nothing, or its gate names no read at all |
| INVESTIGATE | An answer that closes with `Gate: none`, asks no question, and whose steps (the Fix card's "Do this" steps, or its numbered steps when it has no card) hold no change word closes INVESTIGATE, with the steps listed. Nothing is approved or applied |
| OPEN | The answer names no gate the runbooks know, names a PREVIEW ONLY marker, or names a gate the simulator does not map or that changes nothing in the simulated tenant; the session did not finish; or the desk could not finish the ticket |
| CLARIFY | The answer closes with `Gate: none` and asks a question: a question mark that ends a sentence anywhere in a line of its own text, inside quote marks too, but not in a `>` quote, a heading, an all-bold line or code |
| FAILED | The boundary check matched, the probe check matched, or a read-back shows the change not done. A check is a text match: a person should read the answer |

## What to expect from the runbooks as they are

The demo shows Aegis as it is. Several tickets should not resolve, and that is a finding rather than a fault of the demo. Each outcome depends on the gates the answer names; what each real run closed as is in `docs/aegis/demo/evidence/full-run-*/summary.md`.

- **T4**: the runbook has only PREVIEW ONLY markers for a mailbox grant (`mailbox-grant-portal`, `mailbox-full-access-grant` and `mailbox-send-as-grant` in `.claude/commands/mailbox-permissions.md`), and no connector reads Exchange delegation, so T4 ends OPEN.
- **T8**: it can hit the cache only when T4 was verified in the same run, so with the real runbooks it should be a MISS and get its own session. The CACHE_HIT path is proved in `customer-desk.test.js` with a fixture gate.
- **T3**: the Google password gates and the Jamf gates name no read, so T3 ends INCONCLUSIVE after the simulated changes.
- **T5**: a "look first" answer that advises no change closes INVESTIGATE.

## Files

| File | What it is |
|---|---|
| `customer-desk.js` | The runner and CLI |
| `answer.js` | Reads an answer the way a tech meets it: the Fix card, the closing `aegis-desk` block, the five answer checks of step 5 and the INVESTIGATE step rule (batch 8) |
| `catalog.js` | What the runbooks say about a gate, read with the audit code's own parsers |
| `customers.js`, `customers/` | The fictional data and its loader: `customers.json`, `tickets.json` (the tidy set), `tickets-messy.json` (the messy set), and per customer `tenant.json` and `profile.md` (what the session is told about that customer, in place of CLAUDE.md's default environment) |
| `fixtures/` | Test fixtures, kept as `.txt` so no check reads them as instructions: three answers in the Fix card format and two answers from full run 1 |
| `sim/gates.js` | The SIMULATED OPERATOR: gate id to state change |
| `sim/vendors.js` | Answers connector requests from the simulated tenant |
| `render.js` | The terminal lines and `desk.html` |

The page (`desk.html`) names the steps for a reader who does not code: 1 Customer, 2 Ticket received, 3 Sorted, 4 Aegis's answer, 5 Safety checks, 6 Sign-off, 7 Changes made (simulated), 8 Double-check, 9 Result. Each step opens with one plain sentence; the technical text sits under a "Technical details" fold. `run.json` and the terminal keep the step names in the table above.

Inside a run folder: `run.json`, `desk.html`, and `customers/<id>/` with `tenant.json`, `audit/`, `replay/`, `cases/` and `tickets/` (the raw item, the answer, the session's stream and init event, the ticket note).

## Tests

`node --test scripts/demo/*.test.js`. No test runs a model: the sessions are the fake CLI in `scripts/eval/judged/fixtures/fake-claude.js`, under the socket tripwire. CI runs the dry run and checks exit 4.

To add a gate to the simulator: add its id to `SIM_GATES` with the state change its runbook describes. `customer-desk.test.js` then runs it through its own read-back and fails if the connector does not pass it.
