# Vendor facts to check (batch G3)

Facts that the vendor's own documentation did not confirm on 2026-10-28, and what each
one affects in Aegis. Every vendor host in `docs/aegis/g3/vendor-facts.md` (Hosts) was
reachable; these are gaps in the pages, not refused hosts. Check each against the vendor
console or a support case before production; until then the code takes the safer side.

| ID | What is not confirmed | What Aegis does meanwhile | Where it matters |
|---|---|---|---|
| S-09 | `admin.apps.requests.list` and `restricted.list` need the same `admin.apps:read` as `approved.list` | allows only read scopes either way | `scope-manifest.json` slack |
| S-12 | which Slack methods return `x-oauth-scopes` beyond the documented example | a missing header gives a `scope_notice`; it never passes silently | Slack preflight |
| G-13 | the classic scope for branch protection and ruleset reads | classic tokens are refused unless every scope is read-only | GitHub connector |
| G-31 | whether fine-grained PATs and App tokens return `X-OAuth-Scopes` | treated as not exposed: a `scope_notice` | GitHub connector |
| G-34, G-35 | a self-introspection call for installation tokens and fine-grained PATs | none is used | GitHub connector |
| O-11 | whether an Okta service app must use DPoP | the connector does not send DPoP; a vendor refusal ends in HTTP_ERROR with a plain next step | Okta connector |
| O-30 | Okta's Retry-After on 429 | the contract honours Retry-After when present; otherwise backoff | Okta connector |
| M-28 | whether a password reset (portal or Graph) moves the user's `signInSessionsValidFromDateTime`, as Revoke sessions does (M-26); Microsoft's pages describe the property and the revocation, not the reset (D9 on PR #9) | on a ticket that also reset the password, `verify-sessions-revoked` may pass without a revocation: `/mfa-issue` and `/password-reset` say so, and ask for the Revoke sessions audit entry as well (batch G4, task A4) | `msgraph-client.js verify-sessions-revoked`; `/mfa-issue`; `/password-reset` |
| M-02 | whether Entra still accepts the legacy SHA-1 `x5t` header | the connector sends `x5t#S256` only | Microsoft Graph connector |
| F-03 | the API role string for Fleet's Technician role | any role other than observer is refused | Fleet preflight |
| F-10 | a prose definition of `last_mdm_checked_in_at` | shown as the vendor's field, not reinterpreted | endpoint MDM sync runbook |
| F-11 | whether every Fleet endpoint sends `retry-after` on 429 | honoured when present | contract |
| F-13 | whether Fleet's API answers an empty list as `[]` or as `null`: `results` from GET /api/v1/fleet/commands, and `activities` from GET /api/v1/fleet/activities and a host's activities (GET /api/v1/fleet/hosts/:id/activities); Fleet is written in Go, which can encode an empty list as `null` (code review round 2 of batch G4, finding 10) | `null` is read as no list: the read-back is INCONCLUSIVE (exit 5), never a pass and never a failed object | `fleet-client.js verify-wipe` and `verify-deleted`; `/fleet-device-actions` |
| J-01 | the canonical Jamf Pro token path: `/api/v1/oauth/token` (current reference) or `/api/oauth/token` (what `jamf-client.js` sends, and older docs) | unchanged: `/api/oauth/token`; a 404 on the exchange ends in HTTP_ERROR, never a retry | `jamf-client.js` tokenExchange |
| J-04 | whether `GET /api/v1/auth` lists privileges for an API client token | Jamf Pro is treated as not exposing scopes (`scope_notice`) | Jamf preflight |
| J-05 | the full list of Jamf Pro action privileges | the manifest names the read privileges to grant, not a deny list | `scope-manifest.json` jamf |
| J-06 | the replacement for the deprecated v3 inventory endpoints | the adapter keeps its v1 routes | `jamf-client.js` |
| J-10 | Jamf Pro 429 and Retry-After | backoff | contract |
| W-03, W-05 | a way for a service account to read its delegation list; the error text when a scope is not delegated | the token response `scope` is the check | Google Workspace preflight |
| W-04 | Google's tokeninfo for access tokens | not used | none |
| W-06 | Google Workspace 429 and Retry-After | honoured when present | contract |
| L-06 | that no Linear query returns a key's permissions | Linear is treated as not exposing scopes | Linear preflight |
| A-06 | that no Atlassian call returns an API token's scopes | Jira is treated as not exposing scopes | Jira preflight |
| A-08 | Atlassian's `X-ARequestId` header | read as a request id only when present and safe | operator message |
| A10 note | Retry-After as an HTTP date: no vendor page mentions it | parsed when present (RFC 9110 allows it) | contract |
| B-15 | the Okta help page for removing people from a group | the runbook names the console path from the pages that were read and marks the rule-managed case | Okta group runbook |
| Jira JSM scopes | the read scope names for a scoped JSM token | the client uses a classic token against the site; scoped tokens are not supported | `scope-manifest.json` jira |
