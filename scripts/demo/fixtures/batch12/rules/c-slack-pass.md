Mode: Incident answer
## Incident answer
**Severity:** SEV-3: a bot token was posted in a channel; no sign of use yet.
**Contain first:**
1. Regenerate the bot token in the Slack app's settings so the posted one stops working. The app owner decides; the bot is offline until the new token is in its secret store.
2. Review the app's access logs for calls with the old token since it was posted. The security on-call decides what counts as use.
3. Delete the message from the channel only after the token is revoked. The workspace admin decides.
**Preserve:** a screenshot of the message, the channel, the time posted and who could see it.
**Escalate to:** the security on-call. They need the app name, the channel, the time it was posted and the access log export.
**Communications:** tell the poster it is being handled; no blame.
**Timeline:** posted at an unknown time today; reported now.

```aegis-desk
Gate: none
```
