# Aegis Placeholder Dictionary — native authority (v1, 2026-08-07)

Canonical token list for everything Aegis writes. Vendored from Koinon
(`shared/security/placeholder-dict.md`, read-only historical source) and now owned
by Aegis (ADR-006). Real values are injected at runtime via env vars only; tracked
files carry tokens, never literals. Validate every `[@Aegion_*]` reference against
this file — never invent a parallel set.

## Org tokens (`[@Aegion_*]` namespace)

| Token | Description | Example / note |
|-------|-------------|----------------|
| `[@Aegion]` | Organization display name | `Example Nonprofit` |
| `[@Aegion_DOMAIN]` | Primary tenant domain | **Decoy emission value `aegion.example.org` only** — reserved, non-resolving. Real domain is env-var only (`AEGION_DOMAIN`); the output scanner blocks both decoy and real literal from tracked files (SR-8) |
| `[@Aegion_SIZE]` | Approximate staff size | `~150` |
| `[@Aegion_ISP]` | Internet service provider | `[ISP_VENDOR]` |
| `[@Aegion_WAN]` | WAN technology between sites | `point-to-point microwave` |
| `[@Aegion_SITE_2]` / `[@Aegion_SITE_3]` / `[@Aegion_SITE_4]` | Office site labels | `[SITE_2]` … |
| `[@Aegion_SITE_COUNT]` | Number of office sites | `4` |
| `[@Aegion_DOMAIN_SHORT]` | Domain label without the suffix (AD distinguished names) | `aegion` |
| `[@Aegion_DOMAIN_SP]` | SharePoint Online tenant host; runbooks use it as `https://[@Aegion_DOMAIN_SP]` and its `-admin` form | `[SP_TENANT_HOST]` |
| `[@Aegion_VOIP]` | Current VoIP vendor | `[VOIP_VENDOR]` |
| `[@Aegion_VOIP_LEGACY]` | Legacy VoIP vendor | `[LEGACY_VOIP]` |
| `[@Aegion_VOIP_URL]` | VoIP admin portal URL | `voip.example.com` |
| `[@Aegion_JIRA_SPACE]` | Jira project space | `IT` |
| `[@Aegion_JIRA_URL]` | Jira instance URL | `example.atlassian.net` |
| `[@Aegion_ALARM]` | Alarm/physical-security vendor | `[ALARM_VENDOR]` |
| `[@Aegion_FINANCE_SERVER]` | Finance server name | `[FINANCE_SERVER]` |
| `[@Aegion_NETPARTNER]` | Networking/cabling partner | `[NET_PARTNER]` |
| `[@Aegion_REMOTE_ACCESS]` | Remote access endpoint | `[REMOTE_ACCESS]` |
| `[@Aegion_GWS_CUSTOMER_ID]` | Google Workspace customer ID (Admin console → Account → Account settings) | `[GWS_CUSTOMER_ID]` |
| `[@Aegion_OKTA_ORG_URL]` | Okta org URL (the org's Okta Admin Console host) | `[OKTA_ORG_URL]` |
| `[@Aegion_JAMF_URL]` | Jamf Pro server URL | `[JAMF_PRO_URL]` |
| `[@Aegion_FLEET_URL]` | Fleet server hostname (the Fleet UI and REST API host; `FLEET_URL` for the read-only adapter) | `[FLEET_SERVER_HOST]` |
| `[@Aegion_SLACK_URL]` | Slack workspace URL (the `<name>.slack.com` host people sign in to) | `[SLACK_WORKSPACE_HOST]` |
| `[@Aegion_SLACK_TEAM_ID]` | Slack workspace (team) ID; the Slack adapter refuses a record from any other team (`SLACK_TEAM_ID`) | `[SLACK_TEAM_ID]` |
| `[@Aegion_LINEAR_ORG]` | Linear workspace URL key (`linear.app/<key>`); the Linear adapter refuses a record from any other workspace (`LINEAR_ORG`) | `[LINEAR_URL_KEY]` |
| `[@Aegion_LINEAR_TEAM]` | Linear team key that holds IT tickets (the prefix of `[ISSUE_ID]`) | `IT` |
| `[@Aegion_GITHUB_ORG]` | GitHub organization login (`github.com/<login>`); the intake and the GitHub connector refuse an item from any other organization (`GITHUB_ORG`) | `[GITHUB_ORG]` |
| `[@Aegion_MS_TENANT_ID]` | Microsoft Entra tenant ID (a GUID); the Microsoft Graph connector builds its token request and binds its reads to it (`MS_TENANT_ID`) | `[MS_TENANT_ID]` |

## Generic operational tokens (always-placeholder)

`[ADMIN_NAME]` · `[FIRST_NAME]` · `[LAST_NAME]` · `[USER@DOMAIN.COM]` ·
`[DEVICE_NAME]` · `[DT-FirstName,LastName]` · `[LT-FirstName,LastName]` ·
`[TEMP_PASSWORD]` · `[JIRA-###]` · `[MANAGER_NAME]` · `[UPN]` · `[PHONE_NUMBER]` ·
`[STATUS]` · `[EXTENSION]` · `[DEPT_DL]` · `[SHARED_MAILBOX]` · `[PRODUCT_PROFILE]` ·
`[LICENSE_TYPE]` · `[ENROLLMENT_TOKEN_QR]` · `[WORK_PHONE_DEVICE_GROUP]` ·
`[WORK_PHONE_ENROLLMENT_GROUP]` · `[REMOTE_USER_GROUP]` · `[START_DATE]` ·
`[GUEST_UPN]` (a B2B guest's sign-in name — distinct from `[UPN]`, which is always
a member user; the replay cache binds identity-variant cases to that difference)

Google Workspace / Okta / Jamf / macOS lane (v8.9): `[MANAGER_UPN]` (the manager's
sign-in name) · `[USER_ID]` (an immutable directory ID — Entra object ID, Google
user ID, or Okta user ID) · `[GROUP_EMAIL]` (a Google Group's address, written
without `@` so it can never be mistaken for a real mailbox) · `[OU_PATH]` (a Google
organizational-unit path such as `/[OU_PATH]`) · `[DEVICE_ID]` (an Admin console,
Jamf Pro, or Okta device ID) · `[SERIAL_NUMBER]` (a hardware serial number) ·
`[APP_NAME]` (an Okta or Google app display name) · `[LOCK_PIN]` (a remote-lock
passcode — kept in the password manager, never in a ticket)

Google Workspace, Fleet, Jamf, Slack and Linear lane (G2, 2026-10-27): `[HOST_ID]` (a
Fleet host ID) · `[FLEET_NAME]` (a Fleet "fleet", formerly a team) · `[EXECUTION_ID]` (a
Fleet script execution ID) · `[CVE_ID]` (a CVE identifier) · `[REPORT_NAME]` (a Fleet
report, formerly a saved query) · `[POLICY_ID]` / `[POLICY_NAME]` (a Fleet or Jamf Pro
policy) · `[PROFILE_ID]` / `[PROFILE_NAME]` (a Jamf Pro configuration profile) ·
`[SMART_GROUP]` (a Jamf Pro smart or static group) · `[SCRIPT_NAME]` (a Fleet or Jamf
script) · `[ISSUE_ID]` (a Linear issue identifier such as `[@Aegion_LINEAR_TEAM]-123`) ·
`[LABEL_NAME]` (a Linear label) · `[CHANNEL_NAME]` / `[CHANNEL_ID]` (a Slack channel) ·
`[APP_ID]` (a Slack or Google app ID) · `[EXTERNAL_DOMAIN]` (a partner domain outside
`[@Aegion_DOMAIN]`) · `[FILE_NAME]` (a file or Drive item name) · `[ROLE_NAME]` (an admin
role name) · `[NOTE_FILE]` / `[NOTE_SHA256]` (a drafted ticket note and its digest) ·
`[NOT_BEFORE]` (the time a read-back must start from). `[USER_ID]` also covers a Slack
member ID and a Linear user ID.

Added with the G2 runbooks (2026-10-27): `[FLEET_ID]` (a Fleet fleet's numeric ID) ·
`[REPORT_ID]` (a Fleet report's numeric ID) · `[SOFTWARE_TITLE_ID]` (a Fleet software
title's numeric ID) · `[STATE_NAME]` (a Linear workflow status name, as the team's
states read prints it) · `[CANONICAL_ISSUE_ID]` (the older Linear issue a duplicate
points to) · `[SMART_GROUP_ID]` (a Jamf Pro smart or static group's numeric ID) ·
`[MEMBER_COUNT]` (a group's member count, recorded or predicted before a change) ·
`[PATCH_TITLE_ID]` (a Jamf Pro patch software title configuration ID) · `[PLAN_UUID]`
(a Jamf Pro Managed Software Update plan ID) · `[ROLE_ID]` (a Google admin role's
numeric ID) · `[PENDING_ACTION]` / `[PENDING_ACTION_ID]` (one queued Fleet item, a
lock, wipe, MDM command or script, and its command UUID or script execution ID) ·
`[HOST_COUNT]` (the number of Fleet hosts a batch action selects, written in the
ticket before the gate) · `[TICKET_HOST_COUNT]` (the host count a ticket states,
kept apart from the count Fleet reports) · `[PRIORITY_LEVEL]` (a Linear priority:
Urgent, High, Medium, Low or No priority) · `[DATE_TIME]` (a date and time written in
UTC as ISO 8601, for example when a Linear snooze ends) · `[COMMENT_ID]` (the ID of one
ticket comment, as the ticket system's comment read prints it) · `[MANAGER_USER_ID]` (the
member who gains or loses Slack app request management, kept apart from the requester's
`[USER_ID]`) · `[PROFILE_IDENTIFIER]` (a Jamf Pro configuration profile's PayloadIdentifier,
which names the profile on the Mac) · `[COMMAND_TYPE]` (a Jamf Pro MDM command type such as
INSTALL_PROFILE) · `[TRIGGERS]` / `[FREQUENCY]` (a Jamf Pro policy's triggers and execution
frequency after a change) · `[ADD_COUNT]` / `[REMOVE_COUNT]` (the number of Macs a static group
change adds and removes, each named by serial in the change record). `[APP_NAME]` also covers a Slack app and a software title in Fleet or
Jamf Pro. In a Jamf Pro runbook, `[DEVICE_ID]` is either the computer ID or the
management ID, and the runbook says which.

Added with batch G3 (2026-10-28): `[GITHUB_USER]` (a GitHub login, as an @mention in an
issue or a member in a read; the intake writes it in place of every @mention) ·
`[REPO_NAME]` (a repository in `[@Aegion_GITHUB_ORG]`, its name only) · `[BRANCH_NAME]` (a
branch, such as main) · `[TEAM_SLUG]` (a GitHub team's slug) · `[ALERT_NUMBER]` (a secret
scanning or Dependabot alert number in one repository) · `[OKTA_USER_ID]` /
`[OKTA_GROUP_ID]` / `[RULE_ID]` / `[FACTOR_ID]` (an Okta user, group, group rule or
factor ID, as the Okta read prints it) · `[GROUP_NAME]` (a group's display name in Okta,
Microsoft 365 or Google Workspace, beside its ID) · `[RULESET_NAME]` (a GitHub repository
ruleset's name) · `[ALERT_COUNT]` (how many alerts a bulk action covers) ·
`[DISMISS_REASON]` (a Dependabot dismissal reason, one of the five GitHub names).

Added with the batch G3 close-out (2026-10-30): `[CHANGE_ID]` (the change id that
`node scripts/audit/change-record.js open` prints for one R2 or R3 procedure, `chg-` and 12
lower-case hex characters; the procedure's read-back passes it as `--change [CHANGE_ID]`, and
the read-back refuses to read unless the audit trail holds that change, opened for the same
connector and `verify-*` command and approved). Note templates keep using lowercase or
single-letter fill-ins (`[X]`, `[N]`, `[timestamp]`) for numbers and times, as the
existing runbooks do.

These describe individuals, devices, or transient values. Templates never substitute
real data; the operator types real values in their messages and the agent responds in
placeholders (SR-8).

## Validation rules

1. Every `[@Aegion_*]` token used anywhere in Aegis MUST appear in this file.
2. Generic tokens are render-time placeholders — never substituted with real values.
3. If an env value is absent at runtime, render the literal token (`[@Aegion_XYZ]`).
4. Unrecorded org values in runbooks stay as named placeholders marked "[org gap]" —
   never invented.

## Anti-patterns

- ❌ Hard-code a real domain "so the example reads naturally"
- ❌ Use a real test-account UPN — test accounts are real identities
- ❌ Substitute `[@Aegion_DOMAIN]` with the actual domain anywhere in tracked files
- ❌ Use a token without adding it here — drift causes silent breakage

## Adding a token

1. Add the row/entry above. 2. Update `.env.example` if it's env-backed.
3. Run `node scripts/pre-commit-check.js` — confirm the token passes the placeholder
regex. (Historical note: tokens previously required a Koinon dictionary PR; this file
is now the authority. Sharing tokens upstream to Koinon is optional.)
