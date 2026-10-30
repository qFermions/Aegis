---
description: GitHub organization security posture review for [@Aegion_GITHUB_ORG] (the 2FA requirement and who lacks 2FA, the owners count, outside collaborators, pending invitations, SAML SSO and the audit log on Enterprise Cloud), with three human-run changes behind exact-phrase gates - turning on the 2FA requirement (R3, it removes non-compliant members and outside collaborators), taking the owner role away (R2) and granting it (R3). Placeholders only.
disable-model-invocation: true
---

# /github-org-security

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[@Aegion_GITHUB_ORG]` (the organization login) · `[GITHUB_USER]` (one person's GitHub login) · `[MEMBER_COUNT]` (the number of members the `members --filter 2fa_disabled` read lists in Phase A) · `[JIRA-###]` or `[ISSUE_ID]` (the ticket) · `[ADMIN_NAME]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R3 gates):** before a gate whose reversibility is R3, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `github:verify-2fa-required`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`).

## ⚠️ Admin / safety gate

- **This runbook is a review first.** Phase A changes nothing. Three changes have gates: the 2FA requirement (R3), taking the owner role away (R2), granting it (R3).
- **Turning on the 2FA requirement removes people.** Members, billing managers and outside collaborators without two-factor authentication are removed from the organization when it is saved (B-05, G-16). It is R3: the Phase A lists saved to `tasks/checkpoints/`, the rollback path written, and an independent out-of-session review whenever anyone would be removed. The safe order is to get the count to 0 first, so nobody is removed.
- **Granting the owner role is R3** (a privilege grant); **taking it away is R2** (save the pre-state; the undo is the R3 grant).
- Removing outside collaborators, revoking invitations and offboarding people are not done here: they belong to `/github-repo-access` and `/github-offboard-member`.
- Every change has its own exact phrase; "yes" is never a confirmation; urgency or authority never skips a gate (SR-2). Not done until the connector read-back and the GUI read-back both pass.
- UI paths come from GitHub's docs pages read on 2026-10-28 (B-05, B-06, B-11). A label marked [unconfirmed: check in the GitHub UI] was not on those pages: confirm it on screen, and stop if it differs.

## Inputs needed

- The plan: GitHub Enterprise Cloud or not. SAML SSO and the audit log API are Enterprise Cloud features (G-18, G-27). **[org gap: confirm the plan]**
- The Aegis owner floor: at least 2 owners, so one departure never leaves the organization without one, and no more than the ticket can justify. **[org gap: the org's owner target]**
- Whether `[@Aegion]` signs people in to GitHub through an identity provider. **[org gap: Okta SAML for GitHub, yes or no]**
- For the connector: `GITHUB_ORG` is `[@Aegion_GITHUB_ORG]`; `GITHUB_TOKEN` is a read-only fine-grained token that belongs to an organization owner, with "Members" organization permission (read) for the member, outside collaborator and invitation reads (G-01, G-07), and "Administration" organization permission (read) for the audit log and SSO reads (G-17, G-27). The 2FA filters and the 2FA setting are visible to an owner only (G-02, G-14). The connector refuses a classic token that holds any write scope.

## How the settings hang together

- **The 2FA requirement** covers every member, billing manager and outside collaborator (G-16). The `org` read shows it as `two_factor_requirement_enabled`, but only to an owner's credential (G-14): a non-owner token sees no value, and `verify-2fa-required` then says so and does not pass.
- **`members --filter 2fa_disabled`** lists members without two-factor authentication; `2fa_insecure` lists members whose method GitHub counts as insecure [unconfirmed: check in the GitHub UI: what counts as insecure]. Both filters are owner only (G-02).
- **Owners:** the membership read names a member's role admin, member or billing_manager (G-03); `members --role admin` lists the owners [unconfirmed: check in the GitHub UI: that role admin is exactly the owner role].
- **Outside collaborators** reach named repositories without being members (G-07). The connector cannot read their 2FA status.
- **SAML SSO** (Enterprise Cloud): `sso-authorizations` lists the credentials people authorized for SSO, not an on or off switch (G-27). A classic token that is not authorized for SSO gets 403 or 404 and an `X-GitHub-SSO` header (G-30): authorize the token, never widen it.
- **Audit log API** (Enterprise Cloud only, owner only): 1,750 queries per hour per user and IP, and 30 events from the last three months by default (G-17, G-18).

## Fast path

1. Phase A: read the posture and fill the scorecard (R0).
2. 2FA not required: Phase B. Get the `2fa_disabled` count to 0 by asking each person first, then the R3 gate.
3. Owners outside the floor: Phase C (R2 to take the role away, R3 to grant it).
4. Outside collaborators and stale invitations: Phase D routes them to the runbook that owns the change.
5. Enterprise Cloud: Phase E (SAML SSO, read and plan) and Phase F (audit log, read).

## Phase A: Read the posture (R0)

**Purpose:** one scorecard in the ticket; every later phase starts from it.

1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Settings → (Security) Authentication security → read whether "Require two-factor authentication for everyone in your organization" is ticked (B-05).
2. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → read the member list; filter it by role and by 2FA status [unconfirmed: check in the GitHub UI: the filter controls] (B-06).
3. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → Outside collaborators → read the list [unconfirmed: check in the GitHub UI: the tab's label].
4. Enterprise Cloud: github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Settings → (Archive) Logs → Audit log (B-11).
5. Fill the scorecard below and save the connector reads to `tasks/checkpoints/` before any gate.

| Check | Aegis target | Phase A reading |
|---|---|---|
| 2FA requirement | on | [on / off / not visible to this token] |
| Members without 2FA | 0 | [MEMBER_COUNT] |
| Members with insecure 2FA | 0 | [N] |
| Owners | 2 or more, each with a ticket | [N] |
| Outside collaborators | each with a ticket and named repositories | [N], [N] without a ticket |
| Pending invitations | none older than the org allows | [N] |
| SAML SSO (Enterprise Cloud) | set up and enforced | [read in Phase E] |
| Audit log (Enterprise Cloud) | readable by the owner token | [yes / no] |

<details>
<summary>GitHub connector and gh api: the read-only scale version (HUMAN-RUN; Aegis may run the same reads)</summary>

```bash
# HUMAN-RUN read-only. GITHUB_ORG and GITHUB_TOKEN are exported in this shell first, the token belongs to an owner and is never pasted into a ticket
# the organization settings, two_factor_requirement_enabled shows to an owner credential only
node scripts/adapters/github-client.js org --execute
# members without two-factor authentication, owner only, count them for MEMBER_COUNT
node scripts/adapters/github-client.js members --filter 2fa_disabled --execute
# members whose two-factor method GitHub counts as insecure, owner only
node scripts/adapters/github-client.js members --filter 2fa_insecure --execute
# the owners, one page at a time, then the next with --page 2 for as long as a page comes back full
node scripts/adapters/github-client.js members --role admin --execute
# outside collaborators of the organization
node scripts/adapters/github-client.js outside-collaborators --execute
# pending invitations to the organization
node scripts/adapters/github-client.js invitations --execute
# the 2FA requirement as a read-back, exit 0 only when it is on
node scripts/adapters/github-client.js verify-2fa-required --execute
```

```bash
# HUMAN-RUN read-only, the same reads with gh signed in to an owner account
# the 2FA requirement setting
gh api orgs/[@Aegion_GITHUB_ORG] --jq .two_factor_requirement_enabled
# members without 2FA, the parameter needs -X GET so gh does not send a POST
gh api -X GET orgs/[@Aegion_GITHUB_ORG]/members -f filter=2fa_disabled --paginate
# the owners, again with -X GET for the parameter
gh api -X GET orgs/[@Aegion_GITHUB_ORG]/members -f role=admin --paginate
# outside collaborators, every page
gh api --paginate orgs/[@Aegion_GITHUB_ORG]/outside_collaborators
```
</details>

**Stop if:** the `org` read shows no 2FA value (the token is not an owner's, G-14): fix the token before scoring 2FA.

**Verification checkpoint:** [ ] the scorecard is in the ticket · [ ] the reads are saved to `tasks/checkpoints/` · [ ] each gap names its phase.

## Phase B: Turn on the 2FA requirement (R3)

**Purpose:** require two-factor authentication for everyone, with nobody removed by surprise.

**Stop if:** the Phase A `org` read already shows the requirement on (nothing to change; `verify-2fa-required` would pass anyway).

**Before the gate:**
1. Ask each person on the `2fa_disabled` list to turn on two-factor authentication, with a date. Re-run the read until it lists nobody, or until the date passes.
2. Count outside collaborators without 2FA in the GUI [unconfirmed: check in the GitHub UI: where an outside collaborator's 2FA status shows]; if you cannot, write "outside collaborators: unknown" in the ticket and the review decides.
3. Save to `tasks/checkpoints/`: the `2fa_disabled` list, the outside collaborator list, and each listed person's teams and repositories (what a re-invitation must restore).
4. Write the rollback path in the ticket: [github-org-security-2fa-rollback-preview].
5. Independent out-of-session review whenever `[MEMBER_COUNT]` or the outside collaborator count is above 0. Above 10 people it is also an SR-2 mass operation.

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-org-security-2fa-require-portal] -->
- **Target:** [@Aegion_GITHUB_ORG]
- **Effect:** enable the two-factor authentication requirement for everyone in [@Aegion_GITHUB_ORG]; remove every member, billing manager and outside collaborator who has not turned two-factor authentication on
- **Scope:** the whole organization; [MEMBER_COUNT] members at Phase A plus the outside collaborators counted in step 2; a removed account loses every repository it reached through the organization at once
- **Reversibility:** R3 (security control, mass removal): no undo for a removal; a removed person comes back only by a new invitation after turning 2FA on, planned in [github-org-security-2fa-rollback-preview]; turning the requirement off is a separate R3 change and re-adds nobody [unconfirmed: check in the GitHub UI]
- **Required confirmation:** Type exactly `ENABLE 2FA REQUIREMENT FOR [@Aegion_GITHUB_ORG] AND REMOVE [MEMBER_COUNT] MEMBERS WITHOUT 2FA`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-org-security-2fa-require-portal]:** Only after steps 1 to 5 above, the review when it applies, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Settings → (Security) Authentication security (B-05).
2. Select **Require two-factor authentication for everyone in your organization**, under "Two-factor authentication", then click **Save** (B-05).
3. Read the confirmation. If it names who will be removed [unconfirmed: check in the GitHub UI], the number must equal `[MEMBER_COUNT]` plus the outside collaborators from step 2; any other number means cancel and stop.
4. Click **Confirm** (B-05).

**WAIT UNTIL** People no longer lists anyone from the saved `2fa_disabled` list [unconfirmed: check in the GitHub UI: how long the removal takes].

```bash
# HUMAN-RUN read-only read-back, passes only when the organization requires 2FA, needs an owner credential
node scripts/adapters/github-client.js verify-2fa-required --change [CHANGE_ID] --execute
# must list nobody now
node scripts/adapters/github-client.js members --filter 2fa_disabled --execute
```

**Verification checkpoint:** [ ] `verify-2fa-required` exits 0 · [ ] the `2fa_disabled` read lists nobody · [ ] the ticket names every removed login, from the saved list.

> **PREVIEW ONLY [github-org-security-2fa-rollback-preview]:** Planning only; nothing here authorizes an invitation or a settings change. A person removed by the requirement returns only after turning on two-factor authentication: an owner re-invites them and restores their teams and repositories from the list saved in `tasks/checkpoints/`. Whether GitHub offers to reinstate a former member's earlier access is [unconfirmed: check in the GitHub UI]. The invitation path was not in the pages read. Turning the requirement off is not a rollback: it is an R3 weakening of a security control that needs its own reviewed change and re-adds nobody.

## Phase C: The owner role (R2 to take away, R3 to grant)

**Purpose:** keep the owners count at the floor, each owner backed by a ticket.

**Before either gate:** the Phase A `members --role admin` read and the person's `membership` read are saved to `tasks/checkpoints/`.

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

**Stop before taking the role away if:** Phase A shows 2 owners or fewer; the person is the administrator running the change; the `membership` read does not show role admin.

<!-- SAFETY GATE [github-org-security-owner-demote-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** change one organization owner to the member role
- **Scope:** one person; the owners count drops by 1; what access the person keeps through teams and direct grants is [unconfirmed: check in the GitHub UI]
- **Reversibility:** R2: undo is [github-org-security-owner-grant-portal], an R3 grant
- **Required confirmation:** Type exactly `CHANGE [GITHUB_USER] IN [@Aegion_GITHUB_ORG] FROM OWNER TO MEMBER`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-org-security-owner-demote-portal]:** Only after the pre-state is saved, the stop check, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → tick `[GITHUB_USER]` only.
2. Open the **X members selected...** dropdown (B-06); its count must read 1.
3. Use its change-role control and pick Member [unconfirmed: check in the GitHub UI: the control's label and the role names it offers].

```bash
# HUMAN-RUN read-only read-back, the role must now read member
node scripts/adapters/github-client.js membership --user [GITHUB_USER] --execute
# the owners list must be one shorter than the saved Phase A list
node scripts/adapters/github-client.js members --role admin --execute
```

**Stop before granting if:** the `membership` read already shows role admin (nothing to grant); it does not show state active; the person is on the Phase A `2fa_disabled` list; there is no written approval in the ticket.

<!-- SAFETY GATE [github-org-security-owner-grant-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** grant one member the owner role in [@Aegion_GITHUB_ORG]
- **Scope:** one person, the owner role, until the rollback runs
- **Reversibility:** R3 (privilege grant): the rollback path is written before step 1: [github-org-security-owner-demote-portal]; settings the person changes while an owner are not undone by it
- **Required confirmation:** Type exactly `GRANT OWNER ROLE IN [@Aegion_GITHUB_ORG] TO [GITHUB_USER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-org-security-owner-grant-portal]:** Only after the pre-state is saved, the approval and rollback path are in the ticket, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → tick `[GITHUB_USER]` only.
2. Open the **X members selected...** dropdown (B-06); its count must read 1.
3. Use its change-role control and pick Owner [unconfirmed: check in the GitHub UI: the control's label and the role names it offers].

```bash
# HUMAN-RUN read-only read-back, the role must now read admin
node scripts/adapters/github-client.js membership --user [GITHUB_USER] --execute
```

**Verification checkpoint:** [ ] the `membership` read shows the new role · [ ] the owners count is at the floor or the ticket says why not.

## Phase D: Outside collaborators and pending invitations (R0 here)

**Purpose:** every outside collaborator and every pending invitation has a ticket; the rest go to the runbook that owns the change.

1. For each outside collaborator from Phase A: find the ticket that granted the access. No ticket: remove the access with `/github-repo-access` (Phase E, one repository at a time) or, for every repository at once, `/github-offboard-member` (Phase F).
2. For each pending invitation from Phase A: no ticket, or older than the org allows **[org gap: the invitation age limit]**: revoke it with `/github-offboard-member` (Phase C).
3. Write each decision in the ticket. Nothing changes in this phase.

**Verification checkpoint:** [ ] every outside collaborator and invitation has a ticket or a routed change.

## Phase E: SAML SSO (Enterprise Cloud, read and plan)

**Purpose:** know whether people sign in to the organization through the identity provider.

1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Settings → (Security) Authentication security → read the SAML single sign-on section [unconfirmed: check in the GitHub UI: the section and its enforcement setting].
2. Read `sso-authorizations` (below): it lists the credentials people authorized for SSO, not whether SSO is on (G-27). An empty list does not prove SSO is off.

```bash
# HUMAN-RUN read-only, Enterprise Cloud and an owner token, the credentials authorized for SAML SSO
node scripts/adapters/github-client.js sso-authorizations --execute
```

> **PREVIEW ONLY [github-org-security-saml-preview]:** Planning only; nothing here authorizes a settings change. Setting up or enforcing SAML SSO is a multi-system change with the identity provider **[org gap: Okta or another]**: everyone without a linked identity is affected [unconfirmed: check in the GitHub UI: what enforcement does to them]. It needs its own reviewed change with the identity side (`/okta-app-assignment`), an independent out-of-session review, and a rollback path before step 1.

## Phase F: Audit log (read)

**Purpose:** evidence for the review, and the read-back other GitHub runbooks cite.

1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Settings → (Archive) Logs → Audit log (B-11) → search for the event the ticket asks about.
2. Enterprise Cloud: the connector reads the same log through the API (G-18).

```bash
# HUMAN-RUN read-only, Enterprise Cloud and an owner token, the most recent member removals
node scripts/adapters/github-client.js audit-log --phrase "action:org.remove_member" --execute
```

```bash
# HUMAN-RUN read-only, the same search with gh, the parameter needs -X GET
gh api -X GET orgs/[@Aegion_GITHUB_ORG]/audit-log -f phrase='action:org.remove_member'
```

**Verification checkpoint:** [ ] the events the review relies on are cited in the ticket by time and action.

## ⚠️ Risk warning

- **The 2FA requirement removes people the moment it is saved.** Get the count to 0 first; every removal needs a re-invitation to undo.
- **Never turn the requirement off to let someone back in.** That weakens a security control for everyone (R3) and re-adds nobody.
- **Fewer than 2 owners is a lockout risk;** many owners is a blast-radius risk. Every owner needs a ticket.
- **An owner token reads more than it should need.** Keep it read-only and fine-grained, export it for the review, and unset it after.
- **An empty SSO authorization list proves nothing about whether SSO is on.** The GUI setting is the proof.

## ✅ Verification checklist

- [ ] Phase A scorecard and saved reads are in the ticket.
- [ ] 2FA requirement: `verify-2fa-required` exits 0; `members --filter 2fa_disabled` lists nobody; every removed login is in the ticket.
- [ ] Owner role taken away: `membership` reads member; the owners list is one shorter and at or above the floor.
- [ ] Owner role granted: `membership` reads admin; approval and rollback path were in the ticket first.
- [ ] Outside collaborators and invitations: each has a ticket or a routed change.
- [ ] Enterprise Cloud: SAML SSO read in the GUI; audit log events cited.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed, only when every read-back passed] GitHub organization `[@Aegion_GITHUB_ORG]` posture review on [date]: 2FA required [yes/no], members without 2FA [N], owners [N], outside collaborators [N] ([N] without a ticket), pending invitations [N], SAML SSO [state], audit log [readable / not Enterprise Cloud]. Changed: [2FA requirement turned on, [MEMBER_COUNT] members removed after review / owner role taken from `[GITHUB_USER]` / owner role granted to `[GITHUB_USER]`] by [ADMIN_NAME], confirmed by the exact phrase. Pre-state saved to `tasks/checkpoints/`. Read-back: [verify-2fa-required exited 0 / membership reads (role)] at [time]. Routed: [changes sent to /github-repo-access or /github-offboard-member]. Time spent: [X] min.
>
> [Partial state, keep open] Verified: [what passed]. Pending: [people still without 2FA before the date / a read-back failed / a routed change not done]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

The 2FA requirement is a switch that removes people, not a policy that nags them. Running it when the "without 2FA" list is already empty turns a mass removal into a no-op.

## Career upgrade

A posture scorecard with a target, a reading and a routed fix for each line is how security and IT leads report to an auditor; it is the shape of SOC 2 and ISO 27001 access reviews.

## Next action

Run Phase A with an owner's read-only token, fill the scorecard in the ticket, and start with the 2FA line.

**Sources (checked 2026-10-28, batch G3 vendor facts, `docs/aegis/g3/vendor-facts.md`):** docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization (B-05) · docs.github.com/en/organizations/managing-membership-in-your-organization/removing-a-member-from-your-organization (B-06) · docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization (B-11, G-18) · docs.github.com/en/rest/orgs/members (G-01, G-02, G-03) · docs.github.com/en/rest/orgs/orgs and its enterprise-cloud@latest edition (G-14, G-16, G-17, G-27) · docs.github.com/en/rest/orgs/outside-collaborators (G-07) · docs.github.com/en/rest/authentication/authenticating-to-the-rest-api (G-30) · cli.github.com/manual/gh_api (B-12, B-13). A label marked [unconfirmed: check in the GitHub UI] was not on these pages.
