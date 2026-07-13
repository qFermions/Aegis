---
description: Check and release quarantined email in Microsoft Defender — find, review, release, report false positive, allow sender, configure notifications. Portal first. Placeholders only.
---

# /email-quarantine

**Verdict:** Quarantined email is held in Microsoft Defender because EOP (Exchange Online Protection) flagged it as spam, phish, malware, or bulk. Always check WHY it was quarantined before releasing — releasing a genuine phish is a security incident.

## What to check first
- Who reported it? User or admin noticing missing mail?
- What quarantine reason appears? Spam / high-confidence spam / phish / high-confidence phish / malware / bulk — each has a different risk profile and release decision.
- Is it actually missing, or in the user's Junk folder instead? Check Junk first — quarantine holds messages EOP actively intercepted.
- How old is it? Quarantine retention default is 30 days. Malware quarantine: 30 days, non-releasable by default.

## Step-by-step fix

### 1. Access quarantine
`Defender portal (security.microsoft.com) → Email & collaboration → Review → Quarantine`

- Default view shows **all quarantined items** across the org (admin view).
- Users can also self-serve their own quarantined mail at `https://security.microsoft.com/quarantine` if their quarantine policy permits it.

### 2. Search for the message
Use the filter bar:
- **Sender:** `[SENDER]`
- **Recipient:** `[USER@DOMAIN.COM]`
- **Subject:** partial match is fine
- **Date received:** narrow the window
- **Quarantine reason:** select from dropdown (spam / phish / malware / bulk / transport rule)

Click **Refresh** after setting filters.

### 3. Review why it was quarantined
Click the message → review the details pane:
- **Quarantine reason** — the primary verdict
- **Spam confidence level (SCL):** 5–6 = spam, 7–9 = high-confidence spam, -1 = bypassed
- **Phish confidence level (PCL)** — shown for phish verdicts
- **Authentication results** — check SPF / DKIM / DMARC pass/fail

Decision guide:
| Reason | Safe to release? |
|--------|-----------------|
| Spam / Bulk | Usually yes — confirm with recipient first |
| High-confidence spam | Review headers; use caution |
| Phish | Do NOT release without thorough review |
| High-confidence phish | Do NOT release — delete it |
| Malware | Cannot release from portal — never should be |

### 4. Release the message
Select the message → **Release email** (top action bar or right-click menu).

Options presented:
- **Release to all recipients** — releases to every quarantined recipient
- **Release to specific recipients** — use this when in doubt
- **Report as "no threats found"** — check this to send a false-positive report to Microsoft (recommended when it was legitimate mail)

Click **Release**.

Allow 5–10 minutes for delivery to the recipient's inbox.

### 5. Report false positive to Microsoft (recommended)
When releasing a legitimate message, always check **"Report message as having no threats"** in the release dialog. This trains the EOP filtering model for your tenant.

Alternatively, submit manually:
`Defender portal → Email & collaboration → Submissions → User reported → Submit to Microsoft for analysis`

### 6. Add sender to allow list (Tenant Allow/Block List — preferred)
To prevent future quarantine of mail from the same sender:

`Defender portal (security.microsoft.com) → Email & collaboration → Policies & rules → Threat policies → Tenant Allow/Block Lists → Senders tab → + Add`

- **Sender:** `[SENDER]` or `*@[DOMAIN]` for a whole domain
- **Action:** Allow
- **Expiry:** set a sensible expiry (30–90 days recommended; review before renewing)
- **Note/Reason:** document why you added it

This is the safest allow method — scoped, auditable, time-limited, and reversible.

See `/email-whitelist` for a full comparison of all allow methods and their tradeoffs.

### 7. Set up quarantine notifications (so users get alerted automatically)
`Defender portal → Email & collaboration → Policies & rules → Threat policies → Quarantine policies`

- Select or create a policy (e.g., "NotifyUsersSpam")
- Enable **End-user spam notifications**
- Set **Notification frequency** (daily or every 3 days recommended)
- Assign the policy to the relevant anti-spam policy under `Defender → Threat policies → Anti-spam → [policy name] → Edit → Spam quarantine action → Quarantine policy`

Users will receive an email digest listing their quarantined messages with a Release / Block option.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Install the Exchange Online module if not already present
Install-Module ExchangeOnlineManagement -Scope CurrentUser

# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName "[UPN]"   # sign in with an admin account

# List quarantined messages for a specific recipient
Get-QuarantineMessage -RecipientAddress "[USER@DOMAIN.COM]" |   # filter by recipient
    Select-Object Subject, SenderAddress, ReceivedTime, QuarantineTypes, Released  # show key fields

# Get details on a specific quarantined message (grab Identity from above output)
Get-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]"   # view full headers and quarantine reason

# Release a quarantined message to the original recipient
Release-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]" -ReleaseToAll   # ⚠️ releases to ALL quarantined recipients

# Release to a specific recipient only
Release-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]" -User "[USER@DOMAIN.COM]"   # safer — single recipient

# Delete a quarantined message (phish/malware — do not release)
Delete-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]"   # ⚠️ permanent deletion
```
</details>

## ⚠️ Risk warning
- **Never release malware quarantine.** The portal blocks this by default — if you see a workaround, do not use it.
- **Never release high-confidence phish without full header review.** A released phishing email lands in the inbox with full link/attachment functionality.
- **Broad allow-lists bypass spam filtering.** Adding `*@[DOMAIN]` allows ALL mail from that domain, including future spoofed messages. Use the Tenant Allow/Block List with an expiry date, not a permanent anti-spam policy domain allow.
- **Quarantine notifications expose message subjects to users** — confirm your org's data handling policy is OK with that before enabling.

## ✅ Verification checklist
- [ ] Message found in quarantine with quarantine reason reviewed
- [ ] Release reason confirmed (false positive, not genuine threat)
- [ ] Message released and recipient confirms receipt in inbox
- [ ] False positive reported to Microsoft (checkbox checked or Submissions portal used)
- [ ] Sender added to Tenant Allow/Block List with expiry date if recurrence expected
- [ ] Quarantine notification policy active so users self-serve in future

## 📝 Jira-ready note
> Resolved [date/time]. Quarantined message from [SENDER] to [USER@DOMAIN.COM] reviewed — flagged as [spam/bulk/phish]. Determined to be a false positive: [brief reason]. Released to recipient; false positive reported to Microsoft. Sender added to Tenant Allow/Block List (expires [date]). Quarantine notifications confirmed active for affected mailbox. Time spent: [X] min.
