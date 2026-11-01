# Test-tenant runbook: each connector once, read-only (readiness rows 4 and 12)

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). This page is for the owner. It says, per
connector, which test account to get, which least-privilege credential to make, and the exact
commands to run once against that test tenant: every read and every `verify-*` read-back, first as
a dry run and then live. It proves rows 4 and 12 of [the readiness gate](../production-readiness.md)
only when the owner has run it and kept the results outside this repository. This page never marks
a row passed.

## Before you start (every connector)

**Price and sign-up.** Each section names the account it needs. Check the vendor's price page first:
a sign-up, a trial or a paid plan is the owner's call, and some reads need a paid or enterprise plan
(the section says which).

**The credential.** Make exactly the least-privilege credential the section quotes from
[`scope-manifest.json`](../../../scripts/adapters/scope-manifest.json) (plain English:
[scope manifest](../g3/scope-manifest.md)) and nothing more. Keep it in the shell session only:
type `read -rs VARIABLE_NAME`, paste the value, press Enter, then `export VARIABLE_NAME`. Never
write it into a file in the repository, never create a `.env` inside the working tree, and run
`unset VARIABLE_NAME` for each variable when the session ends. A PEM private key can be pasted as
one line with literal `\n` escapes; the Google Workspace, Okta and Microsoft Graph connectors turn
them back into line breaks. The list of every variable is in `.env.example`.

**The audit trail.** Every live run writes one entry per request to the local audit trail (no data,
no body, no credential). For a test-tenant session, export `AEGIS_AUDIT_DIR` set to a folder outside
the working tree, so nothing from that session lands in the checkout.

**Placeholders.** Replace every `[PLACEHOLDER]` at the prompt with the test tenant's value. Never
write a value back into this page or any repository file.

**The command form.** Each read and each read-back below is one `bash` block of two lines: the dry
run, then the same command with the bare `--execute` flag. Run the first line, check it, then the
second. The exit codes are the shared ones (`scripts/adapters/README.md`):

| Exit | Meaning |
|---|---|
| 0 | a read's dry run, a read that answered, or a read-back that verified |
| 1 | refused input, a missing credential, or a credential holding more than the manifest (`SCOPE_REFUSED`) |
| 2 | the read failed, or a read-back read the record and it did not prove the change |
| 3 | a record from another tenant |
| 4 | a `verify-*` dry run: it reads nothing, so it proves nothing, and prints `NOT VERIFIED` |

A dry run prints the exact request (method, host, path), reads no credential and opens no
connection. A good dry run is exit 0 for a read and exit 4 for a read-back, with the planned
request shown. Anything else means the command or a placeholder is wrong: fix it before `--execute`.

**Read-backs on a test tenant.** A `verify-*` command proves a change a person made. On the test
tenant the owner makes that change by hand in the vendor console on a test object first, then runs
the read-back: a good result is exit 0 with `"verified": true`. Running the same read-back before
the change is also a useful result: a good one is exit 2 with `"verified": false`. Do not run a
read-back whose change you are not willing to make on a test object (a wipe, a deletion); record it
as not run. The `--change` flag is not used here: without it a read-back still runs and records
`change: null`.

## Recording each result outside the repository

Keep the results in a folder outside the working tree, for example `~/aegis-owner-records/test-tenant/`,
one CSV file per connector and day, named `YYYY-MM-DD-connector.csv`. One row per command run:

```text
date,connector,command,exit_code,result,note
2026-11-02,fleet,fleet-client.js host --id [HOST_ID] --execute,0,pass,answer matches the console
```

- `command` is the command as written on this page, with its placeholders, never the value typed.
- `result` is `pass` when the exit code and the answer are what the "Good result" line says and the
  answer matches what the vendor console shows for the same object; otherwise `fail`, with the
  reason in `note`.
- `note` holds no tenant value: no name, address, ID, hostname, serial, token or response text.
- Row 12 holds for a connector when every row in its file is `pass` or a recorded "not run" with a
  reason; the owner writes that outcome outside this page.

## Fleet (`fleet`)

