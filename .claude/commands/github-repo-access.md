---
description: GitHub repository access for one person or one team (add a collaborator with read, triage or write as R1, maintain or admin as R3, change a role, remove a direct collaborator as R2, give a team access, add a person to a team or take them out). Every change is a human step behind its own exact-phrase gate, proved by the read-only GitHub connector. Placeholders only.
disable-model-invocation: true
---

# /github-repo-access

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[GITHUB_USER]` (the person's GitHub login) · `[REPO_NAME]` (one repository in `[@Aegion_GITHUB_ORG]`, its name only) · `[TEAM_SLUG]` (a team's slug) · `[ROLE_NAME]` (a repository role exactly as GitHub writes it: read, triage, write, maintain or admin) · `[MEMBER_COUNT]` (a team's member count, recorded in Phase A) · `[JIRA-###]` or `[ISSUE_ID]` (the ticket) · `[ADMIN_NAME]` · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `github:verify-collaborator`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`).

## ⚠️ Admin / safety gate

- Eight changes, eight gates. **Add a person with read, triage or write** is R1. **Maintain or admin** for a person is R3 (a privilege grant). **Change a role** to read, triage or write is R1, and R2 when the current role is maintain or admin. **Remove a direct collaborator** is R2.
- **Give a team access** is R2 (every member gets it at once), and R3 when the role is maintain or admin or the team has more than 10 members (SR-2 mass operation). **Take a team's access away** is R2.
- **Add a person to a team** is R1; **take them out of a team** is R2.
- R2 and R3 save the Phase A reads to `tasks/checkpoints/` before the gate. R3 also writes the rollback path in the ticket before step 1, and gets an independent out-of-session review when it is part of a multi-system plan.
- Every change has its own exact phrase. A phrase never carries into a later phase; "yes" is never a confirmation. Urgency or authority ("the release is blocked", "the CTO asked") never skips a gate (SR-2).
- Not done until the connector read-back and the GUI read-back both pass.
- UI labels come from GitHub's docs pages read on 2026-10-28. A label marked [unconfirmed: check in the GitHub UI] was not on those pages: confirm it on screen, and stop if it differs.

## Inputs needed

- `[GITHUB_USER]` or `[TEAM_SLUG]`, `[REPO_NAME]` and the `[ROLE_NAME]` the ticket asks for.
- The repository owner's approval in the ticket **[org gap: who owns each repository]**.
- For maintain or admin: the reason and how long the role is needed.
- For the connector: `GITHUB_ORG` is `[@Aegion_GITHUB_ORG]` and `GITHUB_TOKEN` holds a read-only fine-grained token with "Metadata" repository permission (read) for `collaborators` and `permission`, and "Members" organization permission (read) for `membership`, `teams` and `team-members` (G-01, G-03, G-05, G-08, G-09). Its owner needs write, maintain or admin on `[REPO_NAME]` to list collaborators (G-08). The connector refuses a classic token that holds any write scope.

## How access works

- **Five roles:** read, triage, write, maintain, admin. The `permission` read prints `role_name`, the real role. Its `permission` field is the older base role, where maintain shows as write and triage as read (G-09): always read `role_name`.
- **Two routes in:** a direct grant, or a team. `permission` shows the role the person ends up with. `collaborators --affiliation direct` shows direct grants only.
- **`verify-collaborator-removed` proves only the direct grant is gone.** Access through a team stays until Phase G takes the person out of that team.
- **Team lists include child teams:** the team members read lists members of child teams too (G-06). A person in a child team stays listed for the parent.
- **Someone outside `[@Aegion_GITHUB_ORG]`** added to a repository becomes an outside collaborator [unconfirmed: check in the GitHub UI]. Whether the org allows that is **[org gap: the outside collaborator policy]**.
- **The connector is read only.** Without `--execute` it prints the planned GET and sends nothing. Each `verify-*` read prints verified true or false: exit 0 verified, exit 2 not verified. A `verify-*` without `--execute` exits 4 and prints NOT VERIFIED: a dry run proves nothing.

## Fast path

1. Phase A: read the person's membership, role and teams (R0). Save the reads to `tasks/checkpoints/` for R2 and R3.
2. New person, read, triage or write: Phase B (R1). **WAIT UNTIL** any invitation is accepted.
3. Maintain or admin: Phase C (R3, approval and rollback path first).
4. Role change: Phase D. Removal: Phase E (R2).
5. A team on the repository: Phase F. A person on a team: Phase G.

## Phase A: Read the current access (R0)

**Purpose:** know the role, the route (direct or team) and the team list before anything changes.

1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams → read whether `[GITHUB_USER]` or `[TEAM_SLUG]` is listed, and with which role (B-01, B-02).
2. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → People → find `[GITHUB_USER]` → read whether they are a member (B-06).
3. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Teams → `[TEAM_SLUG]` → read the members and the repositories [unconfirmed: check in the GitHub UI: the Teams tab and its member and repository lists].
4. Write in the ticket: the `role_name` (or none), the route (direct, or which team), the membership state, and for a team its `[MEMBER_COUNT]`.

<details>
<summary>GitHub connector and gh api: the read-only scale version (HUMAN-RUN; Aegis may run the same reads)</summary>

```bash
# HUMAN-RUN read-only. GITHUB_ORG and GITHUB_TOKEN are exported in this shell first, and the token is never pasted into a ticket
# without --execute each line prints the planned GET and sends nothing
# the person's membership: state active or pending, role admin, member or billing_manager
node scripts/adapters/github-client.js membership --user [GITHUB_USER] --execute
# the role the person ends up with on the repository, read role_name
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
# direct collaborators only, then the next page with --page 2 for as long as a page comes back full
node scripts/adapters/github-client.js collaborators --repo [REPO_NAME] --affiliation direct --execute
# everyone who reaches the repository, directly or through a team
node scripts/adapters/github-client.js collaborators --repo [REPO_NAME] --affiliation all --execute
# the teams in the organization
node scripts/adapters/github-client.js teams --execute
# the members of one team, child teams included, count them for MEMBER_COUNT
node scripts/adapters/github-client.js team-members --team [TEAM_SLUG] --execute
```

```bash
# HUMAN-RUN read-only, the same reads with gh signed in to an account that can read the repository
# every collaborator of the repository, every page
gh api --paginate repos/[@Aegion_GITHUB_ORG]/[REPO_NAME]/collaborators
# one person's role on the repository, read role_name
gh api repos/[@Aegion_GITHUB_ORG]/[REPO_NAME]/collaborators/[GITHUB_USER]/permission
# the person's membership in the organization
gh api orgs/[@Aegion_GITHUB_ORG]/memberships/[GITHUB_USER]
# the members of one team, every page
gh api --paginate orgs/[@Aegion_GITHUB_ORG]/teams/[TEAM_SLUG]/members
```
</details>

**Stop if:** a later phase's end state is already what Phase A shows (the read-back would then pass with nothing changed); the ticket has no owner approval.

**Verification checkpoint:** [ ] `role_name`, route and membership state are in the ticket · [ ] for a team, `[MEMBER_COUNT]` is in the ticket · [ ] for R2 and R3, the reads are saved to `tasks/checkpoints/`.

## Phase B: Add one person with read, triage or write (R1)

**Purpose:** one direct grant at the lowest role that does the job.

**Stop if:** `[ROLE_NAME]` is maintain or admin (Phase C); the Phase A `permission` read already shows `[ROLE_NAME]`; the person is not a member and the ticket does not approve an outside collaborator.

**Role needed:** repository admin on `[REPO_NAME]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-add-portal] -->
- **Target:** [GITHUB_USER] on [REPO_NAME]
- **Effect:** add one person to one repository as a direct collaborator with the read, triage or write role
- **Scope:** one person, one repository, the role [ROLE_NAME] only; other repositories and teams are untouched
- **Reversibility:** R1: undo is removing the direct grant under [github-repo-access-remove-portal]; code the person already read or cloned stays with them
- **Required confirmation:** Type exactly `ADD [GITHUB_USER] TO [REPO_NAME] AS [ROLE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-add-portal]:** Only after the Phase A reads are in the ticket, `[ROLE_NAME]` is read, triage or write, and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. Click **Add people** → choose `[GITHUB_USER]`.
3. Under "Choose a role", pick `[ROLE_NAME]` → click **Add [GITHUB_USER] to [REPO_NAME]** (B-01).

**WAIT UNTIL** the person accepts the invitation, when GitHub sends one [unconfirmed: check in the GitHub UI: whether this add sends an invitation, and how long it stays open]. Until then the read-back cannot pass.

```bash
# HUMAN-RUN read-only read-back, passes only when role_name on the repository is the role just granted
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role [ROLE_NAME] --execute
```

**Verification checkpoint:** [ ] `verify-collaborator` exits 0 · [ ] Collaborators & teams lists `[GITHUB_USER]` with `[ROLE_NAME]`.

## Phase C: Grant maintain or admin (R3)

**Purpose:** a privilege grant, made only with the owner's written approval and a rollback path.

**Before the gate:** save the Phase A reads to `tasks/checkpoints/`; write in the ticket the approval, the end date, and the rollback path (lower the role under [github-repo-access-change-role-portal] to the Phase A role, or remove under [github-repo-access-remove-portal] when Phase A showed no access).

**Stop if:** the Phase A `permission` read already shows `[ROLE_NAME]`; there is no written approval.

**Role needed:** repository admin on `[REPO_NAME]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-grant-portal] -->
- **Target:** [GITHUB_USER] on [REPO_NAME]
- **Effect:** grant one person the maintain or admin role on one repository
- **Scope:** one person, one repository; [ROLE_NAME] is maintain or admin; covers a new collaborator and raising an existing direct collaborator
- **Reversibility:** R3 (privilege grant): the rollback path is written before step 1: [github-repo-access-change-role-portal] back to the Phase A role, or [github-repo-access-remove-portal] when Phase A showed no access; changes the person makes while holding the role are not undone by either
- **Required confirmation:** Type exactly `GRANT [ROLE_NAME] ON [REPO_NAME] TO [GITHUB_USER]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-grant-portal]:** Only after the pre-state is saved, the approval and rollback path are in the ticket, and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. **New collaborator:** Click **Add people** → choose `[GITHUB_USER]` → under "Choose a role", pick `[ROLE_NAME]` → click **Add [GITHUB_USER] to [REPO_NAME]** (B-01).
3. **Existing direct collaborator:** next to `[GITHUB_USER]`, open the Role dropdown → pick `[ROLE_NAME]` (B-02).

