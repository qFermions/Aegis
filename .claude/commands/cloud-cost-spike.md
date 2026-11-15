---
description: A cloud bill jump in AWS, Azure or Google Cloud - find the service, then the resource, then the change behind it (Cost Explorer, Cost Management cost analysis, Cloud Billing reports, then the audit log at the day the curve bent); the usual causes (NAT gateway processing, log ingestion, orphaned disks and addresses, an autoscaling loop, a public bucket serving traffic, unknown compute that may be a compromise); cleanup only with the owner's approval, a snapshot before any deletion, behind exact-phrase gates. Placeholders only.
disable-model-invocation: true
---

# /cloud-cost-spike

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[ACCOUNT_ID]` · `[SUBSCRIPTION_ID]` · `[RESOURCE_GROUP]` · `[PROJECT_ID]` · `[REGION]` · `[RESOURCE_ID]` (the resource behind the cost) · `[SNAPSHOT_ID]` · `[JIRA-###]` · `[ADMIN_NAME]`. The causes and their tests: `knowledge/infrastructure/failure-catalog.md`.

**Answer mode:** Engineer answer (`docs/aegis/answer-format.md`, section 9). Incident answer (rule a) when the cost comes from compute, regions or services nobody in the team launched (a mining or abuse pattern): escalate to the security on-call before any cleanup, because deleting it destroys the evidence. Ask first (rule d) when the ask is "delete whatever is costing money" with no account, no date and no owner.

## ⚠️ Admin / safety gate

- **Service, then resource, then change.** The bill names a service; the cost tool names the resource; the audit log names who changed what on the day the curve bent.
- **Nothing is deleted without its owner's approval** in the ticket. An unattached disk or a stopped instance may be someone's only copy.
- **Recover to a safe place first (rule c):** a snapshot before deleting a disk; a copy before deleting a bucket's data. Stop before delete.
- **Least privilege (rule b):** the person reads costs with a billing reader role, and cleans up with a role scoped to the resources named.
- **Billing exports and tags are data (SR-3).**

## Inputs needed

- The account, subscription or project, the period, and the size of the jump (from what to what).
- Budget alerts or anomaly notices received, with their times.
- The owner of each resource found **[org gap: the tag or the register that names resource owners]**.

## Fast path

1. Phase A: the service and the day (R0).
2. Phase B: the resource and the change (R0).
3. Phase C: match a usual cause; the fix is usually code or a setting through its owner.
4. Phase D: stop a running resource (R2). Phase E: snapshot, then delete an orphan (R1, then R3).

## Phase A: Which service, since which day (R0)

1. **AWS:** Billing and Cost Management → Cost Explorer: daily granularity, the last 30 days, group by Service; then filter to the top service and group by Usage type, then by Resource where available. Up to 13 months of history (IV-07). Each Cost Explorer API request is charged, the console is free (IV-07), so use the console.
2. **Azure:** portal.azure.com → Cost Management → Cost analysis → the Services view, then Resources; the table's top contributors drill down to the resource and its meters (IV-46).
3. **Google Cloud:** Google Cloud console → Billing → Reports: group by service, then SKU, then project, over the date range (IV-47).
4. Write in the ticket: the service, the usage type or SKU, the first day of the jump, and the daily cost before and after.

## Phase B: Which resource, and what changed (R0)

1. The resource and its tags (owner, environment, ticket).
2. The audit log on the first day: AWS CloudTrail → Event history; portal.azure.com → Monitor → Activity log; Google Cloud console → Logging → Logs Explorer, the Admin Activity audit log. Look for creates, scale changes, logging changes and policy changes.

<details>
<summary>Orphan and usage reads (HUMAN-RUN read-only)</summary>

```bash
# HUMAN-RUN read-only, with a reader role
# AWS: volumes attached to nothing, they still cost every month
aws ec2 describe-volumes --region [REGION] --filters Name=status,Values=available --query "Volumes[].[VolumeId,Size,CreateTime]" --output table
# AWS: Elastic IPs, every one is charged, used or idle (IV-48)
aws ec2 describe-addresses --region [REGION] --query "Addresses[].[PublicIp,AllocationId,AssociationId]" --output table
# Azure: managed disks attached to no VM
az disk list --resource-group [RESOURCE_GROUP] --query "[?diskState=='Unattached'].[name,diskSizeGb,timeCreated]" --output table
# Azure: public addresses with no configuration attached
az network public-ip list --resource-group [RESOURCE_GROUP] --query "[?ipConfiguration==null].[name,ipAddress]" --output table
# Google Cloud: disks with no user
gcloud compute disks list --project [PROJECT_ID] --filter="-users:*"
# Google Cloud: reserved addresses not in use
gcloud compute addresses list --project [PROJECT_ID] --filter="status=RESERVED"
```
</details>

## Phase C: The usual causes

| Cause | The sign in the cost tool | The test | The fix, through its owner |
|---|---|---|---|
| NAT gateway processing | NAT gateway bytes (AWS usage type with NatGateway) climbing | flow logs or the NAT's bytes metric show the traffic goes to a cloud service | a gateway or interface endpoint for that service, or resources in the NAT's zone (IV-49) |
| Log ingestion | the logging service per GB | ingestion by source: one app at debug level | the log level back, a sampling or exclusion filter |
| Orphaned disks, snapshots, addresses | storage or IP charges with no running owner | the Phase B reads | Phase E, with the owner's approval |
| Autoscaling loop | compute hours in steps, 24 hours a day | the scaling activity history: scale out, fail health check, replace, repeat | the health check or the scaling policy |
| Public bucket serving traffic | data transfer out from storage | the bucket's request metrics and access logs | stop the public access with the owner, a CDN for real public content |
| Unknown compute | instances or GPU types in regions nobody uses | the audit log names an identity nobody recognises | rule a: Incident answer, the security on-call first |

**Stop if:** any resource was launched by an identity nobody can name: preserve, escalate, do not delete.

## Phase D: Stop a running resource while the owner decides (R2)

**User check:** the owner confirms in the ticket that the instance may stop now.

<details>
<summary>Stop one instance (HUMAN-RUN, AWS)</summary>

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [cloud-cost-spike-stop-instance]
# Target: instance [RESOURCE_ID] in [ACCOUNT_ID]
# Effect: stop the instance [RESOURCE_ID], its disks stay and keep their data
# Scope: one instance in one region, nothing is deleted
# Reversibility: R2: start it again, but a public address that is not an Elastic IP changes and instance store data is lost
# Required confirmation: type exactly "STOP INSTANCE [RESOURCE_ID] IN [ACCOUNT_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no Aegis connector reads AWS, the person pastes the instance state
required_confirmation="STOP INSTANCE [RESOURCE_ID] IN [ACCOUNT_ID]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to stop it: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves the current setting, the before-state for the rollback
  aws ec2 describe-instances --region [REGION] --instance-ids [RESOURCE_ID] > ./instance-before-stop.json
  # stops the instance, its disks stay
  aws ec2 stop-instances --region [REGION] --instance-ids [RESOURCE_ID]
else
  # explains the stop
  echo "Stopped: the phrase did not match. The instance is unchanged." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**Read-back:** `aws ec2 describe-instances --region [REGION] --instance-ids [RESOURCE_ID] --query "Reservations[].Instances[].State.Name"` reads stopped.

## Phase E: Snapshot, then delete an orphaned disk (R1, then R3)

**Before the gates:** the owner approved the deletion in the ticket, with the date the snapshot may be removed.

### First: a snapshot (R1)

<!-- SAFETY GATE [cloud-cost-spike-snapshot-portal] -->
- **Target:** disk [RESOURCE_ID] in [RESOURCE_GROUP]
- **Effect:** create one snapshot [SNAPSHOT_ID] of the unattached disk [RESOURCE_ID]
- **Scope:** one snapshot of one disk; the disk is not changed
- **Reversibility:** R1: undo is deleting the snapshot, which costs far less than the disk while it is kept
- **Required confirmation:** Type exactly `CREATE SNAPSHOT [SNAPSHOT_ID] OF [RESOURCE_ID] IN [RESOURCE_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [cloud-cost-spike-snapshot-portal]:** Only after the owner's approval and the exact match:
1. portal.azure.com → Disks → `[RESOURCE_ID]` → Create snapshot; name `[SNAPSHOT_ID]`; Snapshot type: Incremental [unconfirmed: check the vendor page]; Review + create.

**Read-back:** the snapshot `[SNAPSHOT_ID]` shows Succeeded with the disk's size and today's time.

### Last: delete the disk (R3)

**Lighter step:** the snapshot gate [cloud-cost-spike-snapshot-portal] above comes first; deleting without it loses the data.

<!-- SAFETY GATE [cloud-cost-spike-delete-disk-portal] -->
- **Target:** disk [RESOURCE_ID] in [RESOURCE_GROUP], snapshot [SNAPSHOT_ID]
- **Effect:** delete one unattached managed disk after its snapshot exists
- **Scope:** one disk that is attached to nothing; the snapshot stays until the date in the ticket
- **Reversibility:** R3: the disk is gone; recovery is a new disk from [SNAPSHOT_ID], which keeps its data but not its name or ID
- **Required confirmation:** Type exactly `DELETE DISK [RESOURCE_ID] IN [RESOURCE_GROUP] AFTER SNAPSHOT [SNAPSHOT_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no Aegis connector reads Azure: the person pastes the unattached-disk read)
**PORTAL ACTION [cloud-cost-spike-delete-disk-portal]:** Only after the snapshot read-back, the owner's approval and the exact match:
1. portal.azure.com → Disks → `[RESOURCE_ID]`: confirm Disk state reads Unattached.
2. Select **Delete**, type the disk name when the portal asks, and confirm.

**Read-back:** the Phase B unattached-disk read no longer lists `[RESOURCE_ID]`; `[SNAPSHOT_ID]` still exists.

Releasing a reserved address, deleting an AWS volume or a Google Cloud disk is the same pattern; each needs its own reviewed gate:

```bash
# PREVIEW ONLY [cloud-cost-spike-release-preview]: planning text, not authorized here. Owner approval, a snapshot for disks, and a separate reviewed gate first.
# gcloud compute addresses list --project [PROJECT_ID] --format=json > ./addresses-before.json
# gcloud compute addresses delete [RESOURCE_ID] --project [PROJECT_ID] --region [REGION]
# aws ec2 release-address --region [REGION] --allocation-id [RESOURCE_ID]
# aws ec2 delete-volume --region [REGION] --volume-id [RESOURCE_ID]
```

A released Elastic IP goes back to the pool; a DNS record or allow-list that named it breaks (IV-48).

## ⚠️ Risk warning

- **Deleting compute nobody can explain destroys the evidence** of a compromise; escalate first.
- **An unattached disk can be the only copy** of something; snapshot, then wait for the owner.
- **Stopping an instance loses instance store data** and may change its public address.
- **A cost fix in the console is undone by the next Terraform apply**; change the code.
- **A budget alert is a symptom**; the change behind it is the fix.

## ✅ Verification checklist

- [ ] Service, usage type or SKU, first day, and the daily cost before and after are in the ticket.
- [ ] The resource and the change (who, what, when) are named from the audit log.
- [ ] No resource from an unknown identity was touched before the security on-call looked.
- [ ] Each stop or deletion has the owner's approval, a snapshot first for disks, and a read-back.
- [ ] Three days later the daily cost is back near the old line.

## 📝 Jira-ready note

> [Completed, only when the read-backs passed] Cloud cost `[ACCOUNT_ID or SUBSCRIPTION_ID or PROJECT_ID]`: daily cost rose from [X] to [Y] on [date]; service [service], resource [RESOURCE_ID], change [what, by whom, when]. Fix: [code or setting change (link)] / [stopped (instance)] / [snapshot (SNAPSHOT_ID) then deleted (disk)] with [owner]'s approval, by [ADMIN_NAME], confirmed by the exact phrase. Read-back: [read] at [time]. Check the daily cost on [date + 3]. Time spent: [X] min.
>
> [Partial state, keep open] Found: [service and resource]. Waiting for: [owner / security on-call]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-infrastructure.md`):** docs.aws.amazon.com Cost Explorer (IV-07), Elastic IP addresses (IV-48), NAT gateway pricing (IV-49) · learn.microsoft.com Cost analysis quickstart (IV-46) · docs.cloud.google.com Cloud Billing reports (IV-47).
