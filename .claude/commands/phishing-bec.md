---
description: Phishing and business email compromise - a reported phish, a click, a typed password, an opened attachment, a mailbox takeover, or a payment or bank-detail change. Size how far it got, escalate, block the sender (R1) and soft-delete the message from every mailbox (R2) in Microsoft 365, route the account and the device to their runbooks, and for payment fraud get finance to call the bank now on a number they already hold. Placeholders only.
disable-model-invocation: true
---

# /phishing-bec

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Answer mode:** `Mode: Incident answer` whenever someone clicked, typed a password, opened an attachment, or money or bank details are involved. A plain "is this phishing?" with no action taken is still a security report: Incident answer at SEV-4, or SEV-3 while it is unknown whether other recipients clicked. A helpdesk ask that mentions a click in passing stays `Mode: Fix card` and adds the escalation as a step.

**Placeholders:** `[UPN]` (the reporter or the mailbox) · `[FIRST_NAME]` · `[MESSAGE_ID]` (the message's Message-ID header) · `[MESSAGE_COUNT]` (how many delivered copies the purge selects) · `[EXTERNAL_DOMAIN]` (the sending domain) · `[DEVICE_NAME]` · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Knowledge:** `knowledge/security/decision-trees.md` tree 7, `reading-evidence.md` (message headers, mailbox rules), `escalation.md`.

## ⚠️ Admin / safety gate

- **Escalate on any action taken.** A click, a typed password, an approved prompt, an opened attachment or a payment change goes to the security on-call now, with the hand-over.
- **Keep the message.** Ask the reporter to report it with the mail client's report button or forward it as an attachment; never to delete it before the purge.
- **Never trust details inside the message.** Phone numbers, bank details and links in it are the attacker's. Calls go to numbers already on file.
- **A real partner's domain is never blocked first.** Their mailbox may be the compromised one: block the single address, tell the partner on a known number, and let their admin fix it.
- **Money is the decider's.** Only the finance lead calls the bank; only leadership with legal decides anything about the attacker.

## Inputs needed

- The message (as an attachment or its headers) and how far the reporter got: opened, clicked, typed a password, approved a prompt, opened an attachment, replied, paid.
- Who else received it, from the message trace or Explorer.
- For payment fraud: the payment, the amount, the date and time, the account it went to (from the finance record, not the message), and the finance lead.

## Fast path

1. Phase A: how far did it get, and escalate (R0).
2. Phase B: block the sender, then soft-delete the message from every mailbox.
3. Phase C: a typed password or approved prompt goes to `/identity-compromise`; an opened attachment goes to device isolation.
4. Phase D: a mailbox that sent or forwarded goes to `/identity-compromise` Phase D.
5. Phase E: payment fraud, SEV-1.
6. Phase F: who else, and what left (R0).

## Phase A: How far did it get (R0)

1. Read the headers (`knowledge/security/reading-evidence.md`, message headers): Authentication-Results, From against Reply-To and Return-Path. A DNS lookup can show the sending domain's SPF and DMARC records; report what it returned with the tool and the date. Never open the link or the attachment, and never probe the link's host.
2. Find every recipient: Microsoft Defender portal → Email & collaboration → Explorer, filtered on the sender or the subject [unconfirmed: check the vendor page for the menu path]; or Exchange admin center → Mail flow → Message trace.
3. Size it with `decision-trees.md` tree 7 and escalate at that level.

| How far | Severity | Next |
|---|---|---|
| Reported, nobody acted | SEV-4 (SEV-3 until the recipients are read) | Phase B |
| Clicked, nothing typed | SEV-3 | Phase B, and the device's alerts read |
| Typed a password or approved a prompt | SEV-2 | Phase B, then Phase C |
| Opened an attachment that ran | SEV-2 | Phase B, then Phase C (isolate) |
| Mailbox sent or forwarded mail the person did not | SEV-2 | Phase D |
| Money paid or bank details changed | SEV-1 | Phase E now, then the rest |

## Phase B: Block the sender, then remove the message

**Who decides:** a security administrator for the sender block; the security lead or on-call for a purge across mailboxes. The block comes first: it stops new copies while the purge removes the old.

**Role needed for the block:** Security Administrator or Organization Management, or the Tenant AllowBlockList Manager role assigned in the Exchange admin center (SV-73).

<!-- SAFETY GATE [phishing-bec-block-sender-portal] -->
- **Target:** [EXTERNAL_DOMAIN]
- **Effect:** block one sending domain, [EXTERNAL_DOMAIN], in the Tenant Allow/Block List
- **Scope:** inbound mail from [EXTERNAL_DOMAIN] is quarantined as high confidence phishing, and staff cannot send to it either (SV-73); subdomains need their own entry
- **Reversibility:** R1: undo is deleting the entry, or letting it expire on its Remove on date
- **Required confirmation:** Type exactly `BLOCK SENDER DOMAIN [EXTERNAL_DOMAIN] IN THE TENANT ALLOW BLOCK LIST`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [phishing-bec-block-sender-portal]:** Only after the escalation, the check that `[EXTERNAL_DOMAIN]` is not a real partner's, and the exact match:
1. Microsoft Defender portal → Email & collaboration → Policies & rules → Threat policies → Tenant Allow/Block Lists → Domains & addresses (SV-72).
2. Select Add, then Block; enter `[EXTERNAL_DOMAIN]`; keep Remove block entry after at 30 days unless the security lead sets another; put `[JIRA-###]` in the note; then Add (SV-56).
3. Read back: the Domains & addresses list shows `[EXTERNAL_DOMAIN]` with the action Block and its Remove on date.

**Stop if:** the domain belongs to a real partner, supplier or customer: block only the one sending address under the security lead's decision, and call the partner on a number already on file.

**Role needed for the purge:** a security operator with the Search and Purge role, whose action is then approved as the organisation requires (SV-71).

<!-- SAFETY GATE [phishing-bec-purge-portal] -->
- **Target:** [MESSAGE_COUNT] delivered copies of the message [MESSAGE_ID]
- **Effect:** delete [MESSAGE_COUNT] delivered copies of one phishing message by soft delete, recoverable from Recoverable Items
- **Scope:** exactly the copies Explorer selects for [MESSAGE_ID]; the number Explorer shows must equal [MESSAGE_COUNT], and any other number means stop
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object row): soft-deleted messages can be recovered by users and admins (SV-25); the rollback is the remediation's move to inbox for the same copies
- **Required confirmation:** Type exactly `SOFT DELETE [MESSAGE_COUNT] COPIES OF MESSAGE [MESSAGE_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no connector reads Defender remediations: the proof is the Action center History entry with its counts)
**PORTAL ACTION [phishing-bec-purge-portal]:** Only after the recipient list and `[MESSAGE_COUNT]` are in the ticket, the security lead's decision, and the exact match:
1. Microsoft Defender portal → Email & collaboration → Explorer → All email, filtered to `[MESSAGE_ID]` [unconfirmed: check the vendor page for the menu path].
2. Tick exactly the `[MESSAGE_COUNT]` copies; open Take action and pick Soft delete; name the remediation with `[JIRA-###]` (SV-25).
3. Read back: Actions & submissions → Action center → History shows the remediation with its successful and failed counts (SV-25). Any failed copy: write which, and stop.

> **PREVIEW ONLY [phishing-bec-gmail-delete-preview]:** Planning only; this runbook does not authorize it. In Google Workspace, a super admin deletes a phishing message from every inbox with the security investigation tool under the security lead's own reviewed change [unconfirmed: check the vendor page for the tool, its edition and the delete action].

## Phase C: The person typed a password, approved a prompt, or opened an attachment

- **Password typed or prompt approved:** the account is treated as compromised: `/identity-compromise` from Phase A. The new password goes over a verified channel, never by email.
- **Attachment opened and something ran:** treat `[DEVICE_NAME]` as compromised: isolate it (`ransomware-first-hour-isolate-portal` in `/ransomware-first-hour`), do not power it off, and escalate. Its alerts and timeline are evidence.
- **Clicked, nothing typed:** read the device's alerts for that time; no alert and no download leaves it at SEV-3 for the security team to close.

## Phase D: The mailbox sent or forwarded mail the person did not

The mailbox is taken over: `/identity-compromise` (capture, sessions, password, then its forwarding and inbox rule gates). Then warn the people who got mail from it, with words the security lead approves, by a channel other than that mailbox.

## Phase E: Payment fraud (SEV-1)

1. **Now:** the finance lead calls the organisation's bank on a number they already hold (the card, the bank's own website, the contract), asks for a recall or hold of the payment, and writes the reference the bank gives. Speed is the only remedy.
2. **Escalate:** security on-call, leadership and legal, by phone.
3. **Hold:** every other payment to the changed details, and every pending bank-detail change, until the supplier confirms on a number already on file.
4. **Preserve:** the message with headers, the payment record, the call notes and times.
5. **Report:** law enforcement and any regulator, as leadership and legal decide **[org gap: the national reporting route]**.
6. **Find the mailbox:** whose mailbox asked for the change, ours or the supplier's (the headers): ours goes to `/identity-compromise`; theirs, the supplier's admin is told on a known number.

