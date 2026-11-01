---
description: Take a departing person out of the GitHub organization [@Aegion_GITHUB_ORG] - read membership, owner status, teams, outside-collaborator access, pending invitations and the repositories and forks that depend on them, then convert to outside collaborator (R2) or remove from the organization (R3, part of /offboard with independent review), revoke a pending invitation (R1), or remove an outside collaborator from every repository (R3). Each change is a human step behind its own exact-phrase gate, proved by verify-offboarded. Placeholders only.
disable-model-invocation: true
---

# /github-offboard-member

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[GITHUB_USER]` (the departing person's GitHub login) · `[FIRST_NAME]` `[LAST_NAME]` / `[UPN]` (the same person in the identity systems, for the `/offboard` plan only, never typed into GitHub) · `[REPO_NAME]` (one repository in `[@Aegion_GITHUB_ORG]`) · `[TEAM_SLUG]` (a team's slug) · `[JIRA-###]` or `[ISSUE_ID]` (the ticket) · `[ADMIN_NAME]` · `[NOT_BEFORE]` (the time noted just before a removal, for the audit log read) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3 and that has a read-back named for it below, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `github:verify-offboarded`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`). A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names.

## ⚠️ Admin / safety gate

- **Removing a member from the organization is R3.** They lose every repository and team at once. An offboarding spans systems (identity, mail, devices, GitHub), so this step belongs with `/offboard` and runs after its independent out-of-session review, with the Phase A pre-state saved to `tasks/checkpoints/` and the rollback path written before step 1.
- **Converting a member to an outside collaborator is R2:** they leave the organization's member list and keep only repository access [unconfirmed: check in the GitHub UI: exactly which access the conversion keeps]. Save the pre-state first.
- **Revoking a pending invitation is R1;** the undo is a new invitation.
- **Removing an outside collaborator from every repository is R3** in an offboarding (all access at once). Up to 10 repositories can instead go one at a time through `/github-repo-access` (R2 each).
- Every change has its own exact phrase; "yes" is never a confirmation; "they already left, just do it" never skips a gate (SR-2). Not done until `verify-offboarded` and the GUI read-back pass.
- UI paths come from GitHub's docs pages read on 2026-10-28 (B-06, B-07). A label marked [unconfirmed: check in the GitHub UI] was not on those pages: confirm it on screen, and stop if it differs.

## Inputs needed

- `[GITHUB_USER]` and the `/offboard` ticket it belongs to; the leave date; whether this is an involuntary termination (then GitHub goes in the containment step of `/offboard`, before the person is told).
- The outcome: a leaver (remove), or someone who keeps named repositories as a contractor (convert), with the list of repositories and the owner's approval.
- Whether `[@Aegion]` signs people in to GitHub through an identity provider. **[org gap: Okta SAML for GitHub, yes or no]** If yes, the identity side runs in `/okta-user-lifecycle` as part of `/offboard`; the GitHub side is still proved here.
- For the connector: `GITHUB_ORG` is `[@Aegion_GITHUB_ORG]`; `GITHUB_TOKEN` holds a read-only fine-grained token with "Members" organization permission (read) for membership, teams, outside collaborators and invitations (G-01, G-03, G-05, G-07), and "Metadata" repository permission (read) for `permission` and `collaborators` (G-08, G-09). The audit log read needs an owner's token on Enterprise Cloud (G-17, G-18). The connector refuses a classic token that holds any write scope.

## How leaving works in GitHub

- **Membership:** the `membership` read shows state (active or pending) and role (admin, member or billing_manager) (G-03). A pending state means an invitation was never accepted.
- **`verify-offboarded`** passes only when the person is not a member, has no pending invitation, and is not an outside collaborator. After a conversion it does not pass, and says the person is now an outside collaborator: that is the conversion's proof.
- **Teams:** the team members read includes child-team members (G-06); removal from the organization takes the person out of every team.
- **Forks and repositories:** what happens to the person's forks of private repositories when they leave is [unconfirmed: check in the GitHub UI]. Phase A records them so the repository owner can decide before removal.
- **Reinstatement:** whether GitHub can restore a former member's earlier access, and for how long, is [unconfirmed: check in the GitHub UI]. Plan for a fresh invitation.

## Fast path

1. Phase A: read membership, owner status, teams, outside-collaborator access, invitations, repositories and forks (R0). Save it to `tasks/checkpoints/`.
2. Phase B: decide, in the ticket: revoke an invitation, convert, remove, or remove an outside collaborator.
3. Invitation never accepted: Phase C (R1).
4. Contractor who stays on named repositories: Phase D (R2).
5. Leaver: Phase E (R3, inside `/offboard`, after review). **WAIT UNTIL** People no longer lists them.
6. Outside collaborator leaving: Phase F (R3), or `/github-repo-access` per repository.
7. Every path ends with `verify-offboarded` (or, for a conversion, its expected "outside collaborator" answer).

## Phase A: Read everything the person touches (R0)

**Purpose:** the pre-state a reinstatement would need, and the stops that must clear before removal.

1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → find `[GITHUB_USER]` → read the role and the teams shown [unconfirmed: check in the GitHub UI: what the member's page lists] (B-06).
2. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → Outside collaborators → is `[GITHUB_USER]` listed? [unconfirmed: check in the GitHub UI: the tab's label]
3. For each repository the ticket or the manager names: github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams → read the person's role and whether they are the only admin (B-01).
4. Forks: for each private repository on the list, read its forks list and note any fork owned by `[GITHUB_USER]` [unconfirmed: check in the GitHub UI: where the forks list shows]. Work that lives only in a fork goes to the repository owner before removal.
5. Write in the ticket and save to `tasks/checkpoints/`: role, state, teams, outside-collaborator status, pending invitation, repositories with role, forks, and whether the person is an owner.

<details>
<summary>GitHub connector and gh api: the read-only scale version (HUMAN-RUN; Aegis may run the same reads)</summary>

```bash
# HUMAN-RUN read-only. GITHUB_ORG and GITHUB_TOKEN are exported in this shell first, and the token is never pasted into a ticket
# state active or pending, role admin, member or billing_manager
node scripts/adapters/github-client.js membership --user [GITHUB_USER] --execute
# the owners, needed when the person is one, then the next page with --page 2 for as long as a page comes back full
node scripts/adapters/github-client.js members --role admin --execute
# the teams, then the members of each team to find the person, child teams included
node scripts/adapters/github-client.js teams --execute
node scripts/adapters/github-client.js team-members --team [TEAM_SLUG] --execute
# is the person an outside collaborator
node scripts/adapters/github-client.js outside-collaborators --execute
# is there a pending invitation for the person
node scripts/adapters/github-client.js invitations --execute
# the person's role on one repository, read role_name, repeat per repository on the list
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
# the repository's direct collaborators, to see whether another admin exists
node scripts/adapters/github-client.js collaborators --repo [REPO_NAME] --affiliation direct --execute
```

```bash
# HUMAN-RUN read-only, the same reads with gh signed in to an account that can read the organization
# the person's membership
gh api orgs/[@Aegion_GITHUB_ORG]/memberships/[GITHUB_USER]
# every team, every page
gh api --paginate orgs/[@Aegion_GITHUB_ORG]/teams
# outside collaborators, every page
gh api --paginate orgs/[@Aegion_GITHUB_ORG]/outside_collaborators
# one repository's role for the person
gh api repos/[@Aegion_GITHUB_ORG]/[REPO_NAME]/collaborators/[GITHUB_USER]/permission
```
</details>

**Stop if:**
- the person is an owner and Phase A shows 2 owners or fewer: grant another owner first with `/github-org-security` (Phase C, R3);
- the person is the only admin of a repository on the list: give another person admin first with `/github-repo-access` (Phase C, R3);
- a fork holds work nobody else has, and the repository owner has not decided;
- the `membership` read already shows no membership and `verify-offboarded` already passes (nothing to remove: write that in the ticket).

**Verification checkpoint:** [ ] the Phase A pre-state is in the ticket and saved to `tasks/checkpoints/` · [ ] every stop above is cleared or the ticket says why it does not apply.

## Phase B: Decide the path (R0)

Write one line in the ticket before any gate:

- **Pending invitation, never accepted:** Phase C.
- **Member who keeps named repositories** (a contractor, with the owner's approval and an end date): Phase D, then `/github-repo-access` to trim each repository to what the ticket names.
- **Member who leaves:** Phase E, inside `/offboard`, after its independent review.
- **Outside collaborator who leaves:** Phase F, or `/github-repo-access` Phase E for each repository when there are 10 or fewer.

## Phase C: Revoke a pending invitation (R1)

**Stop if:** the Phase A `invitations` read does not list `[GITHUB_USER]` (nothing to revoke).

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-offboard-member-revoke-invitation-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** revoke the pending invitation of [GITHUB_USER] to [@Aegion_GITHUB_ORG]
- **Scope:** one pending invitation; nothing else the person has is touched
- **Reversibility:** R1: undo is a new invitation, planned in [github-offboard-member-reinstate-preview]
- **Required confirmation:** Type exactly `REVOKE PENDING INVITATION OF [GITHUB_USER] TO [@Aegion_GITHUB_ORG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [github-offboard-member-revoke-invitation-portal]:** Only after the Phase A `invitations` read lists the person and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → the pending invitations list → the invitation for `[GITHUB_USER]` → its cancel control [unconfirmed: check in the GitHub UI: the list's location and the control's label].

```bash
# HUMAN-RUN read-only read-back, passes when the person is not a member, has no pending invitation and is not an outside collaborator
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER] --execute
```

**Verification checkpoint:** [ ] `verify-offboarded` exits 0 · [ ] the invitations list no longer shows the person.

## Phase D: Convert a member to an outside collaborator (R2)

**Purpose:** a person who stops being a member but keeps the repositories the ticket names.

**Stop if:** the Phase A `membership` read does not show state active (there is no member to convert); the owner's approval, the repository list and an end date are not in the ticket; the person is an owner (take the role away first with `/github-org-security` Phase C).

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-offboard-member-convert-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** convert one organization member to an outside collaborator
- **Scope:** one person; they leave the member list and teams, and keep repository access as an outside collaborator [unconfirmed: check in the GitHub UI: exactly which repositories and roles they keep]
- **Reversibility:** R2: back to member is a new invitation and the saved teams, planned in [github-offboard-member-reinstate-preview]; removal at the end date is [github-offboard-member-remove-outside-portal]
- **Required confirmation:** Type exactly `CONVERT [GITHUB_USER] TO OUTSIDE COLLABORATOR IN [@Aegion_GITHUB_ORG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute`
**PORTAL ACTION [github-offboard-member-convert-portal]:** Only after the Phase A pre-state is saved to `tasks/checkpoints/`, the approval, repository list and end date are in the ticket, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → tick `[GITHUB_USER]` only.
2. Open the **X members selected...** dropdown (B-07); its count must read 1.
3. Click **Convert to outside collaborator** (B-07), then confirm.

```bash
# HUMAN-RUN read-only read-back, must NOT pass: it must say the person is now an outside collaborator, which proves the conversion
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute
# each kept repository, the role must match the ticket, repeat per repository
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
```

**Verification checkpoint:** [ ] `verify-offboarded` exits 2 with the reason "now an outside collaborator", the answer a conversion expects: any exit other than 2 with that reason, exit 5 (INCONCLUSIVE: proves nothing either way) among them, does not prove the conversion · [ ] each kept repository shows the role the ticket names; anything more is trimmed with `/github-repo-access` · [ ] the end date is on the ticket for Phase F.

## Phase E: Remove a member from the organization (R3, inside /offboard)

**Purpose:** a leaver loses every repository and team at once.

**Before the gate:** the Phase A pre-state is saved to `tasks/checkpoints/`; every Phase A stop is cleared; the `/offboard` plan and its independent out-of-session review cite this step; the rollback path is written in the ticket ([github-offboard-member-reinstate-preview]); `[NOT_BEFORE]` is noted.

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-offboard-member-remove-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** remove one member from [@Aegion_GITHUB_ORG]
- **Scope:** one person; every team, every repository they reached through the organization, and their member role go at once; what happens to their forks is [unconfirmed: check in the GitHub UI]
- **Reversibility:** R3 (account removal): no one-click undo; the way back is a new invitation and the teams and roles saved in tasks/checkpoints/, planned in [github-offboard-member-reinstate-preview]
- **Required confirmation:** Type exactly `REMOVE [GITHUB_USER] FROM ORGANIZATION [@Aegion_GITHUB_ORG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute`
**PORTAL ACTION [github-offboard-member-remove-portal]:** Only after the independent review, the saved pre-state, the written rollback path, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → tick `[GITHUB_USER]` only.
2. Open the **X members selected...** dropdown (B-06); its count must read 1, and any other number means stop.
3. Click **Remove from organization**, then click **Remove members** (B-06).

**WAIT UNTIL** People no longer lists `[GITHUB_USER]`.

```bash
# HUMAN-RUN read-only read-back, passes only when the person is not a member, has no pending invitation and is not an outside collaborator
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute
# Enterprise Cloud with an owner token, the removal event, it must be dated after NOT_BEFORE
node scripts/adapters/github-client.js audit-log --phrase "action:org.remove_member" --execute
```

**Verification checkpoint:** [ ] `verify-offboarded` exits 0 · [ ] on Enterprise Cloud, the audit log shows the removal after `[NOT_BEFORE]` · [ ] the `/offboard` ticket records the GitHub step as done.

## Phase F: Remove an outside collaborator from every repository (R3)

**Purpose:** a contractor's end date, or an outside collaborator who leaves.

**Stop if:** the Phase A `outside-collaborators` read does not list `[GITHUB_USER]` (nothing to remove here).

**Before the gate:** the Phase A `outside-collaborators` read and each repository's role are saved to `tasks/checkpoints/`; the rollback path is written in the ticket; when part of `/offboard`, its independent review covers this step. Ten or fewer repositories: prefer `/github-repo-access` Phase E, one repository at a time (R2 each).

**Role needed:** organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-offboard-member-remove-outside-portal] -->
- **Target:** [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** remove one outside collaborator from every repository in [@Aegion_GITHUB_ORG]
- **Scope:** one person; every repository they reach in the organization, all at once
- **Reversibility:** R3: no one-click undo; the way back is re-adding each repository from tasks/checkpoints/ under `/github-repo-access`, planned in [github-offboard-member-reinstate-preview]
- **Required confirmation:** Type exactly `REMOVE OUTSIDE COLLABORATOR [GITHUB_USER] FROM ALL REPOSITORIES IN [@Aegion_GITHUB_ORG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute`
**PORTAL ACTION [github-offboard-member-remove-outside-portal]:** Only after the saved pre-state, the written rollback path, the review when part of `/offboard`, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → Outside collaborators → `[GITHUB_USER]` → the control that removes them from every repository, then confirm [unconfirmed: check in the GitHub UI: the tab, the control and its dialog].

```bash
# HUMAN-RUN read-only read-back, passes only when the person is not a member, has no pending invitation and is not an outside collaborator
node scripts/adapters/github-client.js verify-offboarded --user [GITHUB_USER] --change [CHANGE_ID] --execute
```

**Verification checkpoint:** [ ] `verify-offboarded` exits 0 · [ ] the outside collaborator list no longer shows the person.

> **PREVIEW ONLY [github-offboard-member-reinstate-preview]:** Planning only; nothing here authorizes an invitation or an access change. The way back from Phases C to F is a new organization invitation (or a new collaborator invitation per repository through `/github-repo-access`), followed by the teams and roles saved in `tasks/checkpoints/`. The invitation path was not in the pages read, and whether GitHub can reinstate a former member's earlier access is [unconfirmed: check in the GitHub UI]. A reinstatement is its own ticket with the owner's approval.

## ⚠️ Risk warning

- **Removal is all at once.** Every team and repository goes in one click; the saved Phase A pre-state is the only map back.
- **The last owner and the only repository admin are stops,** not warnings: fix them first, or the organization or a repository is left without anyone who can manage it.
- **Forks may hold the only copy of someone's work.** The repository owner decides before removal.
- **Conversion is not offboarding.** An outside collaborator still reaches code; `verify-offboarded` says so until Phase F runs.
- **GitHub is one system of several.** The identity, mail and device steps live in `/offboard`; this runbook proves only the GitHub side.

## ✅ Verification checklist

- [ ] Phase A pre-state is in the ticket and saved to `tasks/checkpoints/`; every stop is cleared.
- [ ] Invitation revoked: `verify-offboarded` exits 0.
- [ ] Converted: `verify-offboarded` exits 2 saying "now an outside collaborator" (any exit other than 2 with that reason, exit 5 INCONCLUSIVE among them, does not prove it); each kept repository's role matches the ticket.
- [ ] Removed from the organization: `verify-offboarded` exits 0; People no longer lists the person; on Enterprise Cloud the audit log shows the removal after `[NOT_BEFORE]`.
- [ ] Outside collaborator removed: `verify-offboarded` exits 0.
- [ ] The `/offboard` ticket records the GitHub step and its read-back.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed, only when every read-back passed] GitHub `[@Aegion_GITHUB_ORG]`, `[GITHUB_USER]` (offboarding [JIRA-###]): [revoked the pending invitation / converted to outside collaborator, keeping (repositories) until (end date) / removed from the organization after independent review / removed as outside collaborator from every repository] on [date/time] by [ADMIN_NAME], confirmed by the exact phrase. Pre-state saved to `tasks/checkpoints/`: role [role], [N] teams, [N] repositories, [N] forks (owner decision: [decision]). Read-back: `verify-offboarded` [exited 0 / exited 2, outside collaborator, as expected for a conversion] at [time]; audit log [removal event at (time) / not Enterprise Cloud]. Time spent: [X] min.
>
> [Partial state, keep open] Verified: [what passed]. Pending: [a stop not cleared / the review not done / a read-back failed]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

"Removed from the organization" and "can no longer reach the code" are different claims. `verify-offboarded` checks three lists (members, invitations, outside collaborators) because a person can drop off one and still be on another.

## Career upgrade

Proving a leaver is gone from every access path, not just the one you clicked, is the joiner-mover-leaver control that identity governance and SOC 2 audits sample first.

## Next action

Run Phase A for `[GITHUB_USER]`, save the pre-state, clear the stops, and write the Phase B decision in the `/offboard` ticket.

**Sources (checked 2026-10-28, batch G3 vendor facts, `docs/aegis/g3/vendor-facts.md`):** docs.github.com/en/organizations/managing-membership-in-your-organization/removing-a-member-from-your-organization (B-06) · docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-outside-collaborators/converting-an-organization-member-to-an-outside-collaborator (B-07) · docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository (B-01) · docs.github.com/en/rest/orgs/members (G-01, G-03) · docs.github.com/en/rest/orgs/outside-collaborators (G-07) · docs.github.com/en/rest/teams/members (G-06) · docs.github.com/en/rest/collaborators/collaborators (G-08, G-09) · docs.github.com/en/enterprise-cloud@latest/rest/orgs/orgs (G-17, G-18) · cli.github.com/manual/gh_api (B-12, B-13). A label marked [unconfirmed: check in the GitHub UI] was not on these pages.
