Mode: Incident answer
Assumed setup: Microsoft 365 with Exchange Online and Defender for Office 365 (no company profile given). Tell me what your company runs for a better answer.
## Incident answer
**Severity:** SEV-1: money already left to an account we did not approve, and the mailbox that asked for the change may still be in someone else's hands.
**Contain first:**
1. Recall or hold the payment: the finance lead decides and calls our bank now on the number on the bank card or the bank's own site; cost: none, speed is the only remedy.
2. Hold every other payment and bank-detail change for that vendor: the finance lead decides; cost: a late payment to a real vendor.
3. Lock down the mailbox that received the change request (end its sessions, reset its password by phone, capture then turn off any forwarding or rule): the security lead decides; cost: that person is offline for an hour.
**Preserve:** before step 3 changes anything, export the change-request message with full headers, the mailbox's rules and forwarding as they are, its sign-in log for the last 30 days, and the payment record.
**Escalate to:** the security on-call now, by phone. They need the vendor, the payment time and amount, the change-request message with headers, which mailbox received it, and what finance has done.
**Communications:** leadership and legal now, by phone, because money left; the vendor on a number already on file, never one in the message. Thank the finance director for raising it fast; ask them not to reply to or delete the message. No guess yet about whose mailbox was used.
**Timeline:** change request received unknown; payment made yesterday; vendor call today; reported now.

## Human-run and read-back
- **Recall or hold the payment.** Runs it: the finance lead, by phone to the bank. Confirms first: the number comes from the bank card or the bank's own site. Verify: the bank confirms the hold or recall in writing.
- **Hold other payments and bank-detail changes for that vendor.** Runs it: the finance lead. Confirms first: the vendor's number on file. Verify: the payment system shows that vendor on hold.
- **Lock down the mailbox that received the request.** Runs it: an administrator, on the security lead's go. Confirms first: the message, rules, forwarding and sign-in log are exported. Verify: the mailbox shows no active sessions and no forwarding. The /identity-compromise runbook's gates cover this (Details).

## Details
Step 3's changes are owned by `/identity-compromise` (sessions, password, forwarding and rule gates, each R1 or R2 with its read-back). Later rung, only if the security lead orders it: block the sending domain with `phishing-bec-block-sender-portal`. Ticket note: `/phishing-bec`'s note, payment fraud form.

```aegis-desk
Gate: none
```
