---
description: Whitelist a sender or domain in Microsoft 365 — five methods ranked by safety, tradeoffs explained, safest approach recommended. Portal first. Placeholders only.
---

# /email-whitelist

**Verdict:** There are five ways to allow a sender or domain in M365, and they are NOT equally safe. The **Tenant Allow/Block List** in Defender is the recommended default — scoped, auditable, time-limited. Every broader method bypasses progressively more filtering and increases phishing exposure.

## What to check first
- Is this a one-time false positive, or a recurring pattern? One-time → release from quarantine + report FP. Recurring → add an allow.
- Is this a specific sender or an entire domain? Sender-level is always safer than domain-level.
- Is the sender external or internal? Internal mail issues usually mean a connector or relay problem — not a whitelist job.
- Check the message trace first to confirm the exact block reason: `Exchange admin center (admin.exchange.microsoft.com) → Mail flow → Message trace → search by [SENDER] / [USER@DOMAIN.COM]`.

## Step-by-step fix — choose the right method

### Method 1 — Tenant Allow/Block List (RECOMMENDED)
**Safety: Highest.** Scoped to specific sender/domain, time-limited, reviewable, does not bypass authentication checks.

`Defender portal (security.microsoft.com) → Email & collaboration → Policies & rules → Threat policies → Tenant Allow/Block Lists → Senders tab → + Add`

- **Entry:** `[SENDER]` for a single address, or `*@[DOMAIN]` for a whole domain (use sparingly)
- **Action:** Allow
- **Expiry:** 30–90 days recommended — set a review date, don't leave it permanent
- **Note:** document the ticket number `[JIRA-###]` and reason

Use this for: trusted vendors, known-good newsletters, partner orgs with occasional false positives.

---

### Method 2 — Anti-spam policy: allowed senders / domains
**Safety: Medium.** Bypasses spam filtering for the listed sender/domain, but authentication checks (SPF/DKIM/DMARC) still apply. Applies to all users covered by the policy (often org-wide).

`Defender portal → Email & collaboration → Policies & rules → Threat policies → Anti-spam → [policy name] → Edit → Allowed and blocked senders and domains → Allowed senders / Allowed domains → + Add`

- Add `[SENDER]` or `[DOMAIN]`
- Save

Use for: high-volume trusted senders where TABL expiry management is impractical (e.g., a payroll system that sends to all staff). Use sparingly — any compromise of the sender's account bypasses spam filtering for your whole org.

**Do NOT add broadly trusted domains like gmail.com, outlook.com, or major ESPs here.** Attackers spoof exactly those domains.

---

### Method 3 — Exchange mail flow (transport) rule to set SCL -1
**Safety: Low. Last resort only.** SCL -1 bypasses ALL spam and bulk filtering. Unlike methods 1–2, a well-crafted transport rule can also bypass phishing and malware checks if written broadly.

`Exchange admin center (admin.exchange.microsoft.com) → Mail flow → Rules → + Add a rule`

Example rule to set SCL -1 for a specific sender:
- **Name:** Allow [SENDER] — bypass spam `[JIRA-###]`
- **Apply this rule if:** The sender is `[SENDER]`
- **Do the following:** Set the spam confidence level (SCL) to -1
- **Priority:** set high (low number) so it fires before block rules
- **Enable/Save**

