# Decision trees: the first five minutes

Each tree starts from what the person sees and ends at a runbook phase or a failure-catalog entry. Answer each question with a read, not a guess.

## Tree 1: "I can't reach it" or "access denied" in the cloud

1. What does the caller get back?
   - **HTTP 403, AccessDenied, AuthorizationFailed, PERMISSION_DENIED:** the request arrived and a policy refused it. Go to 2.
   - **HTTP 401, invalid or expired token:** authentication, not authorization. The credential, its expiry, the clock (`timedatectl`). Stop here.
   - **Timeout, no answer:** something dropped it on the way. Go to 4.
   - **Connection refused:** the host answered "nothing listens here" (or the OS firewall rejected). The path is open; the service or its bind address is the fault (`/linux-server-triage`, `ss -tlnp`).
2. Does the error name an explicit deny (AWS "with an explicit deny in", a Google Cloud deny policy, an Azure deny assignment)?
   - **Yes:** an allow will not fix it (IV-01). Find the deny's owner (the organization's SCP or RCP, a permissions boundary, a deny policy) and stop; escalate if nobody knows why it exists.
   - **No:** a missing allow. Go to 3.
3. Is the denied identity, action or time expected?
   - **No** (an identity nobody runs, a write nobody tried, a new place): rule a, Incident answer, `escalation.md`.
   - **Yes:** the smallest grant (`/cloud-access-denied` Phase E).
4. Is it one source or all, one port or all?
   - **All callers, all ports, or several services:** check the status page and the last network change; a route or NAT is more likely than a rule.
   - **One source or one port:** go to 5.
5. Read the path in order (`/cloud-network-block`): name resolution, route, subnet filter (network ACL, subnet NSG), instance filter (security group, NIC NSG, VPC firewall rule), the host. The first layer that refuses is the fault.

## Tree 2: A Terraform plan wants to do something nobody expected

1. Which symbols? `+` and `~` only: review the attributes, then `/terraform-plan-review` Phase D. Any `-/+`, `+/-` or `-`: go to 2.
2. For each replace, which attribute carries `# forces replacement`?
   - **A rename of the resource or a move into a module** (same kind destroyed and created at a new address): a `moved` block (IV-33).
   - **An attribute someone changed outside Terraform:** drift; decide which value is right, then write it into the code or accept it (Phase G).
   - **A provider or module version bump** that changed a default: pin the version back (IV-35), read the upgrade notes, plan again.
   - **A wanted change that the provider can only make by rebuilding:** R3 with a snapshot first (rule c) and a review (Phase E).
3. Does the summary line match the ticket? A destroy count above zero on an "add" ticket stops the work.

## Tree 3: A pod is not running or not ready

1. `kubectl get pods`: what is the STATUS?
   - **Pending:** read the `FailedScheduling` event: resources, taint, affinity or an unbound volume claim.
   - **ImagePullBackOff or ErrImagePull:** the event says not found (the tag), unauthorized (the pull secret in the pod's namespace), or too many requests (the registry limit).
   - **CrashLoopBackOff:** go to 2.
   - **Running, 0/1 READY:** the readiness probe; its path, port and timing against the app's start time.
   - **Running and READY, callers fail:** the Service selector (`endpointslices`), DNS from inside a pod, the ingress, the certificate.
2. `describe` Last State: the exit code.
   - **137 with reason OOMKilled:** the memory limit against `kubectl top`; a leak if usage climbs to the kill each time.
   - **137 without OOMKilled, or 143:** a kill from outside, usually a failing liveness probe; read its events.
   - **1 or another app code:** `kubectl logs --previous` names the failing call (config, secret, a dependency, a migration).
3. Did it start with a deploy? Roll back first (`/k8s-pod-failure` Phase D), then fix forward.

## Tree 4: A Linux server is slow or a service failed

1. `uptime`: is the load above the CPU count?
   - **Yes, and `top` shows CPU busy:** which process; a runaway is the app team's, a binary nobody knows is rule a.
   - **Yes, and CPU is idle:** tasks waiting on disk or a network share (`vmstat` column b, `iostat` await).
   - **No:** go to 2.
2. `free -m` and `dmesg`: did the OOM killer act? Then memory, not CPU.
3. `df -h` and `df -i`: a full file system or full inodes stops writes and many services. `du` far below `df` means a deleted file still held open (`lsof +L1`).
4. `systemctl status` and `journalctl -u`: the unit's own error names a config, a missing file, a port in use or `Too many open files`.
5. `timedatectl`: a clock out of sync breaks TLS and tokens.

## Tree 5: The bill jumped

1. Which service? (Cost Explorer, Cost analysis, Billing reports, grouped by service, daily.)
2. Which usage type or SKU inside it, and from which day?
3. Which resource, and which change on that day (the audit log)?
4. Was it launched by an identity the team knows?
   - **No:** rule a; preserve, escalate, do not delete.
   - **Yes:** match a cause in `failure-catalog.md` (NAT processing, log ingestion, orphans, an autoscaling loop, a public bucket) and fix it through its owner.

## Tree 6: Data is lost or wrong

1. Is it the result of a compromise (ransomware, a deletion nobody made, backups deleted)? Then rule a first: the security team picks the restore point.
2. When was it last right? That time picks the restore point; its age against the RPO says how much will be lost.
3. Restore to a new name, check with the owner, then copy the missing part across or replace (`/backup-restore-test`).
