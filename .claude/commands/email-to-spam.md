---
description: Diagnose why email lands in spam — inbound false positives and outbound deliverability. Headers, SPF/DKIM/DMARC, Message Trace, anti-spam policies, blocklists. Portal first. Placeholders only.
disable-model-invocation: true
---

# /email-to-spam

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Spam misclassification is almost always caused by one of four things: failed sender authentication (SPF/DKIM/DMARC), a high spam confidence score from EOP, a misconfigured mail flow rule, or a per-user Junk setting. Start with Message Trace to find the verdict, then follow the matching path.

## What to check first
- **Inbound or outbound?** Is legitimate mail from outside landing in a user's Junk/quarantine — OR is mail sent FROM your org landing in recipients' spam? These are different problems with different fixes.
- **Junk folder vs quarantine?** Junk = delivered by EOP but sorted by Outlook/OWA. Quarantine = held by EOP before delivery. The fix path differs.
- **Consistent pattern or one-off?** One sender, one recipient, always? Or random? Pattern = policy/config issue. Random = possible blocklist or reputation issue.
- **Check Message Trace first** — it will tell you exactly what EOP decided and why.

## Step-by-step fix

### Step 1 — Run a Message Trace (always start here)
`Exchange admin center (admin.exchange.microsoft.com) → Mail flow → Message trace → + Start a trace`

- **Sender(s):** `[SENDER]`
- **Recipient(s):** `[USER@DOMAIN.COM]`
- **Time range:** bracket the window when the email was sent
- Click **Search**

Read the result:
- **Status: Delivered** + action = JunkFolder → EOP delivered it, Outlook/OWA moved it to Junk (SCL 5–6 or per-user Junk setting)
- **Status: Quarantined** → EOP held it (SCL 7–9, phish, malware, or transport rule)
- **Status: FilteredAsSpam** → EOP applied a spam action — check the events tab for which policy fired
- **Events tab** → expand each event to see spam verdicts, rule hits, and SCL

Note the **SCL (Spam Confidence Level)** value:
| SCL | Meaning |
|-----|---------|
| -1 | Bypassed filtering (safe sender, transport rule, or internal) |
| 0–4 | Not spam |
| 5–6 | Spam (Junk folder action) |
| 7–9 | High-confidence spam (quarantine action) |
| N/A | Phish / malware verdict (separate score) |

---

### Step 2 — Check message headers (for inbound)
Get the full headers from the quarantined or delivered message (in OWA: … → View → View message source, or admin releases it first).

Key headers to read:
- `X-Forefront-Antispam-Report: SFV:SPM` → spam verdict
- `X-Forefront-Antispam-Report: SFV:PHSH` → phish verdict
- `X-Forefront-Antispam-Report: SFV:SKS` → transport rule set SCL to skip
- `Authentication-Results:` → check SPF=pass/fail, DKIM=pass/fail, DMARC=pass/fail
- `X-Microsoft-Antispam: BCL:X` → bulk complaint level (0 = not bulk, 9 = very bulky)

Use the Microsoft Message Header Analyzer: paste headers at `https://mha.azurewebsites.net/` for a readable breakdown.

---

### Step 3 — INBOUND path: fix based on verdict