**WAIT UNTIL** a new collaborator accepts the invitation, when GitHub sends one [unconfirmed: check in the GitHub UI].

```bash
# HUMAN-RUN read-only read-back, passes only when role_name is maintain or admin as granted
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role [ROLE_NAME] --change [CHANGE_ID] --execute
```

**Verification checkpoint:** [ ] `verify-collaborator` exits 0 · [ ] the approval, end date and rollback path are in the ticket.

## Phase D: Change a role (R1; R2 when the current role is maintain or admin)

**Purpose:** move a direct collaborator to read, triage or write. Raising anyone to maintain or admin is Phase C.

**Stop if:** `[ROLE_NAME]` is maintain or admin (Phase C); the Phase A `permission` read already shows `[ROLE_NAME]`; Phase A's direct list does not show the person (the role comes from a team: change the team's grant in Phase F, or the membership in Phase G).

**Role needed:** repository admin on `[REPO_NAME]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-change-role-portal] -->
- **Target:** [GITHUB_USER] on [REPO_NAME]
- **Effect:** change one direct collaborator's role on one repository to read, triage or write
- **Scope:** one person, one repository, the new role [ROLE_NAME]; access through a team is not touched
- **Reversibility:** R1 when the Phase A role was read, triage or write: undo is [github-repo-access-change-role-portal] again with the Phase A role; R2 when the Phase A role was maintain or admin: the Phase A reads are saved to tasks/checkpoints/ first, and the undo is [github-repo-access-grant-portal]
- **Required confirmation:** Type exactly `CHANGE ROLE OF [GITHUB_USER] ON [REPO_NAME] TO [ROLE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-change-role-portal]:** Only after the Phase A role is in the ticket (and saved to `tasks/checkpoints/` when it was maintain or admin) and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. Next to `[GITHUB_USER]`, open the Role dropdown → pick `[ROLE_NAME]` (B-02).

