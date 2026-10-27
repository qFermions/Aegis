# Read-only adapters (lane G2)

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). These adapters let Aegis read Fleet, Jamf Pro, Slack, Linear and Google Workspace through authorized read access, and prove a human's write with a `verify-*` read. No code here can send a write: every adapter is built on one contract, `readonly-contract.js`, and its tests (`readonly-contract.test.js`) prove each rule.

## The contract

| Rule | What the code does |
|---|---|
| Allow-list | A request is sent only when it is an exact (method, path) pair the adapter's spec names: a GET route with validated path parameters and query keys, or, for GraphQL, a POST to the spec's one GraphQL path whose query text is byte-equal to a named query document defined in code. Anything else is `REFUSED` before credentials are read and before the transport is called. |
| Reads only | Every method but GET is refused. A spec cannot even define a non-GET route, and a GraphQL document holding a `mutation` or `subscription` operation (also after a query in the same document) is refused and fails to build. |
| Token exchange | The only non-read request is the vendor's documented token exchange at its exact host and path, built by the client from the named credentials with exactly the declared grant fields. A raw request to the token path, or one carrying any other field, is refused. It is never retried. |
| Credentials | Read from named environment variables only, after the request is allowed. Missing variables give `NO_CREDENTIALS` and name the variable. No credential or token value appears in a result, an error, an exception or printed output; a response that echoes one is redacted. The module has no `fs` and no `console`. |
| Untrusted responses | Every string in a response is scanned with the shared injection markers (`scripts/tier/tier-guard.js`) plus agent-directed shapes; a hit is returned with its JSON path and a quoted excerpt under `flags`, and `renderResult` prints a fixed line saying it was not followed. Nothing in the client acts on response text. |
| Tenant | An adapter that binds a tenant (Slack team, Linear workspace, Google customer) needs its tenant variable before any request; a response holding a record from another tenant is `TENANT_MISMATCH` and returns no data. Fleet and Jamf Pro serve one tenant per server and are bound by their configured host. |
| Failure states | `OK`, `REFUSED`, `NO_CREDENTIALS`, `HTTP_ERROR`, `TIMEOUT`, `NETWORK_ERROR`, `TENANT_MISMATCH`, `INVALID_RESPONSE`. Reads retry up to 2 times on a timeout, a network error, 429 or 5xx; a 3xx is never followed; a response over 5 MB or not JSON returns no data. |
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
