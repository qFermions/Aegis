# Batch 12, task 1: the four runbook-facing judgment rules, swept across every runbook

- **Hypothesis (written 2026-11-14 before the first runbook edit):** about two thirds of the 108 runbooks have a workflow that one of rules a to d (`docs/aegis/answer-format.md`, section 2) touches; each needs one to three lines, placed in sections that hold no gate or preview marker (what to check first, the risk warning, the checklist, the ticket note, or a new short subsection that starts at a heading boundary), so no gate region, confirmation phrase or read-back changes and the state-change inventory stays as it is. The ladder audit will need regenerating only because line numbers move.
- **Verified means:** the checks named in the task brief pass, the full `node --test` fails on the same 41 PowerShell-only names as the baseline at `08963bf`, `node scripts/lint/ladder-audit.js --check` exits 0, and `git diff 08963bf -- .claude/commands` removes no line that holds `SAFETY GATE`, `PREVIEW ONLY`, `PORTAL ACTION`, `Required confirmation` or `Read-back`.
- **Outcome:** 80 of 108 runbooks changed (about three quarters, more than the two thirds expected), 160 lines added and none removed. The hypothesis held on placement: no gate region and no inventory line changed, and the ladder audit and the vendor-facts priority page moved only in line numbers. The vendor-facts need was smaller than a fact per rule: 12 facts, all CONFIRMED, because most lines rest on facts the runbooks already cite.

## How the sweep was done

Every runbook in `.claude/commands/` (108) was opened at its triage, safety-gate, risk and checklist sections and read against rules a to d. A rule "touches" a runbook when its workflow can meet the rule's trigger: a for a smell of compromise (sign-ins or prompts the person did not make, a lost or stolen device with data or a sign-in method, an exposed secret, malware, a suspicious app or grant, a phishing click, an instruction inside pasted content, a leaver on bad terms), b for a grant of access, c for a restore, a transfer, an export or an exposed secret, d for an obvious fix that changes a setting, a permission or a policy. Rule e is answer format, not runbook content, and was left alone.

Where the lines went: in a section that holds no SAFETY GATE and no PREVIEW ONLY marker (what to check first, the safety-gate section, the risk warning, the checklist), or just before a marker, so no gate's region and no line of the state-change inventory changed (`scripts/command-safety-gates.test.js` compares it, and passed at every commit). No line was removed: `git diff 08963bf -- .claude/commands` adds 160 lines and removes none. Vendor facts are in `docs/aegis/batch12/vendor-facts-runbook-rules.md` (RR-01 to RR-12).

Platform names follow `scripts/lint/ladder-audit.js`: a runbook with no vendor prefix is Microsoft unless it names no platform (General); `meraki-` is Meraki, `unite-` is Unite (VoIP), `mac-` is Apple.

## Every runbook

