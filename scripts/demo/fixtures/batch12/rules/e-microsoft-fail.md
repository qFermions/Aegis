Mode: Fix card
## Fix
**What's wrong:** [FIRST_NAME]'s laptop shows as not compliant since the encryption policy changed last week, which usually means the device has not checked in since the policy was assigned, or BitLocker is waiting for a recovery key escrow that failed because the device was offline when the policy arrived.
**Do this:**
1. Open Intune admin center → Devices → [DEVICE_NAME] → Device compliance and read which setting fails, because the failing setting tells you whether this is encryption, the OS version, or a password rule, and each needs a different fix.
2. Ask [FIRST_NAME] to sync from the Company Portal app, since a sync forces the device to check in and pick up the newest policy, which clears most stale compliance states within a few minutes.
3. If encryption is the failing setting, re-push the encryption policy assignment, because a failed escrow leaves the setting pending until the policy is evaluated again on the device.
**Done when:** the device shows Compliant. Aegis then checks the compliance state.
**Stop if:** a setting other than encryption fails, because then the cause is another policy.
**Tell the user now:** IT is checking your laptop's settings. Please open Company Portal and choose Sync.
**Tell the user when done:** Your laptop meets the company settings again.

```aegis-desk
Gate: none
```
