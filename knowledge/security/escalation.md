# Escalation: who is told, how fast, who decides, what they need

> **Execution boundary:** reference and planning text only. It does not authorize any change.

Every answer that finds a smell of compromise names an escalation (judgment rule a). This file says who, how fast, who decides each containment, and what to hand over. It names roles, never people. The organisation fills in the names and numbers in its own on-call list **[org gap: the security on-call route and the out-of-hours number]**.

## The roles

| Role | Who that usually is | What they own |
|---|---|---|
| Security on-call | Whoever holds the security pager or rota this week | The first response, out of hours too; containment decisions until the security lead takes over |
| Security lead | The person accountable for security (in a small organisation, often the IT manager) | Severity, containment decisions with business cost, the investigation, the hand-over to outside help |
| Incident response team | The internal team or the retained outside responder | Forensics, memory and disk images, the eradication plan |
| Leadership | The executive on call, or the head of the organisation | Decisions that stop the business or spend money; outside statements |
| Legal or privacy | Counsel, the data protection or privacy lead | Whether personal or customer data is involved, and what must be reported to whom |
| Finance lead | Whoever approves and releases payments | Calling the bank on a payment fraud; holding payments |
| Data or system owner | The owner of the affected system, repository or app | Approving changes that stop their system; rotating credentials their system uses |
| Cyber insurer | The insurer's breach line, when the organisation holds a policy | Often must be called before outside responders are hired **[org gap: whether a policy exists and its notice terms]** |

## The matrix

| Severity | Who is told | How fast | Who decides containment | Who talks to whom |
|---|---|---|---|---|
| SEV-1 (active, data or money leaving, or the business stopped) | Security on-call by phone now; security lead; leadership; legal or privacy; the incident response team; finance if money moved; the insurer when the policy says so | Now, by phone, not by ticket alone | Security lead (on-call until the lead answers); leadership for shutting down a service or a site | Security lead to leadership; leadership or legal to anyone outside; finance to the bank; nobody talks to the attacker |
| SEV-2 (confirmed compromise of one account, device, key or system) | Security on-call; security lead; the system owner; legal or privacy when personal data may be involved | Within the hour, by phone or the security channel | Security lead or on-call; the system owner for a change that stops their system | Security lead to the system owner and leadership; the tech to the reporter |
| SEV-3 (suspected, no sign of use or spread) | Security on-call or the security queue, marked urgent | The same working day, at once if the evidence grows | The tech for the light steps (session end, password reset, one sender block), with security told; security lead for anything heavier | The tech to the reporter; security lead decides who else hears |
| SEV-4 (a weakness or exposure with no sign of use) | The security queue; the system owner | Within the normal cycle, the same week for an internet-facing weakness | The system owner, with the security lead for risk acceptance | The system owner and the security lead |

Rules that hold at every level:

- **When unsure between two levels, escalate at the higher one.** Security can lower it; nobody can get back the hour lost.
- **Out of hours, a SEV-1 or SEV-2 still goes by phone.** A ticket alone is not an escalation.
- **The tech never waits for an answer before the lightest containment the matrix lets the tech take** (ending sessions, resetting one password, holding a payment by calling finance). Everything heavier waits for its decider.
- **If mail or chat may be compromised, escalate by phone** and agree another channel with the security lead.

## What to hand over

The escalation is one short message, in this order. Copy it into the security channel or say it on the call.

1. **What was seen:** the smell in one sentence, in the reporter's words where they help.
2. **When:** first seen, reported, now; times in UTC; unknown written as unknown.
3. **Which account, device, key or system:** by placeholder in Aegis, by real name only in the organisation's own channel.
4. **Evidence:** what was captured and where it is kept (never the secret itself): log exports, the message with headers, the alert, screenshots of what the person saw.
5. **What was done already, and by whom:** each change with its time; "nothing yet" is an answer.
6. **What is still open:** the containment steps waiting for a decision, each with its cost.
7. **Who the reporter is, and how to reach them** on a channel the attacker cannot read.

Example (placeholders only):

> Security on-call: SEV-2 suspected mailbox takeover. [UPN] reported replies they did not send, 2026-11-14 09:12 UTC. Sign-in log export and the mailbox rule list saved to the incident folder for [JIRA-###]. Done: sessions ended 09:31 UTC by [ADMIN_NAME]. Waiting on you: account block (the person cannot work while blocked), and the review of a forwarding rule to an outside address. Reporter reachable by phone on the number in the staff list.

## When to call outside help

- The incident response team or an outside responder: SEV-1 always; SEV-2 when the attacker had admin rights, when more than one system is involved, or when the security lead cannot be sure what left.
- Law enforcement: ransomware, payment fraud, extortion; leadership and legal decide **[org gap: the national reporting route]**.
- The vendor's own security team: when the compromise sits in their platform (a leaked platform token, an abuse report about their customers).
- Regulators and customers: only legal or privacy decides and speaks.
