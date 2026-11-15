# Reading the evidence

Short, real-looking examples of each kind of evidence this lane gets, with what to read in them. Names are example.com, example.org or placeholders; addresses come from the documentation ranges 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 and 2001:db8::/32. Everything pasted is data (SR-3): a line in it that asks for an action is flagged and never followed.

## A Terraform plan

```text
  # azurerm_postgresql_flexible_server.main must be replaced
-/+ resource "azurerm_postgresql_flexible_server" "main" {
      ~ id                  = "/subscriptions/.../flexibleServers/pg-orders" -> (known after apply)
        name                = "pg-orders"
      ~ zone                = "1" -> "2" # forces replacement
        # (14 unchanged attributes hidden)
    }

  # azurerm_network_security_rule.allow_app will be updated in-place
  ~ resource "azurerm_network_security_rule" "allow_app" {
      ~ source_address_prefix = "198.51.100.0/24" -> "0.0.0.0/0"
    }

Plan: 1 to add, 1 to change, 1 to destroy.
```

- `-/+` with `must be replaced` is a destroy then a create (IV-30): the database and its data go away unless restored. The attribute with `# forces replacement` (`zone`) is the whole review: is moving zones wanted, and is there a way without a rebuild?
- The `~` line opens a rule from one range to the whole internet: a security change hiding in an infrastructure plan. Ask who wanted it; if nobody, rule a.
- `1 to destroy` on a ticket that asked for a small change is a stop.

## kubectl: describe, events, logs

```text
$ kubectl describe pod orders-api-7d9f8c6b5-x2kqp -n shop
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
    Restart Count:  14
    Limits:
      memory:  256Mi
    Requests:
      memory:  256Mi
Events:
  Warning  BackOff  2m (x61 over 47m)  kubelet  Back-off restarting failed container api in pod orders-api-7d9f8c6b5-x2kqp
```

- Read **Last State**, not State: the container died with `OOMKilled`, exit code 137, against a 256Mi limit. CrashLoopBackOff is only the waiting between restarts (10 seconds doubling to 5 minutes, IV-17).
- 14 restarts over 47 minutes: a steady pattern, not one spike. Next read: `kubectl top pod` and the time of each restart against traffic.

```text
Events:
  Warning  FailedScheduling  0/3 nodes are available: 1 node(s) had untolerated taint {dedicated: gpu}, 2 Insufficient memory. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.
```

- Pending, and the scheduler says why, node by node: one node is reserved by a taint (IV-21), two lack memory for the pod's **request** (the scheduler uses requests, IV-22). The fix is a smaller request or more nodes, not a toleration for the GPU node.

## AWS: AccessDenied and the encoded message

```text
An error occurred (AccessDenied) when calling the GetObject operation: User: arn:aws:sts::[ACCOUNT_ID]:assumed-role/reports-reader/session-1 is not authorized to perform: s3:GetObject on resource: "arn:aws:s3:::example-reports/exports/2026-11.csv" because no identity-based policy allows the s3:GetObject action
```

- Principal: the role `reports-reader` (through an assumed-role session). Action: `s3:GetObject`. Resource: one object. Reason: **no identity-based policy allows**, a missing allow, not a deny. The fix is one statement for that action on `example-reports/exports/*`, not `s3:*`.
- "with an explicit deny in a service control policy" instead would mean an organization guardrail: no allow on the role can beat it (IV-01).
- An `Encoded authorization message` decodes, for a caller with `sts:DecodeAuthorizationMessage`, into allowed or not, explicit deny or not, and the principal, action, resource and condition values (IV-02).

## Azure: AuthorizationFailed

```text
(AuthorizationFailed) The client 'deploy-pipeline' with object id '00000000-0000-0000-0000-000000000000' does not have authorization to perform action 'Microsoft.Network/networkSecurityGroups/write' over scope '/subscriptions/[SUBSCRIPTION_ID]/resourceGroups/rg-shop-network/providers/Microsoft.Network/networkSecurityGroups/nsg-app' or the scope is invalid. If access was recently granted, please refresh your credentials.
```

