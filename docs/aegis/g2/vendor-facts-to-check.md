# Vendor facts to check by hand (batch G2)

This session's network refused the vendor documentation hosts, so each fact below rests on a search excerpt or on the vendor's own repository (docs source, schema, SDK or discovery document), as the line itself says. One row per marked line: where it is, how it was read, and the breadcrumb, command or API path on that line. Re-read each against the live vendor page and correct the runbook if they differ. Generated from the runbooks, adapters and the posture audit at the head of `feat/g2-gws-fleet-jamf-slack-linear`.

Total: 445 marked lines.

## Fleet (37 lines)

| where | how read | breadcrumb, command or API path on the line |
|---|---|---|
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/lock-wipe-hosts.md: read in full: Lock, Unlock, Wipe and Cancel paths, badges, per-OS behavior, PIN, Linux reboot and wipe limits, cancel windows, Entra advice |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md: the source of fleetdm.com/docs/rest-api/rest-api: `mdm.device_status`, `mdm.pending_action`, script results, MDM commands, activities, doWipeProtected and doWipe, delete semantics |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md: Observer, Observer+, Technician, Maintainer, Admin, GitOps permissions |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/scripts.md: Run Script paths, batch run, results |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/enroll-hosts.md: Turn off MDM, Unenroll, Delete host and which hosts come back |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/Contributing/reference/audit-logs.md: activity types |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/fleetctl.md: fleetctl login and its config file |
| `.claude/commands/fleet-device-actions.md:395` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md: release 4.93.2, teams renamed fleets in 4.82.0). fleetdm.com could not be opened from this session (proxy 403), so every source was read as the vendor's own docs source in the fleetdm/fleet repository (main branch |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md: the source of fleetdm.com/docs/rest-api/rest-api: host status values, `seen_time`, `detail_updated_at`, refetch and its Android 400, disk encryption fields and statuses, the fleet filter on Premium, MDM enrollment values, `mdm |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/enforce-disk-encryption.md: the Show disk encryption key action, key only when verified |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/Contributing/reference/audit-logs.md: read_host_disk_encryption_key and other activity types |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/enroll-hosts.md: deleted hosts re-enroll, Apple Business hosts return as Pending |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/lock-wipe-hosts.md: Apple lock and wipe need MDM on |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md: Observer through Admin permissions |
| `.claude/commands/fleet-host-health.md:144` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md: release 4.93.2, teams renamed fleets in 4.82.0). fleetdm.com could not be opened from this session (proxy 403), so every source was read as the vendor's own docs source in the fleetdm/fleet repository (main branch |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/reports.md: live and stored reports, Add report, Live report, Export results, Store data, Store report results; vendor repo |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md: stored report results, the 25-second live-report wait, the result caps, activities, hosts by status; vendor repo |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/Contributing/reference/audit-logs.md: the `live_query` activity and its fields; vendor repo |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md: who may read, run and create reports; vendor repo |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/schema/tables/launchd.yml, listenin: raw.githubusercontent.com/fleetdm/fleet/main/schema/tables/launchd.yml, listening_ports.yml, process_open_sockets.yml, logged_in_users.yml, last.yml, shell_history.yml, startup_items.yml, scheduled_tasks.yml and users. |
| `.claude/commands/fleet-osquery-investigation.md:229` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md: 4.82.0 renamed queries to reports and teams to fleets; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/what-are-fleet-policies.md: pass and fail, hourly runs, the Policies page; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/automations.md: newly failing hosts, 3 attempts, query edits and Reset policy, daily ticket automations; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/policy-automation-run-script.md: Policies → Manage automations → Run script; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/scripts.md: Run Script on a host, where results appear, the 5-minute timeout; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md: policy counts, hosts by policy response, the host record, refetch, script results, activities; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md: who may view, script and edit policies; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/Contributing/reference/audit-logs.md: the `ran_script` and policy activities; vendor repo |
| `.claude/commands/fleet-policy-failures.md:215` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md: 4.82.0 renamed teams to fleets; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/vulnerability-processing.md: CVE sources per platform, Debian and Arch limits; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/docs/REST%20API/rest-api.md: software titles, vulnerabilities and `resolved_in_version`, the 204 answer, host software, hosts by title, install results, Premium-only filters; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/deploy-software-packages.md: Add software, install on a host, the 1-hour timeout and 3 tries, where install status appears; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/fleet-maintained-apps.md: adding a Fleet-maintained app, Deploy → Patch, uninstall, deleting an offer; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/automatic-software-install-in-fleet.md: Policies → Manage automations → Install software; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/automations.md: newly failing hosts, 3 tries, the 24-hour wait after 10 failures, Reset policy, the 30-day vulnerability automation window; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/articles/role-based-access.md: who may view, install, add software and edit automations; vendor repo |
| `.claude/commands/fleet-vulnerable-software.md:224` | vendor repository | raw.githubusercontent.com/fleetdm/fleet/main/CHANGELOG.md: 4.82.0 renamed teams to fleets; vendor repo |

## Linear (92 lines)

