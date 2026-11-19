Mode: Incident answer
## Incident answer
**Severity:** SEV-2: a working access key was public for two days.
**Contain first:**
1. Deactivate the access key in the IAM console → Users → [USER_NAME] → Security credentials. The cloud account owner decides; the deploy pipeline stops until a new key is set.
2. Create a replacement key and store it only in the pipeline's secret store. The cloud account owner decides.
**Preserve:** keep the CloudTrail events for that key id from the last 3 days before any cleanup.
**Escalate to:** the security on-call now. They need the key id, the repository, the time it was pushed and the time it was found.
**Communications:** tell the repository owner the key is being revoked and not to delete the commit yet.
**Timeline:** pushed two days ago; found today; key still active now.

```aegis-desk
Gate: none
```
