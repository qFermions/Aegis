---
description: Troubleshoot Gmail delivery in Google Workspace — external mail bouncing inbound, or our outbound mail (scan-to-email, apps) landing in spam — Email Log Search and DNS checks first, then gated MX, SPF, DKIM and DMARC changes that a human makes at the DNS host. Placeholders only.
disable-model-invocation: true
---

# /gws-gmail-delivery

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

**Placeholders:** `[USER@DOMAIN.COM]` (the affected mailbox) · `[@Aegion_DOMAIN]` (the sending and receiving domain) · org values from `modules/security/placeholder-dictionary.md`. The DNS host for `[@Aegion_DOMAIN]` is an **[org gap]** — read it from the registrar record on file, never guess it.

## Verdict

Two different tickets hide under "mail problems":

- **Inbound bounce, external senders only** ("mail from outside bounces, internal mail is fine"): internal mail never touches DNS, so the first suspects are the domain's MX records and Gmail's front door (inbound gateway, blocked senders, a missing alias). The bounce text the external sender received names the hop that rejected it.
- **Outbound mail filed as spam** ("our scan-to-email notices land in spam since Monday, nothing changed on our side"): Google's sender guidelines require SPF or DKIM for every sender and SPF, DKIM and DMARC for bulk senders. A device that sends as `[@Aegion_DOMAIN]` from outside Google's servers, or a DKIM key that no longer matches DNS, fails authentication and is filed as spam. "Nothing changed" usually means the receiver's rules changed, or a DNS record did.

## What to check first

1. **Email Log Search (R0):** Admin console → Reporting → Email Log Search → enter the sender or recipient and the date range → read the delivery status. It needs the Gmail Settings privilege, cannot show message contents, and keeps 30 days — older messages need the recipient and message ID and show post-delivery status only. A message absent from ELS never reached Google.
2. **The bounce text (R0):** ask the external sender for the full bounce. Google's own codes: `550 5.1.1` means "The email account that you tried to reach does not exist"; `550 5.7.1` is a policy rejection.
3. **DNS from the outside (R0):** Google Admin Toolbox Check MX (toolbox.googleapps.com/apps/checkmx) → enter `[@Aegion_DOMAIN]` → read the MX and SPF findings.
4. **DKIM status (R0):** Admin console → Apps → Google Workspace → Gmail → Authenticate email → read the status for `[@Aegion_DOMAIN]`.
5. **Headers from a recipient (R0):** in Gmail, next to Reply → More → Show original → read the SPF, DKIM and DMARC results on the spam-filed copy; for other mail systems paste the header into the Google Admin Toolbox Messageheader tool.

## Step-by-step fix

### Phase 1 — Inbound: external mail bounces, internal mail arrives

**Purpose** — find where the message died: before Google (DNS), at Google's door (inbound settings), or at the address.

1. Admin console → Reporting → Email Log Search → recipient `[USER@DOMAIN.COM]`, the sender's address and the date → read the result.
   - **No row at all:** the message never reached Google. Go to step 2.
   - **A row with a rejected or bounced status:** read the reason — a routing or compliance rule, the inbound gateway, or a blocked sender. Go to step 3.
   - **Delivered:** it is in the mailbox (a filter, forwarding, or the Spam folder); not a delivery problem — work it with the user.
2. Check MX (toolbox.googleapps.com/apps/checkmx) → `[@Aegion_DOMAIN]` → read whether the MX records point at Google. Then Admin console → Account → Domains → Manage domains → read the domain's status. Google says new MX records can take up to 72 hours to take effect — a registrar change last week explains a "since last week" ticket.
3. Admin console → Apps → Google Workspace → Gmail → Spam, Phishing and Malware → read the **Inbound gateway** setting (a gateway you no longer route through makes Gmail distrust mail that arrives directly) and the blocked-sender settings.
4. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the primary address and the aliases. A `550 5.1.1` from outside while internal mail works usually means the outside world uses an alias that does not exist.

**Done when:** you can name the hop that rejected the message. A wrong MX record set is fixed by the gate below. An inbound-gateway or routing change, or a missing alias, is each its own gated change — write it up as a separate ticket with the ELS evidence instead of editing from this runbook.