```bash
# HUMAN-RUN read-only read-back, passes only when role_name is the new role
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role [ROLE_NAME] --execute
```

**Verification checkpoint:** [ ] `verify-collaborator` exits 0 · [ ] the old and new roles are in the ticket.

## Phase E: Remove one direct collaborator (R2)

**Purpose:** take one direct grant away; the Phase A role is the way back.

**Stop if:** Phase A's direct list does not show `[GITHUB_USER]` (the read-back would pass with nothing removed; team access is Phase G); the Phase A reads are not saved to `tasks/checkpoints/`.

**Role needed:** repository admin on `[REPO_NAME]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-remove-portal] -->
- **Target:** [GITHUB_USER] on [REPO_NAME]
- **Effect:** remove one direct collaborator from one repository
- **Scope:** one person, one repository, the direct grant only; access through a team stays until Phase G; code the person already cloned stays with them
- **Reversibility:** R2: re-add with the role saved in tasks/checkpoints/, under [github-repo-access-add-portal] for read, triage or write, or [github-repo-access-grant-portal] for maintain or admin
- **Required confirmation:** Type exactly `REMOVE [GITHUB_USER] FROM [REPO_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-remove-portal]:** Only after the Phase A reads are saved to `tasks/checkpoints/` and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. Next to `[GITHUB_USER]`, use the remove control, then confirm [unconfirmed: check in the GitHub UI: the control's label and its confirmation dialog].

```bash
# HUMAN-RUN read-only read-back, passes only when the person is no longer a direct collaborator
node scripts/adapters/github-client.js verify-collaborator-removed --repo [REPO_NAME] --user [GITHUB_USER] --change [CHANGE_ID] --execute
# what is left: role_name through a team, or no role at all
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
```

**Verification checkpoint:** [ ] `verify-collaborator-removed` exits 0 · [ ] the `permission` read shows what a team still grants, written in the ticket.

## Phase F: A team on the repository (R2; R3 for maintain or admin, or more than 10 members)

**Purpose:** give or take a team's access in one change. The member count is the blast radius.

**Before either gate:** the Phase A `team-members` read is saved to `tasks/checkpoints/` with `[MEMBER_COUNT]`. A count over 10, or maintain or admin, makes the grant R3: the rollback path is written in the ticket before step 1.

**Role needed:** repository admin on `[REPO_NAME]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-team-grant-portal] -->
- **Target:** [TEAM_SLUG] on [REPO_NAME]
- **Effect:** grant one team the role [ROLE_NAME] on one repository
- **Scope:** every current member of the team, [MEMBER_COUNT] people at Phase A including child-team members, and anyone who joins the team later
- **Reversibility:** R2 for read, triage or write on a team of 10 members or fewer; R3 for maintain or admin, or more than 10 members; undo is [github-repo-access-team-remove-portal], or this gate again with the Phase A role when the team already had access
- **Required confirmation:** Type exactly `GRANT [ROLE_NAME] ON [REPO_NAME] TO TEAM [TEAM_SLUG] WITH [MEMBER_COUNT] MEMBERS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-team-grant-portal]:** Only after `[MEMBER_COUNT]` is saved, the R3 rollback path when it applies, and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. Open the control that adds a team [unconfirmed: check in the GitHub UI: its label] → choose `[TEAM_SLUG]` → under "Choose a role", pick `[ROLE_NAME]` → click **Add [TEAM_SLUG] to [REPO_NAME]** (B-01).
3. A team that already has access: next to `[TEAM_SLUG]`, open the Role dropdown → pick `[ROLE_NAME]` (B-02).

