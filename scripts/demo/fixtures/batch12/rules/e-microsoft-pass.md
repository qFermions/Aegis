Mode: Fix card
## Fix
**What's wrong:** [FIRST_NAME]'s laptop shows as not compliant since the encryption policy changed.
**Do this:**
1. Open Intune admin center → Devices → [DEVICE_NAME] → Device compliance and read which setting fails.
2. Ask [FIRST_NAME] to sync from the Company Portal app.
3. If encryption is the failing setting, re-push the encryption policy assignment.
**Done when:** the device shows Compliant. Aegis then checks the compliance state.
**Stop if:** a setting other than encryption fails.
**Tell the user now:** IT is checking your laptop's settings. Please open Company Portal and choose Sync.
**Tell the user when done:** Your laptop meets the company settings again.

```aegis-desk
Gate: none
```
