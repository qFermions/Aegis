# Sources

Every vendor or standards page this module and its runbooks rely on, with the date it was read. The quote and the CONFIRMED or UNCONFIRMED verdict for each fact are in `docs/aegis/batch12/vendor-facts-infrastructure.md`, by id. A page fetched in one answer does not change this list (`docs/aegis/answer-format.md`, section 10).

All read 2026-11-14 with GET requests only.

## AWS (docs.aws.amazon.com)

- IAM policy evaluation logic: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html (IV-01)
- STS DecodeAuthorizationMessage: https://docs.aws.amazon.com/STS/latest/APIReference/API_DecodeAuthorizationMessage.html (IV-02)
- Permissions boundaries: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html (IV-03)
- IAM policy simulator: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html (IV-08)
- Security groups: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html (IV-04, IV-53)
- Network ACLs: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html (IV-05)
- Flow log records: https://docs.aws.amazon.com/vpc/latest/userguide/flow-log-records.html (IV-06)
- NAT gateway pricing: https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-pricing.html (IV-49)
- Cost Explorer: https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html (IV-07)
- Elastic IP addresses: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html (IV-48)
- AWS Backup restore testing: https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html (IV-50)
- AWS Health Dashboard: https://docs.aws.amazon.com/health/latest/ug/aws-health-dashboard-status.html (IV-38); the live page https://health.aws.amazon.com/health/status returned no readable text to the fetch tool.

## Microsoft Azure (learn.microsoft.com, azure.status.microsoft)

- Azure RBAC scope: https://learn.microsoft.com/en-us/azure/role-based-access-control/scope-overview (IV-09)
- Azure roles and Entra roles: https://learn.microsoft.com/en-us/azure/role-based-access-control/rbac-and-directory-admin-roles (IV-10)
- Troubleshoot Azure RBAC: https://learn.microsoft.com/en-us/azure/role-based-access-control/troubleshooting (IV-11)
- Network security groups: https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview (IV-15)
- IP flow verify: https://learn.microsoft.com/en-us/azure/network-watcher/ip-flow-verify-overview (IV-41)
- Diagnose a traffic filter problem: https://learn.microsoft.com/en-us/azure/virtual-network/diagnose-network-traffic-filter-problem (IV-42)
- Cost analysis: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis (IV-46)
- Restore VMs with Azure Backup: https://learn.microsoft.com/en-us/azure/backup/backup-azure-arm-restore-vms (IV-51, IV-59)
- Azure status: https://azure.status.microsoft/en-us/status (IV-39)

## Google Cloud (cloud.google.com, which redirects to docs.cloud.google.com; status.cloud.google.com)

- IAM overview: https://docs.cloud.google.com/iam/docs/overview (IV-12, IV-55)
- IAM conditions: https://docs.cloud.google.com/iam/docs/conditions-overview (IV-13)
- Policy Troubleshooter: https://docs.cloud.google.com/policy-intelligence/docs/troubleshoot-access (IV-14)
- VPC firewall rules: https://docs.cloud.google.com/firewall/docs/firewalls (IV-16, IV-56)
- Cloud Billing reports: https://docs.cloud.google.com/billing/docs/how-to/reports (IV-47)
- SLO monitoring concepts: https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring (IV-52)
- Google Cloud status: https://status.cloud.google.com/ (IV-40)

## Kubernetes (kubernetes.io)

- Pod lifecycle: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/ (IV-17)
- Liveness, readiness and startup probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/ (IV-18, IV-57)
- DNS for Services and Pods: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/ (IV-19)
- Debugging DNS resolution: https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/ (IV-20)
- Taints and tolerations: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ (IV-21)
- Resource management for pods and containers: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ (IV-22, IV-23)
- Images: https://kubernetes.io/docs/concepts/containers/images/ (IV-24, IV-25)
- Safely drain a node: https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/ (IV-26)
- Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ (IV-27)

## Terraform (developer.hashicorp.com)

- `terraform plan`: https://developer.hashicorp.com/terraform/cli/commands/plan (IV-28)
- `terraform apply`: https://developer.hashicorp.com/terraform/cli/commands/apply (IV-29)
- Plan tutorial (the legend): https://developer.hashicorp.com/terraform/tutorials/cli/plan (IV-30, IV-58)
- The lifecycle meta-argument: https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle (IV-31)
- State locking: https://developer.hashicorp.com/terraform/language/state/locking (IV-32, IV-65)
- `force-unlock`: https://developer.hashicorp.com/terraform/cli/commands/force-unlock (read; it says the command does not modify infrastructure)
- Refactoring with `moved`: https://developer.hashicorp.com/terraform/language/modules/develop/refactoring (IV-33)
- Import blocks: https://developer.hashicorp.com/terraform/language/import (IV-34)
- Module syntax and versions: https://developer.hashicorp.com/terraform/language/modules/syntax (IV-35)
- `terraform state rm`: https://developer.hashicorp.com/terraform/cli/commands/state/rm (IV-36)
- Drift tutorial: https://developer.hashicorp.com/terraform/tutorials/state/resource-drift (IV-37)

## Not read (no allowlisted host)

- Linux distribution manual pages for systemd, journald, `lsof` and the kernel's OOM killer (IV-43 to IV-45).
- The usual source of the four golden signals and of the USE method (IV-68, IV-43).