```bash
# HUMAN-RUN read-only read-back for one member of the team, picked from the Phase A list, passes when role_name is the team's new role
node scripts/adapters/github-client.js verify-collaborator --repo [REPO_NAME] --user [GITHUB_USER] --role [ROLE_NAME] --change [CHANGE_ID] --execute
```

The spot check proves the grant only for a member whose Phase A role was lower than `[ROLE_NAME]`; pick one. Collaborators & teams must list `[TEAM_SLUG]` with `[ROLE_NAME]`.

<!-- SAFETY GATE [github-repo-access-team-remove-portal] -->
- **Target:** [TEAM_SLUG] on [REPO_NAME]
- **Effect:** remove one team's access to one repository
- **Scope:** every member who reaches the repository only through this team loses it; direct collaborators keep their grants
- **Reversibility:** R2: give the team its Phase A role back under [github-repo-access-team-grant-portal]
- **Required confirmation:** Type exactly `REMOVE TEAM [TEAM_SLUG] FROM [REPO_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-team-remove-portal]:** Only after the team's Phase A role and `[MEMBER_COUNT]` are saved to `tasks/checkpoints/` and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]/[REPO_NAME]` → Settings → (Access) Collaborators & teams.
2. Next to `[TEAM_SLUG]`, use the remove control, then confirm [unconfirmed: check in the GitHub UI: the control's label].

```bash
# HUMAN-RUN read-only read-back for one member of the team with no direct grant, role_name must be gone or lower
node scripts/adapters/github-client.js permission --repo [REPO_NAME] --user [GITHUB_USER] --execute
```

**Verification checkpoint:** [ ] the spot check passes for the grant, or the `permission` read shows the lower role for the removal · [ ] Collaborators & teams agrees.

## Phase G: A person on a team (R1 to add, R2 to take out)

**Purpose:** give access the way the team already has it, or take a person out of every repository the team grants.

**Before:** the Phase A `membership` read shows state active (a team holds organization members); the team's repositories are in the ticket.

**Role needed:** a maintainer of `[TEAM_SLUG]`, or an organization owner [unconfirmed: check in the GitHub UI].

<!-- SAFETY GATE [github-repo-access-team-member-add-portal] -->
- **Target:** [GITHUB_USER] in [TEAM_SLUG]
- **Effect:** add one organization member to one team
- **Scope:** one person, one team; the person gets every repository access the team holds
- **Reversibility:** R1: undo is [github-repo-access-team-member-remove-portal]
- **Required confirmation:** Type exactly `ADD [GITHUB_USER] TO TEAM [TEAM_SLUG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-team-member-add-portal]:** Only after the Phase A team list is in the ticket, the person is not already listed, and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Teams → `[TEAM_SLUG]` → Members → add `[GITHUB_USER]` [unconfirmed: check in the GitHub UI: the Members tab and its add control].

```bash
# HUMAN-RUN read-only read-back, passes only when the person is listed in the team
node scripts/adapters/github-client.js verify-team-member --team [TEAM_SLUG] --user [GITHUB_USER] --execute
```

**Stop before removing if:** the Phase A `team-members` read does not list the person (the absent check would pass with nothing removed); the person reaches `[TEAM_SLUG]` through a child team (the read lists child-team members, G-06, so the absent check cannot pass): take them out of the child team instead.

<!-- SAFETY GATE [github-repo-access-team-member-remove-portal] -->
- **Target:** [GITHUB_USER] in [TEAM_SLUG]
- **Effect:** remove one person from one team
- **Scope:** one person, one team; the person loses every repository access that only this team gave them
- **Reversibility:** R2: add them back under [github-repo-access-team-member-add-portal]
- **Required confirmation:** Type exactly `REMOVE [GITHUB_USER] FROM TEAM [TEAM_SLUG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [github-repo-access-team-member-remove-portal]:** Only after the Phase A `team-members` read is saved to `tasks/checkpoints/` and the exact match:
1. github.com → profile picture → Organizations → `[@Aegion_GITHUB_ORG]` → Teams → `[TEAM_SLUG]` → Members → `[GITHUB_USER]` → the remove control [unconfirmed: check in the GitHub UI: its label].

```bash
# HUMAN-RUN read-only read-back, passes only when the person is no longer listed in the team
node scripts/adapters/github-client.js verify-team-member --team [TEAM_SLUG] --user [GITHUB_USER] --absent --change [CHANGE_ID] --execute
```

**Verification checkpoint:** [ ] `verify-team-member` exits 0 for the add, or with `--absent` for the removal.

## ⚠️ Risk warning

- **Maintain and admin are privilege grants.** They need written approval, an end date and a rollback path before step 1.
- **Removing a direct grant can leave team access.** The `permission` read after Phase E shows what a team still grants.
- **A team grant reaches everyone on the team,** later joiners too. More than 10 members is a mass change (R3).
- **Removal does not take back code.** What the person cloned while they had access stays with them; a leaked secret is `/github-security-alerts`.
- **A departing person** goes through `/github-offboard-member` and `/offboard`, not one repository at a time.

## ✅ Verification checklist

- [ ] Phase A role, route, membership and (for a team) `[MEMBER_COUNT]` are in the ticket; R2 and R3 reads are saved to `tasks/checkpoints/`.
- [ ] Add, grant or role change: `verify-collaborator` exits 0 for `[ROLE_NAME]`; Collaborators & teams agrees.
- [ ] Removal: `verify-collaborator-removed` exits 0; the `permission` read shows any team access left.
- [ ] Team on the repository: the spot check passes, or the `permission` read shows the lower role; Collaborators & teams agrees.
- [ ] Team membership: `verify-team-member` exits 0 (with `--absent` for a removal).
- [ ] R3: approval, end date and rollback path were in the ticket before step 1.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise use the partial-state form.

> [Completed, only when every read-back passed] GitHub `[@Aegion_GITHUB_ORG]/[REPO_NAME]`: [added `[GITHUB_USER]` as [ROLE_NAME] / granted [maintain or admin] to `[GITHUB_USER]` until [end date] / changed `[GITHUB_USER]` from [old role] to [ROLE_NAME] / removed direct collaborator `[GITHUB_USER]` / granted team `[TEAM_SLUG]` ([MEMBER_COUNT] members) [ROLE_NAME] / removed team `[TEAM_SLUG]` / added or removed `[GITHUB_USER]` in team `[TEAM_SLUG]`] on [date/time] by [ADMIN_NAME], confirmed by the exact phrase. Approval: [approver, in this ticket]. Pre-state: [role_name or none, route] saved to `tasks/checkpoints/`. Read-back: [verify command] exited 0 at [time]; the GUI shows [state]. Time spent: [X] min.
>
> [Partial state, keep open] Verified: [what passed]. Pending: [the invitation is not accepted yet / a team still grants access / a read-back failed]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

In GitHub, "who can push" is the sum of two lists: direct grants and team grants. Removing someone from one list and reading back only that list proves half the job; the `permission` read is the whole answer.

## Career upgrade

Granting through teams and reading back effective permission, not the list you edited, is the access-review habit platform and security engineering roles test for.

## Next action

Run Phase A for `[GITHUB_USER]` on `[REPO_NAME]` and write the `role_name` and route in the ticket before choosing a phase.

**Sources (checked 2026-10-28, batch G3 vendor facts, `docs/aegis/g3/vendor-facts.md`):** docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository (B-01, B-02) · docs.github.com/en/rest/collaborators/collaborators (G-08, G-09) · docs.github.com/en/rest/orgs/members (G-01, G-03) · docs.github.com/en/rest/teams/teams and docs.github.com/en/rest/teams/members (G-05, G-06) · docs.github.com/en/organizations/managing-membership-in-your-organization/removing-a-member-from-your-organization (B-06, the People list) · cli.github.com/manual/gh_api (B-12, B-13). A label marked [unconfirmed: check in the GitHub UI] was not on these pages.