<!-- SAFETY GATE [gws-gmail-delivery-mx-change-portal] -->
- **Target:** [@Aegion_DOMAIN] MX records at its DNS host
- **Effect:** change the MX records for the domain so inbound mail is delivered to Google's mail servers
- **Scope:** one domain's MX record set; every inbound message for the domain is affected once DNS propagates
- **Reversibility:** R2 — copy the current MX records into the ticket first (the pre-state); the previous set can be re-entered at the DNS host under its own phrase, and either direction can take up to 72 hours to propagate
- **Required confirmation:** Type exactly `CHANGE MX RECORDS FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (DNS records at the domain host: no connector reads DNS)
**PORTAL ACTION [gws-gmail-delivery-mx-change-portal]:** Only after the pre-state is in the ticket and the exact match, and only by the human administrator signed in at the DNS host:
1. At the DNS host, open the DNS records for `[@Aegion_DOMAIN]` and replace the MX record set with the Google MX values shown on Google's "Set up MX records for Google Workspace" page.
2. Save, then **WAIT UNTIL** Check MX reports Google's MX records (up to 72 hours).
3. Read-back: Admin console → Reporting → Email Log Search → a fresh external test message to `[USER@DOMAIN.COM]` shows a delivered status.

### Phase 2 — Outbound: our mail lands in recipients' spam

**Purpose** — prove how the message leaves and whether it authenticates before touching DNS.

1. Find how the device sends — **[org gap]**. Admin console → Apps → Google Workspace → Gmail → Routing → read the **SMTP relay service** setting. Google recommends the relay for devices and apps (`smtp-relay.gmail.com` on port 25, 465 or 587, authenticated by IP address); a device using `smtp.gmail.com` sends with a user's own credentials; a device that sends straight to the internet from its own address never touches Google and must be covered by SPF.
2. Admin console → Reporting → Email Log Search → sender = the device's address, the date → read the delivery status. Google monitors relay traffic and emails the super administrators when a user sends a significant amount of spam — read that mailbox too.
3. From a recipient's copy: Gmail → More → Show original → read the SPF, DKIM and DMARC lines — PASS or FAIL each, and which domain was checked. Non-Gmail headers go into the Messageheader tool.
4. Admin console → Apps → Google Workspace → Gmail → Authenticate email → read the DKIM status for `[@Aegion_DOMAIN]`. Check MX → read the SPF record: it must include every sender for the domain (`include:_spf.google.com` covers Google's servers only).
5. Compare with Google's sender guidelines: every sender needs SPF or DKIM, valid forward and reverse DNS, and a spam rate under 0.3% in Postmaster Tools; a sender of 5,000 or more messages a day to Gmail needs SPF and DKIM and a DMARC record (its policy may be none).

**Done when:** you know which check fails (SPF, DKIM, DMARC alignment, reputation) and which sending path produces it. Then gate the matching fix — each is a DNS or Admin console change a human makes, in the order SPF → DKIM → DMARC.

<!-- SAFETY GATE [gws-gmail-delivery-spf-change-portal] -->
- **Target:** [@Aegion_DOMAIN] SPF TXT record at its DNS host
- **Effect:** change the SPF TXT record so it lists every service that sends mail as the domain
- **Scope:** one TXT record; it changes how every receiver evaluates mail from the domain
- **Reversibility:** R2 — record the current TXT value first; re-entering it under its own phrase restores the old behavior after DNS propagation (allow 48 hours)
- **Required confirmation:** Type exactly `CHANGE SPF RECORD FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (DNS records at the domain host: no connector reads DNS)
**PORTAL ACTION [gws-gmail-delivery-spf-change-portal]:** Only after the pre-state is in the ticket and the exact match:
1. At the DNS host, edit the SPF TXT record for `[@Aegion_DOMAIN]` so it includes Google (`v=spf1 include:_spf.google.com ~all` is Google's own example) plus the mechanism for the device or third-party sender. Nothing is needed in the Admin console for SPF.
2. Save, then **WAIT UNTIL** Check MX reports the new SPF record; allow 48 hours before judging results.

<!-- SAFETY GATE [gws-gmail-delivery-dkim-generate-portal] -->
- **Target:** [@Aegion_DOMAIN] DKIM key in the Admin console
- **Effect:** create a new DKIM key and TXT record value for the domain; signing does not start yet
- **Scope:** one domain's DKIM key; outgoing mail is unaffected until Start Authentication is clicked in a later gate
- **Reversibility:** R1 — an unpublished, unstarted key changes nothing; generating again replaces the pending value
- **Required confirmation:** Type exactly `CREATE DKIM KEY FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-gmail-delivery-dkim-generate-portal]:** Only after the exact match:
1. Admin console → Apps → Google Workspace → Gmail → **Authenticate email** → select `[@Aegion_DOMAIN]` → **Generate New Record** → choose the 2048-bit key if the DNS host supports it, keep the default `google` prefix selector → **Generate**.
2. Copy the TXT record name (`google._domainkey` by default) and the TXT record value shown. Do not click Start Authentication yet.

<!-- SAFETY GATE [gws-gmail-delivery-dkim-dns-portal] -->
- **Target:** [@Aegion_DOMAIN] DKIM TXT record at its DNS host
- **Effect:** add the DKIM TXT record from the previous gate at the DNS host
- **Scope:** one new TXT record; nothing changes in mail flow until signing starts
- **Reversibility:** R1 — delete the TXT record at the DNS host under its own phrase
- **Required confirmation:** Type exactly `ADD DKIM TXT RECORD FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-gmail-delivery-dkim-dns-portal]:** Only after the exact match, by the human administrator at the DNS host:
1. At the DNS host, add a TXT record with the name and value copied from the Authenticate email page.
2. Save, then **WAIT UNTIL** the record resolves. Google says DKIM authentication can take up to 48 hours to start working after the key is added, and the Admin console may keep showing "You must update the DNS records" for up to 48 hours.