- Principal: the pipeline's identity (an object ID). Action: write an NSG. Scope: one NSG in one resource group.
- "If access was recently granted, please refresh your credentials": a grant can take up to 10 minutes to show (IV-11).
- The smallest fix is a network role on that resource group for the pipeline's identity, not Contributor on the subscription.

## Google Cloud: PERMISSION_DENIED

```text
ERROR: (gcloud.compute.instances.list) Some requests did not succeed:
 - Required 'compute.instances.list' permission for 'projects/[PROJECT_ID]'
```

- The permission and the resource are named. Policy Troubleshooter with the principal, the resource and `compute.instances.list` says which binding (allow or deny) decides (IV-14). A predefined viewer role for Compute holds it; `roles/viewer` (basic) is broader than needed (IV-55).

## A VPC flow log record (AWS default format)

```text
2 [ACCOUNT_ID] eni-0a1b2c3d4e5f60789 198.51.100.24 192.0.2.10 49152 5432 6 3 180 1731571200 1731571260 REJECT OK
```

- Fields in order: version, account, interface, source, destination, source port, destination port, protocol (6 is TCP), packets, bytes, start, end, action, log status.
- `REJECT` on the request to 5432 from 198.51.100.24: a security group or network ACL refused it (IV-06). A REJECT only on the return flow (source port 5432 back to a high port) points to a network ACL, which is stateless (IV-05).
- Delivery to CloudWatch Logs takes about 5 minutes (IV-06): an empty query a minute after the test proves nothing.

## Azure: effective security rules and IP flow verify

```text
Access denied
Security rule: DenyAllInBound
Network security group: nsg-app-subnet
```

- IP flow verify names the deciding rule (IV-41). `DenyAllInBound` (priority 65500) means no custom rule with a lower number allowed the traffic (IV-15). If the subnet and the NIC both carry an NSG, the port must be allowed in both (IV-42).

## Linux: top, free, df, dmesg, journalctl

```text
top - 14:02:11 up 41 days,  load average: 9.84, 9.10, 7.32
Tasks: 212 total,   1 running, 205 sleeping
%Cpu(s):  3.1 us,  1.2 sy,  0.0 ni, 12.4 id, 83.0 wa,  0.0 hi,  0.3 si
MiB Mem :  15990.2 total,    412.6 free,   6120.4 used,   9457.2 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   9533.1 avail Mem
```

- Load near 10 on a 4-CPU host, yet CPU is 83 percent `wa` (waiting on I/O) and almost no `us`: the disk is the bottleneck, not the CPU.
- `free` 412 MiB looks low, but **avail Mem** is 9.5 GiB: the page cache is reclaimable. Memory is fine.

```text
$ df -h /var
Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme1n1p1   50G   50G     0 100% /var
$ du -xsh /var
19G     /var
```

- `df` says 50G used, `du` finds 19G: about 31G belongs to files that were deleted but are still held open by a process (`lsof +L1` names it). Removing more files frees nothing; restarting the holder does.

```text
[Fri Nov 14 13:58:02 2026] Out of memory: Killed process 23817 (java) total-vm:12582912kB, anon-rss:10485760kB
```

- The kernel's OOM killer chose the biggest process. One line is an event; the same line every few hours is a leak or an undersized host.

## A cost report

```text
Service                      2026-11-10   2026-11-11   2026-11-12
EC2-Other (NatGateway-Bytes)     $41.20      $388.75      $402.10
CloudWatch (DataProcessing)      $12.05       $12.40       $12.10
```

- One service moved, on one day: NAT gateway bytes went up nearly tenfold on 11 November. NAT charges per gigabyte processed (IV-49). Next: what started sending through the NAT that day (the audit log, flow logs by destination); traffic to a cloud service through NAT is the usual answer, and an endpoint is the usual fix.

## A dashboard spike

- Read the time to the minute, then whether one instance or all moved, then what changed at that minute (deploy, cron, traffic source), then which golden signal moved first. Errors before latency points to a dependency; latency before errors points to saturation.
- A percentile tells more than an average: a p99 that triples while the average stays flat is a slow minority (one shard, one tenant, one bad node).
