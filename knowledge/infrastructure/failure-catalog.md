# Failure catalog

Each entry: the symptom as a person reports it; the likely causes, most common first; the smallest test that splits them; the fix (the lightest that works, applied by a person); the rollback. The class of each fix is in brackets. The runbook named in each entry holds the gate.

## Cloud identity and access

**1. AWS: "is not authorized to perform ... because no identity-based policy allows"**
- Causes: the role lacks the action; the action is right but the resource ARN in the policy is too narrow (a missing `/*`); the caller is a different role than assumed.
- Split: `aws sts get-caller-identity` (who is calling), then the IAM policy simulator for that principal, action and resource (IV-08).
- Fix: one statement with the exact action and resource on the role, through the code that owns it [R2] (`/cloud-access-denied`).
- Rollback: remove that statement.

**2. AWS: "with an explicit deny in a service control policy" or "in a permissions boundary"**
- Causes: an organization guardrail (region, service, tag rule); a boundary on the role.
- Split: the message names the policy type; the decoded message says explicit deny and the matched context (IV-02).
- Fix: none on the role: an allow never beats a deny (IV-01). The guardrail's owner decides; a boundary change is R3.
- Rollback: not applicable.

**3. Azure: "AuthorizationFailed ... does not have authorization to perform action ... over scope"**
- Causes: no role at that scope; a role assigned minutes ago and not visible yet (up to 10 minutes, IV-11); an Entra role mistaken for an Azure role (IV-10).
- Split: Access control (IAM) → Check access for the principal at the resource; the assignment's time.
- Fix: wait and sign out and in when the grant is new; else the smallest role on the resource group to a group [R2] (`/cloud-access-denied`).
- Rollback: remove that one assignment.

**4. Google Cloud: "Permission ... denied on resource"**
- Causes: no binding with that permission; a binding whose condition expired (IV-13); a deny policy; an organization policy constraint (a different error that names a constraint).
- Split: Policy Troubleshooter with the principal, resource and permission (IV-14).
- Fix: the smallest predefined role holding the permission, bound to a group or service account, with an end date when temporary [R2] (`/cloud-access-denied`).
- Rollback: remove that binding.

## Cloud networking

**5. A timeout to a port inside a VPC or VNet**
- Causes: the instance filter (security group, NSG, VPC firewall rule) has no allow; a network ACL drops the return traffic (stateless, IV-05); no route; the OS firewall.
- Split: AWS flow logs REJECT on the request or only on the return port (IV-06); Azure IP flow verify names the rule (IV-41); Google Cloud firewall rules by priority (IV-16).
- Fix: one allow rule, one port, the narrowest source [R2] (`/cloud-network-block`).
- Rollback: remove that rule.

**6. A private service is unreachable from a private subnet but works from the internet**
- Causes: a private endpoint whose name still resolves to the public address (the private DNS zone is not linked); no NAT or endpoint for the outbound path.
- Split: resolve the name from the source; compare with the endpoint's private address.
- Fix: link the private DNS zone to the source network, or add the endpoint route, in code [R2].
- Rollback: remove the link.

**7. Everything in one subnet lost the internet at once**
- Causes: a route table change (the default route removed or pointed elsewhere); the NAT gateway deleted or its address released; a network ACL change.
- Split: the subnet's effective routes; the audit log at the minute it stopped.
- Fix: revert the change in code [R2] (`/terraform-plan-review`).
- Rollback: the reverted commit's previous plan.

## Terraform

**8. The plan wants to destroy and re-create a resource nobody changed**
- Causes: a rename or a move into a module; drift on an attribute that forces replacement; a provider or module upgrade that changed a default.
- Split: the attribute marked `# forces replacement`; the commit and lock-file diff since the last apply; a refresh-only plan (IV-37).
- Fix: a `moved` block (IV-33), pin the version back (IV-35), or write the real value into the code; then plan again [no gate: a pull request].
- Rollback: revert the commit.

**9. "Error acquiring the state lock"**
- Causes: a run still going; a run that crashed and left the lock; two pipelines on one state.
- Split: the lock's Who, Operation and Created; the pipeline's job list.
- Fix: let it finish or cancel it; force-unlock only when the holder is proved gone [R2] (IV-32, `/terraform-plan-review` Phase F).
- Rollback: restore the previous state version if two writers corrupted it.

**10. The apply failed half way**
- Causes: a permission missing for one resource; a quota; a name already taken; an API timeout.
- Split: the apply output's first error and the resources it lists as created.
- Fix: fix the cause, plan again (Terraform plans only what is left), apply the new plan [R2].
- Rollback: a plan from the previous commit.

