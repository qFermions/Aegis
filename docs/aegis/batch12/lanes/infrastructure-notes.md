# Lane note: infrastructure and cloud (batch 12)

## Hypothesis and verified means (written 2026-11-14, before the first lane file)

- **Hypothesis:** capability-map rows 18 and 19 are missing because Aegis has no method for infrastructure work, not because it lacks commands. A knowledge module that teaches the senior engineer's order (read the evidence, rank causes, split them with the smallest read, change through code a person applies, prove it) plus seven runbooks whose every change sits behind the existing gate grammar will let Aegis give Engineer answers on AWS, Azure, Google Cloud, Kubernetes, Terraform and Linux without tuning to any ticket.
- **Verified means:** `node --test scripts/command-safety-gates.test.js scripts/markdown-links.test.js scripts/repository-structure.test.js scripts/eval/judged/cases.test.js` passes with no new failing test name against the 41 pwsh-only names in `docs/aegis/demo/evidence/batch12/baseline/failing-names.txt`; `node scripts/lint/command-structure.js` exits 0; `node scripts/lint/ladder-audit.js --check` exits 0; every new gate id has its own per-gate test in the safety-gates run; the dev cases parse with `readCaseFile`. None of this proves answer quality: only the batch lead's judged run can.

## What was built

- `knowledge/infrastructure/`: README, method (ten steps; RPO, RTO, snapshots versus backups; observability, golden signals, SLOs and error budgets), decision trees (six), failure catalog (21 entries), reading-evidence (annotated plan, `kubectl describe` and events, AWS, Azure and Google Cloud denials, a flow log record, IP flow verify, `top`, `df` against `du`, `dmesg`, a cost report, a dashboard spike), safe changes (a pattern table and five PREVIEW ONLY blocks), escalation, sources.
- Seven runbooks: `/terraform-plan-review` (A), `/backup-restore-test` (A), `/k8s-pod-failure`, `/cloud-access-denied`, `/cloud-network-block`, `/linux-server-triage`, `/cloud-cost-spike` (B). 21 SAFETY GATEs (14 shell, 7 portal) and 5 PREVIEW ONLY markers in the runbooks; 5 more previews in `safe-changes.md`.
- `docs/aegis/batch12/vendor-facts-infrastructure.md`: IV-01 to IV-68 (IV-54 unused), 67 lines, 54 CONFIRMED, 13 UNCONFIRMED.
- `scripts/demo/fixtures/batch12/infrastructure/`: 7 fixtures (Engineer 2 good and 1 flawed, Incident 1 and 1, Ask first 1 and 1) and `fixtures.json` (ticket, mode, platform, expected verdict, flaw). All seven give the expected verdict on the lead's `modeRow` and `expertRows`.
- `docs/aegis/batch12/lanes/infrastructure-dev-cases.jsonl`: INF01 to INF14 on six platforms; `infrastructure-capability-rows.md`; evidence in `infrastructure-evidence/`.
- Shared registries, appended only: `VARIANTS`, `MIXED_STATE_COMMANDS`, the runbook count (108 to 115), the two gate counts (351 to 372), `NOT_COUNTED` (the journal gate's `[N]` is days), 23 generic tokens in the placeholder dictionary; the state-change inventory, the ladder audit and the vendor-facts priority page regenerated.

## Decisions and why

- **Every gate saves the before-state to a local file first, then changes.** It is the R2 checkpoint rule of `CLAUDE.md`, and it also gave each gate a sink the scanner could already see before the lead widened it.
- **Terraform state is never pulled to a laptop.** State can hold secrets; the rollback is the backend's state version, whose serial goes in the ticket. The reviewed plan text (sensitive values masked) is what the gate saves.
- **Classes:** a scoped role to a group, a narrow firewall rule, a manifest apply, a force-unlock and a state write are R2; an admin role, a broad scope, an admin or database port, a public source, a plan with a replace or destroy, deleting a disk and removing journal files are R3; one rollback, one restart, a snapshot, a restore to a new name and the AWS decode are R1. Where one gate covers both, its Reversibility line names both and the higher one governs.
- **The AWS decode is gated, not a plain read.** After the merge the widened scanner counts `aws sts decode-authorization-message` as a write. It changes nothing in AWS, but its output can hold detail AWS hides from the denied caller (IV-02), so an R1 gate that writes it to one local file is honest, not a workaround.
- **`kubectl exec` is a preview.** The scanner counts it as a write, and running a command in a live container is a change the workload owner agrees to; a pod-spec read replaces it in the DNS reads.
- **GitOps and code first.** Every runbook says a hand change on a GitOps cluster or a Terraform-managed resource is drift; the gate is for clusters and resources outside that.
- **Linux facts stay UNCONFIRMED** (IV-43 to IV-45): no Linux documentation host is on the allowlist, and the brief allows no other host.
- **Observability has no runbook.** It is taught in `method.md` and `reading-evidence.md`; a dashboard spike lands in the runbook of the system that moved.

## Left out

- Bicep, CloudFormation and ARM templates; Helm (its commands are in the gate rules, but there is no Helm runbook); EKS, AKS and GKE identity integrations for pods; Cloud SQL, RDS and Azure SQL beyond restore.
- Read-only cloud connectors: every gate's read-back is "none" with the output a person pastes. A future batch could add AWS, Azure and Google Cloud read adapters like `scripts/adapters/`.
- A fresh-context review of this lane: the brief says not to start subagents, so the batch's evidence-reviewer is the independent read.

## Findings for the batch lead (files outside this lane, not edited)

1. **Google Cloud docs moved host.** Every `cloud.google.com/...` page answered 301 to `docs.cloud.google.com/...`. The tool server's allowlist names `cloud.google.com` only, so a sealed session's `docs_fetch` of a Google Cloud page will meet a redirect to an off-list host.
2. **Scanner gaps seen from this lane:** `sudo systemctl restart` and `journalctl --vacuum-time` are not sinks in the widened scanner; the two Linux gates own only their before-state redirect. `aws sts decode-authorization-message` (a read) and `kubectl exec` count as writes; handled as above.
3. **`scripts/demo/expert-rules.js` `labeledParts` reads labels inside fenced code:** a YAML `options:` key was taken as the Engineer answer's Options part and failed a good answer ("parts out of order"). The fixture uses flow-style YAML to avoid it; skipping fenced lines in the parser would be the fix.
4. **Counts that every lane changes:** `repository-structure.test.js` (115 here), `read-back-field.test.js` and `gate-r-class.test.js` (372 here). Merging four lanes needs the sum, not one side.
5. **`ladder-audit.js` `vendorOf`** puts every runbook without a vendor prefix under Microsoft, so these seven cloud runbooks show as Microsoft rows in `docs/aegis/ladder-audit.md`.
6. **`pre-commit-check.js` WARNs on "SCP"** (the scp/sftp pattern) in lines about AWS service control policies; WARN only, the commits proceed.

## Open questions

- Should these rows replace capability-map rows 18 and 19, or follow them?
- Which on-call roles and owner registers does the owner want named (the `[org gap]` markers in the runbooks and `escalation.md`)?
- Should an R2 grant name its own read-back command once a cloud read connector exists?
