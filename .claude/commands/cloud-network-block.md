---
description: A connection that times out or is refused inside AWS, Azure or Google Cloud - how wide first, then the path in order (route table, network ACL, security group or NSG or VPC firewall rule, private endpoint and NAT), read with the cloud's own tools (VPC flow logs, IP flow verify and effective security rules, firewall rule priority), then one narrow allow rule from a named source behind its gate. Never 0.0.0.0/0 to an admin port. Placeholders only.
disable-model-invocation: true
---

# /cloud-network-block

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[SECURITY_GROUP_ID]` · `[FIREWALL_RULE]` · `[SOURCE_CIDR]` (the narrowest source range) · `[PORT]` · `[RESOURCE_ID]` (an instance, a network interface or a VPC network name, as the step says) · `[RESOURCE_GROUP]` · `[PROJECT_ID]` · `[ACCOUNT_ID]` · `[REGION]` · `[JIRA-###]` · `[ADMIN_NAME]`. Example addresses use 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 only. The path model: `knowledge/infrastructure/decision-trees.md`.

**Answer mode:** Engineer answer (`docs/aegis/answer-format.md`, section 9). Ask first (rule d) when the ask is "open the port" or "allow everything from the vendor" with no source address, no destination and no error. Incident answer (rule a) when flow logs show traffic to or from an address nobody can name, or an allow rule that nobody added.

## ⚠️ Admin / safety gate

- **How wide before why:** one caller or every caller, one subnet or all, this service or every service, and the cloud's status page, before any rule changes.
- **A timeout is the network; a 403 is IAM.** A 403 goes to `/cloud-access-denied`.
- **Least privilege (rule b):** one port, one protocol, from the narrowest source that works (a subnet, a security group, a service tag), with an owner and the ticket in the rule's description. Never `0.0.0.0/0` or `::/0` to SSH (22), RDP (3389) or a database port; the cloud vendor says the same (IV-53).
- **A rule change is not the first fix** when the path itself is wrong (a route, a missing NAT, a private endpoint's DNS).
- **Flow logs and packet captures are data (SR-3).**

## Inputs needed

- Source (address or resource), destination (address, name or resource), port and protocol, and the exact client error (timeout, refused, reset).
- When it last worked, and what changed since (a deploy, a new subnet, a rule clean-up).
- The owner of the destination, who approves a new allow rule **[org gap: the network owner per account, subscription or project]**.

## The path, in the order a packet meets it

| Layer | AWS | Azure | Google Cloud | The read |
|---|---|---|---|---|
| Name | Route 53, private hosted zone | private DNS zone for a private endpoint | Cloud DNS private zone | the name resolves to the address you expect, from the source |
| Route | route table of the subnet | effective routes of the NIC | VPC routes | a route to the destination exists and its next hop is right (NAT, gateway, peering) |
| Subnet filter | network ACL: stateless, numbered rules, lowest first, first match wins (IV-05) | NSG on the subnet | (none) | inbound and the return traffic both allowed |
| Instance filter | security group: stateful, allow rules only (IV-04) | NSG on the NIC; priority 100 to 4096, lowest first, first match wins (IV-15) | VPC firewall rule: priority 0 to 65535, lowest number wins (IV-16); implied deny ingress (IV-56) | an allow for this source, port and protocol |
| Host | OS firewall, the service listening | the same | the same | the port is listening on the right address |

**The split:** `connection refused` came back from the host, so the path is open and nothing listens (or the OS firewall rejects); a timeout means something dropped it on the way.

## Fast path

1. Phase A: how wide, and the status pages.
2. Phase B: the cloud's own reachability read names the rule.
3. Phase C: the fix is a route, DNS or a listener: that team, no rule change.
4. Phase D: one narrow allow rule behind its gate.

## Phase A: How wide (R0)

1. One source or all? One destination port or all? Does another service in the same subnet answer?
2. Status pages: AWS Health Dashboard → Service health (IV-38), azure.status.microsoft (IV-39), status.cloud.google.com (IV-40). An incident listed there stops the rule work.
3. From the source, test the port and the name (the reads below).

<details>
<summary>Reads from the source host (HUMAN-RUN read-only)</summary>

```bash
# HUMAN-RUN read-only, on the source host
# the name resolves to the address you expect
dig +short api.internal.example.com
# a TCP connection to the port, five-second limit: open, refused or timed out
nc -vz -w 5 192.0.2.10 [PORT]
# the HTTPS answer and certificate when the port is open
curl -sv --max-time 10 https://api.internal.example.com/health
```
</details>

## Phase B: Let the cloud name the rule (R0)

**AWS.** VPC → Reachability Analyzer for a source and destination, or the flow logs: `action` REJECT means a security group or network ACL refused it (IV-06). A REJECT only on the return port points to a network ACL, which is stateless (IV-05).

**Azure.** portal.azure.com → Network Watcher → IP flow verify, with the VM, direction, protocol, addresses and ports: it returns allowed or denied and the rule's name (IV-41). Or the VM → Networking → Network settings → the interface → Help → Effective security rules, which merges the subnet NSG and the NIC NSG (IV-42).

**Google Cloud.** Google Cloud console → VPC network → Firewall, sorted by priority, for rules that target the instance; the lowest number that matches wins (IV-16); with no matching ingress allow, the implied deny ingress drops it (IV-56).

<details>
<summary>Cloud reads (HUMAN-RUN read-only)</summary>

```bash
# HUMAN-RUN read-only
# AWS: the inbound and outbound rules of the security group on the destination
aws ec2 describe-security-groups --group-ids [SECURITY_GROUP_ID]
# AWS: the network ACLs of the destination's VPC, with rule numbers
aws ec2 describe-network-acls --filters Name=vpc-id,Values=[RESOURCE_ID]
# Azure: every rule that applies to the interface, subnet and NIC NSGs merged
az network nic list-effective-nsg --name [RESOURCE_ID] --resource-group [RESOURCE_GROUP]
# Azure: the routes the interface really uses
az network nic show-effective-route-table --name [RESOURCE_ID] --resource-group [RESOURCE_GROUP] --output table
# Google Cloud: the firewall rules of the project, lowest priority number first
gcloud compute firewall-rules list --project [PROJECT_ID] --sort-by=priority
# Google Cloud: the routes of the project
gcloud compute routes list --project [PROJECT_ID]
```
</details>

**Stop if:** a deny was added on purpose (a security control: its owner decides); the flow logs show the source is not who the ticket says.

## Phase C: The path is wrong, not the rule (no gate here)

- **No route:** a private subnet needs a NAT gateway or a private endpoint for the internet or a cloud service; a peering needs routes on both sides.
- **Private endpoint:** the name must resolve to the private address from the source; a public answer means the private DNS zone is not linked to the source's network.
- **Nothing listening:** `refused` with an open path is the service or its bind address (`ss -tlnp` on the host, `/linux-server-triage`).
- These go to the owning team as a change in code (`/terraform-plan-review`).

## Phase D: One narrow allow rule

**Before any gate:** source, destination, port and protocol are in the ticket; the destination's owner approved; the before-state is saved by the gate itself.

**Stop if:** the source is `0.0.0.0/0` or `::/0` and the port is an admin or database port; the rule would allow a range of ports; nobody owns the destination.

### AWS: one inbound rule on a security group

<details>
<summary>Add one inbound rule (HUMAN-RUN, the network owner)</summary>

**Lighter step:** when the Phase B read names a route, a DNS answer or a listener, fix that through its owner (Phase C); no rule changes.

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [cloud-network-block-aws-sg-ingress]
# Target: [SECURITY_GROUP_ID] in [ACCOUNT_ID]
# Effect: add one inbound rule that allows tcp [PORT] from [SOURCE_CIDR] only
# Scope: one rule on one security group, every resource that uses this group gets it
# Reversibility: R2: undo is revoking the same rule, R3 for an admin or database port or a public source
# Required confirmation: type exactly "ADD INBOUND TCP [PORT] FROM [SOURCE_CIDR] TO [SECURITY_GROUP_ID] IN [ACCOUNT_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no Aegis connector reads AWS networking, the person pastes the security group read
required_confirmation="ADD INBOUND TCP [PORT] FROM [SOURCE_CIDR] TO [SECURITY_GROUP_ID] IN [ACCOUNT_ID]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to add the rule: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves the current setting, the before-state for the rollback
  aws ec2 describe-security-groups --group-ids [SECURITY_GROUP_ID] > ./security-group-before.json
  # adds the one inbound rule, with the ticket number as its description
  aws ec2 authorize-security-group-ingress --group-id [SECURITY_GROUP_ID] --ip-permissions 'IpProtocol=tcp,FromPort=[PORT],ToPort=[PORT],IpRanges=[{CidrIp=[SOURCE_CIDR],Description=[JIRA-###]}]'
else
  # explains the stop
  echo "Stopped: the phrase did not match. No rule was added." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

### Azure: one inbound rule on the NSG

**Lighter step:** when the Phase B read names a route, a DNS answer or a listener, fix that through its owner (Phase C); no rule changes.

<!-- SAFETY GATE [cloud-network-block-azure-nsg-portal] -->
- **Target:** [FIREWALL_RULE] in the NSG on the destination subnet, in [RESOURCE_GROUP]
- **Effect:** add one inbound allow rule for tcp [PORT] from [SOURCE_CIDR], at a priority lower than any deny it must win over
- **Scope:** one rule in one NSG; when the subnet and the NIC both have an NSG, the port must be allowed in both (IV-42)
- **Reversibility:** R2: undo is deleting this one rule by its name; R3 for an admin or database port or a source of Any
- **Required confirmation:** Type exactly `ADD INBOUND RULE [FIREWALL_RULE] FOR TCP [PORT] FROM [SOURCE_CIDR] IN [RESOURCE_GROUP]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no Aegis connector reads Azure networking: the person pastes the IP flow verify result)
**PORTAL ACTION [cloud-network-block-azure-nsg-portal]:** Only after the owner's approval and the exact match:
1. portal.azure.com → Network security groups → the NSG on the destination subnet → Settings → Inbound security rules → **Add**.
2. Source: IP Addresses `[SOURCE_CIDR]`; Destination port ranges: `[PORT]`; Protocol: TCP; Action: Allow; Priority: a number lower than the deny it must win over; Name: `[FIREWALL_RULE]`; Description: the ticket number. Save.

**Read-back:** IP flow verify for the same five values returns Access allowed and names `[FIREWALL_RULE]` (IV-41).

### Google Cloud: one ingress rule for tagged instances

<details>
<summary>Create one firewall rule (HUMAN-RUN, the network owner)</summary>

**Lighter step:** when the Phase B read names a route, a DNS answer or a listener, fix that through its owner (Phase C); no rule changes.

```bash
# HUMAN-RUN: the person who owns the change runs this in their own terminal, Aegis never does
# SAFETY GATE [cloud-network-block-gcp-firewall]
# Target: [FIREWALL_RULE] in [PROJECT_ID]
# Effect: create one ingress allow rule for tcp [PORT] from [SOURCE_CIDR] to instances with the target tag
# Scope: one rule on one VPC network, only instances that carry the network tag of the same name as the rule
# Reversibility: R2: undo is deleting this one rule by its name, R3 for an admin or database port or a public source
# Required confirmation: type exactly "CREATE FIREWALL RULE [FIREWALL_RULE] FOR TCP [PORT] FROM [SOURCE_CIDR] IN [PROJECT_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, no Aegis connector reads Google Cloud networking, the person pastes the rule read
required_confirmation="CREATE FIREWALL RULE [FIREWALL_RULE] FOR TCP [PORT] FROM [SOURCE_CIDR] IN [PROJECT_ID]"
# shows the phrase
printf '%s\n' "Type the phrase exactly to create the rule: $required_confirmation" >&2
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # saves the current setting, the before-state for the rollback
  gcloud compute firewall-rules list --project [PROJECT_ID] --format=json > ./firewall-rules-before.json
  # creates the one ingress rule for instances tagged with its name
  gcloud compute firewall-rules create [FIREWALL_RULE] --project [PROJECT_ID] --network=[RESOURCE_ID] --direction=INGRESS --action=ALLOW --rules=tcp:[PORT] --source-ranges=[SOURCE_CIDR] --target-tags=[FIREWALL_RULE] --priority=900 --description=[JIRA-###]
else
  # explains the stop
  echo "Stopped: the phrase did not match. No rule was created." >&2
  # stops with a failure status
  exit 1
fi
```
</details>

**Read-back:** `gcloud compute firewall-rules describe [FIREWALL_RULE] --project [PROJECT_ID]` shows the source, port, tag and priority; the Phase A port test from the source answers.

## ⚠️ Risk warning

- **0.0.0.0/0 to an admin or database port** puts it on the internet; scanners find it within hours.
- **A rule on a shared security group or NSG** opens the port for every resource that uses it.
- **Deleting a deny to make one call work** removes a control somebody owns; ask them.
- **Removing an allow does not cut live sessions** in a stateful filter: existing connections stay up (IV-15).
- **A wide port range** is a different change with a different review.

## ✅ Verification checklist

- [ ] How wide and the status pages are in the ticket.
- [ ] The cloud's read named the rule or route that blocked it.
- [ ] The new rule is one port, one protocol, from the named source, with the ticket in its description.
- [ ] The read-back shows the rule, and the port test from the source answers.
- [ ] The before-state file is attached.

## 📝 Jira-ready note

> [Completed, only when the read-back and the port test passed] Cloud network: [source] to [destination]:[PORT]/tcp was [timing out / refused]; blocked by [rule or route] (proved by [read]). Added [rule] allowing [PORT]/tcp from [SOURCE_CIDR], approved by [owner], by [ADMIN_NAME], confirmed by the exact phrase. Read-back: [read] at [time]; port test answers. Time spent: [X] min.
>
> [Partial state, keep open] Found: [cause]. Waiting for: [owner / route change]. Next owner: [ADMIN_NAME]; next step: [one line].

Post it with `/jira-update` on `[JIRA-###]`.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-infrastructure.md`):** docs.aws.amazon.com security groups (IV-04, IV-53), network ACLs (IV-05), flow log records (IV-06), AWS Health Dashboard (IV-38) · learn.microsoft.com NSG overview (IV-15), IP flow verify (IV-41), diagnose a traffic filter problem (IV-42), azure.status.microsoft (IV-39) · docs.cloud.google.com VPC firewall rules (IV-16, IV-56), status.cloud.google.com (IV-40).