## Kubernetes

**11. CrashLoopBackOff after a deploy**
- Causes: a config or secret the new version needs; a migration; a dependency it cannot reach; a liveness probe too strict for its start time.
- Split: `kubectl logs --previous`, the exit code under Last State, the probe events.
- Fix: roll back one revision [R1], then fix forward through the manifest [R2] (`/k8s-pod-failure`).
- Rollback: roll forward again.

**12. OOMKilled (exit code 137)**
- Causes: a limit below the real need; a leak; a traffic spike.
- Split: `kubectl top pod` against the limit over time; restart times against traffic.
- Fix: a limit above the measured peak with the request close to normal use (IV-22, IV-23) [R2]; a leak goes to the app team.
- Rollback: the previous manifest.

**13. Pending**
- Causes: not enough allocatable CPU or memory for the requests; an untolerated taint (IV-21); node affinity; an unbound PersistentVolumeClaim.
- Split: the `FailedScheduling` event text.
- Fix: smaller requests, a toleration that matches the intent, more nodes through the node pool, or the storage class [R2].
- Rollback: the previous manifest.

**14. ImagePullBackOff**
- Causes: a wrong tag; a missing or wrong pull secret (it must be in the pod's namespace, IV-25); a registry rate limit; the registry down.
- Split: the event's words: not found, unauthorized, too many requests.
- Fix: the tag in the manifest; the pull secret; a mirror or authenticated pulls [R1 or R2].
- Rollback: the previous manifest.

**15. A name does not resolve inside the cluster, or external names are slow**
- Causes: CoreDNS down or overloaded; a wrong namespace in a short name; `ndots:5` sending an external name through every search domain first (IV-19).
- Split: the CoreDNS pods (IV-20); resolve the fully qualified Service name; resolve the external name with a trailing dot.
- Fix: scale or fix CoreDNS (the platform team); use fully qualified names; set `dnsConfig` `ndots` on the workload [R2].
- Rollback: the previous manifest.

**16. Certificate not issued (cert-manager)**
- Causes: the HTTP-01 challenge cannot reach the ingress (class, firewall, DNS); a DNS-01 credential without rights; a rate limit at the certificate authority.
- Split: the Challenge object's status and reason.
- Fix: the ingress class or the firewall for port 80; the DNS credential's scope [R2].
- Rollback: the previous Issuer or Ingress.

## Linux servers

**17. Disk full**
- Causes: logs or a dump; a deleted file still held open; full inodes (`df -i`).
- Split: `du` against `df`; `lsof +L1`; `df -i`.
- Fix: restart the holder [R1]; fix rotation; compress or move; remove journal files last [R3] (`/linux-server-triage`).
- Rollback: none for removals: copy first.

**18. The OOM killer stopped the service**
- Causes: a leak; a host too small for the workload; a new co-located process.
- Split: `dmesg -T` OOM lines over days (one time or a pattern); memory of the process over time.
- Fix: restart buys time [R1]; the leak or the size is the real fix (the app team, a resize).
- Rollback: none needed for a restart.

**19. TLS or token errors from one host only**
- Causes: the clock drifted; an old CA bundle; a proxy.
- Split: `timedatectl` (synchronised yes or no); the error text.
- Fix: the time service, then the app [R1].
- Rollback: not needed.

## Cost

**20. The bill jumped**
- Causes: NAT gateway processing (traffic to a cloud service through NAT, IV-49); log ingestion at debug level; orphaned disks, snapshots and addresses (IV-48); an autoscaling loop; a public bucket serving traffic; compute nobody launched (rule a).
- Split: service, then usage type or SKU, then resource, then the audit log on the first day (`/cloud-cost-spike`).
- Fix: an endpoint, a log level, a scaling fix, removal of orphans with the owner's approval and a snapshot first [R1 then R3].
- Rollback: a snapshot restores a disk's data, not its ID.

## Backup and recovery

**21. A restore "worked" but the data is wrong**
- Causes: the wrong restore point (after the damage, or older than the owner thinks); the restore went over live data and mixed old and new.
- Split: the restore point's time against the time of the damage; the owner's check on the restored copy.
- Fix: restore again from an earlier point to a new name; copy across only what is missing [R1 then R3] (`/backup-restore-test`).
- Rollback: the pre-replace snapshot Azure Backup keeps (IV-51), or the live state saved before.
