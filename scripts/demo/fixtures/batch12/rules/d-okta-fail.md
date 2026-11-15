Mode: Fix card
## Fix
**What's wrong:** MFA is slowing down the warehouse team.
**Do this:**
1. Open the Okta Admin Console → Security → Authentication Policies.
2. Add a rule for the warehouse group that does not require MFA.
3. Ask the team to sign in again.
**Done when:** the team signs in without a prompt.
**Stop if:** other groups lose MFA.
**Tell the user now:** IT is changing your sign-in settings.
**Tell the user when done:** You no longer need the extra step.

```aegis-desk
Gate: none
```