| where | how read | breadcrumb, command or API path on the line |
|---|---|---|
| `.claude/commands/linear-intake.md:17` | search excerpt | - Creating one issue is R1, and so is giving it one label and a priority, with one consequence to weigh first: on a workspace with SLAs turned on, the priority set here can start an SLA clock (Linear' |
| `.claude/commands/linear-intake.md:28` | search excerpt | - Whether SLAs are turned on for the workspace (a Business or Enterprise plan feature, search excerpt): **[org gap]**. |
| `.claude/commands/linear-intake.md:33` | search excerpt | - Every IT request becomes an issue in one team. A team's Triage inbox (a status of type triage) collects issues from integrations, from people outside the team, from Linear Asks (Slack, email intake  |
| `.claude/commands/linear-intake.md:35` | search excerpt | - Labels are workspace labels or team labels; a label group nests one level, and an issue takes one label from a group, so a label from a single-select group replaces the group's current label (Linear |
| `.claude/commands/linear-intake.md:36` | search excerpt | - Priority drives SLAs where they are on: the default rules give Urgent 24 hours and High 1 week, and Medium, Low and No priority none; a priority set later starts the clock on an older issue (search  |
| `.claude/commands/linear-intake.md:37` | search excerpt | - On an Asks email intake issue, comments sync back to the requester's email thread (search excerpt), so every comment, the intake note included, may reach the requester. |
| `.claude/commands/linear-intake.md:55` | search excerpt | Linear → Team settings ; Workflow → read the statuses and whether the team has a triage status ; [@Aegion_LINEAR_TEAM] |
| `.claude/commands/linear-intake.md:116` | search excerpt | - **Scope:** one issue; a label from a single-select group replaces the group's current label on that issue; with SLAs on, an Urgent or High priority starts an SLA clock (24 hours and 1 week under the |
| `.claude/commands/linear-intake.md:121` | search excerpt | Labels → pick ; [ISSUE_ID]; [LABEL_NAME] |
| `.claude/commands/linear-intake.md:131` | search excerpt | [ISSUE_ID]; [PRIORITY_LEVEL] |
| `.claude/commands/linear-intake.md:137` | search excerpt | Linear → Settings → Asks; Linear → Team settings ; [@Aegion_LINEAR_TEAM] |
| `.claude/commands/linear-intake.md:142` | search excerpt | - **Priority is an SLA commitment.** Where SLAs are on, Urgent starts a 24-hour clock and High a 1-week clock under the default rules, and a priority set later starts the clock on an older issue (sear |
| `.claude/commands/linear-intake.md:143` | search excerpt | - **Never create labels from intake.** Typing "Group/Label" into Add label creates a group and a label (search excerpt), and label management may belong to Admins only. |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/linear-asks: Asks intake through Slack, email and web forms into a team's triage; Business and Enterprise |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/changelog/2025-07-17-email-intake-for-asks: intake addresses create issues in the selected team's triage; comments sync to the email thread |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/changelog/2026-04-02-web-forms-for-linear-asks: web forms on Enterprise |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/issue-templates.md: a template can have its own email address |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/changelog/2025-11-20-form-templates: form templates on all plans |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/triage: the Triage inbox and who lands there |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/labels: workspace and team labels, groups, one label per group, the Group/Label shorthand |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/configuring-workflows: statuses under Team settings → Workflow |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/sla: Business and Enterprise, default rules, the SLA icon colours |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/delete-archive-issues: Recently deleted issues for 30 days; a 2021 changelog said 14 |
| `.claude/commands/linear-intake.md:186` | search excerpt | linear.app/docs/members-roles: member roles |
| `.claude/commands/linear-intake.md:186` | vendor repository | raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql: read in full: WorkflowState.type values, IssueLabel.groupType, Team.requirePriorityToLeaveTriage, securitySettings.labelManagementRole, User.guest, Issue SLA fields, the issueCreate, issueUpdate and issueAddLabel mutatio |
| `.claude/commands/linear-ticket-note.md:17` | search excerpt | - Posting one comment is R1 (it can be edited or deleted later), with one exception that cannot be undone: on an issue that came in through an Asks email intake address, comments sync back to the requ |
| `.claude/commands/linear-ticket-note.md:32` | search excerpt | - A Linear comment is a markdown body on one issue. A person writes it in the issue's "Leave a comment…" box and posts it with the **Comment** button or Cmd/Ctrl+Enter; comments are not auto-saved, un |
| `.claude/commands/linear-ticket-note.md:53` | search excerpt | archivedAt; trashed |
| `.claude/commands/linear-ticket-note.md:107` | search excerpt | - **Scope:** one comment on [ISSUE_ID], visible to everyone who can see the issue's team; on an issue that came in through Asks email intake it may also be emailed to the requester (search excerpt) |
| `.claude/commands/linear-ticket-note.md:229` | search excerpt | linear.app/docs/comment-on-issues: the "Leave a comment…" box, the Comment button and Cmd/Ctrl+Enter, no auto-save, edit and delete in the comment's "..." menu |
| `.claude/commands/linear-ticket-note.md:229` | search excerpt | linear.app/changelog/2025-07-17-email-intake-for-asks: email intake creates issues in the team's triage and comments sync to the email thread |
| `.claude/commands/linear-ticket-note.md:229` | search excerpt | linear.app/docs/delete-archive-issues: archived issues cannot be edited until restored |
| `.claude/commands/linear-ticket-note.md:229` | search excerpt | linear.app/docs/members-roles: member roles |
| `.claude/commands/linear-ticket-note.md:229` | vendor repository | raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql: read in full: Comment fields id, body, createdAt, editedAt, user; Issue.comments includes inline description comments; Issue.archivedAt and trashed; User.guest; the commentCreate, commentUpdate and commentDelete mutation |
| `.claude/commands/linear-triage.md:17` | search excerpt | - **Mark as duplicate is the one R2 step.** Linear moves the duplicate's attachments to the issue you pick (search excerpt), so undoing it means moving them back by hand. The attachment list goes into |
| `.claude/commands/linear-triage.md:20` | search excerpt | - **A comment may leave the building.** On an issue that came in through Linear Asks or an email intake address, a comment can be synced back to the requester's email thread (search excerpt): write ev |
| `.claude/commands/linear-triage.md:28` | search excerpt | - Whether the workspace plan has SLAs and triage responsibility (Business and Enterprise plans, search excerpt). |
| `.claude/commands/linear-triage.md:33` | search excerpt | triage |
| `.claude/commands/linear-triage.md:34` | search excerpt | ] moves the issue to the team's default status, with an optional comment. Mark as duplicate [; ] closes it into the team's duplicate status and moves its attachments to the issue you pick. Decline [; ] cancels it, with an optional comment. Snooze [ |
| `.claude/commands/linear-triage.md:37` | search excerpt | labelManagementRole |
| `.claude/commands/linear-triage.md:38` | search excerpt | Settings → Issues → SLAs; slaType; slaStartedAt; slaBreachesAt |
| `.claude/commands/linear-triage.md:40` | search excerpt | - **How the vendor facts were read:** Linear's documentation site could not be opened from this session on 2026-10-27, so menu labels, plan tiers and windows below come from Linear's pages as indexed  |
| `.claude/commands/linear-triage.md:56` | search excerpt | Workflow → read the status names and which status accepted issues land ; [@Aegion_LINEAR_TEAM] |
| `.claude/commands/linear-triage.md:57` | search excerpt | Triage → read whether triage responsibility is on and who holds it no; [@Aegion_LINEAR_TEAM] |
| `.claude/commands/linear-triage.md:58` | search excerpt | Linear → Settings → Labels ; Labels page → read the label groups and which labels IT uses  |
| `.claude/commands/linear-triage.md:122` | search excerpt | triagedAt |
| `.claude/commands/linear-triage.md:168` | search excerpt | - **Scope:** one issue; it moves to the team's canceled status with an optional comment, and on an Asks or email-intake issue that comment can reach the requester by email (search excerpt) |
| `.claude/commands/linear-triage.md:212` | search excerpt | [ISSUE_ID] |
| `.claude/commands/linear-triage.md:213` | search excerpt | Linear → Settings → Issues → SLAs → read the rule for this issue |
| `.claude/commands/linear-triage.md:256` | search excerpt | - **Comments can reach requesters.** On Asks and email-intake issues an accept or decline comment can be emailed to the requester (search excerpt); it cannot be recalled. |
| `.claude/commands/linear-triage.md:301` | vendor repository | raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql: read in full: the seven status types, `requirePriorityToLeaveTriage`, `markedAsDuplicateWorkflowState`, `triagedAt`, the SLA fields, `labelManagementRole`, `issueBatchUpdate` at most 50 ids |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/triage: the four actions, their shortcuts, triage responsibility on Business and Enterprise |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/sla: Settings → Issues → SLAs, plans, default rules, the fire icon |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/labels: workspace and team labels, label groups |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/configuring-workflows: default statuses and categories |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/comment-on-issues: the comment box |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/linear-asks and linear.app/changelog/2025-07-17-email-intake-for: linear.app/docs/linear-asks and linear.app/changelog/2025-07-17-email-intake-for-asks (search excerpt: Asks intake, comments synced to the requester's email thread) |
| `.claude/commands/linear-triage.md:301` | search excerpt | linear.app/docs/select-issues: multi-select and bulk actions |
| `.claude/commands/linear-workspace-admin.md:18` | search excerpt | - **Closed issues do not need deleting.** Each team archives closed issues automatically after its auto-archive period (1 to 12 months, search excerpt), and archived issues stay searchable. "Delete al |
| `.claude/commands/linear-workspace-admin.md:36` | search excerpt | - **Roles.** Linear's schema has the role types owner, admin, user (shown as Member), guest and app. On the Free plan everyone is an Admin, and role types can be changed only on paid plans (search exc |
| `.claude/commands/linear-workspace-admin.md:37` | search excerpt | Cmd/Ctrl Z; issueDelete; issueArchive; trash |
| `.claude/commands/linear-workspace-admin.md:38` | search excerpt | Cmd/Ctrl A; Cmd/Ctrl K; issueBatchUpdate |
| `.claude/commands/linear-workspace-admin.md:39` | search excerpt | userSuspend; userUnsuspend; forceBypassScimRestrictions |
| `.claude/commands/linear-workspace-admin.md:40` | search excerpt | Settings → Administration → Security; Settings → Workspace → Security and Settings → Security |
| `.claude/commands/linear-workspace-admin.md:41` | search excerpt | CSV export sits under Settings → Administration → Import Export |
| `.claude/commands/linear-workspace-admin.md:43` | search excerpt | - **How the vendor facts were read:** Linear's documentation site could not be opened from this session on 2026-10-27, so menu labels, plan tiers and windows come from Linear's pages as indexed by a w |
| `.claude/commands/linear-workspace-admin.md:59` | search excerpt | Linear → Settings → Administration → Members → find your own row ; [USER@DOMAIN.COM] |
| `.claude/commands/linear-workspace-admin.md:60` | search excerpt | Linear → Settings → Security → read whether SAML and SCIM are on ; Settings → Administration → Security or Settings → Workspace → Security |
| `.claude/commands/linear-workspace-admin.md:62` | search excerpt | Workflow → read the auto-archive period for closed issues ; [@Aegion_LINEAR_TEAM] |
| `.claude/commands/linear-workspace-admin.md:96` | search excerpt | Cmd/Ctrl Z |
| `.claude/commands/linear-workspace-admin.md:103` | search excerpt | [ISSUE_ID]; Cmd/Ctrl Delete |
| `.claude/commands/linear-workspace-admin.md:111` | search excerpt | Archives → Recently deleted issues lists ; [@Aegion_LINEAR_TEAM]; [ISSUE_ID] |
| `.claude/commands/linear-workspace-admin.md:124` | search excerpt | Archives → Recently deleted issues ; [@Aegion_LINEAR_TEAM]; [ISSUE_ID] |
| `.claude/commands/linear-workspace-admin.md:161` | search excerpt | Cmd/Ctrl K; [STATE_NAME] |
| `.claude/commands/linear-workspace-admin.md:183` | search excerpt | Cmd/Ctrl K |
| `.claude/commands/linear-workspace-admin.md:203` | search excerpt | - **Scope:** one member of workspace [@Aegion_LINEAR_ORG]; their issues, comments and assignments stay; they stay listed under Members as suspended and drop from the next billing cycle (search excerpt |
| `.claude/commands/linear-workspace-admin.md:211` | search excerpt | Linear → Settings → Administration → Members ; [USER@DOMAIN.COM]; ... |
| `.claude/commands/linear-workspace-admin.md:245` | search excerpt | Cmd/Ctrl K |
| `.claude/commands/linear-workspace-admin.md:251` | search excerpt | - **Scope:** every team the export covers, with issue ID, team, title, status, assignee, labels and more (search excerpt); assignee names make it personal data |
| `.claude/commands/linear-workspace-admin.md:256` | search excerpt | **Role needed:** a workspace Owner (Linear's exporting-data page as indexed says Owners; whether that holds on every plan or only Enterprise is unclear, search excerpt). An Admin who is not an Owner s |
| `.claude/commands/linear-workspace-admin.md:259` | search excerpt | Linear → Settings → Administration → Import Export  |
| `.claude/commands/linear-workspace-admin.md:264` | search excerpt | GUI read-back: the workspace audit log shows the export with your name and the time (search excerpt; the audit log page's label is unverified). No adapter read covers exports or the audit log. |
| `.claude/commands/linear-workspace-admin.md:272` | search excerpt | Linear → Settings → Security → read whether SAML and SCIM are on ; Settings → Administration → Security or Settings → Workspace → Security |
| `.claude/commands/linear-workspace-admin.md:273` | search excerpt | Linear → Settings → Administration → Security → read which sign-in methods are allowed |
| `.claude/commands/linear-workspace-admin.md:275` | search excerpt | > **PREVIEW ONLY [linear-workspace-admin-sso-preview]:** Planning only, not authorized from this runbook: turning SAML, SCIM or a sign-in method on or off can lock every member out at once. It is a ch |
| `.claude/commands/linear-workspace-admin.md:333` | vendor repository | raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql: read in full: `issueDelete` and its `permanentlyDelete` argument with the 30-day grace period, `issueArchive` with `trash`, `issueBatchUpdate` at most 50 ids, `userSuspend` and `userUnsuspend` each callable only by a wor |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/delete-archive-issues: delete paths, Recently deleted issues, 30 days, automatic archive of 1 to 12 months |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/select-issues: multi-select and the command menu |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/members-roles: the Members page, suspend from the row menu, billing, Free plan roles |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/scim: Enterprise and SAML prerequisite, Settings → Security, View configuration |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/login-methods and linear.app/docs/login-restrictions (search exc: linear.app/docs/login-methods and linear.app/docs/login-restrictions (search excerpt: SAML and admin fallback, the conflicting security paths and plan names) |
| `.claude/commands/linear-workspace-admin.md:333` | search excerpt | linear.app/docs/exporting-data: Import Export, Owners, private-teams toggle, view export limits of 250 and 2,000, audit log |

## Slack (76 lines)

| where | how read | breadcrumb, command or API path on the line |
|---|---|---|
| `.claude/commands/slack-app-approval.md:157` | search excerpt | Read Phase A step 1 first: the request managers it recorded are the pre-state. Whether members may request unapproved apps is a separate setting that this runbook records and does not change. The requ |
| `.claude/commands/slack-app-approval.md:207` | search excerpt | - Labels came from search excerpts on 2026-10-27; a screen that does not match is a stop, not a guess. |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | slack.com/help/articles/222386767: Require approved apps, approve and restrict, request management; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/admins/managing-app-approvals: admin.apps:write for approve and restrict; read and write together disable UI approval; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/reference/methods/admin.apps.requests.list/: pending only, admin.apps:read, Enterprise only; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/reference/methods/admin.apps.approved.list/ and /admin.apps.restr: docs.slack.dev/reference/methods/admin.apps.approved.list/ and /admin.apps.restricted.list/ (search excerpt) |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/reference/scopes/admin.md: admin scope; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/admins/audit-logs-api/: auditlogs:read, Org Owner; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | search excerpt | docs.slack.dev/apis/slack-connect/using-slack-connect-api-methods: conversations.connect:manage; search excerpt |
| `.claude/commands/slack-app-approval.md:246` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads,: github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads, Bearer header; vendor repo, read in full) |
| `.claude/commands/slack-app-approval.md:246` | vendor repository | github.com/slackapi/slack-api-specs web-api OpenAPI v2 (scopes per method; vendo: github.com/slackapi/slack-api-specs web-api OpenAPI v2 (scopes per method; vendor repo, last updated 2021-09-07, possibly stale). No Slack page could be opened directly from this session. |
| `.claude/commands/slack-guests-connect.md:81` | search excerpt | Next → set the time limit to the date in the ticket  |
| `.claude/commands/slack-guests-connect.md:133` | search excerpt | - **Reversibility:** R1: the partner can send a new invitation, which comes back through the approve gate [slack-guests-connect-approve-invitation-portal] (a search excerpt says the inviter must send  |
| `.claude/commands/slack-guests-connect.md:155` | search excerpt | - **Reversibility:** R3: no undo is documented; sharing again needs a new invitation (from a search excerpt, unverified), and the files it shared stay inaccessible |
| `.claude/commands/slack-guests-connect.md:201` | search excerpt | #[CHANNEL_NAME] |
| `.claude/commands/slack-guests-connect.md:267` | search excerpt | - Labels came from search excerpts on 2026-10-27; a screen that does not match is a stop, not a guess. |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/202518103: guest roles, time limits, 5 single-channel guests per paid member; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/218124397: Change account type path; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/115005912706: Slack Connect approval settings and per-organization rules; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/360063030933: disconnect from an organization; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/360026489273: remove an organization from a channel; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | slack.com/help/articles/213185307: archive or delete a channel, unarchive; search excerpt |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | docs.slack.dev/reference/objects/conversation-object and /reference/objects/user: docs.slack.dev/reference/objects/conversation-object and /reference/objects/user-object (is_archived, is_ext_shared, deleted; search excerpt) |
| `.claude/commands/slack-guests-connect.md:306` | search excerpt | docs.slack.dev/apis/slack-connect/using-slack-connect-api-methods:  |
| `.claude/commands/slack-guests-connect.md:306` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads,: github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads, Bearer header; vendor repo, read in full) |
| `.claude/commands/slack-guests-connect.md:306` | vendor repository | github.com/slackapi/slack-api-specs web-api OpenAPI v2 (scopes, is_restricted an: github.com/slackapi/slack-api-specs web-api OpenAPI v2 (scopes, is_restricted and is_ultra_restricted; vendor repo, last updated 2021-09-07). No Slack page could be opened directly from this session. |
| `.claude/commands/slack-incident-comms.md:142` | search excerpt | /slack-retention-export; [ISSUE_ID] |
| `.claude/commands/slack-incident-comms.md:227` | search excerpt | slack.com/help/articles/202395258-Edit-or-delete-messages: deleting a message, the 15-second unsend on desktop; search excerpt |
| `.claude/commands/slack-incident-comms.md:227` | search excerpt | slack.com/help/articles/205239997: pins, any member can pin and unpin; search excerpt |
| `.claude/commands/slack-incident-comms.md:227` | search excerpt | slack.com/help/articles/360026489273-Remove-organizations-from-a-Slack-Connect-channel: channel name, Settings, Organizations; search excerpt |
| `.claude/commands/slack-incident-comms.md:227` | search excerpt | slack.com/blog/transformation/managing-slack-at-scale-announcement-channels-and-new-admin-apis: posting permissions on paid plans, 2019; search excerpt |
| `.claude/commands/slack-incident-comms.md:227` | search excerpt | docs.slack.dev/reference/objects/conversation-object: is_archived, is_ext_shared; search excerpt |
| `.claude/commands/slack-incident-comms.md:227` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py : github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py (conversations.history and the write methods the adapter refuses; vendor repo) |
| `.claude/commands/slack-incident-comms.md:227` | vendor repository | github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_exampl: github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_examples.json (conversations.history fields; vendor repo, last updated 2021). |
| `.claude/commands/slack-retention-export.md:91` | search excerpt | > **PREVIEW ONLY [slack-retention-export-legal-hold-release-preview]:** Planning only; nothing here authorizes removing a custodian, narrowing a hold's conversations or date range, or releasing a hold |
| `.claude/commands/slack-retention-export.md:206` | search excerpt | #[CHANNEL_NAME] |
| `.claude/commands/slack-retention-export.md:239` | search excerpt | - Labels came from search excerpts on 2026-10-27; a screen that does not match is a stop, not a guess. |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/203457187: customize data retention: defaults, path, overrides, daily permanent deletion; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/4401830811795: legal holds: Legal Holds Admin role, path, 1,000 custodians, Slack Connect excluded; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/204897248: import and export tools, export eligibility; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/201658943: export your workspace data: paths, date range, emailed link, all-conversations export; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/220556107: reading a Slack export: files and folders; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/360002079527: Discovery API; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/213185307: archive or delete a channel; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/202395258: edit or delete messages: who, no bulk, permanent, 15-second unsend; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | slack.com/help/articles/204475027: deactivation keeps profile and messages; search excerpt |
| `.claude/commands/slack-retention-export.md:279` | search excerpt | docs.slack.dev/reference/objects/conversation-object and /reference/methods/team: docs.slack.dev/reference/objects/conversation-object and /reference/methods/team.accessLogs (search excerpt) |
| `.claude/commands/slack-retention-export.md:279` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads,: github.com/slackapi/python-slack-sdk at commit 449cf2f (method names, GET reads, Bearer header; vendor repo, read in full) |
| `.claude/commands/slack-retention-export.md:279` | vendor repository | github.com/slackapi/slack-api-specs web-api OpenAPI v2 (user fields is_owner, is: github.com/slackapi/slack-api-specs web-api OpenAPI v2 (user fields is_owner, is_admin, deleted; vendor repo, last updated 2021-09-07). No Slack page could be opened directly from this session. |
| `.claude/commands/slack-security-settings.md:238` | search excerpt | **Before:** Phase B is done and the requirement reads required; Phase A recorded whether SMS is allowed (the pre-state and the rollback value); members were told the date SMS codes stop working and as |
| `.claude/commands/slack-security-settings.md:254` | search excerpt | Slack → Admin → Workspace settings → Security → Two-factor authentication for email sign-in  |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/212221668: mandatory two-factor, 24-hour sign-out, SMS restriction, Owners and Admins; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/205168057: custom SAML SSO, plans and roles, entity ID and post-back URL, IdP session length and Single Logout not honored; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/115005223763-Manage-session-duration: desktop and mobile durations, warnings, gradual rollout; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/115004856503: approved email domains, SSO overrides sign-up preferences; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/201330256: who can invite, invitation approval; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | slack.com/help/articles/4412651915539-Manage-public-file-sharing: Public File Sharing path and roles; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | docs.slack.dev/reference/methods/admin.teams.settings.info: Enterprise settings read, fields unconfirmed; search excerpt |
| `.claude/commands/slack-security-settings.md:311` | search excerpt | docs.slack.dev/reference/methods/team.accessLogs and /reference/methods/auth.tes: docs.slack.dev/reference/methods/team.accessLogs and /reference/methods/auth.test (sign-in log on paid plans, token identity; search excerpt) |
| `.claude/commands/slack-security-settings.md:311` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py : github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py (method names; vendor repo) |
| `.claude/commands/slack-security-settings.md:311` | vendor repository | github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_exampl: github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_examples.json (user field has_2fa; vendor repo, last updated 2021). |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/204475027-Deactivate-a-members-account: who can deactivate, Primary Owner exception, org-level only on Enterprise, effects; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/360002061747-Reactivate-a-members-account: org and workspace paths, role on reactivation; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/218124397-Change-a-members-role: Change account type path and conversion rules; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/204401633-Transfer-ownership-of-a-workspace-or-org: Primary Owner transfer, Slack Support fallback; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/206924507-Reset-all-single-sign-on-sessions: workspace-wide forced reset; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/201330256: invitations, 30 days; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/202518103: guest types, five per paid member; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | slack.com/help/articles/205168057: Slack ignores IdP session length and Single Logout; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | docs.slack.dev/reference/scim-api/scim-api-2 and docs.slack.dev/admins/scim-api : docs.slack.dev/reference/scim-api/scim-api-2 and docs.slack.dev/admins/scim-api (SCIM deactivation, admin scope; search excerpt) |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | docs.slack.dev/reference/methods/admin.users.session.reset: Enterprise only; search excerpt |
| `.claude/commands/slack-user-lifecycle.md:348` | search excerpt | docs.slack.dev/reference/methods/users.info, /reference/objects/user-object, /re: docs.slack.dev/reference/methods/users.info, /reference/objects/user-object, /reference/methods/auth.test, /reference/methods/team.accessLogs (fields, paid plans; search excerpt) |
| `.claude/commands/slack-user-lifecycle.md:348` | vendor repository | github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py : github.com/slackapi/python-slack-sdk at commit 449cf2f, slack_sdk/web/client.py (method names, the write methods the adapter refuses; vendor repo) |
| `.claude/commands/slack-user-lifecycle.md:348` | vendor repository | github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_exampl: github.com/slackapi/slack-api-specs, web-api/slack_web_openapi_v2_without_examples.json (user fields deleted, is_restricted, is_ultra_restricted, is_primary_owner; vendor repo, last updated 2021). |
| `scripts/adapters/slack-client.js:53` | search excerpt | // (SCOPES below; scope names from Slack's 2021 OpenAPI spec and search excerpts of |
| `scripts/adapters/slack-client.js:91` | search excerpt | // fails the check); app list shapes and team.accessLogs from search excerpts of |

## Jamf Pro (70 lines)

| where | how read | breadcrumb, command or API path on the line |
|---|---|---|
| `.claude/commands/jamf-config-profiles.md:144` | search excerpt | # proves an install command for this profile (its identifier) on that Mac was acknowledged after the save time - the type name comes from a search excerpt of the API reference |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.28.0/Viewing-the-Status-of-a-Configuration-Profile: Complete, Remaining, Failed; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.16.0/Adding_a_Computer_Configuration_Policy_to_the_Jamf_Pro_Dashboard: Completed, Pending, Failed; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | learn.jamf.com/r/ja-JP/technical-paper-managing-jamf-connect-current/Creating_a_Configuration_Profile_using_Jamf_Pro: General payload level and distribution method, Scope tab, installed at check-in; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | support.jamf.com/en/articles/11024623-deploy-jamf-pro-configuration-profile-changes-to-computers-with-the-profile-installed-already: Distribute to All, Newly Assigned Devices Only, remove then reinstall; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.17.0/Re-enrollment_Settings: pending and failed commands cleared; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups: privilege sets, object privileges; search excerpt of a translated page |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v2-mdm-commands: command, status, profileIdentifier, clientManagementId filter; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | developer.jamf.com/jamf-pro/reference/findosxconfigurationprofilesbyid: profile read; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v2-computer-groups-smart-groups and ge: developer.jamf.com/jamf-pro/reference/get_v2-computer-groups-smart-groups and get_v2-computer-groups-smart-group-membership-id (group search and membership, Read Smart Computer Groups; search excerpt) |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory: sections, serial filter; search excerpt |
| `.claude/commands/jamf-config-profiles.md:434` | search excerpt | the G1 runbooks `/mac-troubleshoot` and `/jamf-lock-erase` (History → Management: the G1 runbooks `/mac-troubleshoot` and `/jamf-lock-erase` (History → Management History and System Settings → General → Device Management; repo runbooks checked 2026-10-15). No Jamf page could be opened from this sess |
| `.claude/commands/jamf-filevault.md:61` | search excerpt | **Role needed (to see a key):** the Jamf Pro privilege View Disk Encryption Recovery Key on the signed-in account (Jamf's support article on permission to view FileVault recovery keys; read as a searc |
| `.claude/commands/jamf-filevault.md:181` | search excerpt | 2. Read the key to the person at the Mac through the channel set in Inputs needed; they type it where the Mac asks for the recovery key and set a new password. The on-Mac steps are in Jamf's support a |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | every Jamf page below was read as a search excerpt, because the vendor documenta: every Jamf page below was read as a search excerpt, because the vendor documentation hosts could not be opened from this session (`docs/aegis/lanes/g2.md`, "How the vendor documentation was read"): https://learn.jamf.c |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/de-DE/jamf-pro-documentation-11.21.0/Issuing_a_new_FileVault_Recovery_Key: German page |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Creating_and_Exporting_an_Institutional_Recovery_Key: French page |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://support.jamf.com/en/articles/11016710-how-to-reset-passwords-with-the-filevault-recovery-key-in-jamf-pro:  |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://support.jamf.com/en/articles/11016698-allow-users-in-jamf-pro-permission-to-view-filevault-recovery-keys: View Disk Encryption Recovery Key |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://support.jamf.com/en/articles/11016722-issues-using-the-issue-new-recovery-key-policy-option: Authentication error |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://support.jamf.com/en/articles/11016721-filevault-personal-recovery-key-is-not-showing-in-jamf-pro: one or two inventory submissions |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://support.jamf.com/en/articles/11024623-deploy-jamf-pro-configuration-profile-changes-to-computers-with-the-profile-installed-already: the distribute prompt |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.28.0/Viewing-the-Status-of-a-Configuration-Profile:  |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Computer_Inventory_Information: French page, weekly Update Inventory |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.21.0/Execution_Frequency_for_Policies:  |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups: French page, privilege inheritance |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://developer.jamf.com/jamf-pro/docs/privileges-and-deprecations:  |
| `.claude/commands/jamf-filevault.md:281` | search excerpt | https://developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory-id-filevault: the key path the adapter refuses |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.25.0/Computer_Inventory_Information: weekly Update Inventory policy, `jamf recon`, declarative status, optional categories; search excerpt of a translated page |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/de-DE/jamf-pro-documentation-11.28.0/Computer_Extension_Attributes: input types and data types; search excerpt of a translated page |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Computer_Inventory_and_Criteria_Reference: criteria; search excerpt |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Group_Management: smart and static groups; search excerpt |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Creating_an_Advanced_Computer_Search: Search Inventory, New, criteria order; search excerpt |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.23.0/Remote_Commands_for_Computers: mass actions; search excerpt of a translated page |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups: privilege sets; search excerpt of a translated page |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory: sections and serial filter; search excerpt |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v2-computer-groups-smart-groups and ge: developer.jamf.com/jamf-pro/reference/get_v2-computer-groups-smart-groups and get_v2-computer-groups-smart-group-membership-id (group search, membership, Read Smart Computer Groups; search excerpt) |
| `.claude/commands/jamf-inventory-groups.md:365` | search excerpt | the G1 runbook `/jamf-enroll-mac` (the gated `jamf recon` pattern and the Genera: the G1 runbook `/jamf-enroll-mac` (the gated `jamf recon` pattern and the General section's last check-in; repo runbook checked 2026-10-15). No Jamf page could be opened from this session (proxy refusal and DNS failure |
| `.claude/commands/jamf-patch-management.md:50` | search excerpt | Jamf Pro → Computers → Patch Management ; [APP_NAME] |
| `.claude/commands/jamf-patch-management.md:84` | search excerpt | **Role needed:** a Jamf Pro account holding the Create Patch Management Software Titles privilege (the name the API reference gives for creating a title configuration; read from a search excerpt). |
| `.claude/commands/jamf-patch-management.md:129` | search excerpt | Jamf Pro → Computers → Patch Management ; Patch Policies → New ; [APP_NAME] |
| `.claude/commands/jamf-patch-management.md:193` | search excerpt | Jamf Pro → Computers → Managed Software Updates → New  |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | every Jamf page below was read as a search excerpt, because the vendor documenta: every Jamf page below was read as a search excerpt, because the vendor documentation hosts could not be opened from this session (`docs/aegis/lanes/g2.md`, "How the vendor documentation was read"): https://learn.jamf.c |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/zh-TW/jamf-pro-documentation-11.25.0/Patch_Policies: Traditional Chinese page |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.31.0/Managed_Software_Updates:  |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/fr-FR/jamf-pro-documentation-current/Managed_Software_Updates: French page, macOS 27 and blueprints |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/es-ES/jamf-pro-documentation-11.20.0/Updating_macOS_Using_Managed_Software_Updates: Spanish page |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/App_Installers:  |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.28.0/App_Installers_Deployment_Status:  |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.21.0/Execution_Frequency_for_Policies: the Enabled control on regular policies |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://learn.jamf.com/r/en-US/jamf-pro-documentation-11.23.0/Group_Management:  |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://developer.jamf.com/jamf-pro/reference/post_v2-patch-software-title-configurations: Create Patch Management Software Titles |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://developer.jamf.com/jamf-pro/reference/get_v2-patch-software-title-configurations-id-export-report: Read Patch Management Software Titles |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://developer.jamf.com/jamf-pro/reference/get_v1-managed-software-updates-plans: read privileges |
| `.claude/commands/jamf-patch-management.md:346` | search excerpt | https://developer.jamf.com/jamf-pro/reference/get_v1-managed-software-updates-plans-id-events:  |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.21.0/Execution_Frequency_for_Policies: frequencies, 24 hours, 7 days, 30 days, the Ongoing and Recurring Check-in warning; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/de-DE/jamf-pro-documentation-11.20.0/Manually_Running_a_Policy: trigger event names, `jamf policy -event`; search excerpt of a translated page |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.24.0/Creating_a_Policy: runs at the next check-in, Self Service tab; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.24.0/Viewing_and_Flushing_Logs_for_a_Policy: Logs, Flush, Flush All, 25 KB; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.30.0/Log_Flushing: server-wide flushing; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.17.0/items_Available_to_Users_in_Jamf_Self_Service_for_macOS: categories, Featured, display name, description, icon; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/self-service-plus-documentation/Self_Service_Plus_Settings_Reference: Self Service+ settings by blueprint or profile; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/en-US/jamf-pro-documentation-11.17.0/Re-enrollment_Settings: policy logs cleared; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | learn.jamf.com/r/fr-FR/jamf-pro-documentation-11.22.0/Jamf_Pro_User_Accounts_and_Groups: privilege sets, object privileges; search excerpt of a translated page |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | developer.jamf.com/jamf-pro/reference/findpoliciesbyid: policy read, Accept header; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | developer.jamf.com/jamf-pro/reference/findcomputerhistorybyid: computer history and its subsets; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory: sections and serial filter; search excerpt |
| `.claude/commands/jamf-policies-self-service.md:333` | search excerpt | the G1 runbook `/mac-troubleshoot` (Branch D, the gated check-in; repo runbook c: the G1 runbook `/mac-troubleshoot` (Branch D, the gated check-in; repo runbook checked 2026-10-15). No Jamf page could be opened from this session (proxy refusal and DNS failure on 2026-10-27), so every label and behav |
| `scripts/adapters/jamf-client.js:65` | search excerpt | //   - The token path. One search excerpt shows /api/v1/oauth/token; the lane allows |
| `scripts/adapters/jamf-client.js:75` | search excerpt | //     profileIdentifier filter and record field come from a search excerpt of the |

## Google Workspace (170 lines)

| where | how read | breadcrumb, command or API path on the line |
|---|---|---|
| `.claude/commands/gws-2sv-enforcement.md:17` | search excerpt | - **Role needed for every gate here: Super Admin.** Google states that only super admins can enforce 2-Step Verification for the whole organization (search excerpt, support.google.com/a/answer/1219251 |
| `.claude/commands/gws-2sv-enforcement.md:25` | search excerpt | [START_DATE] |
| `.claude/commands/gws-2sv-enforcement.md:32` | search excerpt | Admin console → Security → Authentication → 2-step verification |
| `.claude/commands/gws-2sv-enforcement.md:33` | search excerpt | /gws-2sv-reset |
| `.claude/commands/gws-2sv-enforcement.md:34` | search excerpt | - **Exceptions.** Exceptions are made by scoping the setting to a child unit or a configuration group; no dedicated exception control was found in the sources (unverified). Google's lockout guidance w |
| `.claude/commands/gws-2sv-enforcement.md:35` | search excerpt and vendor repository | Reporting → User Reports → Security shows the same two columns but can lag up to 48 hou; isEnrolledIn2Sv; isEnforcedIn2Sv |
| `.claude/commands/gws-2sv-enforcement.md:37` | search excerpt | - **Google's order** (search excerpt): allow with enforcement off, track enrollment, then enforce. |
| `.claude/commands/gws-2sv-enforcement.md:54` | search excerpt | Admin console → Reporting → User Reports → Security → read the ; [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:105` | search excerpt | Admin console → Security → Authentication → 2-step verification ; [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:144` | search excerpt | Admin console → Security → Authentication → 2-step verification ; [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:200` | search excerpt | REMOVE [USER@DOMAIN.COM] FROM 2-STEP VERIFICATION EXCEPTION GROUP [GROUP_EMAIL]; isEnrolledIn2Sv |
| `.claude/commands/gws-2sv-enforcement.md:223` | search excerpt | user; isEnrolledIn2Sv |
| `.claude/commands/gws-2sv-enforcement.md:238` | search excerpt | user; isEnrolledIn2Sv; ADD [USER@DOMAIN.COM] TO 2-STEP VERIFICATION EXCEPTION GROUP [GROUP_EMAIL] |
| `.claude/commands/gws-2sv-enforcement.md:312` | search excerpt | Admin console → Security → Authentication → 2-step verification ; [OU_PATH]; [START_DATE] |
| `.claude/commands/gws-2sv-enforcement.md:324` | search excerpt | The Reporting enforcement column catches up within 48 hours (search excerpt). |
| `.claude/commands/gws-2sv-enforcement.md:330` | search excerpt | /gws-new-user |
| `.claude/commands/gws-2sv-enforcement.md:346` | search excerpt | RESTORE 2-STEP VERIFICATION METHODS FOR OU [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:350` | search excerpt | Admin console → Security → Authentication → 2-step verification ; [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:386` | search excerpt | Admin console → Security → Authentication → 2-step verification ; [OU_PATH] |
| `.claude/commands/gws-2sv-enforcement.md:435` | search excerpt | user; isEnrolledIn2Sv |
| `.claude/commands/gws-2sv-enforcement.md:480` | search excerpt | support.google.com/a/answer/9176657: deploy 2-Step Verification: allow, enforcement with a date, new user enrollment period of 1 day to 6 months, methods, the Only security key suspension grace period and admin-generated backup codes, the configuration-group lockout warning; search excerpt |
| `.claude/commands/gws-2sv-enforcement.md:480` | search excerpt | support.google.com/a/answer/6000269: User Reports, Security columns for 2-Step Verification enrollment and enforcement, up to 48 hours lag; search excerpt |
| `.claude/commands/gws-2sv-enforcement.md:480` | search excerpt | support.google.com/a/answer/1219251: administrator privileges: only super admins enforce 2-Step Verification for the organization; search excerpt |
| `.claude/commands/gws-2sv-enforcement.md:480` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json: `isEnrolledIn2Sv` and `isEnforcedIn2Sv` are output-only user fields, users.list returns at most 500 per page; vendor repo |
| `.claude/commands/gws-2sv-enforcement.md:480` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json: customer usage report path, dates in Pacific time; vendor repo |
| `.claude/commands/gws-2sv-enforcement.md:480` | search excerpt | developers.google.com/admin-sdk/reports/v1/reference/usage-ref-appendix-a/customers-accounts: the `accounts:num_users_2sv_*` parameter names; search excerpt |
| `.claude/commands/gws-2sv-enforcement.md:480` | vendor repository | raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md and Reports.md (GAM read sy: raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md and Reports.md (GAM read syntax; project wiki, GAM is a community tool, not a Google product). |
| `.claude/commands/gws-account-containment.md:31` | search excerpt | - **Suspend first.** Google's compromised-account guidance puts suspension first: suspending resets the user's sign-in cookies and OAuth tokens, and after reactivation the user must sign in with the n |
| `.claude/commands/gws-account-containment.md:32` | search excerpt | /gws-password-reset |
| `.claude/commands/gws-account-containment.md:33` | search excerpt | - **Tokens already issued.** Google Cloud guidance warns that suspension, a password reset and a cookie reset do not invalidate access tokens an attacker already holds (search excerpt, docs.cloud.goog |
| `.claude/commands/gws-account-containment.md:34` | search excerpt | tokens.list; asps.list; admin.directory.user.security; docs/aegis/lanes/g2.md |
| `.claude/commands/gws-account-containment.md:35` | search excerpt | /gws-audit-log; suspicious_login; login_success; password_edit; recovery_email_edit; recovery_phone_edit; 2sv_disable; CHANGE_PASSWORD |
| `.claude/commands/gws-account-containment.md:56` | search excerpt | Admin console → Security → Alert center → read the alerts for the account |
| `.claude/commands/gws-account-containment.md:103` | search excerpt | Admin console → Directory → Users → point to ; [USER@DOMAIN.COM]; /gws-offboard |
| `.claude/commands/gws-account-containment.md:125` | search excerpt | - **Reversibility:** R2: forward-only; the old password cannot be restored, and a reset does not invalidate an access token an attacker already holds (Google Cloud guidance, search excerpt) |
| `.claude/commands/gws-account-containment.md:129` | search excerpt | Admin console → Directory → Users ; [USER@DOMAIN.COM] |
| `.claude/commands/gws-account-containment.md:150` | search excerpt | [USER@DOMAIN.COM] |
| `.claude/commands/gws-account-containment.md:169` | search excerpt | **Purpose**: suspension resets OAuth tokens (search excerpt). If Connected applications still lists a grant to an app the real user does not recognise, revoke it here and record its client ID; blockin |
| `.claude/commands/gws-account-containment.md:173` | search excerpt | [USER@DOMAIN.COM] |
| `.claude/commands/gws-account-containment.md:186` | search excerpt | verify-*; [NOT_BEFORE] |
| `.claude/commands/gws-account-containment.md:197` | search excerpt | Admin console → Security → Access and data control → API controls → Manage Third-Party App Access; [APP_NAME] |
| `.claude/commands/gws-account-containment.md:323` | search excerpt | - **Suspend before you reset.** A password reset alone leaves the attacker's sessions and OAuth tokens alive; suspension resets both (search excerpt). Access tokens already issued may still work until |
| `.claude/commands/gws-account-containment.md:325` | search excerpt | /gws-offboard |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/2984349: identify and secure compromised accounts: suspend first, suspension resets sign-in cookies and OAuth tokens, user log events up to 6 months, check admin activity and mobile devices, new OAuth tokens only after sign-in with the new password; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/2537800: manage a user's security settings: Security, Password, Reset password, app passwords; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/178854: sign a user out: desktop apps not signed out, Gmail up to an hour, suspension resets cookies; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/1219251: administrator privileges: User Security Management; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | docs.cloud.google.com/docs/security/compromised-credentials: tokens already held survive suspension and resets; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/7061566: log lag: OAuth up to a few hours; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | support.google.com/a/answer/9104586: alert center: Suspicious login alerts hidden from the default list; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | search excerpt | knowledge.workspace.google.com/admin/users/restore-a-recently-deleted-user: 20-day restore window; search excerpt |
| `.claude/commands/gws-account-containment.md:370` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json: `suspended`, `isAdmin`, the tokens and asps scope; vendor repo |
| `.claude/commands/gws-account-containment.md:370` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json: activities for login, token, admin and user_accounts; vendor repo |
| `.claude/commands/gws-account-containment.md:370` | vendor repository | raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Tokens.md, Users-Application-S: raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Tokens.md, Users-Application-Specific-Passwords.md and Reports.md (GAM syntax, exit status 60; project wiki, GAM is a community tool, not a Google product) |
| `.claude/commands/gws-admin-roles.md:32` | vendor repository | isAdmin; isDelegatedAdmin |
| `.claude/commands/gws-admin-roles.md:33` | search excerpt | Roles are assigned at Admin console → Account → Admin roles |
| `.claude/commands/gws-admin-roles.md:34` | vendor repository | roleAssignments.list; includeIndirectRoleAssignments |
| `.claude/commands/gws-admin-roles.md:35` | search excerpt | - **Google's hygiene guidance** (search excerpt, knowledge.workspace.google.com, security best practices for administrator accounts): more than one super admin; each super admin account belongs to one |
| `.claude/commands/gws-admin-roles.md:36` | search excerpt | - **Super admin account recovery** (same search excerpt): off by default for most current and all new customers, on by default for existing customers with fewer than 3 super admins or 500 users, and i |
| `.claude/commands/gws-admin-roles.md:50` | search excerpt | Admin console → Account → Admin roles  |
| `.claude/commands/gws-admin-roles.md:90` | search excerpt | Admin console → Security → Authentication → Account recovery  |
| `.claude/commands/gws-admin-roles.md:91` | vendor repository | user; recoveryEmail; recoveryPhone; set; missing |
| `.claude/commands/gws-admin-roles.md:102` | search excerpt | The two gates below change one organizational unit each, one direction each. A configuration group can carry its own recovery value (search excerpt): these gates never change a group's value, and when |
| `.claude/commands/gws-admin-roles.md:122` | search excerpt | Admin console → Security → Authentication → Account recovery ; [OU_PATH] |
| `.claude/commands/gws-admin-roles.md:152` | search excerpt | Admin console → Security → Authentication → Account recovery ; [OU_PATH] |
| `.claude/commands/gws-admin-roles.md:176` | search excerpt | **Role needed:** Super Admin (assigning admin roles needs a super admin; search excerpt, support.google.com/a/answer/9807615). |
| `.claude/commands/gws-admin-roles.md:186` | search excerpt | Admin console → Account → Admin roles ; [ROLE_NAME] |
| `.claude/commands/gws-admin-roles.md:188` | search excerpt | 3. Where multi-party approval is on, a second super admin must approve; the request expires after 3 days (search excerpt). **WAIT UNTIL** it is approved before the read-back. |
| `.claude/commands/gws-admin-roles.md:219` | search excerpt | ASSIGN ADMIN ROLE [ROLE_NAME] TO [USER@DOMAIN.COM] |
| `.claude/commands/gws-admin-roles.md:223` | search excerpt | Admin console → Directory → Users ; [USER@DOMAIN.COM] |
| `.claude/commands/gws-admin-roles.md:255` | search excerpt | Admin console → Account → Admin roles ; [ROLE_NAME]; [USER@DOMAIN.COM] |
| `.claude/commands/gws-admin-roles.md:312` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json: roles and roleAssignments paths, `isAdmin`, `isDelegatedAdmin`, `includeIndirectRoleAssignments`, service-account assignees, `recoveryEmail` and `recoveryPhone`; vendor repo |
| `.claude/commands/gws-admin-roles.md:312` | search excerpt | knowledge.workspace.google.com/admin/users/security-best-practices-for-administrator-accounts: more than one super admin, no shared admin accounts, separate daily account, replace a super admin by assigning the new one first, super admin recovery defaults and path; search excerpt |
| `.claude/commands/gws-admin-roles.md:312` | search excerpt | support.google.com/a/answer/9807615: assign specific admin roles: super admin required, Account → Admin roles, 1,000 assignments per role, a group counts as one; search excerpt |
| `.claude/commands/gws-admin-roles.md:312` | search excerpt | support.google.com/a/answer/9011448: remove administrator privileges: the slider and Save, the confirmation email; search excerpt |
| `.claude/commands/gws-admin-roles.md:312` | search excerpt | knowledge.workspace.google.com/admin/users/set-admin-privileges-to-protect-user-privacy: Unassign role, multi-party approval requests expire after 3 days; search excerpt |
| `.claude/commands/gws-admin-roles.md:312` | vendor repository | raw.githubusercontent.com/wiki/GAM-team/GAM/Administrators.md and Users.md (GAM : raw.githubusercontent.com/wiki/GAM-team/GAM/Administrators.md and Users.md (GAM read syntax; project wiki, GAM is a community tool, not a Google product) |
| `.claude/commands/gws-drive-sharing.md:19` | search excerpt | - **Time window.** A sharing-setting change can take up to 24 hours to apply, and inside that window the old and the new setting can both be enforced at times (search excerpt). Not done until the read |
| `.claude/commands/gws-drive-sharing.md:33` | search excerpt | Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings → Sharing options holds  |
| `.claude/commands/gws-drive-sharing.md:34` | search excerpt | Admin console → Account → Domains → Allowlisted domains is one list for the whole organization |
| `.claude/commands/gws-drive-sharing.md:52` | search excerpt | [GROUP_EMAIL] |
| `.claude/commands/gws-drive-sharing.md:67` | search excerpt | [FILE_NAME]; /gws-audit-log |
| `.claude/commands/gws-drive-sharing.md:70` | search excerpt | [FILE_NAME] |
| `.claude/commands/gws-drive-sharing.md:111` | search excerpt | [EXTERNAL_DOMAIN]; [FILE_NAME] |
| `.claude/commands/gws-drive-sharing.md:139` | search excerpt | **Role needed:** Super Admin, or a custom admin role with the Domain settings administrator privilege (search excerpt). |
| `.claude/commands/gws-drive-sharing.md:141` | search excerpt | [EXTERNAL_DOMAIN]; [NOT_BEFORE] |
| `.claude/commands/gws-drive-sharing.md:168` | search excerpt | **Role needed:** Super Admin, or a custom admin role with the Domain settings administrator privilege (search excerpt). |
| `.claude/commands/gws-drive-sharing.md:202` | search excerpt | ALLOW EXTERNAL SHARING FOR OU [OU_PATH]; TURN OFF EXTERNAL SHARING FOR OU [OU_PATH] |
| `.claude/commands/gws-drive-sharing.md:221` | search excerpt | ALLOW EXTERNAL SHARING FOR OU [OU_PATH]; RESTRICT EXTERNAL SHARING FOR OU [OU_PATH] TO ALLOWLISTED DOMAINS |
| `.claude/commands/gws-drive-sharing.md:240` | search excerpt | TURN OFF EXTERNAL SHARING FOR OU [OU_PATH]; RESTRICT EXTERNAL SHARING FOR OU [OU_PATH] TO ALLOWLISTED DOMAINS |
| `.claude/commands/gws-drive-sharing.md:310` | search excerpt | knowledge.workspace.google.com/admin/drive/manage-external-sharing-for-your-organization: Sharing options and its three values, group overrides unit, per-user enforcement, up to 24 hours with mixed enforcement |
| `.claude/commands/gws-drive-sharing.md:310` | search excerpt | knowledge.workspace.google.com/admin/domains/allow-external-sharing-with-only-trusted-domains: Allowlisted Domains, one organization-wide list, verified Google Workspace domains, Domain settings privilege |
| `.claude/commands/gws-drive-sharing.md:310` | search excerpt | knowledge.workspace.google.com/admin/drive/manage-shared-drives-as-an-admin: default sharing settings for new shared drives |
| `.claude/commands/gws-drive-sharing.md:310` | search excerpt | support.google.com/a/answer/4579696: Drive log events, Visibility filter, Visibility against Visibility change, the group-sharing caveat |
| `.claude/commands/gws-drive-sharing.md:310` | search excerpt | knowledge.workspace.google.com/admin/security/take-action-based-on-search-results: Actions, Audit File Permissions, Files and People tabs, no shared-drive files |
| `.claude/commands/gws-drive-sharing.md:310` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json: Reports API activities for the drive and admin applications |
| `.claude/commands/gws-drive-sharing.md:310` | vendor repository | raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Drive-Permissions.md and Repor: raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Drive-Permissions.md and Reports.md (project wiki: GAM read syntax and the role mapping; GAM is a community tool, not a Google product) |
| `.claude/commands/gws-security-posture.md:20` | search excerpt | - **Role needed for the review:** Super Admin, or an admin role that holds each check's privilege: Reports (Reporting pages), Security center privileges plus read access to the Security health units ( |
| `.claude/commands/gws-security-posture.md:24` | search excerpt | - The Google Workspace edition **[org gap]**: the lane's sources list Security health only for Frontline Standard and Plus, Enterprise Standard and Plus, Education Standard and Plus, and Enterprise Es |
| `.claude/commands/gws-security-posture.md:34` | search excerpt | Admin console → Reporting → User Reports → Security can lag up to 48 hours |
| `.claude/commands/gws-security-posture.md:35` | search excerpt | - **Retired check:** the less secure apps settings were removed from the Admin console on June 15 2024 (search excerpt). A posture check for them reads "retired, not applicable", never "fail". |
| `.claude/commands/gws-security-posture.md:59` | search excerpt | Admin console → Security → Authentication → Account recovery → Super admin account recovery |
| `.claude/commands/gws-security-posture.md:60` | search excerpt | Admin console → Apps → Google Workspace → Gmail → End User Access → Automatic forwarding  |
| `.claude/commands/gws-security-posture.md:61` | search excerpt | Admin console → Security → Access and data control → API controls → Manage Third-Party App Access  |
| `.claude/commands/gws-security-posture.md:174` | search excerpt | # read-only: 2-Step Verification counts for one day, dates are UTC-8, a warning in the answer means missing or partial data for that day, parameter names from a search excerpt |
| `.claude/commands/gws-security-posture.md:211` | search excerpt | 1. **Super admin hygiene.** Google recommends more than one super admin, each managed by a separate person, no shared admin accounts, and a separate non-admin account for daily work (search excerpt).  |
| `.claude/commands/gws-security-posture.md:232` | search excerpt | **Role needed:** Super Admin, or a custom admin role with the Gmail Settings administrator privilege (search excerpt). |
| `.claude/commands/gws-security-posture.md:260` | search excerpt | **Role needed:** Super Admin, or a custom admin role with the Gmail Settings administrator privilege (search excerpt). |
| `.claude/commands/gws-security-posture.md:287` | search excerpt | **Role needed:** Super Admin. The lane's sources leave the privilege for API controls unclear (one search excerpt mentions Service Settings), so take the safer reading and use a Super Admin. |
| `.claude/commands/gws-security-posture.md:299` | search excerpt | Admin console → Security → Access and data control → API controls → Manage Third-Party App Access ; [APP_NAME]; [OU_PATH] |
| `.claude/commands/gws-security-posture.md:303` | search excerpt | [NOT_BEFORE]; [APP_ID]; [OU_PATH] |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | knowledge.workspace.google.com/admin/users/security-best-practices-for-administrator-accounts: more than one super admin, separate daily account, super admin recovery default and path |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/9807615: Account → Admin roles |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/6000269: User Reports → Security, 2-Step Verification columns, up to 48 hours lag |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/14724207: automatic forwarding path, on by default, Gmail Settings privilege |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | knowledge.workspace.google.com/admin/apps/control-which-third-party-and-internal-apps-access-google-workspace-data: API controls, Manage Third-Party App Access, Trusted, Limited, Blocked |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/6328676: Universal settings, Mobile Device Management privilege |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/7532105: Security health privileges and editions |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/14114704: less secure apps settings removed June 15 2024 |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | support.google.com/a/answer/7061566: retention cannot be changed, lag times |
| `.claude/commands/gws-security-posture.md:396` | search excerpt | developers.google.com/admin-sdk/reports/v1/reference/usage-ref-appendix-a/customers-accounts: the 2-Step Verification usage parameter names |
| `.claude/commands/gws-security-posture.md:396` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json: user fields isEnrolledIn2Sv, isEnforcedIn2Sv, isAdmin, roles, role assignments, mobile and ChromeOS devices, the security scope that also grants writes |
| `.claude/commands/gws-security-posture.md:396` | vendor repository | raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json: activities for admin and token, customer usage reports, dates in UTC-8 |
| `.claude/commands/gws-security-posture.md:396` | vendor repository | raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md, Administrators.md, Users-T: raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md, Administrators.md, Users-Tokens.md and Reports.md (project wiki: GAM read syntax and CSV columns; GAM is a community tool, not a Google product) |
| `scripts/adapters/gws-client.js:69` | search excerpt | //   - usage parameter names come from a search excerpt; they are passed through unchanged. |
| `scripts/adapters/gws-client.js:75` | search excerpt | //   - The User Reports 2-Step Verification column may lag up to 48 hours (search excerpt); |
| `scripts/gws-posture-audit.js:49` | search excerpt | // search excerpt: the Google page could not be opened; its text came from a search index. |
| `scripts/gws-posture-audit.js:52` | vendor repository | url: 'https://raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json', |
| `scripts/gws-posture-audit.js:57` | vendor repository | url: 'https://raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json', |
| `scripts/gws-posture-audit.js:61` | vendor repository | gamUsers: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md', how: 'project wiki', title: 'GAM wiki: Users' }, |
| `scripts/gws-posture-audit.js:62` | vendor repository | gamAdmins: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Administrators.md', how: 'project wiki', title: 'GAM wiki: Administrators' }, |
| `scripts/gws-posture-audit.js:63` | vendor repository | gamTokens: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Tokens.md', how: 'project wiki', title: 'GAM wiki: Users, Tokens' }, |
| `scripts/gws-posture-audit.js:64` | vendor repository | gamReports: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Reports.md', how: 'project wiki', title: 'GAM wiki: Reports' }, |
| `scripts/gws-posture-audit.js:66` | vendor repository | url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Drive-Permissions.md', |
| `scripts/gws-posture-audit.js:70` | search excerpt | deploy2sv: { url: 'https://support.google.com/a/answer/9176657', how: 'search excerpt', title: 'Deploy 2-Step Verification' }, |
| `scripts/gws-posture-audit.js:71` | search excerpt | userReportsSecurity: { url: 'https://support.google.com/a/answer/6000269', how: 'search excerpt', title: 'User reports: Security' }, |
| `scripts/gws-posture-audit.js:72` | search excerpt | privilegeDefinitions: { url: 'https://support.google.com/a/answer/1219251', how: 'search excerpt', title: 'Administrator privilege definitions' }, |
| `scripts/gws-posture-audit.js:75` | search excerpt | how: 'search excerpt', |
| `scripts/gws-posture-audit.js:78` | search excerpt | assignRoles: { url: 'https://support.google.com/a/answer/9807615', how: 'search excerpt', title: 'Assign specific admin roles' }, |
| `scripts/gws-posture-audit.js:79` | search excerpt | lessSecureApps: { url: 'https://support.google.com/a/answer/14114704', how: 'search excerpt', title: 'Transition from less secure apps to OAuth' }, |
| `scripts/gws-posture-audit.js:82` | search excerpt | how: 'search excerpt', |
| `scripts/gws-posture-audit.js:87` | search excerpt | how: 'search excerpt', |
| `scripts/gws-posture-audit.js:92` | search excerpt | how: 'search excerpt', |
| `scripts/gws-posture-audit.js:95` | search excerpt | driveLogEvents: { url: 'https://support.google.com/a/answer/4579696', how: 'search excerpt', title: 'Drive log events' }, |
| `scripts/gws-posture-audit.js:96` | search excerpt | autoForwarding: { url: 'https://support.google.com/a/answer/14724207', how: 'search excerpt', title: 'Let users automatically forward their own Gmail emails' }, |
| `scripts/gws-posture-audit.js:97` | search excerpt | mobileUniversal: { url: 'https://support.google.com/a/answer/6328676', how: 'search excerpt', title: 'Apply universal settings for mobile devices and endpoints' }, |
| `scripts/gws-posture-audit.js:98` | search excerpt | retention: { url: 'https://support.google.com/a/answer/7061566', how: 'search excerpt', title: 'Data retention and lag times' }, |
| `scripts/gws-posture-audit.js:109` | search excerpt | Security → Authentication → 2-step verification  |
| `scripts/gws-posture-audit.js:110` | search excerpt | Reporting → User Reports → Security |
| `scripts/gws-posture-audit.js:116` | search excerpt | note: 'tenant totals per day; the parameter names come from a search excerpt', |
| `scripts/gws-posture-audit.js:122` | search excerpt | 'Only a super admin can enforce 2-Step Verification for the whole organization (search excerpt).', |
| `scripts/gws-posture-audit.js:130` | search excerpt | Account → Admin roles  |
| `scripts/gws-posture-audit.js:131` | search excerpt | Security → Authentication → Account recovery → Super admin account recovery; Security → Account recovery |
| `scripts/gws-posture-audit.js:139` | search excerpt | 'Google recommends more than one super admin, each a separate person with no shared admin account, and a separate non-admin account for daily work (search excerpt).', |
| `scripts/gws-posture-audit.js:140` | search excerpt | 'The super admin recovery default depends on the age and size of the customer account, so read the setting rather than assume it (search excerpt).', |
| `scripts/gws-posture-audit.js:142` | search excerpt | 'A role can be assigned to a user, a group or a service account; read all three (search excerpt; discovery document).', |
| `scripts/gws-posture-audit.js:150` | search excerpt | 'none: the less secure apps settings were removed from the Admin console on June 15 2024, so there is no setting to read (search excerpt)', |
| `scripts/gws-posture-audit.js:155` | search excerpt | 'Password-only IMAP, POP, SMTP, CalDAV and CardDAV sign-in is turned off for Workspace accounts (search excerpt).', |
| `scripts/gws-posture-audit.js:164` | search excerpt | Security → Access and data control → API controls → Manage Third-Party App Access |
| `scripts/gws-posture-audit.js:192` | search excerpt | 'A configuration group setting overrides the organizational-unit setting, and a change takes up to 24 hours (search excerpt).', |
| `scripts/gws-posture-audit.js:193` | search excerpt | 'A "Shared externally" log entry records a sharing event, not proof that someone outside still has access: the log shows events, not current state (search excerpt).', |
| `scripts/gws-posture-audit.js:194` | search excerpt | 'Sharing with people who have no Google account is a separate visitor sharing setting (search excerpt).', |
| `scripts/gws-posture-audit.js:207` | search excerpt | 'The setting is on by default and needs the Gmail Settings admin privilege (search excerpt).', |
| `scripts/gws-posture-audit.js:217` | search excerpt | Devices → Mobile & endpoints → Settings → Universal → Security → Device approvals |
| `scripts/gws-posture-audit.js:238` | search excerpt | 'Admins cannot delete log event data or change how long Google keeps it, so there is no retention setting to audit (search excerpt).', |
| `scripts/gws-posture-audit.js:239` | search excerpt | 'Admin and Drive log events appear in near real time; OAuth events can take up to a few hours (search excerpt).', |
| `scripts/gws-posture-audit.js:554` | search excerpt | if (c.superAdmins < 2) reasons.push('Google recommends more than one super admin (search excerpt)'); |
| `scripts/gws-posture-audit.js:568` | search excerpt | text: 'not applicable; the less secure apps settings were removed from the Admin console (support.google.com/a/answer/14114704, search excerpt)', |
| `scripts/gws-posture-audit.js:584` | search excerpt | lines.push(`- Enforced but not enrolled (enforcement can lock these users out, search excerpt): ${countWithRows(c.enforcedNotEnrolled, r.enforcedNotEnrolled, 'active user')}.`); |
| `scripts/gws-posture-audit.js:689` | search excerpt | `- Sources were checked ${SOURCES_CHECKED}. "discovery document" is Google's published API definition; "project wiki" is the GAM project's own wiki (GAM is a community tool); "search excerpt" means th |

## How this list was made

A line-based extraction (Python 3, run from the repo root): every line of the files below that says "search excerpt", "vendor repo" or names a raw.githubusercontent.com source; a Sources line is split at " · " into one row per source. A fact is listed under how its line says it was read.

<details><summary>vendor-facts.py</summary>

```python
import re,glob,subprocess
plat={'fleet':'Fleet','linear':'Linear','slack':'Slack','jamf':'Jamf Pro','gws':'Google Workspace'}
g2files={'fleet':['.claude/commands/fleet-device-actions.md','.claude/commands/fleet-host-health.md','.claude/commands/fleet-osquery-investigation.md','.claude/commands/fleet-policy-failures.md','.claude/commands/fleet-vulnerable-software.md','scripts/adapters/fleet-client.js'],
 'linear':sorted(glob.glob('.claude/commands/linear-*.md'))+['scripts/adapters/linear-client.js'],
 'slack':sorted(glob.glob('.claude/commands/slack-*.md'))+['scripts/adapters/slack-client.js'],
 'jamf':['.claude/commands/jamf-config-profiles.md','.claude/commands/jamf-filevault.md','.claude/commands/jamf-inventory-groups.md','.claude/commands/jamf-patch-management.md','.claude/commands/jamf-policies-self-service.md','scripts/adapters/jamf-client.js'],
 'gws':['.claude/commands/gws-2sv-enforcement.md','.claude/commands/gws-account-containment.md','.claude/commands/gws-admin-roles.md','.claude/commands/gws-drive-sharing.md','.claude/commands/gws-security-posture.md','scripts/adapters/gws-client.js','scripts/gws-posture-audit.js']}
mark=re.compile(r'search excerpt|vendor repo(?:sitory)?|raw\.githubusercontent\.com',re.I)
out=['# Vendor facts to check by hand (batch G2)','',
'This session\'s network refused the vendor documentation hosts, so each fact below rests on a search excerpt or on the vendor\'s own repository (docs source, schema, SDK or discovery document), as the line itself says. One row per marked line: where it is, how it was read, and the breadcrumb, command or API path on that line. Re-read each against the live vendor page and correct the runbook if they differ. Generated from the runbooks, adapters and the posture audit at the head of `feat/g2-gws-fleet-jamf-slack-linear`.','']
total=0
for k,files in g2files.items():
    rows=[]
    for f in files:
        for n,line in enumerate(open(f,encoding='utf-8'),1):
            if not mark.search(line): continue
            if line.lstrip().startswith('**Sources') or ' · ' in line:
                body=re.sub(r'^\s*\*\*Sources[^*]*\*\*:?\s*','',line.strip())
                for entry in [e.strip() for e in body.split(' · ') if e.strip()]:
                    if not mark.search(entry) and 'raw.githubusercontent' not in entry: continue
                    how='search excerpt' if re.search(r'(?<!no )search excerpt',entry,re.I) else 'vendor repository'
                    m=re.match(r'(\S+)\s*\((.*)\)\.?\s*(.*)$',entry)
                    src,facts=(m.group(1),m.group(2)) if m else (entry[:80],entry)
                    facts=re.sub(r'^(?:vendor repo(?:sitory)?|search excerpt)[,:]?\s*','',facts,flags=re.I)
                    fact=(src+': '+facts)[:300].replace('|','\\|').replace('\u2014','--')
                    rows.append(f'| `{f}:{n}` | {how} | {fact} |')
                continue
            how='search excerpt' if re.search(r'(?<!no )search excerpt',line,re.I) else 'vendor repository'
            if re.search('search excerpt',line,re.I) and re.search(r'vendor repo|raw\.githubusercontent',line,re.I): how='search excerpt and vendor repository'
            facts=re.findall(r'`([^`]{3,120})`',line)
            facts=[x for x in facts if not x.startswith('node scripts/') and x not in ('--execute',)]
            crumbs=re.findall(r'((?:[A-Z][\w&/ -]{1,40} → ){1,8}[\w&/ -]{1,60})',line)
            fact='; '.join(dict.fromkeys(crumbs+facts))[:300] or line.strip()[:200]
            fact=fact.replace('|','\\|').replace('\u2014','--')
            rows.append(f'| `{f}:{n}` | {how} | {fact} |')
    out+= [f'## {plat[k]} ({len(rows)} lines)','','| where | how read | breadcrumb, command or API path on the line |','|---|---|---|']+rows+['']
    total+=len(rows)
out.insert(4,f'Total: {total} marked lines.\n')
open('docs/aegis/g2/vendor-facts-to-check.md','w',encoding='utf-8').write('\n'.join(out))
print(total)
```

</details>
