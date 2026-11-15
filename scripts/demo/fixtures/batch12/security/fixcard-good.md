Mode: Fix card
## Fix
Assumed setup: Microsoft 365 with hybrid Active Directory and Entra ID (no company profile given). Tell me what your company runs for a better answer.
**What's wrong:** Sign-ins [FIRST_NAME] did not make locked her account; someone may have her password.
**Do this:**
1. Read last night's failed sign-ins for [UPN] in the Entra sign-in logs: addresses she never uses mean someone else.
2. Tell the security on-call now; they need the log export, the addresses, the times and the account.
3. Reset her password at the on-premises directory; read it to her on a call to the number on file.
4. If any of those sign-ins succeeded, end her sessions too.
**Done when:** she signs in with the new password, and no new sign-ins come from those addresses.
**Stop if:** one of those sign-ins succeeded: it is an incident for security.
**Tell the user now:** IT will call you with a new password. Please do not reuse the old one.
**Tell the user when done:** Your new password is set. Tell IT about any prompts you did not start.

This needs a security check alongside the reset: see Details.

## Details
Step 3 (reset the password): R2. Double-check: Aegis reads the password change time after the reset. Step 4, only if a sign-in succeeded: gate `security-session-revoke-portal` in `/security-alert-triage`. Unlocking without a reset would hand the account back to whoever was guessing.

```aegis-desk
Gate: password-reset-synced-portal
Phrase: RESET AD PASSWORD FOR [first.last] MAPPED TO [UPN]
Read-back: msgraph-client.js verify-password-changed --user [USER_ID] --not-before [NOT_BEFORE] --change [CHANGE_ID] --execute
```