<!-- SAFETY GATE [gws-gmail-delivery-dkim-start-portal] -->
- **Target:** [@Aegion_DOMAIN] DKIM signing
- **Effect:** enable DKIM signing of outgoing mail for the domain
- **Scope:** every message Google sends for the domain is signed from now on
- **Reversibility:** R1 — signing can be turned off again from the same Authenticate email page under its own phrase, after which receivers evaluate SPF alone [unverified: the fetched page does not quote the stop control]
- **Required confirmation:** Type exactly `ENABLE DKIM SIGNING AND START AUTHENTICATION FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-gmail-delivery-dkim-start-portal]:** Only after the TXT record resolves and the exact match:
1. Admin console → Apps → Google Workspace → Gmail → **Authenticate email** → select `[@Aegion_DOMAIN]` → **Start Authentication**.
2. Read-back: the page's status shows the domain authenticating, and a fresh test message's Show original reads DKIM PASS for `[@Aegion_DOMAIN]`.

<!-- SAFETY GATE [gws-gmail-delivery-dmarc-add-portal] -->
- **Target:** [@Aegion_DOMAIN] DMARC TXT record at its DNS host
- **Effect:** add a DMARC TXT record at the _dmarc host telling receivers what to do with mail that fails SPF and DKIM
- **Scope:** one TXT record; with policy none receivers only report, nothing is rejected
- **Reversibility:** R1 — delete the TXT record at the DNS host under its own phrase
- **Required confirmation:** Type exactly `ADD DMARC RECORD FOR [@Aegion_DOMAIN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [gws-gmail-delivery-dmarc-add-portal]:** Only after SPF and DKIM have been authenticating for at least 48 hours (Google's prerequisite) and the exact match:
1. At the DNS host, add a TXT record at `_dmarc.[@Aegion_DOMAIN]` built from Google's "Set up DMARC" page — start with `v=DMARC1; p=none;` and a reporting address you control.
2. Save, then read-back: the `dig` query below returns the record, and a fresh test message's Show original reads DMARC PASS.

<details>
<summary>Terminal — read-only DNS checks (HUMAN-RUN, for reference)</summary>

```zsh
# HUMAN-RUN — read-only DNS lookups from any Mac; nothing here changes anything
dig +short MX [@Aegion_DOMAIN]   # lists the MX records the world sees; they should be Google's
dig +short TXT [@Aegion_DOMAIN]   # shows the SPF record (the v=spf1 line) and any other TXT values
dig +short TXT google._domainkey.[@Aegion_DOMAIN]   # shows the DKIM public key record for Google's default selector
dig +short TXT _dmarc.[@Aegion_DOMAIN]   # shows the DMARC record (v=DMARC1 ...), or nothing if none exists
```
</details>

## ⚠️ Risk warning

- **DNS changes hit every message for the domain.** A wrong MX set stops all inbound mail; a wrong SPF record fails every outbound message. Capture the pre-state in the ticket before any gate, and expect up to 72 hours (MX) or 48 hours (SPF, DKIM, DMARC) before judging the result.
- **Do not click Start Authentication before the DKIM TXT record resolves** — mail would be signed with a key receivers cannot verify, which is worse than unsigned.
- **DMARC starts at policy none.** A reject or quarantine policy before SPF and DKIM are right bounces the organization's own legitimate mail.
- Do not "fix" spam placement by widening SPF to allow everything, by routing the scanner through a personal account, or by asking recipients to allowlist the domain — fix authentication.
- The inbound gateway, routing rules and aliases are each their own gated change; this runbook reads them and does not edit them.

## ✅ Verification checklist

- [ ] Check MX (toolbox.googleapps.com/apps/checkmx) reports Google's MX records and one valid SPF record for `[@Aegion_DOMAIN]`.
- [ ] Inbound case: Admin console → Reporting → Email Log Search shows a delivered status for a fresh external test message to `[USER@DOMAIN.COM]`.
- [ ] Outbound case: a recipient's Show original on a fresh scan-to-email message reads SPF PASS, DKIM PASS and DMARC PASS; Authenticate email shows `[@Aegion_DOMAIN]` authenticating.
- [ ] `dig +short TXT _dmarc.[@Aegion_DOMAIN]` returns the DMARC record if one was added.
- [ ] Admin console → Reporting → Audit and investigation → Admin log events shows the DKIM change with the admin and time; the DNS host's change history shows the record edits.

## 📝 Jira-ready note

> Resolved [date/time]. [Inbound: external mail to `[USER@DOMAIN.COM]` bounced with `[SMTP code]` while internal mail delivered / Outbound: scan-to-email messages from `[@Aegion_DOMAIN]` were filed as spam by recipients]. Cause: [MX records not pointing at Google / inbound gateway no longer in use / missing alias / SPF missing the device's sender / DKIM key not matching DNS / no DMARC record]. Fix: [record changed at the DNS host by the administrator, confirmed by the exact phrase; DKIM generated, published and started], pre-state recorded in this ticket. Verified: Email Log Search shows delivered; recipient headers read SPF, DKIM and DMARC PASS; Check MX clean. Time spent: [X] min.

## Aha moment

Internal mail never touches DNS: the moment a ticket says "inside works, outside doesn't", you are debugging MX records and the front door, not Gmail itself — and "nothing changed on our side" is a claim about the Admin console, not about the DNS zone.

## Career upgrade

Reading SPF, DKIM and DMARC results straight from headers is the same evidence discipline as reading a TLS handshake: authentication outcomes are data you verify, not opinions you argue.

## Next action

Run the Email Log Search for the ticket's message and record whether it never arrived, which hop rejected it, or that it delivered — that one line decides which phase you are in.

**Sources (checked 2026-10-15):** knowledge.workspace.google.com/admin/support/troubleshooting/find-messages-with-email-log-search · knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times · knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace · toolbox.googleapps.com/apps/checkmx · toolbox.googleapps.com/apps/messageheader · knowledge.workspace.google.com/admin/support/troubleshooting/gmail-smtp-errors-and-codes · knowledge.workspace.google.com/admin/gmail/advanced/set-up-an-inbound-mail-gateway · knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app · knowledge.workspace.google.com/admin/gmail/advanced/route-outgoing-smtp-relay-messages-through-google · knowledge.workspace.google.com/admin/security/set-up-spf · knowledge.workspace.google.com/admin/security/set-up-dkim · knowledge.workspace.google.com/admin/security/set-up-dmarc · support.google.com/mail/answer/81126 (Email sender guidelines) · support.google.com/mail/answer/9981691 (Postmaster Tools) · support.google.com/mail/answer/29436 (Show original) · support.google.com/mail/answer/180707 (message authentication) · knowledge.workspace.google.com/admin/reports/admin-log-events.
