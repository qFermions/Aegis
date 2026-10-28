# Read-only adapters (lane G2)

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). These adapters let Aegis read Fleet, Jamf Pro, Slack, Linear and Google Workspace through authorized read access, and prove a human's write with a `verify-*` read. No code here can send a write: every adapter is built on one contract, `readonly-contract.js`, and its tests (`readonly-contract.test.js`) prove each rule.

## The contract

| Rule | What the code does |
|---|---|
| Allow-list | A request is sent only when it is an exact (method, path) pair the adapter's spec names: a GET route with validated path parameters and query keys, or, for GraphQL, a POST to the spec's one GraphQL path whose query text is byte-equal to a named query document defined in code. Anything else is `REFUSED` before credentials are read and before the transport is called. |
| Reads only | Every method but GET is refused. A spec cannot even define a non-GET route, and a GraphQL document holding a `mutation` or `subscription` operation (also after a query in the same document) is refused and fails to build. |
| Token exchange | The only non-read request is the vendor's documented token exchange at its exact host and path, built by the client from the named credentials with exactly the declared grant fields. A raw request to the token path, or one carrying any other field, is refused. It is never retried. |
| Credentials | Read from named environment variables only, after the request is allowed. Missing variables give `NO_CREDENTIALS` and name the variable. No credential or token value appears in a result, an error, an exception or printed output; a response that echoes one is redacted. The module has no `fs` and no `console`. |
| Untrusted responses | Every string in a response is scanned with the shared injection markers (`scripts/tier/tier-guard.js`) plus agent-directed shapes; a hit is returned with its JSON path and a quoted excerpt under `flags`, and `renderResult` prints a fixed line saying it was not followed. Nothing in the client acts on response text. An excerpt is quoted only from text the command shows: Jamf scans the response after its secrets are stripped, Fleet's read-backs scan what they print, Linear's queries ask only for printed fields, Google Workspace withholds the excerpt on a user's personal fields, and Slack quotes only the fields each read exists to show (`QUOTED_FIELDS` in `slack-client.js`); every other flag keeps its path and says the text is withheld. |
| Tenant | An adapter that binds a tenant (Slack team, Linear workspace, Google customer) needs its tenant variable before any request; a response holding a record from another tenant is `TENANT_MISMATCH` and returns no data. Fleet and Jamf Pro serve one tenant per server and are bound by their configured host. |
| Failure states | `OK`, `REFUSED`, `NO_CREDENTIALS`, `HTTP_ERROR`, `TIMEOUT`, `NETWORK_ERROR`, `TENANT_MISMATCH`, `INVALID_RESPONSE`, and since batch G3 `SCOPE_REFUSED` (the credential holds a write scope beyond the manifest) and `AUDIT_FAILED` (the audit trail could not record the request, so its answer is withheld). A 3xx is never followed; a response over 5 MB or not JSON returns no data. |
| Retries (batch G3) | A read retries up to 2 times on a timeout, a network error, 429 or 5xx. A 429 or 503 with `Retry-After` (seconds or an HTTP date) waits exactly that long when it is 30 s or less; a longer one is not waited out. Otherwise the wait doubles from 200 ms to a 2 s cap, drawn from [base/2, base] (jitter). A retry is made only when its wait and one more full attempt fit in the read's retry budget (60 s). The token exchange is never retried. |
| Handoff (batch G3) | A read that gives up ends in a named handoff state on the result: `RETRIES_EXHAUSTED`, `RETRY_AFTER_TOO_LONG` (with `retry_after_seconds`) or `RETRY_BUDGET_SPENT`, each with `what_failed`, `not_done` and `next_step` in plain words. |
| Operator message (batch G3) | `renderResult` adds two fields to every failed result (and to a read-back that did not verify): `operator_message` (what happened, what was not done, the next step) and `admin_detail` (platform, operation, state, status, attempts, request id, handoff). Fixed text from `operator-message.js` plus the result's own checked fields: never a stack trace, a body or a credential. A request id the vendor returns (for example `x-request-id`, `x-github-request-id`, `x-okta-request-id`, `request-id`) is kept when it has a safe form. |
| Audit (batch G3) | Given an audit sink (`scripts/audit/audit-log.js`), every request, each read and the token exchange, is one `connector-call` entry: connector, operation, state, attempts, status, request id, handoff, duration. A failure that never reaches the network is one entry too, with 0 attempts: a missing credential (under the route's name) and a refused request (under `refused-request`, so refused input never enters the trail). No data, body or credential. A sink that fails turns the answer into `AUDIT_FAILED`. `node scripts/audit/audit-log.js status --since 24h` summarises failures by connector and state (task 6b). |
| Scope preflight (batch G3) | Each spec's `scopes` block points at its entry in `scope-manifest.json`. A person running a CLI gets the preflight; an injected test transport does not unless it asks. Slack: `x-oauth-scopes` on the first answer; Google Workspace: the token response `scope`; Fleet: `GET /api/v1/fleet/me` first. A scope or role beyond the manifest is `SCOPE_REFUSED` (exit 1, one audit entry), the answer is dropped and no later request is sent. Linear, Jira and Jamf Pro do not expose it: the first result carries a `scope_notice`. `node scripts/adapters/scopes.js <connector>` prints the entry; `--execute` checks the exported credential. Plain-English table: `docs/aegis/g3/scope-manifest.md`. |
| No network in tests | The default transport throws "Network tripwire fired" when `AEGIS_NETWORK_TRIPWIRE=1`. Every adapter test requires `socket-tripwire.js` first, which sets that variable and replaces every Node socket, HTTP, TLS, DNS and `fetch` entry point with the same error. |

Exit codes for every adapter CLI: `0` read or verified; `1` refused, input error or missing credentials; `2` read failed or a `verify-*` read did not prove the write; `3` a record from another tenant.

## The adapters

| File | Platform | Environment variables | Notes |
|---|---|---|---|
| `fleet-client.js` | Fleet REST API | `FLEET_URL`, `FLEET_API_TOKEN` | Bearer token of an API-only Observer user; no token exchange |
| `jamf-client.js` | Jamf Pro API and Classic API GETs | `JAMF_URL`, `JAMF_CLIENT_ID`, `JAMF_CLIENT_SECRET` | client-credentials exchange at `POST /api/oauth/token`; secret-disclosure reads (FileVault key, Recovery Lock, LAPS) are not on the allow-list |
| `slack-client.js` | Slack Web API read methods | `SLACK_TOKEN`, `SLACK_TEAM_ID`; `SLACK_ACCESS_LOGS_TOKEN` for `access-logs` only | `ok: false` answers are reported as failed reads with the error code only; scopes per command below |
| `linear-client.js` | Linear GraphQL, named queries only | `LINEAR_API_KEY`, `LINEAR_ORG` | `note` prints the ticket note, its SHA-256 and the HUMAN-RUN posting steps offline; `verify-comment` proves the posted note |
| `gws-client.js` | Admin SDK Directory and Reports, read scopes | `GWS_SA_CLIENT_EMAIL`, `GWS_SA_PRIVATE_KEY`, `GWS_ADMIN_SUBJECT`, `GWS_CUSTOMER_ID` | service-account JWT bearer exchange at `oauth2.googleapis.com/token` with read-only scopes |

Every adapter runs dry by default: it prints the exact request it would make with no credentials read and no network, and only the bare `--execute` flag performs the read. Each adapter's allow-list, refused paths and `verify-*` reads are listed in `docs/aegis/lanes/g2.md`.

### Slack tokens and scopes

Each `slack-client.js` command reads one token variable and needs only the scopes below (`SCOPES` in the code; scope names from Slack's 2021 OpenAPI spec and search excerpts of docs.slack.dev, so confirm them on the app's OAuth page). Where two scopes are listed, the first covers a public channel and the second a private one.

| Command | Token variable | Scopes |
|---|---|---|
| `digest` | none (offline) | none |
| `whoami` | `SLACK_TOKEN` | none (`auth.test`) |
| `user`, `users`, `verify-deactivated`, `verify-reactivated`, `verify-guest` | `SLACK_TOKEN` | `users:read` |
| `team` | `SLACK_TOKEN` | `team:read` |
| `channel`, `verify-archived` | `SLACK_TOKEN` | `channels:read`, `groups:read` |
| `verify-posted` | `SLACK_TOKEN` | `channels:history`, `groups:history` |
| `app-requests`, `apps-approved`, `apps-restricted`, `verify-app-approved`, `verify-app-restricted` | `SLACK_TOKEN` | `admin.apps:read` only (an Enterprise org-level user token; never with `admin.apps:write`) |
| `access-logs` | `SLACK_ACCESS_LOGS_TOKEN` | `admin` (an admin's user token, paid plans) |

The `admin` scope also authorizes Slack's SCIM API, including `DELETE /Users` (a deactivation). So `access-logs` reads its own variable: a separate token, exported for that one read and unset right after, never `SLACK_TOKEN`. No other command reads it, and the main spec refuses `team.accessLogs`, so `SLACK_TOKEN` never needs the `admin` scope.

## Adding a read

1. Name the exact path or query in `docs/aegis/lanes/g2.md`, with the vendor page it comes from.
2. Write the failing test first (the adapter's own `*.test.js`, on mocks; the default transport must stay the tripwire).
3. Add the route or named query document to the adapter's spec. Never add a write: a write is a HUMAN-RUN procedure in a runbook under `.claude/commands/`, and the adapter proves it afterwards with a `verify-*` read.
