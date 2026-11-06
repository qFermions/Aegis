## Fix
**What's wrong:** [FIRST_NAME] typed their password into a fake sign-in page, so someone else may have it.
**Do this:**
1. Call [FIRST_NAME] on the staff-list number and confirm what they entered.
2. In Microsoft Entra admin center → Users → [UPN], sign them out of every session.
3. Reset their password in the same place and give the new one over the phone.
4. Open Entra → Sign-in logs, filter on [UPN], and look for sign-ins from places they have not been.
**Done when:** [FIRST_NAME] signs in with the new password and the sign-in logs show only them since the reset.
**Stop if:** the logs show a sign-in from somewhere else; treat it as an incident and escalate now.
**Tell the user:** Thanks for telling us fast. We will call you to set a new password. Do not reuse the old one anywhere.


This is a security incident: the full plan is in Details.

## Details
Sign out first, then reset, so a stolen session cannot outlive the new password. Keep the fake page's address for the report.

Ticket note: password exposed to a phishing page; sessions ended, password reset by phone, sign-in logs reviewed.

```aegis-desk
Gate: example-session-revoke-portal
Gate: example-password-reset-portal
Phrase: REVOKE SESSIONS FOR [UPN]
Phrase: RESET PASSWORD FOR [UPN]
```