Use only when: a specific sender is required by the business, TABL and anti-spam policy are insufficient (e.g., the sender's IP changes constantly and authentication fails), and you have confirmed the sender is legitimate.

⚠️ Always scope the condition as narrowly as possible (specific sender address, not a domain wildcard).

---

### Method 4 — Per-user Safe Senders in OWA/Outlook
**Safety: Medium (user-scoped only).** Only affects the individual user's junk filtering — does not touch org-level spam policies. Simplest for one-off user requests.

User-side (the user does this themselves in OWA):
`OWA (outlook.office.com) → Settings (gear icon) → Mail → Junk email → Safe senders and domains → + Add → [SENDER] → Save`

Admin-side (for a managed user via PowerShell — see PS block below).

Use for: a single user reporting a specific sender as landing in Junk, where the message is already being delivered (not quarantined).

---

### Method 5 — Connection filter IP allow list
**Safety: Low. Use only for known IP ranges you control.** Bypasses spam and malware filtering for all mail from the listed IPs. Typically used for on-prem relay servers or branch office mail flows.

`Defender portal → Email & collaboration → Policies & rules → Threat policies → Anti-spam → Connection filter policy (Default) → Edit → Always allow messages from the following IP addresses or address range → + Add → [IP_ADDRESS_OR_RANGE]`

Use for: your own on-prem mail relay, a known MFP/scanner IP, or a trusted third-party sending service with a static IP. **Never add broad public IP ranges here.**

---

### Decision matrix

| Scenario | Recommended method |
|----------|-------------------|
| Occasional false positive from one sender | Method 1 — TABL, 30-day expiry |
| High-volume trusted vendor (whole domain) | Method 2 — Anti-spam allowed domain (review quarterly) |
| Sender auth keeps failing, business-critical | Method 3 — Transport rule SCL -1, narrowly scoped |
| Single user, already delivered to Junk | Method 4 — Per-user Safe Senders |
| On-prem relay or MFP scanner | Method 5 — Connection filter IP |

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Install Exchange Online module if not already present
Install-Module ExchangeOnlineManagement -Scope CurrentUser

# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName "[UPN]"   # sign in as Exchange admin

# --- Method 2: Add an allowed sender to the Default anti-spam policy ---
Set-HostedContentFilterPolicy -Identity "Default" `
    -AllowedSenders @{Add = "[SENDER]"}              # add one sender to the allow list
    # ⚠️ use @{Add=...} to append, NOT a plain array — that overwrites the existing list

# Add an entire domain to the allowed domains list
Set-HostedContentFilterPolicy -Identity "Default" `
    -AllowedSenderDomains @{Add = "[DOMAIN]"}        # ⚠️ bypasses spam filtering for whole domain — use sparingly

# View current allowed senders/domains on the Default policy
Get-HostedContentFilterPolicy -Identity "Default" |
    Select-Object AllowedSenders, AllowedSenderDomains   # confirm what's already in the list

# --- Method 4: Add a Safe Sender for a specific user (admin-managed) ---
Set-MailboxJunkEmailConfiguration -Identity "[UPN]" `
    -TrustedSendersAndDomains @{Add = "[SENDER]"}    # adds to the user's personal safe senders list
    # does NOT affect org-level spam filtering — scoped to this mailbox only

# View a user's current safe senders list
Get-MailboxJunkEmailConfiguration -Identity "[UPN]" |
    Select-Object TrustedSendersAndDomains           # show what's on the list now
```
</details>

## ⚠️ Risk warning
- **Domain-level allows (any method) let ALL mail from that domain bypass filtering** — including mail from a compromised account at that domain, or a spoofed address that passes SPF/DKIM. Never add high-volume public domains (gmail.com, yahoo.com, outlook.com).
- **SCL -1 transport rules bypass phishing and malware checks** if scoped too broadly. Scope to the narrowest possible condition (exact address, not a domain wildcard).
- **Connection filter IP allows are permanent** until manually removed. Document every IP added and review quarterly.
- **Never add an allow entry because a user "needs it urgently" without checking the message trace first.** Urgency is a social engineering pattern. Verify the sender is legitimate.
- Any org-wide change (Methods 2, 3, 5) should be reviewed before applying. Route to Nova if the change affects all users.

## ✅ Verification checklist
- [ ] Message trace confirms the block reason and the allow method chosen addresses it
- [ ] Allow entry added with the correct scope (sender vs domain, method chosen matches risk level)
- [ ] Expiry date set and calendar reminder created for review (Methods 1, 2)
- [ ] Test email sent from `[SENDER]` to `[USER@DOMAIN.COM]` and delivered to inbox (not Junk, not quarantine)
- [ ] Entry documented in Jira with business justification

## 📝 Jira-ready note
> Resolved [date/time]. Legitimate mail from [SENDER] was being [quarantined / landing in Junk] for [USER@DOMAIN.COM]. Root cause: [spam verdict / failed auth / SCL threshold]. Added sender to [Tenant Allow/Block List / anti-spam policy / Safe Senders] using [Method 1/2/3/4/5]. Expires [date] or reviewed [quarterly]. Test email confirmed delivery to inbox. Time spent: [X] min.
