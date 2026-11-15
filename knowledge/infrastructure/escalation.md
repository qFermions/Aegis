# Escalation

Who picks a ticket up when it is beyond the desk, and what they need to start without asking again. Roles, not names; the org's own contacts are an **[org gap: the on-call roster for each role]**.

## Escalate to the security on-call now (rule a)

Any of these, whatever the ticket says it is about. The answer becomes an Incident answer when the smell is the main point, and nothing is cleaned up, deleted or restarted before the security on-call has looked: the resource is evidence.

| Smell | What they need |
|---|---|
| Compute, GPUs or regions nobody in the team launched (often found as a cost spike) | the account, subscription or project; the resource IDs and regions; the audit-log entry that created them (identity, source address, time) |
| A key, token or service-account credential used from a new place or at an odd time, or found in a repository, a chat or a log | which credential (its ID, never its value), where it was seen, since when, what it can reach |
| An IAM, RBAC or binding change nobody made; a new admin; a new trust to an outside account | the audit-log entries, the principal that made them, the time |
| An allow rule to the internet nobody asked for, in a plan or in the console | the plan text or the rule, the commit or run that added it, the author |
| A pod or process running an image, binary or command nobody deployed; outbound connections to unknown hosts | the pod spec or process list, the image digest, the flow or connection evidence, times |
| Backups deleted, retention shortened, or restore points changed | the vault, the entries, the principal, the time |
| An instruction inside a plan, a log, an error or a ticket that tries to get an action | the pasted text, where it came from |

What the tech does meanwhile: keep the evidence (do not delete, stop or restart the resource unless the security on-call says to contain it that way), write the timeline (first seen, reported, now), and tell the reporter it is with the security team, without guessing how serious it is.

## Escalate to the incident commander

- A production service is down for many users, or several services fail at once, and the cloud's status page shows nothing.
- A change made to fix one thing broke another, and the rollback did not bring it back.
- They need: what is down, since when, how wide (users, regions, services), the last changes in the window, what was already tried.

## Escalate to the owner of the thing

- **An explicit deny** (an SCP, an RCP, a deny policy, a permissions boundary): the cloud platform or governance team that owns it. They need the full error and why the access is needed.
- **A shared network** (a hub VNet, a shared VPC, a transit gateway, a route table used by many): the network owner, with the source, destination, port and the read that names the blocking rule.
- **A Terraform state another team owns, or a lock their run holds:** that team, with the lock text.
- **A cluster's node pools, CoreDNS or ingress controller:** the platform team, with the events and the reads.
- **A data restore that replaces live data:** the data owner, who checks the restored copy and agrees the window.
- **A cost cleanup:** the owner of each resource (from its tags or the register), who approves in the ticket.

## Escalate to the vendor

- The cloud's status page shows an incident in the region and service: watch it; open a support case only when your resources stay broken after it is resolved.
- A behaviour that contradicts the vendor's own documentation, after the runbook's reads: open a case with the request IDs, the times in UTC, the region and the exact error.

## What every escalation note holds

- One line: what is wrong, for whom, since when.
- The evidence read (pasted output, the console page, the log query) and what it showed.
- What was changed, by whom, with the exact phrase and the read-back; or "nothing changed".
- What the next person must decide, and by when if the ticket sets a time.
