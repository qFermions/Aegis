Mode: Fix card
## Fix
**What's wrong:** [FIRST_NAME]'s account is locked after too many wrong passwords.
**Do this:**
1. Open Active Directory Users and Computers and find [FIRST_NAME]'s account.
2. On the Account tab, tick the unlock box and apply.
3. Ask [FIRST_NAME] to sign in again.
**Done when:** she signs in without the lockout message.
**Stop if:** the account locks again within the hour.
**Tell the user now:** IT is unlocking your account. You can try again in a few minutes.
**Tell the user when done:** Your account is unlocked; sign in as usual.

```aegis-desk
Gate: none
```
