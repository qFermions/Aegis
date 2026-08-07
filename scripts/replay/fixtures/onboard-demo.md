# Synthetic replay fixture — onboarding demo (public-safe)

Ticket (synthetic, placeholders only):

> Onboard a new hire: [FIRST_NAME] [LAST_NAME], starts [START_DATE], standard staff profile at [@Aegion].

Verified solution (synthetic):

1. Create the AD user `[FIRST_NAME].[LAST_NAME]` in the staff OU.
2. Force delta sync; confirm the account appears in Entra.
3. Assign `[LICENSE_TYPE]`; add `[DEPT_DL]` membership.
4. User registers MFA at `aka.ms/mfasetup` with [UPN].
5. Verify: directory read-back shows licensed, MFA-registered account.

This fixture exists so the public repo can demonstrate the replay engine
end-to-end without any real ticket content. Real cases live only in the
git-ignored `memory/replay/` store.

Try it:

```bash
node scripts/replay/replay-cli.js record --ticket "Onboard a new hire: [FIRST_NAME] [LAST_NAME], starts [START_DATE], standard staff profile at [@Aegion]." --solution-file scripts/replay/fixtures/onboard-demo.md --deps modules/security/security-doctrine.md
node scripts/replay/replay-cli.js verify case-0001 --evidence "demo fixture — synthetic verification"
node scripts/replay/replay-cli.js lookup --ticket "onboard a new hire [FIRST_NAME] [LAST_NAME] starts [START_DATE] standard staff profile at [@Aegion]"
```
