Mode: Fix card
## Fix
**What's wrong:** Okta Verify is sending repeated prompts to [FIRST_NAME]'s phone.
**Do this:**
1. Open the Okta Admin Console → Directory → People → [UPN] and read the factors.
2. Reset the Okta Verify factor.
3. Ask [FIRST_NAME] to enrol Okta Verify again.
**Done when:** [FIRST_NAME] signs in with one prompt.
**Stop if:** the prompts continue after the reset.
**Tell the user now:** IT is looking at your sign-in app.
**Tell the user when done:** Your sign-in app is set up again.

```aegis-desk
Gate: okta-mfa-reset-factor-portal
```