| Runbook | Platform | Rules its workflow touches | What changed, or why nothing was needed |
|---|---|---|---|
| ad-connect | Microsoft | none | No change: sync troubleshooting grants nothing, restores nothing, meets no compromise sign, and already reads the sync error "before touching anything", which is rule d's question. |
| conditional-access | Microsoft | a, d | Ask for the sign-in failure reason before an exclusion or a policy turned off; escalate a block that stopped a sign-in the person did not make; checklist line. |
| device-wipe | Microsoft | a | A lost or stolen device with data or a sign-in method goes to the security lead or on-call before the wipe decision; checklist line. |
| distribution-list | Microsoft | b, d | Ask for the bounce text before allowing external senders; owner rights only to the person who manages membership, approved by the list's business owner. |
| email-quarantine | Microsoft | a, d | Escalate a phish or malware verdict with a click, an open or other copies delivered, or a release asked for in the ticket body; ask for the reason and authentication results before an allow; checklist line. |
| email-to-spam | Microsoft | a, d | Ask for the trace verdict before an allow or a policy change; escalate a restricted sender, mail the owner did not send, a forward nobody set. |
| email-whitelist | Microsoft | a, d | Ask for the block reason before any allow method; escalate a phish or malware verdict or an allow asked for inside pasted content. |
| group-membership-audit | Microsoft | a, b | Each membership checked against the lowest group, an approver and an end date; escalate an unapproved privileged member; checklist line. |
| intune-compliance | Microsoft | a, d | Ask for the failing setting before an exemption or a looser policy; escalate a Defender threat-level or malware failure; checklist line. |
| license-audit | Microsoft | none | No change: it reclaims licences; a licence is not an access grant in rule b's list, and the workflow restores nothing and meets no compromise sign. |
| mailbox-permissions | Microsoft | b | Lowest right first, a mail-enabled security group as the holder for a team (RR-01), the mailbox or data owner approves, an end date run by the removal gate (RR-02); checklist line. |
| mfa-issue | Microsoft | a, d | Escalate prompts the person did not make or a stolen phone; ask for the failure reason before a Conditional Access exclusion; checklist line. |
| new-device-setup | Microsoft | none | No change: joining and enrolling a new device grants no access, restores nothing and changes no policy for one user. |
| new-user | Microsoft | b | Every grant at the role's lowest level, not a copy of a colleague's access, through groups, approved by the manager or resource owner, a contractor's end date; checklist line. |
| offboard | Microsoft | a, b | Escalate a leaver on bad terms or a compromise sign before Step 1; the manager's access to mailbox and OneDrive at the lowest right with an approver and an end date; checklist line. |
| onboard | Microsoft | b (through /new-user) | No change: a routing-only alias that delivers /new-user, which carries the rule. |
| onedrive-issue | Microsoft | a, d | Escalate ransomware signs before any reset or restore; ask what uses the space before raising a quota. |
| onedrive-restore | Microsoft | a, b, c | View the older version without overwriting and save it beside the live file, copy good later files aside before Files Restore, undo by running Restore again (RR-05 to RR-08); ransomware escalation; the manager's admin access approved with an end date; checklist line. |
| outlook-issue | Microsoft | a | Escalate a rule, forward or sent mail the user did not make; capture before removing the rule. |
| password-reset | Microsoft | a | Escalate sign-ins or prompts not made, a reset nobody asked for, a password typed into a phishing page; checklist line. |
| security-alert-triage | Microsoft | a | Names the security lead, security on-call or incident response team at the start and what they need; checklist line. |
| shared-mailbox | Microsoft | b | Send on Behalf before Send As, Full Access only for readers, the mailbox owner approves, a group as the holder (RR-01), an end date (RR-02); checklist line. |
| shared-mailbox-create | Microsoft | b (through /shared-mailbox) | No change: a routing-only alias to /shared-mailbox, which carries the rule. |
| sharepoint-access | Microsoft | a, b, d | Visitors before Members before Owners through the site's group, the site owner approves, guest access expiry (RR-03); ask for the error before opening sharing (RR-04); escalate a share nobody made; checklist line. |
| teams-issue | Microsoft | d | Ask what the user sees before a meeting, messaging or external access policy change. |
| gws-2sv-enforcement | Google | d | Ask what stops the person enrolling before an exemption or turning enforcement off; an exemption ends on a ticket date. |
| gws-2sv-reset | Google | a | Escalate sign-ins or prompts not made, a request the user did not send, a lost phone or key. |
| gws-account-containment | Google | a | Names the security lead, on-call or incident response team at the start as the case's owner and what they need. |
| gws-admin-roles | Google | a, b | Lowest role, a non-dynamic security group as holder except for Super Admin (RR-10), the IT lead approves, a role that expires within a year (RR-11); escalate an unapproved role holder. |
| gws-audit-log | Google | a | A read that shows a compromise sign goes to the security lead or on-call with the entries. |
| gws-chromeos-device | Google | a | A lost or stolen device: the disable plus the escalation; anything beyond waits for their call. |
| gws-drive-sharing | Google | a, b, d | Viewer before Commenter before Editor to a named account or group, the file owner approves, Drive's access expiry (RR-09); ask for the error before an allowlist or a sharing change; escalate a share nobody made. |
| gws-drive-transfer | Google | b, c | The transfer folder is the safe place, checked against the counts before anything moves on or is deleted (RR-12); the receiver is approved by the manager or data owner. |
| gws-gmail-delivery | Google | a, d | Ask for the bounce or headers before an allow, routing or spam change; escalate mail the user did not send, a forward or filter nobody set. |
| gws-group-membership | Google | b | Member, not manager or owner; the job's group; the group owner approves; an end date the removal phase runs on. |
| gws-license-assign | Google | none | No change: a licence switch is not an access grant in rule b's list; removal already offers archiving to keep the data; no compromise sign in the workflow. |
| gws-new-user | Google | b | Team groups at the Member role, no admin role at creation, the hiring manager approves, a contractor's end date. |
| gws-offboard | Google | a, b, c | Escalate a leaver on bad terms before Phase A; the transfer folder checked before Phase D deletes (RR-12); who receives the data and mail is approved. |
| gws-ou-move | Google | d | Ask what fails before a move that loosens a security setting to make a symptom go away. |
| gws-password-reset | Google | a | Escalate sign-ins not made, a reset nobody asked for, a password typed into a phishing page. |
| gws-security-posture | Google | a, d | A compromise sign found during the review goes to security, not to the fix list; ask for the business reason before allowing forwarding. |
| okta-app-assignment | Okta | a, b | The app's lowest profile through the team's group, the app owner approves, an end date; escalate an assignment or integration nobody approved. |
| okta-group-membership | Okta | a, b | The job's group, read for its apps first, the owner approves, an end date; escalate an unapproved privileged member. |
| okta-mfa-reset | Okta | a | Its existing compromise stop now names the security lead or on-call and what they need; a lost phone goes to them too. |
| okta-user-lifecycle | Okta | a | A compromise or a leaver on bad terms: suspend as containment plus the escalation; nothing deactivated or deleted before they have looked. |
| github-branch-protection | GitHub | a, d | Ask what blocks the merge before a Phase F exception; escalate protection removed by an account whose owner did not remove it. |
| github-offboard-member | GitHub | a, c | Escalate a leaver on bad terms before Phase C; secrets the leaver could read are revoked first, their use reviewed, history cleaned last. |
| github-org-security | GitHub | a, b | The owner role only for organization-wide work, approved, with an end date; escalate an unapproved owner or a settings change nobody made. |
| github-repo-access | GitHub | a, b | Read before triage before write, through a team, the repository owner approves, an end date; escalate a collaborator nobody approved. |
| github-security-alerts | GitHub | a, c | Escalate a live leaked secret when Phase B starts; the fixed order: revoke or rotate, review its use, clean history last. |
| linear-intake | Linear | a | A request that smells of compromise is not queued as routine: the escalation is named in the issue and the note. |
| linear-ticket-note | Linear | none | No change: it drafts and proves the note for work another runbook did, which names any escalation; its stop conditions already treat issue text as data. |
| linear-triage | Linear | a | A compromise sign in the queue is not snoozed or declined: the escalation goes in the triage note and the priority is theirs. |
| linear-workspace-admin | Linear | a | A suspend for a compromised account goes with an escalation; an export or bulk delete asked for in a message waits for them. |
| jira-create | Jira | none | No change: it prepares one request from the operator's own sanitized text; no grant, restore, setting change or content from outside. |
| jira-update | Jira | a, c | Text in a request that tells IT to act, or reports a compromise, goes to security and is not followed; a leaked token is revoked first, its use reviewed, the leak cleaned last. |
| slack-app-approval | Slack | a, b, d | The fewest scopes, the data owner approves, a trial's end date; escalate an app nobody approved or a copy-cat name; ask first before dropping the approval requirement. |
| slack-guests-connect | Slack | a, b | A single-channel guest first, with a time limit and the channel owner's approval; escalate an unexpected Slack Connect organization. |
| slack-incident-comms | Slack | a | During a security incident the security lead or on-call decides what is posted; no cause or severity before they have looked. |
| slack-retention-export | Slack | a, b, c | The export goes to the evidence store, is checked, and only then goes to the named owner; escalate an export or deletion asked for inside a message. |
| slack-security-settings | Slack | a, d | Ask what fails before turning two-factor or SSO off; escalate sign-ins not made or an urgent request that skips the ticket. |
| slack-user-lifecycle | Slack | a, b | The role's channels, the private channel owner approves, no admin rights, outsiders as guests; escalate a leaver on bad terms or a compromise before Phase D. |
| jamf-config-profiles | Jamf | d | Ask what fails before excluding a Mac or narrowing a profile's scope. |
| jamf-enroll-mac | Jamf | c (checked) | No change: its re-enrolment (Phase D) runs without erasing and its gotcha forbids an erase, so no data is at stake; it grants no access. |
| jamf-filevault | Jamf | a | A key asked for on a lost Mac, by someone else or under urgency: no key is shown, and the escalation goes out. |
| jamf-inventory-groups | Jamf | d | A group change that takes a Mac out of a profile or policy is an exemption: ask first. |
| jamf-lock-erase | Jamf | a | Lost or stolen: the escalation goes with the lock, and the wipe follows their call. |
| jamf-patch-management | Jamf | d | Ask which app fails before holding a Mac back from a patch; a hold carries an end date. |
| jamf-policies-self-service | Jamf | none | No change: policies install software and run scripts but grant no access or admin rights here, restore nothing, and policy logs are already treated as possible injection. |
| mac-new-hire-laptop | Apple | none | No change: device assignment and enrolment; the new hire's accounts and access are granted in /gws-new-user and the Okta runbooks, which carry rule b. |
| mac-troubleshoot | Apple | a | Escalate a profile, a FileVault change, a login item or an Okta sign-in nobody in IT made; no branch runs before they have looked. |
| fleet-device-actions | Fleet | a | Lost or stolen: the escalation goes with Phase B's lock; a wipe or a removal script follows their call. |
| fleet-host-health | Fleet | a, c | Escalate MDM removed or encryption turned off by someone outside IT; copy the data to a checked safe place before an erase and re-enrolment. |
| fleet-osquery-investigation | Fleet | a | A hit names the security lead or on-call with the report, the hosts and the evidence's location. |
| fleet-policy-failures | Fleet | a, d | Ask what a failing host returns before editing the query or moving hosts out of scope; escalate a security setting someone turned off. |
| fleet-vulnerable-software | Fleet | a | A known-exploited CVE or signs of use: the escalation, and evidence kept before a patch changes the hosts. |
| lan-wan | General | a, d | Ask what fails before a port, allow rule or limit change; escalate MX security events or unknown devices. |
| meraki-health | Meraki | a | Escalate intrusion or malware events, a rogue access point with the staff network's name, traffic nobody can explain. |
| meraki-site-vpn | Meraki | b | Only the subnets and named flows the sites use, the network owner approves, a migration flow carries an end date. |
| meraki-vpn-status | Meraki | d | Ask which host cannot reach which address before advertising a subnet or widening the VPN firewall. |
| printer-issue | General | none | No change: printer, queue and driver work grants no access, restores nothing, meets no compromise sign and changes no security setting. |
| sip-trunk-status | General | a, d | Toll-fraud signs escalated; ask which phones fail before opening SIP ports to the internet. |
| troubleshoot | General | a, d | The ask-first rule in step 3, a routing row for compromise signs, and the security escalation in step 7. |
| vpn-check | General | a, d | Ask what fails before a routing or VPN-scope change; escalate VPN sign-ins the person did not make. |
| wifi-issue | General | a, d | Ask what the device shows before letting it past the Wi-Fi's security; escalate a rogue access point or an unknown client. |
| zoom-room-issue | General | d | Ask for the logged blocked connection before opening port 9090 or adding an antivirus exclusion. |
| unite-extension-create | Unite | b | The role's call groups, outside forwarding and extra calling rights only when needed, the manager approves, an end date. |
| unite-migration-status | Unite | none | No change: a migration tracker; no grant, restore, compromise sign or setting change for one person. |
| unite-voicemail-reset | Unite | a | Escalate a greeting, forward or deletion someone else made, or a reset asked for by another person. |
| escalation-note | General | a | A security escalation template with what the security lead or on-call needs. |
| field | General | a | Rule 8: a compromise sign on site stops the steps; the escalation; the device is not turned off or wiped. |
| incident-report | General | a | Asks who a security incident went to, and uses that team's severity and cause. |
| ticket-response | General | a | The reply to a person who reported a security worry (section 8's incident reply). |
| aegis | General | none | No change: switches into the Aegis working style and routes to the current rules; no workflow of its own. |
| aegis-update | General | none | No change: maintains Aegis's own files, not an IT workflow. |
| ai-engineer-drill | General | none | No change: a learning drill. |
| board-report | General | none | No change: drafts a report from sanitized summaries. |
| cloud-lab | General | none | No change: a learning drill. |
| daily-start | General | none | No change: a day plan from sanitized summaries. |
| daily-wrap | General | none | No change: a summary of the day's work. |
| devops-drill | General | none | No change: a learning drill. |
| draft-email | General | none | No change: drafts an email from sanitized inputs. |
| ps-error-decode | General | none | No change: decodes PowerShell error text. |
| ps-script | General | none | No change: drafts a placeholder-only script under the script safety scan; no ticket workflow. |
| runbook | General | none | No change: a documentation writer. |
| vendor-email | General | none | No change: drafts a vendor email. |
| vent | General | none | No change: listens; no IT action. |
| write-sop | General | none | No change: an SOP writer. |

## Counts

Counted from the table above (a row counts once per rule it carries; the "No change" rows are left out). 108 rows, 80 changed, 28 unchanged; the 80 match the files `git diff --name-only 08963bf -- .claude/commands` lists.

| Platform | Runbooks changed | Rule a | Rule b | Rule c | Rule d |
|---|---|---|---|---|---|
| Microsoft | 20 | 15 | 8 | 1 | 10 |
| Google | 15 | 10 | 6 | 2 | 5 |
| Okta | 4 | 4 | 2 | 0 | 0 |
| GitHub | 5 | 5 | 2 | 2 | 1 |
| Slack | 6 | 6 | 4 | 1 | 2 |
| Linear | 3 | 3 | 0 | 0 | 0 |
| Jira | 1 | 1 | 0 | 1 | 0 |
| Jamf | 5 | 2 | 0 | 0 | 3 |
| Apple (Mac) | 1 | 1 | 0 | 0 | 0 |
| Fleet | 5 | 5 | 0 | 1 | 1 |
| Meraki | 3 | 1 | 1 | 0 | 1 |
| Unite (VoIP) | 2 | 1 | 1 | 0 | 0 |
| General (network, troubleshooting, drafting) | 10 | 9 | 0 | 0 | 6 |
| **All** | **80** | **63** | **24** | **8** | **29** |

## Decisions

- **Placement over a new step.** Each rule went in as a bullet in the runbook's own safety-gate or "what to check first" section, or as a checklist line, not as a new numbered step inside a gated phase: a line inside a gate's region would change that gate's inventory entry, and a new heading inside a section would change the ladder audit's sections. Where the brief's wording was "a step", the runbook's first section is where its first step is chosen.
- **A licence is not an access grant.** Rule b's list (groups, mailbox permissions, sharing, admin roles, repository access, Slack guests, Okta app assignment, Jamf and Fleet roles) names no licence, so `license-audit` and `gws-license-assign` were left alone.
- **No runbook grants a Jamf or Fleet role.** Those runbooks name the role a person needs to act; none grants one, so rule b had nothing to touch there.
- **End dates without a platform expiry.** Where the platform's own expiry was confirmed (SharePoint guest access RR-03, Drive access RR-09, Google admin roles RR-11, Slack guest time limits from the runbook's own facts), the line names it. Elsewhere the end date goes in the ticket and the runbook's existing removal gate runs on it; no expiry feature was claimed that was not read on a vendor page.
- **Ask-first questions ask for the evidence, never for a person.** Every question asks what fails, what a log or screen shows, or which organization or system; none asks for a name or an address (CLAUDE.md rules 8 and 10). Three first drafts that asked for an outside address were changed to ask for the outside organization.
- **The escalation names a role, not a person.** Every rule a line names the security lead, the security on-call or the incident response team, and what they need; no runbook gained a placeholder for a person.

## Not checked

- Whether the security lead and security on-call roles exist under those names at any customer: the lines name roles generically, as the rule does.
- The Slack, Jamf, Fleet and Okta lines rest on facts the runbooks already cite (several from search excerpts in batches G1 to G3); this task re-read none of those vendor pages.
- No model session was run against the changed runbooks, so whether answers now name the escalation or ask first is measured by the batch's judged run, not here.
