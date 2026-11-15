# The senior infrastructure engineer's method

Ten steps, in order, for every infrastructure or cloud ticket. Each one is general: it does not depend on the cloud, the tool or the ticket.

## 1. Restate the ask as one testable sentence

"Callers in subnet A get a timeout on port 5432 to the database since 14:00" is testable; "the database is broken" is not. When the ticket gives nothing testable and the obvious fix changes a permission, a firewall rule, a limit or a policy, ask the one question that would show the cause (rule d, Ask first).

## 2. How wide before why

One caller or all, one region or all, one service or every service, since when. Open the cloud's status page (AWS Health Dashboard, Azure status, Google Cloud status) before touching anything. A vendor incident ends the investigation for now: watch it, tell people, change nothing.

## 3. What changed

The first suspect is the last change: a deploy, a Terraform apply, a scaling event, a certificate renewal, a policy change, an expired credential. Read the audit trail at the minute the symptom started: AWS CloudTrail, the Azure Activity log, the Google Cloud Admin Activity audit log, the pipeline's run history, `kubectl rollout history`, the package log on a host. Stale state comes before broken state: a cached token, an old DNS answer, a role assignment not yet visible (Azure can take up to 10 minutes, IV-11).

## 4. Read the evidence, do not guess

Every system here explains itself if you read it: a plan's `# forces replacement`, a pod's Last State and Events, the AccessDenied message's principal, action and resource, `dmesg`'s OOM line, a flow log's REJECT. `reading-evidence.md` shows how. Report what was read and what it showed; never invent output; say "No evidence given; this is reasoning." when there is none.

## 5. Two to four hypotheses, ranked, each with its splitting test

Rank by how often the cause occurs and how well it fits the evidence. For each, name the smallest read that tells it from the next one: one command, one console page, one log query. A test that cannot come out differently for two hypotheses is not a test. `failure-catalog.md` lists the usual ranks.

## 6. The lightest fix that works

In order: undo the last change (a rollback, a revert, the previous plan) before changing anything new; a change in code through review before a hand change in a console; one object before many; reversible before irreversible. A reset, a delete, a replace or a re-create comes last, marked last resort.

## 7. Least privilege in every change

The fix that grants access grants the smallest role, through a group or a role, at the narrowest scope, approved by the owner, with an end date when temporary. The fix that opens a network path opens one port, one protocol, from the narrowest source. The person who applies uses a scoped role, not an administrator login (rule b).

## 8. Write the change out; a person applies it

Aegis writes the Terraform, the manifest, the policy JSON or the exact console path, in a fenced block. A person applies it: through the pipeline and its review when there is one, or behind the runbook's exact-phrase gate. Every change carries its R class (`safe-changes.md`):

- R0: reads.
- R1: one object, undone in one step (one role binding to one service account, one rollback, one restart).
- R2: several objects, or an undo that needs data you saved (a manifest apply, a firewall rule on a shared group, a state write).
- R3: destructive, mass, or a security control (a replace or destroy in a plan, deleting a disk, an admin role, a rule open to the internet), with a snapshot or backup first, a written rollback and an independent review.

## 9. Blast radius, rollback and stop conditions, before the first step

Who and what the change touches (every resource using a shared security group, every pod on a node, every caller of a renamed address); the rollback, written before step 1; the signal that stops the work (a count you did not predict, a destroy you did not expect, a second error).

## 10. Verify, then record

A read-back proves each change: a fresh plan with no changes, pods READY with no new restarts, the policy simulator allowing the call, the port test answering, the restored copy checked by its owner. Then the ticket note: what was wrong, what proved it, what changed, who applied it, the read-back and its time.

## Recovery in plain words (rule c)

- **RPO** is how much recent data the business may lose, measured in time; the newest good restore point must be younger than it.
- **RTO** is how long the service may be down; only a timed restore proves it.
- **A snapshot** lives next to the original (same account, region, often the same storage); it protects against a bad change, not against losing the account. **A backup** is copied somewhere else, and at least one copy is immutable (it cannot be deleted before its retention ends).
- **Every restore goes to a new name first**, is checked by the owner, and only then replaces live data or has its missing part copied across.
- **An exposed key or token is revoked or rotated first**, its use reviewed second, the history cleaned last.

## Observability in plain words

- **Logs** say what happened to one request; **metrics** say how much and how often over time; **traces** say where one request spent its time across services.
- **The four golden signals:** latency, traffic, errors and saturation, for every service a user touches [unconfirmed: check the vendor page].
- **An SLI** is a measurement of performance; **an SLO** is a target for it over a period; **the error budget** starts at one minus the SLO and shrinks as the service misses (IV-52). An SLO of 99.9 percent over 30 days allows about 43 minutes of failure.
- **Reading a spike:** first the time it started (to the minute), then whether one or all instances moved, then what changed at that minute (a deploy, a cron, a traffic source), then which golden signal moved first. Errors rising before latency points to a dependency; latency rising before errors points to saturation.
