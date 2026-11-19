# Safe changes

> **Execution boundary:** this file is planning reference only and authorizes nothing. Every command below is a PREVIEW ONLY comment. The runbook named for each pattern holds the exact-phrase gate a person answers before the change runs. Aegis advises; a person applies every change.

## The rules every change follows

1. **Code before console.** When the resource is managed by Terraform, Bicep, CloudFormation, Helm or a GitOps repository, the change is a reviewed commit and a plan; a console edit is drift that the next apply reverts.
2. **Save the before-state, then change, then read back.** Each gate in the runbooks saves the object as it is to a local file first (the R2 checkpoint rule of `CLAUDE.md`), then changes it; a read after the change proves it.
3. **One object, one change, one phrase.** A change to several objects lists them and their count in the ticket before the gate; a count you did not predict stops the work.
4. **The person who applies holds the smallest role that can make this change**, never a standing administrator login (rule b).
5. **Stop conditions are written before step 1:** a destroy in the plan nobody expected, a second error, a read-back that differs.

## The patterns

| Change | Blast radius | Who applies | Class | Rollback | Stop if |
|---|---|---|---|---|---|
| Apply a Terraform plan with only `+` and `~` | the objects in the plan and what references them | the workspace owner, through the pipeline | R2 | a reviewed plan from the previous commit; the backend's state version | the plan was made before another merge |
| Apply a plan with `-/+`, `+/-` or `-` | the replaced objects and their data | the workspace owner, after an independent review | R3 | restore the snapshot taken first, then the previous commit's plan | no restored-and-checked snapshot |
| Force-unlock Terraform state | one state | the workspace owner | R2 | the backend's previous state version | the lock's holder still runs |
| Roll back a Kubernetes Deployment one revision | one workload's pods, replaced one by one | the workload owner | R1 | roll back again | a migration the old version cannot read |
| Apply a changed manifest (limits, probes) | one workload | the workload owner, or a pull request under GitOps | R2 | the saved manifest, or the rollback | the diff shows lines nobody reviewed |
| Drain a node | every pod on the node, PodDisruptionBudgets respected (IV-26) | the platform team | R2 | uncordon | a budget would be broken; the last healthy node |
| Grant a scoped role to a group or role | every member of the group | the resource owner's admin, with the owner's approval | R2; R3 for admin roles or broad scope | remove that one assignment or binding | the role is broader than the error needs |
| Add one allow rule (one port, one source) | every resource using that security group or NSG | the network owner | R2; R3 for admin or database ports, or a public source | remove that rule | the source is the whole internet |
| Restart one systemd unit | the unit's clients, briefly | the service owner | R1 | none needed | the host is under a security question |
| Remove old journal files | the logs removed, for good | the service owner, with a copy elsewhere first | R3 | none: copy first | anyone may need them as evidence |
| Stop an instance | the instance's users; instance store data; a non-elastic public address | the owner | R2 | start it again | the owner has not said yes |
| Delete an orphaned disk | its data | the owner, after a snapshot | R3 | a new disk from the snapshot (new ID) | no snapshot read back |
| Restore to a new name | nothing live | the owner's admin | R1 | delete the copy | the restore target names the live object |
| Replace live data from a backup | every change since the restore point | the owner, in a window | R3 | the pre-replace snapshot (IV-51) | the owner has not checked the copy |

## Previews of the patterns

Each block names the runbook whose gate authorizes it. Every line is a comment.

```bash
# PREVIEW ONLY [infra-safe-terraform-apply]: planning text, not authorized here. The gate is in /terraform-plan-review.
# terraform show -no-color tfplan > ./plan-reviewed.txt
# terraform apply -input=false tfplan
```

```bash
# PREVIEW ONLY [infra-safe-k8s-rollback]: planning text, not authorized here. The gate is in /k8s-pod-failure.
# kubectl get deployment/[WORKLOAD_NAME] -n [NAMESPACE] -o yaml > ./before-rollback.yaml
# kubectl rollout undo deployment/[WORKLOAD_NAME] -n [NAMESPACE]
```

```bash
# PREVIEW ONLY [infra-safe-gcp-binding]: planning text, not authorized here. The gate is in /cloud-access-denied.
# gcloud projects get-iam-policy [PROJECT_ID] --format=json > ./iam-policy-before.json
# gcloud projects add-iam-policy-binding [PROJECT_ID] --member="[PRINCIPAL]" --role="[ROLE_NAME]"
```

```bash
# PREVIEW ONLY [infra-safe-network-rule]: planning text, not authorized here. The gate is in /cloud-network-block.
# aws ec2 describe-security-groups --group-ids [SECURITY_GROUP_ID] > ./security-group-before.json
# aws ec2 authorize-security-group-ingress --group-id [SECURITY_GROUP_ID] --protocol tcp --port [PORT] --cidr [SOURCE_CIDR]
```

```bash
# PREVIEW ONLY [infra-safe-unit-restart]: planning text, not authorized here. The gate is in /linux-server-triage.
# journalctl -u [UNIT_NAME] -n 300 --no-pager > ./unit-log-before-restart.txt
# sudo systemctl restart [UNIT_NAME]
```

## Writing a module a person applies

When the ask is "write a module" or "write a manifest", the Engineer answer gives two or three designs with the trade-off that decides between them, then the chosen one in full:

- **Inputs** with types, descriptions and validation; no secret as a default value.
- **Outputs** that the callers need (an ID, an address), never a secret in plain text.
- **Version pins** for the providers and for every module it calls (IV-35), so an upgrade is a reviewed change.
- **Safe defaults:** private by default (no public IP, no public bucket), encryption on, deletion protection or `prevent_destroy` on stateful resources (IV-31), tags for owner and cost centre.
- **Least privilege** for any role it creates: actions and resources named, no `*`.
- **How a person applies it:** the pull request, the plan to read, the class of the first apply.