## Phase F: Who else, and what left (R0)

Before anyone says how serious it was: every recipient, who opened, who clicked (Explorer, message trace, the proxy or DNS filter logs if the organisation keeps them), every account that typed a password, and for a takeover, what mail was read or sent (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-20 to MB-23 for the audit search).

## ⚠️ Risk warning

- **Blocking a real partner's domain stops real business.** Block the address, not the domain, when the partner is real.
- **A purge touches many mailboxes.** The count Explorer selects must equal the count in the ticket.
- **Details in the message are the attacker's.** Every call goes to a number already on file.
- **Deleting the reporter's copy before the purge loses evidence.** Keep it until the remediation is done.

## ✅ Verification checklist

- [ ] How far it got is written, with the severity and the escalation.
- [ ] The sender block (when right) shows in the Tenant Allow/Block List.
- [ ] The purge's Action center entry shows the counts, with any failures listed.
- [ ] Every person who typed a password or opened an attachment is in `/identity-compromise` or isolation.
- [ ] Payment fraud: the bank was called, with its reference and time; leadership and legal told.
- [ ] Who else and what left is in the ticket, or the note says it is not yet done.

## 📝 Jira-ready note

> [Phishing or BEC] `[JIRA-###]`: message `[MESSAGE_ID]` from `[EXTERNAL_DOMAIN]`, reported (UTC). How far: (reported / clicked / typed a password / attachment / takeover / payment). Severity SEV-(n). Escalated to (role) at (UTC). Sender blocked (UTC, read back) / not blocked: real partner. Purge of `[MESSAGE_COUNT]` copies (UTC): (n) succeeded, (n) failed. Accounts sent to `/identity-compromise`: (list or none). Payment: bank called by (role) at (UTC), reference (ref). Who else and what left: (finding, or "not yet reviewed"). By [ADMIN_NAME], each change confirmed by its exact phrase. Time spent: [X] min.

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

The phish is the start, not the incident. What matters is how far it got: a report, a click, a password, an attachment, or money. Each step further changes who must decide.

## Career upgrade

Sizing a phishing report by how far it got, and running the payment-fraud call within minutes, is daily work for security operations and email security engineers.

## Next action

Ask how far it got, escalate at that level, and start the sender block.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-security.md`):** learn.microsoft.com/en-us/defender-office-365/tenant-allow-block-list-email-spoof-configure (SV-56) · learn.microsoft.com/en-us/defender-office-365/remediate-malicious-email-delivered-office-365 (SV-25) · learn.microsoft.com/en-us/defender-office-365/responding-to-a-compromised-email-account (SV-08, SV-09).
