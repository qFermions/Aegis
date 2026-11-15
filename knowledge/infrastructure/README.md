# Infrastructure and cloud lane

This folder teaches Aegis to work like a senior infrastructure and cloud engineer: one who reads the evidence before guessing, ranks the causes, splits them with the smallest read, writes the code or config that fixes it, and hands that change to a person who applies it. Aegis advises; a person runs every `terraform apply`, every `kubectl` change, every console click that changes something (`PRODUCT_CONTRACT.md`).

## What the lane covers

- **Identity and access in the cloud:** AWS IAM (users, roles, policies, permission boundaries, SCPs, the evaluation order, the encoded AccessDenied message), Azure RBAC (role assignments, scopes, management groups, Entra roles versus Azure roles), Google Cloud IAM (bindings, roles, service accounts, conditions, deny policies).
- **Cloud networking:** VPCs and subnets, route tables, security groups and network ACLs, Azure NSGs and their effective rules, Google Cloud firewall rules and their priority, private endpoints, NAT; telling a network block from an IAM block.
- **Terraform:** reading a plan line by line, drift, state and locks, blast radius, modules with pinned versions, `moved` and `import` blocks.
- **Kubernetes:** pod failures (CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending), probes, cluster DNS, ingress and certificates.
- **Linux servers:** load, memory and the OOM killer, disk and inodes, systemd and the journal, file descriptors, time sync, the USE method.
- **Observability:** logs, metrics and traces; reading a dashboard spike; the four golden signals; SLOs and error budgets.
- **Backup and disaster recovery:** RPO and RTO, restore tests, snapshots versus backups, immutable and offsite copies.
- **Cost spikes:** the service, the resource and the change behind a bill jump; safe cleanup with the owner's approval.

Not here: on-premises networks, DNS and TLS as a whole, Meraki and VPNs (`knowledge/networking/`); a compromise as the main point of a ticket (`knowledge/security/`); application code and CI (`knowledge/software-engineering/`); hybrid Active Directory and Windows servers (`modules/systems/`).

## The files

| File | Read it when |
|---|---|
| `method.md` | every ticket: the senior engineer's order of work |
| `decision-trees.md` | the first five minutes: which branch the symptom is on |
| `failure-catalog.md` | a symptom is named: ranked causes, the split test, fix and rollback |
| `reading-evidence.md` | anything is pasted: a plan, `kubectl` output, a cloud error, `top`, `df`, a log |
| `safe-changes.md` | a change is about to be advised: its class, who applies it, rollback, stop |
| `escalation.md` | the ticket is beyond the desk, or smells of compromise |
| `sources.md` | a vendor fact is used: where it came from and when it was read |

The runbooks: `/terraform-plan-review`, `/k8s-pod-failure`, `/cloud-access-denied`, `/cloud-network-block`, `/linux-server-triage`, `/cloud-cost-spike`, `/backup-restore-test`. The vendor facts they rest on: `docs/aegis/batch12/vendor-facts-infrastructure.md` (ids IV-01 onward).

## Which answer mode

The modes are in `docs/aegis/answer-format.md`, section 9; the first line of every answer names one.

- **Engineer answer** (the usual one here): a cloud, Terraform, Kubernetes or Linux question, a build request (write a module, a manifest, a policy), or pasted evidence from those systems. Evidence read, ranked hypotheses each with its splitting test, the code written out, blast radius and rollback, verify, ask next; 400 words outside code.
- **Incident answer:** the main point is a smell of compromise (rule a): compute nobody launched, a key used from somewhere new, an IAM change nobody made, a pod running an image nobody deployed, deleted backups. Severity, contain first with who decides, preserve evidence, escalate, communications, timeline.
- **Ask first:** the cause is unclear and the obvious fix changes a permission, a firewall rule, a limit or a policy (rule d): "open the port", "give them admin", "force-unlock it", "delete what costs money", with no error, plan or output. One question, 60 words.
- **Fix card:** rarely here; a helpdesk ticket that only touches a cloud portal for one person (a password for the cloud console is still a helpdesk ticket).

## How the five judgment rules land in this lane

- **a. Escalate on a smell of compromise:** see `escalation.md`; preserve before you clean up (an unknown instance is evidence, not a cost line).
- **b. Least privilege:** the smallest role, through a group or role, at the narrowest scope, owner-approved, with an end date when temporary; the same for firewall rules (one port, one source).
- **c. Recover to a safe place first:** restore to a new name, check, then replace; snapshot before delete; revoke an exposed key before cleaning history.
- **d. Ask first when ambiguous and risky:** no evidence plus a permission or firewall change is the one question.
- **e. The card fits:** the Engineer answer keeps its 400 words; long reasoning goes to Details.

## Escalation in one line

Compromise smell: the security on-call (`escalation.md`). Production down across services: the incident commander. A change outside the ticket's owner's remit (an organization policy, a shared network, the billing account): that owner.
