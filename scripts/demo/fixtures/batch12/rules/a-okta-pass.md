Mode: Incident answer
## Incident answer
**Severity:** SEV-2: one account approved a sign-in it did not start, so someone may hold a live session.
**Contain first:**
1. Clear the user's sessions and revoke their tokens in the Okta Admin Console. The security on-call decides; it signs [FIRST_NAME] out everywhere.
2. Reset the password and remove any factor added today. The security on-call decides; [FIRST_NAME] cannot work until the new way in is set.
**Preserve:** export the System Log for [UPN] for the last 7 days before the reset changes it.
**Escalate to:** the security on-call now. They need the time of the approved prompt, the account, the sign-in locations in the System Log and the device that approved it.
**Communications:** tell [FIRST_NAME] not to approve any more prompts; IT will call them on the number on file.
**Timeline:** prompts since this morning; one approved at an unknown time; reported now.

```aegis-desk
Gate: none
```
