Mode: Incident answer
## Incident answer
**Severity:** SEV-1: GPU machines nobody in the team launched are running and billing now in the dev subscription; whoever created them still holds that access.
**Contain first:**
1. Remove or disable the identity that created them (read it in the Activity log first). The security on-call decides; any pipeline using that identity stops.
2. Stop and deallocate the machines, keeping their disks. The security on-call decides with the subscription owner; the cost stops, and nothing is deleted.
3. Block new machine creation in that region with a policy on the subscription. The subscription owner decides; legitimate dev work there pauses too.
**Preserve:** export the subscription's Activity log for the last 7 days, snapshot each machine's OS disk, and save the list of machines with their sizes, regions and creation times, before any deletion. A capture never delays step 1 if the security on-call calls it urgent.
**Escalate to:** the security on-call now. They need the subscription, the region, the machine IDs, the identity and source address from the Activity log entries that created them, and when the budget alert fired.
**Communications:** tell the subscription owner and the finance contact that unexplained machines are being contained; tell the reporter thanks, that the security team has it, and not to delete anything meanwhile.
**Timeline:** created overnight (exact time unknown until the Activity log is read); alert fired this morning; machines still running now.

```aegis-desk
Gate: none
```
