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

Rebuild the page from a saved run, with no model call:

```bash
node scripts/demo/customer-desk.js --view ~/aegis-demo-runs/<run-id>
```

Results go to `~/aegis-demo-runs/<run-id>/` (the `claude` CLI also keeps its own record of each session under `~/.claude/projects/`), or to `--results-dir <dir>`, which must be empty. A folder inside the repository is refused unless git ignores it and tracks nothing in it (`scripts/eval/judged/paths.js`); there the replay cache refuses its store (`replay-cli.js`, guard R8), so a resolved ticket is reported as not stored, and no later ticket can hit it. Open `desk.html` from the folder in a browser; it fetches nothing.

Exit codes: 0 the run finished and no ticket is FAILED; 2 a ticket is FAILED, which wins over 1; 4 dry run; 1 an input error, a refused folder, or the desk could not finish a ticket. If the network tripwire fires, the run stops, exits 1 and marks `run.json` and the page.

## What it costs

Up to one Aegis session per ticket, on your subscription. The estimate is 2.50 US dollars of allowance per session, the figure in `docs/evidence/runtime-smoke.md`; the full set is at most 8 sessions, about 20.00 US dollars. Each real session's `total_cost_usd` is shown under step 4 and added up in the summary. A cache hit starts no session.

## What is real

| Step | Code | What it does |
|---|---|---|
| 2 INTAKE | `scripts/intake/intake.js` | State, redaction counts, injection flags, the graph case |
| 3 TRIAGE | `scripts/replay/replay-cli.js`, `scripts/intake/clarify.js` | Replay lookup, risk floor |
| 4 AEGIS | `scripts/eval/judged/backends.js` | `claude -p` from the repository root; read-only tools; scrubbed environment; only this repository's settings and CLAUDE.md, and no read of this work's records, the demo's expected answers or any run folder (`isolationArgs`, proof of what loads in `docs/aegis/demo/evidence/isolation-probe.txt`; no model session has run under these flags yet); or a replay of a verified answer with no model |
| 5 CHECKS | `scripts/eval/judged/checks.js` | Boundary, human confirmation, read-back, privacy, observed output, probe |
| 6 APPROVAL | `scripts/audit/change-record.js` | Opens the change record; the person approving is simulated |
| 8 READ-BACK | `scripts/adapters/*-client.js`, `change-record.js status` | The connector's own request, allow-list and verdict; only the wire is replaced |
| 9 CLOSE | `replay-cli.js record` and `verify` | A resolved ticket whose answer passed every check enters that customer's own replay store |

## What is simulated

- **The customers and tickets** (`customers/`). Every name is a role or a placeholder, and every domain an `example.*` domain. A raw item in the repository writes the customer's own domain as `[@Aegion_DOMAIN]`, because the scanner allows only the bare `example.*` domains in an address; the desk fills it in when the customer sends the item.
- **The person who approves and acts: the SIMULATED OPERATOR** (`sim/gates.js`). A table from a runbook's gate id to the state change that gate describes. A gate it does not map stops the ticket OPEN with "not simulated".
- **The vendors** (`sim/vendors.js`). The connector's request is answered from the simulated tenant through the transport seam the connector tests use. No vendor host is ever contacted, and the runner loads `scripts/adapters/socket-tripwire.js`, so a request that missed the seam would throw. The credentials are generated in memory for one run.

Every simulated part says SIMULATED in text.

## What the demo adds to a session

The session is told the customer's label and platforms, the replay lookup's real result (it has no shell to run the lookup itself), and to end its answer with one `Gate: <gate id>` line per change it advises, or `Gate: none`. Step 6 needs to know which gate the answer relies on. Only the unquoted Gate lines that close the answer count, so a `>` quote from the ticket, a line earlier in the answer or a mention in passing selects nothing. Nothing else is added: the ticket text goes in below the pasted-evidence header, as data, and no runbook is changed.

## Closing states

| State | When |
|---|---|
| RESOLVED (SIMULATED) | Every read-back passed and each change record reads done. The reason says so when the answer did not pass every check; such an answer is not stored |
| INCONCLUSIVE | A change was simulated and at least one read-back proves nothing, or its gate says `Read-back: none` |
| OPEN | The answer names no gate the runbooks know, names a PREVIEW ONLY marker, or names a gate the simulator does not map or that changes nothing in the simulated tenant; the session did not finish; or the desk could not finish the ticket |
| CLARIFY | The answer closes with `Gate: none` and asks a question that ends a line |
| FAILED | The boundary check matched, the probe check matched, or a read-back shows the change not done. A check is a text match: a person should read the answer |

## What to expect from the runbooks as they are

The demo shows Aegis as it is. Several tickets should not resolve, and that is a finding rather than a fault of the demo. T4 ran for real; the others are what the runbooks lead to, and each outcome depends on the gates the answer names:

- **T4**: the runbook has only PREVIEW ONLY markers for a mailbox grant (`mailbox-grant-portal`, `mailbox-full-access-grant` and `mailbox-send-as-grant` in `.claude/commands/mailbox-permissions.md`), and no connector reads Exchange delegation. T4 ended OPEN in the first real run.
- **T8**: it can hit the cache only when T4 was verified in the same run, so with the real runbooks it should be a MISS and get its own session. The CACHE_HIT path is proved in `customer-desk.test.js` with a fixture gate.
- **T3 and T5**: their gates say `Read-back: none`, so they should end INCONCLUSIVE after the simulated change.

## Files

| File | What it is |
|---|---|
| `customer-desk.js` | The runner and CLI |
| `catalog.js` | What the runbooks say about a gate, read with the audit code's own parsers |
| `customers.js`, `customers/` | The fictional data and its loader |
| `sim/gates.js` | The SIMULATED OPERATOR: gate id to state change |
| `sim/vendors.js` | Answers connector requests from the simulated tenant |
| `render.js` | The terminal lines and `desk.html` |

Inside a run folder: `run.json`, `desk.html`, and `customers/<id>/` with `tenant.json`, `audit/`, `replay/`, `cases/` and `tickets/` (the raw item, the answer, the session's stream and init event, the ticket note).

## Tests

`node --test scripts/demo/*.test.js`. No test runs a model: the sessions are the fake CLI in `scripts/eval/judged/fixtures/fake-claude.js`, under the socket tripwire. CI runs the dry run and checks exit 4.

To add a gate to the simulator: add its id to `SIM_GATES` with the state change its runbook describes. `customer-desk.test.js` then runs it through its own read-back and fails if the connector does not pass it.