> **PREVIEW ONLY [email-spam-inbound-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

**A. SCL 5–6 (landed in Junk folder)**
The message was delivered but Outlook/OWA moved it. Possible causes:
1. EOP spam verdict was marginal — consider adding sender to TABL (see `/email-whitelist` Method 1)
2. Per-user Junk setting — check:
   `OWA → Settings → Mail → Junk email → Safe senders` — confirm `[SENDER]` is not in the blocked list
3. Junk filter level set too aggressively — review the anti-spam policy:
   `Defender portal → Policies & rules → Threat policies → Anti-spam → [policy] → Edit → Bulk email threshold` — default 7; lowering this catches more bulk but increases false positives

**B. SCL 7–9 (quarantined as spam)**
1. Check the anti-spam policy that fired: `Defender portal → Threat policies → Anti-spam → [policy] → edit` — review threshold and action
2. Add sender to Tenant Allow/Block List (see `/email-whitelist` Method 1) with a time-limited allow
3. Report false positive to Microsoft via Submissions: `Defender portal → Email & collaboration → Submissions → + Submit to Microsoft for analysis`

**C. Authentication failure (SPF/DKIM/DMARC fail)**
EOP increases spam score for unauthenticated mail. Check:
- `Authentication-Results: spf=fail` → the sender's IP is not in their SPF record — contact sender to fix their SPF
- `dkim=fail` → DKIM signature invalid or missing — contact sender
- `dmarc=fail` → sender's DMARC policy `p=quarantine` or `p=reject` is being enforced

If you control the sending domain (e.g., a sub-domain you manage), see Step 5 (outbound auth).

**D. Transport rule fired**
Message Trace shows a rule name. Check:
`Exchange admin center → Mail flow → Rules → [rule name]` — review conditions. A rule with a broad keyword match may be over-catching.

---

### Step 4 — OUTBOUND path: diagnose why YOUR mail lands in others' spam

> **PREVIEW ONLY [email-spam-outbound-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

Check these in order:

**A. SPF record**
Verify your SPF record is correctly published:
`nslookup -type=TXT [@Aegion_DOMAIN]` or use `https://mxtoolbox.com/spf.aspx`

A valid SPF record looks like:
```
v=spf1 include:spf.protection.outlook.com -all
```
If you send via third-party services (bulk mail, CRM, ticketing), their sending IPs must be in your SPF. Missing an include = SPF fail = spam score increase.

**B. DKIM**
DKIM signs your outbound mail with a private key. Verify DKIM is enabled in Defender:
`Defender portal → Email & collaboration → Policies & rules → Threat policies → Email authentication settings → DKIM`

- Confirm `[@Aegion_DOMAIN]` has DKIM enabled (Status: Enabled)
- If disabled: click the domain → Enable → publish the two CNAME records shown in your public DNS → re-check after DNS propagates (~10–60 min)

**C. DMARC**
Check your DMARC record:
`nslookup -type=TXT _dmarc.[@Aegion_DOMAIN]` or `https://mxtoolbox.com/dmarc.aspx`

A starter DMARC record (monitor mode — no enforcement, just reporting):
```
v=DMARC1; p=none; rua=mailto:[ADMIN_NAME]@[@Aegion_DOMAIN]
```
Escalate to `p=quarantine` then `p=reject` only after reviewing DMARC reports for 2–4 weeks to confirm no legitimate sources are failing.

**D. Check public blocklists**
If SPF/DKIM/DMARC are clean but outbound mail still goes to spam, your sending IP or domain may be on a public blocklist.

Check:
- `https://mxtoolbox.com/blacklists.aspx` — paste your outbound IP (from M365 → Settings → Domains → [@Aegion_DOMAIN] → DNS records → MX/SPF)
- `https://sendersupport.olc.protection.outlook.com/pm/troubleshooting.aspx` — Microsoft's own sender reputation check

If listed: follow the delist process for each blocklist. Most have a web form. Microsoft SNDS: `https://sendersupport.olc.protection.outlook.com/snds/`.

**E. Check Microsoft's Outbound Spam policy**
`Defender portal → Email & collaboration → Policies & rules → Threat policies → Anti-spam → Outbound spam filter policy`

If a user account was compromised and used to send spam, M365 may have throttled or blocked outbound mail from that account. Review the **Restricted users** list:
`Defender portal → Email & collaboration → Review → Restricted entities`

A user appearing here had their outbound mail blocked. Complete password reset, session revocation, and forwarding-rule cleanup first.

<!-- SAFETY GATE [restricted-entity-unblock-portal] -->
- **Target:** [USER@DOMAIN.COM]
- **Effect:** restore outbound sending after credential and persistence remediation
- **Scope:** one secured sender account
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, the change of a sending control; it lifts a sending restriction and fits no closer row, so the higher class): reversible by restricting the sender again
- **Required confirmation:** Type exactly `UNBLOCK OUTBOUND MAIL FOR [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (Defender restricted entities: no connector reads them)
**PORTAL ACTION [restricted-entity-unblock-portal]:** Only after the exact match, remove `[USER@DOMAIN.COM]` from **Restricted entities**, then verify outbound behavior and sign-in logs.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Resolve one exact Exchange Online module version from the canonical PowerShell Gallery endpoint. This fence performs only the local install.
$moduleName = 'ExchangeOnlineManagement'
$repositoryName = 'PSGallery'
$expectedRepositorySource = 'https://www.powershellgallery.com/api/v2'
$repository = Get-PSRepository -Name $repositoryName -ErrorAction Stop
if ($repository.SourceLocation.TrimEnd('/') -cne $expectedRepositorySource) { throw "PSGallery source mismatch. No module was installed." }
$moduleVersionText = Read-Host "Enter the independently reviewed exact $moduleName version (for example, 3.0.0)"
if ($moduleVersionText -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') { throw "An exact stable module version is required. No module was installed." }
$candidate = Find-Module -Name $moduleName -Repository $repositoryName -RequiredVersion $moduleVersionText -ErrorAction Stop
if ([string]$candidate.Name -cne $moduleName -or [string]$candidate.Version -cne $moduleVersionText) { throw "Module preflight did not resolve the exact requested package. No module was installed." }
# SAFETY GATE [install-exchange-spam]
# Target: exact $moduleName version $moduleVersionText from canonical $repositoryName
# Effect: installs one local PowerShell module without changing sender restrictions
# Scope: CurrentUser on this workstation
# Reversibility: R1 (CLAUDE.md, Risk-Classified Execution Policy, the single reversible write row: one object, undone by one command): reversible through a separately reviewed Uninstall-Module action
# Read-back: none, R1: no change record
$requiredConfirmation = "INSTALL POWERSHELL MODULE $moduleName VERSION $moduleVersionText FROM $repositoryName"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm the local CurrentUser install"
if ($confirmation -ceq $requiredConfirmation) {
    Install-Module -Name $moduleName -Repository $repositoryName -RequiredVersion $moduleVersionText -Scope CurrentUser -ErrorAction Stop
    $installed = Get-InstalledModule -Name $moduleName -RequiredVersion $moduleVersionText -ErrorAction Stop
    if ([string]$installed.Version -cne $moduleVersionText) { throw "Installed-module read-back did not match the approved version." }
} else {
    throw "Confirmation did not match. No change was made."
}
```
</details>

<details>
<summary>PowerShell - read-only investigation</summary>

```powershell

# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName "[UPN]"   # sign in as Exchange/Global admin

# Run a message trace for a specific sender → recipient
Get-MessageTrace -SenderAddress "[SENDER]" `
    -RecipientAddress "[USER@DOMAIN.COM]" `
    -StartDate (Get-Date).AddDays(-7) `             # look back 7 days
    -EndDate (Get-Date) |
    Select-Object Received, SenderAddress, RecipientAddress, Subject, Status, ToIP, FromIP  # key fields

# Get detailed trace events for a specific message (grab MessageTraceId from above)
Get-MessageTraceDetail -MessageTraceId "[MESSAGETRACEID]" -RecipientAddress "[USER@DOMAIN.COM]" |
    Select-Object Date, Event, Action, Detail        # shows each EOP processing step and verdict

# Check outbound spam policy for restricted/blocked senders
Get-HostedOutboundSpamFilterPolicy | Select-Object Name, ActionWhenThresholdReached, BccSuspiciousOutboundMail  # view outbound policy settings

# Check if a user is on the restricted senders list (blocked from outbound mail)
Get-BlockedSenderAddress | Select-Object SenderAddress, ReasonCode, BlockedUntilDate  # ⚠️ these users cannot send outbound

```
</details>

<details>
<summary>PowerShell - separately gated restricted-sender unblock</summary>

```powershell
# This fence performs only the unblock. Run the read-only investigation separately first.
Connect-ExchangeOnline -UserPrincipalName "[UPN]"

# Remove a user from the restricted senders list (AFTER securing the account)
# SAFETY GATE [restricted-entity-unblock]
# Target: [USER@DOMAIN.COM]
# Effect: restores outbound sending after account remediation
# Scope: one secured sender account
# Reversibility: R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, the change of a sending control; it lifts a sending restriction and fits no closer row, so the higher class): not directly reversible; restricting the sender again is a separate reviewed containment action
# Read-back: none, Defender restricted entities: no connector reads them
$requiredConfirmation = "UNBLOCK OUTBOUND MAIL FOR [USER@DOMAIN.COM]"
$confirmation = Read-Host "Type '$requiredConfirmation' after verifying password reset, session revocation, and rule cleanup"
if ($confirmation -ceq $requiredConfirmation) {
    Remove-BlockedSenderAddress -SenderAddress "[USER@DOMAIN.COM]" -ErrorAction Stop  # ⚠️ only after confirming the account is secured
    $stillRestricted = @(Get-BlockedSenderAddress -ErrorAction Stop | Where-Object { [string]$_.SenderAddress -ceq '[USER@DOMAIN.COM]' })
    if ($stillRestricted.Count -ne 0) { throw "Unblock returned but read-back still shows the sender restricted." }
} else {
    throw "Confirmation did not match. No change was made."
}

```
</details>

<details>
<summary>PowerShell - additional read-only checks</summary>

```powershell
Connect-ExchangeOnline -UserPrincipalName "[UPN]"

# Check a user's junk email configuration (why Junk filter is catching something)
Get-MailboxJunkEmailConfiguration -Identity "[UPN]" |
    Select-Object Enabled, TrustedSendersAndDomains, BlockedSendersAndDomains   # see per-user Junk settings

# Check DKIM signing configuration for your domain
Get-DkimSigningConfig -Identity "[@Aegion_DOMAIN]" |
    Select-Object Domain, Enabled, Status, Selector1CNAME, Selector2CNAME   # confirm DKIM is enabled and CNAMEs are correct
```
</details>

## ⚠️ Risk warning
- **Changing the bulk email threshold (BCL) in anti-spam policies** affects all users covered by that policy. Lowering the threshold (e.g., from 7 to 4) may block legitimate newsletters. Test with a narrow-scope policy before applying org-wide.
- **Removing a user from Restricted Entities without securing the account first** re-enables outbound spam from a compromised mailbox. Always reset password + revoke sessions first.
- **Publishing a DMARC `p=reject` record before all legitimate senders are in SPF/DKIM** will cause legitimate mail to be rejected by recipient servers. Start with `p=none`, monitor reports for 2–4 weeks, then tighten.
- **Do not add broad domain-level allows** to work around authentication failures — fix the authentication records instead.

## ✅ Verification checklist
- [ ] Message Trace confirms the exact EOP verdict and SCL
- [ ] Message headers reviewed and authentication results (SPF/DKIM/DMARC) noted
- [ ] Root cause identified (verdict matches the fix applied)
- [ ] Inbound fix: test message from `[SENDER]` to `[USER@DOMAIN.COM]` lands in inbox (not Junk/quarantine)
- [ ] Outbound fix: SPF/DKIM/DMARC all pass for `[@Aegion_DOMAIN]` (confirmed via MXToolbox or header analysis)
- [ ] Domain/IP not on any major public blocklist
- [ ] Any restricted user accounts re-enabled only after password reset + session revoke

## 📝 Jira-ready note
> Resolved [date/time]. Investigated [inbound / outbound] spam misclassification for [SENDER] / [USER@DOMAIN.COM]. Message Trace showed [verdict / SCL / rule name]. Root cause: [failed SPF / high SCL / transport rule / junk setting / blocklist]. Fix applied: [allow entry added / auth record fixed / policy adjusted / blocklist delist requested]. Test confirmed [message delivered to inbox / outbound authenticated correctly]. Time spent: [X] min.
