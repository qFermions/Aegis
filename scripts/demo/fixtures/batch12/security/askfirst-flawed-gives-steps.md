Mode: Ask first
## Fix
**What's wrong:** the compliant-device check blocks the sales team on personal laptops.
**Do this:**
1. Open the Conditional Access policy that requires a compliant device.
2. Put the sales group in its exclusions and save.
3. Ask the team to sign in again.
**Done when:** the sales team signs in from personal laptops.
**Stop if:** other teams ask for the same exclusion.
**Tell the user now:** IT is adding an exception for your team.
**Tell the user when done:** You can sign in from your own laptop now.

```aegis-desk
Gate: none
```
