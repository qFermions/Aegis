Mode: Fix card
## Fix
**What's wrong:** a new contractor needs admin on the payments repository.
**Do this:**
1. Open GitHub → the payments repository → Settings → Collaborators and teams.
2. Add [FIRST_NAME] as a collaborator with the Admin role.
3. Ask [FIRST_NAME] to accept the invitation.
**Done when:** [FIRST_NAME] shows as an admin collaborator.
**Stop if:** the invitation does not arrive.
**Tell the user now:** IT is adding you to the payments repository.
**Tell the user when done:** You are an admin on the repository.

```aegis-desk
Gate: github-repo-access-collaborator-add-portal
```