**Test account.** A Fleet server the owner controls (self-hosted or Fleet's hosted trial) with at
least one enrolled test host. Lock, wipe and the MDM fields need Fleet Premium and MDM turned on.
Check Fleet's price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** an API-only user with the global role observer
(or team observer on each team it reads). Refused: global or team role admin, maintainer,
observer_plus, gitops, technician or any role not named observer.

**Environment:** `FLEET_URL` (the server's bare hostname, [@Aegion_FLEET_URL] in production) and
`FLEET_API_TOKEN`.

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js fleet
node scripts/adapters/scopes.js fleet --execute
```

Good result: exit 0, `"scope_check": "passed"` (the token's role read back as observer).

### Reads

```bash
node scripts/adapters/fleet-client.js me
node scripts/adapters/fleet-client.js me --execute
```

Good result: exit 0, `"state": "OK"`, the user's `global_role` is `observer`.

```bash
node scripts/adapters/fleet-client.js version
node scripts/adapters/fleet-client.js version --execute
```

Good result: exit 0, the server version matches the Fleet UI.

```bash
node scripts/adapters/fleet-client.js host --identifier [SERIAL_NUMBER]
node scripts/adapters/fleet-client.js host --identifier [SERIAL_NUMBER] --execute
```

Good result: exit 0, the host's `id`, `status` and `seen_time` match Hosts in the UI.

```bash
node scripts/adapters/fleet-client.js host --id [HOST_ID]
node scripts/adapters/fleet-client.js host --id [HOST_ID] --execute
```

Good result: exit 0, `mdm.device_status`, `mdm.pending_action` and the disk encryption fields match Host details.

```bash
node scripts/adapters/fleet-client.js hosts --status online --per-page 100
node scripts/adapters/fleet-client.js hosts --status online --per-page 100 --execute
```

Good result: exit 0, the count of online hosts matches the Hosts filter.

```bash
node scripts/adapters/fleet-client.js host-mdm --id [HOST_ID]
node scripts/adapters/fleet-client.js host-mdm --id [HOST_ID] --execute
```

Good result: exit 0, the MDM enrollment matches; empty when the host is not enrolled.

```bash
node scripts/adapters/fleet-client.js host-software --id [HOST_ID] --vulnerable
node scripts/adapters/fleet-client.js host-software --id [HOST_ID] --vulnerable --execute
```

Good result: exit 0, the vulnerable titles match the host's Software tab.

```bash
node scripts/adapters/fleet-client.js host-activities --id [HOST_ID]
node scripts/adapters/fleet-client.js host-activities --id [HOST_ID] --execute
```

Good result: exit 0, the newest activity matches the host's Activity tab.

```bash
node scripts/adapters/fleet-client.js host-upcoming --id [HOST_ID]
node scripts/adapters/fleet-client.js host-upcoming --id [HOST_ID] --execute
```

Good result: exit 0, the queued items match Upcoming (often none).

```bash
node scripts/adapters/fleet-client.js policies
node scripts/adapters/fleet-client.js policies --execute
```

Good result: exit 0, each policy's failing count matches the Policies page.

```bash
node scripts/adapters/fleet-client.js software --vulnerable
node scripts/adapters/fleet-client.js software --vulnerable --execute
```

Good result: exit 0, the titles match Software with the vulnerable filter.

```bash
node scripts/adapters/fleet-client.js vulnerability --cve [CVE_ID]
node scripts/adapters/fleet-client.js vulnerability --cve [CVE_ID] --execute
```

Good result: exit 0 with the affected hosts; an HTTP 204 answer means Fleet knows the CVE and no host is affected.

```bash
node scripts/adapters/fleet-client.js script-result --execution-id [EXECUTION_ID]
node scripts/adapters/fleet-client.js script-result --execution-id [EXECUTION_ID] --execute
```

Good result: exit 0, `exit_code` and the output match the script run in the UI.

```bash
node scripts/adapters/fleet-client.js commands --host-identifier [SERIAL_NUMBER] --command-status pending
node scripts/adapters/fleet-client.js commands --host-identifier [SERIAL_NUMBER] --command-status pending --execute
```

Good result: exit 0, the pending MDM commands match (often none).

```bash
node scripts/adapters/fleet-client.js activities
node scripts/adapters/fleet-client.js activities --execute
```

Good result: exit 0, the newest entry matches the global activity feed.

```bash
node scripts/adapters/fleet-client.js report-results --id [REPORT_ID]
node scripts/adapters/fleet-client.js report-results --id [REPORT_ID] --execute
```

Good result: exit 0, the rows match the stored report's results.

### Read-backs

```bash
node scripts/adapters/fleet-client.js verify-lock --id [HOST_ID]
node scripts/adapters/fleet-client.js verify-lock --id [HOST_ID] --execute
```

Good result: dry run exit 4; after a hand lock on the test host, exit 0 and `"verified": true` (`mdm.device_status` locked, nothing pending).

```bash
node scripts/adapters/fleet-client.js verify-unlock --id [HOST_ID]
node scripts/adapters/fleet-client.js verify-unlock --id [HOST_ID] --execute
```

Good result: dry run exit 4; after the unlock, exit 0 and `"verified": true`.

```bash
node scripts/adapters/fleet-client.js verify-wipe --id [HOST_ID]
node scripts/adapters/fleet-client.js verify-wipe --id [HOST_ID] --execute
```

Good result: dry run exit 4; only on a test host you will lose, exit 0 after the wipe; otherwise exit 2 before it.

```bash
node scripts/adapters/fleet-client.js verify-script --execution-id [EXECUTION_ID]
node scripts/adapters/fleet-client.js verify-script --execution-id [EXECUTION_ID] --execute
```

Good result: dry run exit 4; for a harmless test script that exits 0, exit 0 and `"verified": true`.

```bash
node scripts/adapters/fleet-client.js verify-mdm-off --id [HOST_ID]
node scripts/adapters/fleet-client.js verify-mdm-off --id [HOST_ID] --execute
```

Good result: dry run exit 4; on an enrolled host, exit 2 (`"verified": false`), the correct answer before any change.

```bash
node scripts/adapters/fleet-client.js verify-checked-in --id [HOST_ID] --not-before [NOT_BEFORE]
node scripts/adapters/fleet-client.js verify-checked-in --id [HOST_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 when `last_mdm_checked_in_at` is at or after `[NOT_BEFORE]`.

```bash
node scripts/adapters/fleet-client.js verify-deleted --identifier [SERIAL_NUMBER] --not-before [NOT_BEFORE]
node scripts/adapters/fleet-client.js verify-deleted --identifier [SERIAL_NUMBER] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; on a host that still exists, exit 2 (no `deleted_host` activity).

### Open questions this tenant answers

- F-03: the API role string Fleet uses for Technician. Make a second API-only user with Technician
  on the test server, run the scope check with its token, and record the role string in the refusal.
- F-10: what `last_mdm_checked_in_at` means. Compare it with the host's last MDM check-in in the UI
  after a check-in you trigger on the test host.

## GitHub (`github`)

**Test account.** A test organization the owner owns, with one test repository, one test team and
two test accounts. The audit log and SAML reads need GitHub Enterprise Cloud. Check GitHub's price
page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** a fine-grained token (or App installation
token) on [@Aegion_GITHUB_ORG] with read only: organization Members (read), repository Metadata
(read), repository Administration (read, for branch protection), Secret scanning alerts (read),
Dependabot alerts (read), Issues (read); organization Administration (read) only where the audit log
or SAML authorizations are read (GitHub Enterprise Cloud, an owner); a classic token only with
read:* scopes (read:org, read:audit_log). Refused: a classic token with repo, admin:org,
security_events, workflow, delete_repo or any write:* or admin:* scope.

**Environment:** `GITHUB_ORG` (the test organization's login) and `GITHUB_TOKEN`.

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js github
node scripts/adapters/scopes.js github --execute
```

Good result: exit 0; a fine-grained token gives `"scope_check": "not exposed by the vendor"`, a classic `read:*` token gives `passed`.

### Reads

```bash
node scripts/adapters/github-client.js org
node scripts/adapters/github-client.js org --execute
```

Good result: exit 0, the organization's login and `two_factor_requirement_enabled` match its settings.

```bash
node scripts/adapters/github-client.js members --filter 2fa_disabled
node scripts/adapters/github-client.js members --filter 2fa_disabled --execute
```

Good result: exit 0, the members without two-factor match People with that filter.

```bash
node scripts/adapters/github-client.js membership --user [GITHUB_USER]
node scripts/adapters/github-client.js membership --user [GITHUB_USER] --execute
```

Good result: exit 0, `state` and `role` match the person's row under People.

```bash
node scripts/adapters/github-client.js teams
node scripts/adapters/github-client.js teams --execute
```

Good result: exit 0, the teams match the Teams page.

```bash
node scripts/adapters/github-client.js team-members --team [TEAM_SLUG]
node scripts/adapters/github-client.js team-members --team [TEAM_SLUG] --execute
```

Good result: exit 0, the members match the team's page.

```bash
node scripts/adapters/github-client.js outside-collaborators
node scripts/adapters/github-client.js outside-collaborators --execute
```

Good result: exit 0, the list matches Outside collaborators.

```bash
node scripts/adapters/github-client.js invitations
node scripts/adapters/github-client.js invitations --execute
```

Good result: exit 0, the pending invitations match.

```bash
node scripts/adapters/github-client.js collaborators --repo [REPO_NAME]
node scripts/adapters/github-client.js collaborators --repo [REPO_NAME] --execute
```

Good result: exit 0, each person's role matches Collaborators and teams.

```bash
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER]
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
```

Good result: exit 0, the permission matches the person's role.

```bash
node scripts/adapters/github-client.js protection --repo [REPO_NAME] --branch [BRANCH_NAME]
node scripts/adapters/github-client.js protection --repo [REPO_NAME] --branch [BRANCH_NAME] --execute
```

Good result: exit 0, the rule matches the branch protection settings; on a branch with no classic rule GitHub answers 404 (exit 2), which is the right answer there.

```bash
node scripts/adapters/github-client.js rulesets --repo [REPO_NAME]
node scripts/adapters/github-client.js rulesets --repo [REPO_NAME] --execute
```

Good result: exit 0, the rulesets and their enforcement match Rules.

```bash
node scripts/adapters/github-client.js branch-rules --repo [REPO_NAME] --branch [BRANCH_NAME]
node scripts/adapters/github-client.js branch-rules --repo [REPO_NAME] --branch [BRANCH_NAME] --execute
```

Good result: exit 0, the rules in force on the branch match.

```bash
node scripts/adapters/github-client.js audit-log
node scripts/adapters/github-client.js audit-log --execute
```

Good result: Enterprise Cloud only: exit 0, the newest event matches the audit log; otherwise exit 2 with the HTTP status, recorded as "not available on this plan".

```bash
node scripts/adapters/github-client.js sso-authorizations
node scripts/adapters/github-client.js sso-authorizations --execute
```

Good result: Enterprise Cloud with SAML only: exit 0; otherwise exit 2, recorded as above.

```bash
node scripts/adapters/github-client.js secret-alerts --state open
node scripts/adapters/github-client.js secret-alerts --state open --execute
```

Good result: exit 0, the open alerts match the organization's secret scanning view.

```bash
node scripts/adapters/github-client.js secret-alert --repo [REPO_NAME] --number [ALERT_NUMBER]
node scripts/adapters/github-client.js secret-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --execute
```

Good result: exit 0, `state` matches the alert page; the secret itself is not printed.

```bash
node scripts/adapters/github-client.js dependabot-alerts --state open
node scripts/adapters/github-client.js dependabot-alerts --state open --execute
```

Good result: exit 0, the open alerts match.

```bash
node scripts/adapters/github-client.js dependabot-alert --repo [REPO_NAME] --number [ALERT_NUMBER]
node scripts/adapters/github-client.js dependabot-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --execute
```

Good result: exit 0, `state` and severity match the alert page.

```bash
node scripts/adapters/github-client.js issue --repo [REPO_NAME] --number [N]
node scripts/adapters/github-client.js issue --repo [REPO_NAME] --number [N] --execute
```

Good result: exit 0, the issue and its comments match; @mentions are printed as `[GITHUB_USER]`.

### Read-backs

```bash
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role read
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role read --execute
```

Good result: dry run exit 4; after adding the test account with Read, exit 0 and `"verified": true`.

```bash
node scripts/adapters/github-client.js verify-collaborator-removed --repo [REPO_NAME] --user [GITHUB_USER]
node scripts/adapters/github-client.js verify-collaborator-removed --repo [REPO_NAME] --user [GITHUB_USER] --execute
```

Good result: dry run exit 4; after removing it, exit 0.

```bash
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER]
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER] --execute
```

Good result: dry run exit 4; for a test account still in the organization, exit 2.

```bash
node scripts/adapters/github-client.js verify-team-member --team [TEAM_SLUG] --user [GITHUB_USER]
node scripts/adapters/github-client.js verify-team-member --team [TEAM_SLUG] --user [GITHUB_USER] --execute
```

Good result: dry run exit 4; exit 0 when the test account is on the team.

```bash
node scripts/adapters/github-client.js verify-protection --repo [REPO_NAME] --branch [BRANCH_NAME] --reviews 1 --no-force-push
node scripts/adapters/github-client.js verify-protection --repo [REPO_NAME] --branch [BRANCH_NAME] --reviews 1 --no-force-push --execute
```

Good result: dry run exit 4; exit 0 when the rule asks for one review and blocks force pushes.

```bash
node scripts/adapters/github-client.js verify-2fa-required
node scripts/adapters/github-client.js verify-2fa-required --execute
```

Good result: dry run exit 4; exit 0 when the organization requires two-factor, exit 2 when it does not.

```bash
node scripts/adapters/github-client.js verify-secret-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --state resolved
node scripts/adapters/github-client.js verify-secret-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --state resolved --execute
```

Good result: dry run exit 4; exit 0 after closing a test alert, exit 2 while it is open.

```bash
node scripts/adapters/github-client.js verify-dependabot-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --state dismissed
node scripts/adapters/github-client.js verify-dependabot-alert --repo [REPO_NAME] --number [ALERT_NUMBER] --state dismissed --execute
```

Good result: dry run exit 4; exit 0 after dismissing a test alert.

### Open questions this tenant answers

- The rate-limit 403 (owner decision 3, vendor facts G-40 and G-41). Do not provoke a limit. First,
  take one read permission off the test token and run that read: a 403 without a rate-limit signal
  must stay a permission refusal (exit 2, `HTTP_ERROR`, status 403, no `RATE_LIMITED`). Then, when a
  limit happens in normal use, record whether the answer said `RATE_LIMITED` with `limit` and
  `retry_at`, and whether that matched the limit GitHub showed.
- G-31: whether a fine-grained or App token returns `X-OAuth-Scopes`. Record the scope check's
  `scope_check` value for each token kind.
- G-13: which classic scope the protection and rulesets reads need. Record whether `read:org` alone
  answers them or ends in a 403.

## Google Workspace (`google-workspace`)

**Test account.** A test Google Workspace domain (or a test organizational unit in one the owner
runs) with two test users and one test group. Check Google's price page first; a sign-up is the
owner's call.

**Credential (least privilege, from the manifest):** a service account with domain-wide delegation
of exactly these scopes, impersonating a test admin:
`https://www.googleapis.com/auth/admin.directory.user.readonly`,
`https://www.googleapis.com/auth/admin.directory.group.readonly`,
`https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly`,
`https://www.googleapis.com/auth/admin.directory.device.mobile.readonly`,
`https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly`,
`https://www.googleapis.com/auth/admin.reports.audit.readonly`,
`https://www.googleapis.com/auth/admin.reports.usage.readonly`. Refused: any scope that does not
end in .readonly, for example admin.directory.user, admin.directory.user.security,
admin.directory.group.

**Environment:** `GWS_SA_CLIENT_EMAIL`, `GWS_SA_PRIVATE_KEY`, `GWS_ADMIN_SUBJECT` and
`GWS_CUSTOMER_ID` ([@Aegion_GWS_CUSTOMER_ID] in production).

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js google-workspace
node scripts/adapters/scopes.js google-workspace --execute
```

Good result: exit 0, `"scope_check": "passed"` (every granted scope ends in `.readonly`).

### Reads

```bash
node scripts/adapters/gws-client.js user --user [USER@DOMAIN.COM]
node scripts/adapters/gws-client.js user --user [USER@DOMAIN.COM] --execute
```

Good result: exit 0, `suspended`, `orgUnitPath` and 2-Step Verification match the user's page.

```bash
node scripts/adapters/gws-client.js users --query "isEnrolledIn2Sv=false"
node scripts/adapters/gws-client.js users --query "isEnrolledIn2Sv=false" --execute
```

Good result: exit 0, the users match the console's 2SV filter; exit 2 means Google rejected the query syntax (unconfirmed, record it).

```bash
node scripts/adapters/gws-client.js roles
node scripts/adapters/gws-client.js roles --execute
```

Good result: exit 0, the roles match Admin roles.

```bash
node scripts/adapters/gws-client.js role-assignments --user [USER@DOMAIN.COM]
node scripts/adapters/gws-client.js role-assignments --user [USER@DOMAIN.COM] --execute
```

Good result: exit 0, the user's admin roles match (often none).

```bash
node scripts/adapters/gws-client.js group-members --group [GROUP_EMAIL]
node scripts/adapters/gws-client.js group-members --group [GROUP_EMAIL] --execute
```

Good result: exit 0, the members match the group's page.

```bash
node scripts/adapters/gws-client.js mobile-devices
node scripts/adapters/gws-client.js mobile-devices --execute
```

Good result: exit 0, the mobile devices match the devices list.

```bash
node scripts/adapters/gws-client.js chromeos-devices
node scripts/adapters/gws-client.js chromeos-devices --execute
```

Good result: exit 0, the ChromeOS devices match (often none on a test domain).

```bash
node scripts/adapters/gws-client.js activities --app login --user [USER@DOMAIN.COM] --start [NOT_BEFORE]
node scripts/adapters/gws-client.js activities --app login --user [USER@DOMAIN.COM] --start [NOT_BEFORE] --execute
```

Good result: exit 0, the sign-ins since `[NOT_BEFORE]` match the login audit events.

```bash
node scripts/adapters/gws-client.js usage --date YYYY-MM-DD --parameters accounts:num_users_2sv_enrolled
node scripts/adapters/gws-client.js usage --date YYYY-MM-DD --parameters accounts:num_users_2sv_enrolled --execute
```

Good result: exit 0, the count matches the security report for that date (reports lag by a few days).

### Read-backs

```bash
node scripts/adapters/gws-client.js verify-suspended --user [USER@DOMAIN.COM]
node scripts/adapters/gws-client.js verify-suspended --user [USER@DOMAIN.COM] --execute
```

Good result: dry run exit 4; after suspending the test user by hand, exit 0 and `"verified": true`.

```bash
node scripts/adapters/gws-client.js verify-2sv-enforced --user [USER@DOMAIN.COM]
node scripts/adapters/gws-client.js verify-2sv-enforced --user [USER@DOMAIN.COM] --execute
```

Good result: dry run exit 4; exit 0 when 2SV is enforced for the user, exit 2 when not.

```bash
node scripts/adapters/gws-client.js verify-2sv-not-enforced --user [USER@DOMAIN.COM]
node scripts/adapters/gws-client.js verify-2sv-not-enforced --user [USER@DOMAIN.COM] --execute
```

Good result: dry run exit 4; the opposite verdict of the previous read-back on the same user.

```bash
node scripts/adapters/gws-client.js verify-ou --user [USER@DOMAIN.COM] --ou /[OU_PATH]
node scripts/adapters/gws-client.js verify-ou --user [USER@DOMAIN.COM] --ou /[OU_PATH] --execute
```

Good result: dry run exit 4; exit 0 when the user sits in that unit.

```bash
node scripts/adapters/gws-client.js verify-admin-role-removed --user [USER@DOMAIN.COM] --role-id [ROLE_ID]
node scripts/adapters/gws-client.js verify-admin-role-removed --user [USER@DOMAIN.COM] --role-id [ROLE_ID] --execute
```

Good result: dry run exit 4; exit 0 when the user no longer holds that role.

```bash
node scripts/adapters/gws-client.js verify-event --app admin --event SUSPEND_USER --user [USER@DOMAIN.COM] --not-before [NOT_BEFORE] --target [UPN]
node scripts/adapters/gws-client.js verify-event --app admin --event SUSPEND_USER --user [USER@DOMAIN.COM] --not-before [NOT_BEFORE] --target [UPN] --execute
```

Good result: dry run exit 4; after the test suspension, exit 0 with the matched event's parameters printed. `--user` is the admin who acted, `--target` the test user. `SUSPEND_USER` is not confirmed in the lane's sources: if the read-back fails after a real suspension, read the event name in the admin audit log, run it again with that name and record both.

### Open questions this tenant answers

- W-05: the error text when a requested scope is not delegated. Remove one scope from the delegation
  on the test domain, run the scope check, and record the state and message.
- The `users --query` syntax and the `usage` parameter names (unconfirmed in the lane's sources):
  record whether each read above answered or was rejected.

## Jamf Pro (`jamf`)

**Test account.** A Jamf Pro test server (a trial or a sandbox instance) with one enrolled test Mac.
Check Jamf's price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** an API client whose API role holds only: Read
Computers, Read Smart Computer Groups, Read macOS Configuration Profiles, Read Policies, Read Patch
Management Software Titles, Read Managed Software Updates, View MDM command information in Jamf Pro
API. Refused: any Create, Update or Delete privilege; any Send ... Command privilege; View Disk
Encryption Recovery Key; View Recovery Lock; View Local Admin Password. Jamf Pro does not expose
the role, so confirm it by hand in the console.

**Environment:** `JAMF_URL` (bare hostname, [@Aegion_JAMF_URL] in production), `JAMF_CLIENT_ID`
and `JAMF_CLIENT_SECRET`.

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js jamf
node scripts/adapters/scopes.js jamf --execute
```

Good result: exit 0, `"scope_check": "not exposed by the vendor"`; the privileges are checked in the console.

### Reads

In this section `[DEVICE_ID]` after `--id` is the computer ID and after `--management-id` the
management ID, both as Jamf Pro shows them on the computer's record.

```bash
node scripts/adapters/jamf-client.js version
node scripts/adapters/jamf-client.js version --execute
```

Good result: exit 0, the version matches the server's About page. This is the first read after the token exchange (see the open question).

```bash
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER]
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --execute
```

Good result: exit 0, the computer ID and last contact time match the record.

```bash
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section DISK_ENCRYPTION
node scripts/adapters/jamf-client.js computer --serial [SERIAL_NUMBER] --section DISK_ENCRYPTION --execute
```

Good result: exit 0, the FileVault state matches; no key is printed (the key-like fields are listed as removed).

```bash
node scripts/adapters/jamf-client.js computer-detail --id [DEVICE_ID]
node scripts/adapters/jamf-client.js computer-detail --id [DEVICE_ID] --execute
```

Good result: exit 0, the detail matches the record; secret-like fields are listed as removed.

```bash
node scripts/adapters/jamf-client.js commands --management-id [DEVICE_ID]
node scripts/adapters/jamf-client.js commands --management-id [DEVICE_ID] --execute
```

Good result: exit 0, the MDM commands match the Management tab's history.

```bash
node scripts/adapters/jamf-client.js smart-groups --name "[SMART_GROUP]"
node scripts/adapters/jamf-client.js smart-groups --name "[SMART_GROUP]" --execute
```

Good result: exit 0, the group's ID matches.

```bash
node scripts/adapters/jamf-client.js group-members --id [SMART_GROUP_ID]
node scripts/adapters/jamf-client.js group-members --id [SMART_GROUP_ID] --execute
```

Good result: exit 0, the member count matches the group's page.

```bash
node scripts/adapters/jamf-client.js profile --id [PROFILE_ID]
node scripts/adapters/jamf-client.js profile --id [PROFILE_ID] --execute
```

Good result: exit 0, only each payload's type, identifier and display name are printed, under `payloadSummary`.

```bash
node scripts/adapters/jamf-client.js policy --id [POLICY_ID]
node scripts/adapters/jamf-client.js policy --id [POLICY_ID] --execute
```

Good result: exit 0, triggers and frequency match; script parameters are withheld.

```bash
node scripts/adapters/jamf-client.js history --id [DEVICE_ID] --subset Commands
node scripts/adapters/jamf-client.js history --id [DEVICE_ID] --subset Commands --execute
```

Good result: exit 0, the command history matches the computer's History tab.

```bash
node scripts/adapters/jamf-client.js patch-titles
node scripts/adapters/jamf-client.js patch-titles --execute
```

Good result: exit 0, the titles match Patch Management.

```bash
node scripts/adapters/jamf-client.js patch-report --id [PATCH_TITLE_ID]
node scripts/adapters/jamf-client.js patch-report --id [PATCH_TITLE_ID] --execute
```

Good result: exit 0, the version counts match the title's report.

```bash
node scripts/adapters/jamf-client.js update-plans
node scripts/adapters/jamf-client.js update-plans --execute
```

Good result: exit 0, the plans match Managed Software Updates (often none).

```bash
node scripts/adapters/jamf-client.js update-plan-events --id [PLAN_UUID]
node scripts/adapters/jamf-client.js update-plan-events --id [PLAN_UUID] --execute
```

Good result: exit 0, the events match the plan's status.

### Read-backs

```bash
node scripts/adapters/jamf-client.js verify-command --management-id [DEVICE_ID] --type [COMMAND_TYPE] --not-before [NOT_BEFORE]
node scripts/adapters/jamf-client.js verify-command --management-id [DEVICE_ID] --type [COMMAND_TYPE] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; after sending a harmless command by hand (an inventory update), exit 0 for that type. A profile command type also needs `--profile-identifier [PROFILE_IDENTIFIER]`.

```bash
node scripts/adapters/jamf-client.js verify-profile --serial [SERIAL_NUMBER] --profile-id [PROFILE_ID] --profile-identifier [PROFILE_IDENTIFIER]
node scripts/adapters/jamf-client.js verify-profile --serial [SERIAL_NUMBER] --profile-id [PROFILE_ID] --profile-identifier [PROFILE_IDENTIFIER] --execute
```

Good result: dry run exit 4; exit 0 when the test profile is installed on the test Mac.

```bash
node scripts/adapters/jamf-client.js verify-group-count --id [SMART_GROUP_ID] --expect [MEMBER_COUNT]
node scripts/adapters/jamf-client.js verify-group-count --id [SMART_GROUP_ID] --expect [MEMBER_COUNT] --execute
```

Good result: dry run exit 4; exit 0 when the count read equals the count you wrote down.

```bash
node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER]
node scripts/adapters/jamf-client.js verify-filevault --serial [SERIAL_NUMBER] --execute
```

Good result: dry run exit 4; exit 0 on a Mac with FileVault on, exit 2 when off.

```bash
node scripts/adapters/jamf-client.js verify-policy --id [POLICY_ID] --enabled false
node scripts/adapters/jamf-client.js verify-policy --id [POLICY_ID] --enabled false --execute
```

Good result: dry run exit 4; exit 0 after disabling a test policy by hand.

```bash
node scripts/adapters/jamf-client.js verify-checked-in --serial [SERIAL_NUMBER] --not-before [NOT_BEFORE]
node scripts/adapters/jamf-client.js verify-checked-in --serial [SERIAL_NUMBER] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 when `general.lastContactTime` is at or after `[NOT_BEFORE]`.

### Open questions this tenant answers

- The Jamf Pro token path (J-01). `jamf-client.js` sends the token exchange to `/api/oauth/token`;
  Jamf's current reference names `/api/v1/oauth/token`. The first `--execute` above answers it: exit
  0 means the test server accepts `/api/oauth/token`; `HTTP_ERROR` 404 on the exchange means it does
  not. Record the server version with the result. The connector is not changed until the owner
  decides.
- J-04: whether `GET /api/v1/auth` lists an API client's privileges. Aegis never reads it (it is not
  on the allow-list); check the API role's privileges by hand in the console and record that they
  are the manifest's list and nothing more.

## Linear (`linear`)

**Test account.** A test Linear workspace with one test team and two test members. Check Linear's
price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** a personal API key restricted to Read
(Settings > Account > Security & Access), limited to the teams it reads. Refused: a key with Write,
Admin, Create issues or Create comments; a full-access key. Linear does not expose the key's
permissions, so confirm Read only in its settings.

**Environment:** `LINEAR_API_KEY` and `LINEAR_ORG` (the workspace URL key, [@Aegion_LINEAR_ORG] in
production).

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js linear
node scripts/adapters/scopes.js linear --execute
```

Good result: exit 0, `"scope_check": "not exposed by the vendor"`.

### Reads

```bash
node scripts/adapters/linear-client.js viewer
node scripts/adapters/linear-client.js viewer --execute
```

Good result: exit 0, the viewer is the key's owner and `organization.urlKey` is the test workspace.

```bash
node scripts/adapters/linear-client.js issue --issue [ISSUE_ID]
node scripts/adapters/linear-client.js issue --issue [ISSUE_ID] --execute
```

Good result: exit 0, state and labels match the issue.

```bash
node scripts/adapters/linear-client.js comments --issue [ISSUE_ID]
node scripts/adapters/linear-client.js comments --issue [ISSUE_ID] --execute
```

Good result: exit 0, the comments match (the first 50).

```bash
node scripts/adapters/linear-client.js states --team [@Aegion_LINEAR_TEAM]
node scripts/adapters/linear-client.js states --team [@Aegion_LINEAR_TEAM] --execute
```

Good result: exit 0, the workflow states match the team's settings. On the test workspace, use its own team key.

```bash
node scripts/adapters/linear-client.js labels
node scripts/adapters/linear-client.js labels --execute
```

Good result: exit 0, the labels match.

```bash
node scripts/adapters/linear-client.js triage
node scripts/adapters/linear-client.js triage --execute
```

Good result: exit 0, the issues in Triage match the inbox.

```bash
node scripts/adapters/linear-client.js members
node scripts/adapters/linear-client.js members --execute
```

Good result: exit 0, the members match, suspended ones included.

### Read-backs

`verify-comment` needs the note's SHA-256: run the offline
`node scripts/adapters/linear-client.js note --issue [ISSUE_ID] --body-file [NOTE_FILE]` on a test
note kept under `tasks/` or the system temporary folder, post that note on the test issue by hand,
then run:

```bash
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 when the posted note's digest matches.

```bash
node scripts/adapters/linear-client.js verify-state --issue [ISSUE_ID] --state "[STATE_NAME]"
node scripts/adapters/linear-client.js verify-state --issue [ISSUE_ID] --state "[STATE_NAME]" --execute
```

Good result: dry run exit 4; exit 0 when the issue is in that state.

```bash
node scripts/adapters/linear-client.js verify-labels --issue [ISSUE_ID] --has "[LABEL_NAME]"
node scripts/adapters/linear-client.js verify-labels --issue [ISSUE_ID] --has "[LABEL_NAME]" --execute
```

Good result: dry run exit 4; exit 0 when the issue carries the label.

```bash
node scripts/adapters/linear-client.js verify-trashed --issue [ISSUE_ID]
node scripts/adapters/linear-client.js verify-trashed --issue [ISSUE_ID] --execute
```

Good result: dry run exit 4; exit 2 on an issue that is not deleted.

```bash
node scripts/adapters/linear-client.js verify-snoozed --issue [ISSUE_ID]
node scripts/adapters/linear-client.js verify-snoozed --issue [ISSUE_ID] --execute
```

Good result: dry run exit 4; exit 0 after snoozing a test issue in Triage.

```bash
node scripts/adapters/linear-client.js verify-suspended --user [USER_ID]
node scripts/adapters/linear-client.js verify-suspended --user [USER_ID] --execute
```

Good result: dry run exit 4; exit 2 for an active test member.

### Open questions this tenant answers

- L-06: that no query returns a key's permissions. Record that a Read-only key answers every read
  above, and that the scope check reports "not exposed".
- Whether `issue(id:)` accepts the `[ISSUE_ID]` form: the `issue` read above answers it.

## Microsoft Graph (`msgraph`)

**Test account.** A Microsoft 365 or Entra ID test tenant (a developer or trial tenant) with two test
users, one test group and, for the device reads, one Intune-enrolled test device. The sign-in log
read needs Entra ID P1 or P2. Check Microsoft's price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** an app registration with a certificate and
these application permissions, admin-consented, and nothing else: User.Read.All
(signInSessionsValidFromDateTime on $select for verify-sessions-revoked, vendor facts M-09, M-27);
UserAuthenticationMethod.Read.All (authentication methods; auth-methods, verify-mfa-method,
verify-mfa-cleared and verify-method-absent, vendor fact M-14); AuditLog.Read.All (sign-in logs;
Entra ID P1 or P2); GroupMember.ReadBasic.All; Directory.Read.All (only for another user's
memberOf); DeviceManagementManagedDevices.Read.All. Refused: any application permission that is not
.Read. or .ReadBasic. (vendor fact M-21). Graph does not show an app its permissions, so confirm
them in the app registration.

**Environment:** `MS_TENANT_ID` (the test tenant's GUID, [@Aegion_MS_TENANT_ID] in production),
`MS_CLIENT_ID`, `MS_PRIVATE_KEY` and `MS_CERT_SHA256`; for the scope check's live read also
`MS_SCOPE_CHECK_USER` (a test user's object ID).

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js msgraph
node scripts/adapters/scopes.js msgraph --execute
```

Good result: exit 0, `"scope_check": "not exposed by the vendor"`.

### Reads

```bash
node scripts/adapters/msgraph-client.js user --user [USER_ID]
node scripts/adapters/msgraph-client.js user --user [USER_ID] --execute
```

Good result: exit 0, `accountEnabled` and `lastPasswordChangeDateTime` match the user's page.

```bash
node scripts/adapters/msgraph-client.js auth-methods --user [USER_ID]
node scripts/adapters/msgraph-client.js auth-methods --user [USER_ID] --execute
```

Good result: exit 0, the methods and their IDs match Authentication methods.

```bash
node scripts/adapters/msgraph-client.js member-of --user [USER_ID]
node scripts/adapters/msgraph-client.js member-of --user [USER_ID] --execute
```

Good result: exit 0, the groups match the user's Groups.

```bash
node scripts/adapters/msgraph-client.js group-members --group [GROUP_ID]
node scripts/adapters/msgraph-client.js group-members --group [GROUP_ID] --execute
```

Good result: exit 0, the members match the group's Members.

```bash
node scripts/adapters/msgraph-client.js sign-ins --user [USER_ID] --since [NOT_BEFORE]
node scripts/adapters/msgraph-client.js sign-ins --user [USER_ID] --since [NOT_BEFORE] --execute
```

Good result: P1 or P2 only: exit 0, the sign-ins match the sign-in log.

```bash
node scripts/adapters/msgraph-client.js managed-device --device [DEVICE_ID]
node scripts/adapters/msgraph-client.js managed-device --device [DEVICE_ID] --execute
```

Good result: exit 0, `lastSyncDateTime` and `complianceState` match the device in Intune.

### Read-backs

```bash
node scripts/adapters/msgraph-client.js verify-password-changed --user [USER_ID] --not-before [NOT_BEFORE]
node scripts/adapters/msgraph-client.js verify-password-changed --user [USER_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after a test password reset made after `[NOT_BEFORE]`.

```bash
node scripts/adapters/msgraph-client.js verify-account-enabled --user [USER_ID] --enabled false
node scripts/adapters/msgraph-client.js verify-account-enabled --user [USER_ID] --enabled false --execute
```

Good result: dry run exit 4; exit 0 after blocking sign-in for the test user, exit 2 before.

```bash
node scripts/adapters/msgraph-client.js verify-mfa-method --user [USER_ID] --method microsoftAuthenticator
node scripts/adapters/msgraph-client.js verify-mfa-method --user [USER_ID] --method microsoftAuthenticator --execute
```

Good result: dry run exit 4; exit 0 when the test user has Authenticator registered.

```bash
node scripts/adapters/msgraph-client.js verify-mfa-cleared --user [USER_ID]
node scripts/adapters/msgraph-client.js verify-mfa-cleared --user [USER_ID] --execute
```

Good result: dry run exit 4; exit 0 after "Require re-register MFA" on the test user.

```bash
node scripts/adapters/msgraph-client.js verify-signin --user [USER_ID] --not-before [NOT_BEFORE]
node scripts/adapters/msgraph-client.js verify-signin --user [USER_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after the test user signs in.

```bash
node scripts/adapters/msgraph-client.js verify-device-synced --device [DEVICE_ID] --not-before [NOT_BEFORE]
node scripts/adapters/msgraph-client.js verify-device-synced --device [DEVICE_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after a sync of the test device.

```bash
node scripts/adapters/msgraph-client.js verify-group-member --group [GROUP_ID] --user [USER_ID]
node scripts/adapters/msgraph-client.js verify-group-member --group [GROUP_ID] --user [USER_ID] --execute
```

Good result: dry run exit 4; exit 0 when the test user is in the group.

```bash
node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE]
node scripts/adapters/msgraph-client.js verify-sessions-revoked --user [USER_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after revoking the test user's sessions, when `signInSessionsValidFromDateTime` is at or after `[NOT_BEFORE]`.

```bash
node scripts/adapters/msgraph-client.js verify-method-absent --user [USER_ID] --method-id [METHOD_ID]
node scripts/adapters/msgraph-client.js verify-method-absent --user [USER_ID] --method-id [METHOD_ID] --execute
```

Good result: dry run exit 4; exit 0 after deleting that one method from the test user, exit 2 before.

### Open questions this tenant answers

Microsoft does not document whether a password reset moves signInSessionsValidFromDateTime, so on a ticket that also reset the password, verify-sessions-revoked may pass without a revocation. On the test tenant: reset a test user's password without revoking sessions, then run verify-sessions-revoked with --not-before set to just before the reset, and record whether it passes.

- M-02: whether Entra still needs the legacy SHA-1 `x5t` header. The connector sends `x5t#S256`
  only: record whether the first `--execute` gets a token.

## Okta (`okta`)

**Test account.** An Okta developer or preview org with two test users, one test group, one test app
and one group rule. Check Okta's price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** an OAuth 2.0 service app (client credentials,
private_key_jwt) granted only okta.users.read, okta.groups.read, okta.logs.read and okta.apps.read;
the same service app assigned the READ_ONLY_ADMIN standard role (Read-Only Administrator): scopes
alone are not the boundary, the admin role also limits the app. Refused: any scope that does not end
in .read; a service app with no admin role assigned (an org setting can then give it SUPER_ADMIN) or
with any admin role beyond READ_ONLY_ADMIN.

**Environment:** `OKTA_ORG_URL` (bare hostname, [@Aegion_OKTA_ORG_URL] in production),
`OKTA_CLIENT_ID`, `OKTA_PRIVATE_KEY` and, if the key has one, `OKTA_KEY_ID`.

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js okta
node scripts/adapters/scopes.js okta --execute
```

Good result: exit 0, `"scope_check": "passed"` (every granted scope ends in `.read`). The admin role is not checked here: see the open question.

### Reads

```bash
node scripts/adapters/okta-client.js user --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js user --user [OKTA_USER_ID] --execute
```

Good result: exit 0, `status` matches the person's page; profile values other than the login are masked.

```bash
node scripts/adapters/okta-client.js factors --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js factors --user [OKTA_USER_ID] --execute
```

Good result: exit 0, the factor types match the person's Authenticators.

```bash
node scripts/adapters/okta-client.js user-groups --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js user-groups --user [OKTA_USER_ID] --execute
```

Good result: exit 0, the groups match the person's Groups tab.

```bash
node scripts/adapters/okta-client.js group --group [OKTA_GROUP_ID]
node scripts/adapters/okta-client.js group --group [OKTA_GROUP_ID] --execute
```

Good result: exit 0, the group's name matches.

```bash
node scripts/adapters/okta-client.js group-members --group [OKTA_GROUP_ID]
node scripts/adapters/okta-client.js group-members --group [OKTA_GROUP_ID] --execute
```

Good result: exit 0, the members match the group's People.

```bash
node scripts/adapters/okta-client.js group-rules
node scripts/adapters/okta-client.js group-rules --execute
```

Good result: exit 0, the rules and their status match the Rules tab.

```bash
node scripts/adapters/okta-client.js logs --since [NOT_BEFORE] --target [OKTA_USER_ID]
node scripts/adapters/okta-client.js logs --since [NOT_BEFORE] --target [OKTA_USER_ID] --execute
```

Good result: exit 0, the events match the System Log for that user.

```bash
node scripts/adapters/okta-client.js app-user --app [APP_ID] --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js app-user --app [APP_ID] --user [OKTA_USER_ID] --execute
```

Good result: exit 0 when assigned; exit 2 with HTTP 404 when not assigned (or when `[APP_ID]` is wrong, so check it in the console).

### Read-backs

```bash
node scripts/adapters/okta-client.js verify-status --user [OKTA_USER_ID] --status SUSPENDED
node scripts/adapters/okta-client.js verify-status --user [OKTA_USER_ID] --status SUSPENDED --execute
```

Good result: dry run exit 4; exit 0 after suspending the test user, exit 2 before.

```bash
node scripts/adapters/okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push
node scripts/adapters/okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push --execute
```

Good result: dry run exit 4; exit 0 after resetting the test user's push factor.

```bash
node scripts/adapters/okta-client.js verify-factors-reset-all --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --execute
```

Good result: dry run exit 4; exit 0 when the test user has no factor left.

```bash
node scripts/adapters/okta-client.js verify-sessions-cleared --user [OKTA_USER_ID] --not-before [NOT_BEFORE]
node scripts/adapters/okta-client.js verify-sessions-cleared --user [OKTA_USER_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after clearing the test user's sessions.

```bash
node scripts/adapters/okta-client.js verify-password-reset --user [OKTA_USER_ID] --not-before [NOT_BEFORE]
node scripts/adapters/okta-client.js verify-password-reset --user [OKTA_USER_ID] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 after a test password reset.

```bash
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js verify-group-member --group [OKTA_GROUP_ID] --user [OKTA_USER_ID] --execute
```

Good result: dry run exit 4; exit 0 when the test user is a member.

```bash
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID]
node scripts/adapters/okta-client.js verify-app-assigned --app [APP_ID] --user [OKTA_USER_ID] --execute
```

Good result: dry run exit 4; exit 0 when the test app is assigned.

### Open questions this tenant answers

- The Okta read-only role (vendor facts O-08 to O-10). The connector checks the scopes, not the
  admin role. In the test org's Admin Console, confirm the service app holds READ_ONLY_ADMIN and no
  other role, then record whether every read above answers with that role (a 403 on one names a
  read the role does not cover).
- O-11: whether a service app must use DPoP. The connector sends none: record whether the first
  `--execute` gets a token.

## Slack (`slack`)

**Test account.** A test Slack workspace with two test members and two test channels. The app list
reads need an Enterprise plan with an org-level token. Check Slack's price page first; a sign-up is
the owner's call.

**Credential (least privilege, from the manifest):** users:read, team:read, channels:read,
groups:read, channels:history, groups:history; admin.apps:read (Enterprise org-level user token,
only for the app list reads). Refused: any scope that does not end in :read, :read.<detail> or
:history, for example chat:write, users:write, channels:manage, admin.apps:write, admin, bot,
client, commands, incoming-webhook.

**Environment:** `SLACK_TOKEN` and `SLACK_TEAM_ID` (the workspace's team ID,
[@Aegion_SLACK_TEAM_ID] in production).

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js slack
node scripts/adapters/scopes.js slack --execute
```

Good result: exit 0, `"scope_check": "passed"` from the `x-oauth-scopes` header.

### Reads

```bash
node scripts/adapters/slack-client.js whoami
node scripts/adapters/slack-client.js whoami --execute
```

Good result: exit 0, `team_id` is the test workspace.

```bash
node scripts/adapters/slack-client.js user --user [USER_ID]
node scripts/adapters/slack-client.js user --user [USER_ID] --execute
```

Good result: exit 0, `deleted` and the guest flags match the member's profile.

```bash
node scripts/adapters/slack-client.js users --limit 50
node scripts/adapters/slack-client.js users --limit 50 --execute
```

Good result: exit 0, the counts match the members list.

```bash
node scripts/adapters/slack-client.js team
node scripts/adapters/slack-client.js team --execute
```

Good result: exit 0, the team ID matches `SLACK_TEAM_ID`.

```bash
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID]
node scripts/adapters/slack-client.js channel --channel [CHANNEL_ID] --execute
```

Good result: exit 0, `is_archived` and `is_private` match the channel's settings.

```bash
node scripts/adapters/slack-client.js app-requests
node scripts/adapters/slack-client.js app-requests --execute
```

Good result: Enterprise only: exit 0, the requests match the app management page; otherwise exit 2 with the error code, recorded as "not available on this plan".

```bash
node scripts/adapters/slack-client.js apps-approved
node scripts/adapters/slack-client.js apps-approved --execute
```

Good result: as above, the approved apps match.

```bash
node scripts/adapters/slack-client.js apps-restricted
node scripts/adapters/slack-client.js apps-restricted --execute
```

Good result: as above, the restricted apps match.

### Read-backs

`verify-posted` needs the note's SHA-256: run the offline
`node scripts/adapters/slack-client.js digest --file [NOTE_FILE]` on a test note, post that note in the
test channel by hand, then run:

```bash
node scripts/adapters/slack-client.js verify-posted --channel [CHANNEL_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
node scripts/adapters/slack-client.js verify-posted --channel [CHANNEL_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 when a person's message with that digest is in the channel after `[NOT_BEFORE]`.

```bash
node scripts/adapters/slack-client.js verify-deactivated --user [USER_ID]
node scripts/adapters/slack-client.js verify-deactivated --user [USER_ID] --execute
```

Good result: dry run exit 4; exit 0 after deactivating the test member, exit 2 before.

```bash
node scripts/adapters/slack-client.js verify-reactivated --user [USER_ID]
node scripts/adapters/slack-client.js verify-reactivated --user [USER_ID] --execute
```

Good result: dry run exit 4; exit 0 for an active member.

```bash
node scripts/adapters/slack-client.js verify-guest --user [USER_ID] --type single
node scripts/adapters/slack-client.js verify-guest --user [USER_ID] --type single --execute
```

Good result: dry run exit 4; exit 0 for a single-channel test guest, where the plan has guests.

```bash
node scripts/adapters/slack-client.js verify-archived --channel [CHANNEL_ID]
node scripts/adapters/slack-client.js verify-archived --channel [CHANNEL_ID] --execute
```

Good result: dry run exit 4; exit 0 after archiving the second test channel.

```bash
node scripts/adapters/slack-client.js verify-app-approved --app-id [APP_ID]
node scripts/adapters/slack-client.js verify-app-approved --app-id [APP_ID] --execute
```

Good result: dry run exit 4; Enterprise only: exit 0 for an approved test app.

```bash
node scripts/adapters/slack-client.js verify-app-restricted --app-id [APP_ID]
node scripts/adapters/slack-client.js verify-app-restricted --app-id [APP_ID] --execute
```

Good result: dry run exit 4; Enterprise only: exit 0 for a restricted test app.

### Open questions this tenant answers

- S-12: which methods return `x-oauth-scopes`. Record the scope check's value for `whoami` and for
  the first read of each other kind.
- S-09: whether the request and restricted lists use `admin.apps:read`. Record whether
  `app-requests` and `apps-restricted` answer with that scope alone.

### Slack access logs (`slack-access-logs`)

**Credential (least privilege, from the manifest):** admin (a workspace admin's user token, paid
plan; Slack has no narrower scope for team.accessLogs). Refused: any scope other than admin that
does not end in :read, :read.<detail> or :history. The admin scope also allows writes through
Slack's SCIM API, so export `SLACK_ACCESS_LOGS_TOKEN` for this one read and unset it right after;
never put it in `SLACK_TOKEN`.

```bash
node scripts/adapters/scopes.js slack-access-logs
node scripts/adapters/scopes.js slack-access-logs --execute
```

Good result: exit 0, `"scope_check": "passed"`.

```bash
node scripts/adapters/slack-client.js access-logs --count 100
node scripts/adapters/slack-client.js access-logs --count 100 --execute
```

Good result: paid plans only: exit 0 after `auth.test` names the test workspace; the newest entries match the access logs page.

## Jira (`jira`)

**Test account.** A Jira Service Management test site with one service desk project. Check
Atlassian's price page first; a sign-up is the owner's call.

**Credential (least privilege, from the manifest):** a classic API token of a dedicated Atlassian
account that can only view the service desk project's requests (a classic token carries all of its
account's permissions, so the account is the limit). Refused: an account with Jira or site
administration; an account that can edit, transition or delete issues in other projects. Atlassian
does not expose a token's scopes, so confirm the account's permissions in the site's settings.

**Environment:** `JIRA_SITE` (the bare `<site>.atlassian.net` hostname, [@Aegion_JIRA_URL] in
production), `JIRA_EMAIL` and `JIRA_API_TOKEN`; optional `JIRA_SERVICE_DESK_ID`.

**Scope check (row 4).**

```bash
node scripts/adapters/scopes.js jira
node scripts/adapters/scopes.js jira --execute
```

Good result: exit 0, `"scope_check": "not exposed by the vendor"`.

### Reads

```bash
node scripts/jira-client.js list-desks
node scripts/jira-client.js list-desks --execute
```

Good result: exit 0, one `id=... key=... name=...` line per service desk the account can see.

```bash
node scripts/jira-client.js list-types --service-desk [N]
node scripts/jira-client.js list-types --service-desk [N] --execute
```

Good result: exit 0, one `id=... name=...` line per request type.

```bash
node scripts/jira-client.js get --issue [JIRA-###]
node scripts/jira-client.js get --issue [JIRA-###] --execute
```

Good result: exit 0, `[JIRA-###] ID ... status=...` matching the request.

```bash
node scripts/jira-client.js transition --issue [JIRA-###] --to "[STATUS]"
node scripts/jira-client.js transition --issue [JIRA-###] --to "[STATUS]" --execute
```

Good result: the first line is a local preview (exit 0); the second is a read-only preflight (exit 0) that prints the binding line and the HUMAN-RUN procedure, and changes nothing.

### Read-backs

The create and comment previews print the exact `verify-*` line with its digest and its
`--not-before` value (epoch milliseconds): run `node scripts/jira-client.js create --summary "..." --description "..."`
or `node scripts/jira-client.js comment --issue [JIRA-###] --body "..."` with test text, follow the
printed procedure by hand on the test site, then run the read-back with the values it printed.

```bash
node scripts/jira-client.js verify-create --issue [JIRA-###] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
node scripts/jira-client.js verify-create --issue [JIRA-###] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 and a `Verified:` line after the hand-made request.

```bash
node scripts/jira-client.js verify-comment --issue [JIRA-###] --comment-id [COMMENT_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
node scripts/jira-client.js verify-comment --issue [JIRA-###] --comment-id [COMMENT_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] --execute
```

Good result: dry run exit 4; exit 0 and a `Verified:` line after the hand-posted comment.

```bash
node scripts/jira-client.js verify-transition --issue [JIRA-###] --issue-id [N] --from-version [N] --to-status "[STATUS]"
node scripts/jira-client.js verify-transition --issue [JIRA-###] --issue-id [N] --from-version [N] --to-status "[STATUS]" --execute
```

Good result: dry run exit 4; exit 0 after the hand transition, with the issue ID and status version the preflight printed.

### Open questions this tenant answers

- A-06: that no call returns a token's scopes. Record that the scope check reports "not exposed".
- A-08: whether answers carry `X-ARequestId`. Record whether a failed read's `admin detail` line
  shows a request id.

## The open questions in one place

| Connector | Question | Where on this page |
|---|---|---|
| Okta | does the service app hold READ_ONLY_ADMIN and nothing else, and does every read answer with it | Okta, open questions |
| Jamf Pro | does the server accept the token at `/api/oauth/token`, or only at `/api/v1/oauth/token` (J-01) | Jamf Pro, open questions |
| GitHub | does a rate-limit 403 end in `RATE_LIMITED`, and does a permission 403 stay a permission refusal | GitHub, open questions |
| Microsoft Graph | does a password reset move `signInSessionsValidFromDateTime` | Microsoft Graph, open questions |

The full list of unconfirmed vendor facts, ordered by the gates that rest on them, is
[vendor-facts-priority.md](vendor-facts-priority.md).
