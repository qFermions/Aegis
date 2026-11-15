Mode: Fix card
## Fix
**What's wrong:** [FIRST_NAME] needs to read the finance shared drive for this month's audit only.
**Do this:**
1. Ask the finance shared drive's owner to approve Viewer access for the audit, the lowest role that lets [FIRST_NAME] read the files.
2. Add [FIRST_NAME] to the audit-readers group, which holds Viewer on the shared drive.
3. Set the group membership to expire on the audit's end date from the ticket.
**Done when:** [FIRST_NAME] can open a file in the shared drive and cannot edit it.
**Stop if:** the audit needs edits; then the owner decides on Commenter or Contributor.
**Tell the user now:** IT is setting up read access to the finance files for your audit.
**Tell the user when done:** You can now open the finance files for the audit.

```aegis-desk
Gate: gws-group-membership-add-portal
```
