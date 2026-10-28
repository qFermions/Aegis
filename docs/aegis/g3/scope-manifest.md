# Read-only scope manifest (batch G3, task 3a)

Every connector reads with one credential. This page says, for each one, the smallest
read permission it needs, what Aegis refuses, and whether the vendor lets Aegis check.
The machine-readable copy is `scripts/adapters/scope-manifest.json`; the vendor quotes
behind each line are in `docs/aegis/g3/vendor-facts.md` (fact IDs in brackets).

Check a connector without a credential (prints its entry, sends nothing):

```bash
node scripts/adapters/scopes.js slack
```

Check the credential exported in this shell (one read, recorded in the audit trail):

```bash
node scripts/adapters/scopes.js slack --execute
```

## What happens at run time

A person running any connector CLI gets the scope preflight. A test that injects a
transport does not, unless it asks for it.

| Kind | Connectors | What Aegis does |
|---|---|---|
| header | Slack, Slack access logs | Reads `x-oauth-scopes` on the first answer. A write scope: the answer is dropped, the credential is refused for the rest of the run (SCOPE_REFUSED, exit 1). No header: the first result carries a `scope_notice` saying it could not be checked. |
| token | Google Workspace | Reads `scope` in the token response. A scope that is not `.readonly`: refused before any read. |
| route | Fleet | Reads `GET /api/v1/fleet/me` before the first read. A role other than observer, global or team: refused before the read. |
| none | Linear, Jira, Jamf Pro | The vendor does not expose it. The first result carries a `scope_notice` that says so. The credential owner must set it up as below. |

Every refusal is one audit entry with state SCOPE_REFUSED. The operator message says
the credential holds write permissions, that nothing was read or changed, and to ask the
credential owner for one with exactly the scopes on this page.

## Per connector

| Connector | Least privilege | Refused | Vendor exposes it? |
|---|---|---|---|
| Fleet | API-only user, role observer (global, or on each team it reads) [F-01..F-06] | admin, maintainer, observer_plus, gitops, any other role | yes: `/api/v1/fleet/me` |
| Jamf Pro | API client whose API role holds only read privileges: Read Computers, Read Smart Computer Groups, Read macOS Configuration Profiles, Read Policies, the patch and software update reads, View MDM command information [J-03, J-05, J-08] | any Create, Update, Delete or Send Command privilege; the disk encryption, Recovery Lock and local admin password views | no: the token's `scope` lists role IDs, not privileges [J-02]; `/api/v1/auth` for API clients unconfirmed [J-04] |
| Slack | users:read, team:read, channels:read, groups:read, channels:history, groups:history; admin.apps:read only for the app lists [S-01..S-08] | any scope not ending in `:read`, `:read.<detail>` or `:history` [S-15] | yes: `x-oauth-scopes` header [S-12] |
| Slack access logs | admin, on its own token, exported for the one read [S-10] | anything else that is not a read scope | yes: same header |
| Linear | personal API key restricted to Read, limited to the teams it reads [L-03] | Write, Admin, Create issues, Create comments, full access | no [L-06] |
| Google Workspace | the seven `.readonly` Admin SDK scopes in `gws-client.js` | any scope not ending in `.readonly` | yes: token response `scope` [W-02] |
| Jira | classic API token of a dedicated account that can only view the service desk project | site or Jira admin; edit, transition or delete rights elsewhere | no: classic tokens carry the account's permissions [A-03, A-06] |

## What this does not prove

- For Linear, Jira and Jamf Pro, nothing in Aegis can prove the credential is read-only.
  The adapters still send GET (and GraphQL query) only, which the contract enforces, so a
  write-capable credential is still never used to write. The notice is there so the
  owner fixes the credential.
- A vendor can add a scope name that matches the read pattern but grants a write. The
  pattern follows the vendor's own naming today; recheck on the dates in the JSON file.
- Facts marked UNCONFIRMED in the JSON are listed in `docs/aegis/g3/vendor-facts-to-check.md`.
