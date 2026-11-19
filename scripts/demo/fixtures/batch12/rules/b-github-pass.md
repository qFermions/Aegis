Mode: Fix card
## Fix
**What's wrong:** a new contractor needs to push to the payments repository; admin is more than the job needs.
**Do this:**
1. Ask the payments repository owner to approve Write access for [FIRST_NAME], the lowest role that lets them push branches and open pull requests.
2. In GitHub → Organization → Teams, add [FIRST_NAME] to the payments-contractors team, which holds Write on the repository.
3. Set the team membership's end date to the contract end in the ticket, and add a reminder to remove it then.
**Done when:** [FIRST_NAME] can open a pull request and cannot change settings.
**Stop if:** the work needs repository settings; then the owner decides on Maintain.
**Tell the user now:** IT is setting up your access to the payments repository.
**Tell the user when done:** You can now push branches and open pull requests.

```aegis-desk
Gate: github-repo-access-team-add-portal
```
