---
description: Check and release quarantined email in Microsoft Defender — find, review, release, report false positive, allow sender, configure notifications. Portal first. Placeholders only.
disable-model-invocation: true
---

# /email-quarantine

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

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
> **PREVIEW ONLY [quarantine-disposition-guide]:** This table is triage guidance only. Release, deletion, submission, and allow/block changes are separate actions; use their own reviewed gates.
| Reason | Safe to release? |
|--------|-----------------|
| Spam / Bulk | Usually yes — confirm with recipient first |
| High-confidence spam | Review headers; use caution |
| Phish | Do NOT release without thorough review |
| High-confidence phish | Do NOT release — preserve evidence and separately review the exact deletion scope |
| Malware | Cannot release from portal — never should be |

### 4. Release the message
> **PREVIEW ONLY [quarantine-release-dialog]:** Selecting the item and inspecting the release dialog is preparatory only. Do not submit a release until one of the recipient-scoped gates below matches exactly.
Open the reviewed message and inspect the available release scopes without submitting.

Options presented:
- **Release to all recipients** — releases to every quarantined recipient
- **Release to specific recipients** — use this when in doubt
> **PREVIEW ONLY [quarantine-release-report-option]:** Reporting "no threats found" discloses message evidence to Microsoft and is never bundled into a release approval. Leave it unchecked unless separately reviewed.
- **Report as "no threats found"** — separate external submission; not authorized by either release gate

<!-- SAFETY GATE [quarantine-release-all-portal] -->
- **Target:** [MESSAGE_IDENTITY_GUID] and the displayed original-recipient list rendered as `$recipientCount`
- **Effect:** deliver the reviewed quarantined message to every original recipient
- **Scope:** exactly `$recipientCount` reviewed original recipients shown in the release dialog
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, ">10 objects"; the recipient count can pass 10 and delivery cannot be recalled, so the higher class): delivery cannot be recalled reliably
- **Required confirmation:** Render the displayed integer as `$recipientCount`, then type exactly `RELEASE QUARANTINED MESSAGE [MESSAGE_IDENTITY_GUID] TO ALL $recipientCount LISTED RECIPIENTS`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (Defender quarantine: no connector reads it)
**PORTAL ACTION [quarantine-release-all-portal]:** Re-open the item and stop if the displayed recipient identities or `$recipientCount` drift. Only the exact match authorizes **Release to all recipients** for that list. A single-recipient release uses the separate gate below; neither phrase authorizes the other scope or the reporting option.

<!-- SAFETY GATE [quarantine-release-one-portal] -->
- **Target:** [MESSAGE_IDENTITY_GUID] and [USER@DOMAIN.COM]
- **Effect:** deliver the reviewed quarantined message to one verified original recipient
- **Scope:** one quarantine item and one recipient shown in the release dialog
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: "reversal needs data you'd have to reconstruct"): delivery cannot be recalled reliably
- **Required confirmation:** Type exactly `RELEASE QUARANTINED MESSAGE [MESSAGE_IDENTITY_GUID] TO [USER@DOMAIN.COM]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (Defender quarantine: no connector reads it)
**PORTAL ACTION [quarantine-release-one-portal]:** Only the exact match authorizes **Release to specific recipients** for the named recipient. It never authorizes Release to all.

Allow 5–10 minutes for delivery to the recipient's inbox.

### 5. Report false positive to Microsoft (recommended)
> **PREVIEW ONLY [quarantine-submit-false-positive]:** Submission sends message evidence to an external service and is not authorized by a release gate. Use a separate reviewed submission decision.
Do not couple submission to release. If evidence supports a false positive, prepare a separate external-submission decision that names the exact message and disclosed data.

Alternatively, submit manually:
`Defender portal → Email & collaboration → Submissions → User reported → Submit to Microsoft for analysis`

### 6. Add sender to allow list (Tenant Allow/Block List — preferred)
> **PREVIEW ONLY [quarantine-allow-entry]:** An allow-list entry changes tenant filtering and is not authorized by a release decision. Use a separate reviewed `/email-whitelist` runbook.
To prevent future quarantine of mail from the same sender:

`Defender portal (security.microsoft.com) → Email & collaboration → Policies & rules → Threat policies → Tenant Allow/Block Lists → Senders tab → + Add`

- **Sender:** `[SENDER]` or `*@[DOMAIN]` for a whole domain
- **Action:** Allow
- **Expiry:** set a sensible expiry (30–90 days recommended; review before renewing)
- **Note/Reason:** document why you added it

This is the safest allow method — scoped, auditable, time-limited, and reversible.

See `/email-whitelist` for a full comparison of all allow methods and their tradeoffs.

<!-- SAFETY GATE [quarantine-delete-portal] -->
- **Target:** [MESSAGE_IDENTITY_GUID]
- **Effect:** permanently delete the reviewed quarantined message
- **Scope:** one quarantine item
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): irreversible; the message cannot be released afterward
- **Required confirmation:** Type exactly `DELETE QUARANTINED MESSAGE [MESSAGE_IDENTITY_GUID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (Defender quarantine: no connector reads it)
**PORTAL ACTION [quarantine-delete-portal]:** For a reviewed phish or malware item, only the exact match authorizes **Delete permanently**. Capture needed evidence first.

### 7. Set up quarantine notifications (so users get alerted automatically)
> **PREVIEW ONLY [quarantine-policy-change]:** Creating or assigning a quarantine policy is a separate tenant policy change and must not be performed from this command.
`Defender portal → Email & collaboration → Policies & rules → Threat policies → Quarantine policies`

- Select or create a policy (e.g., "NotifyUsersSpam")
- Enable **End-user spam notifications**
- Set **Notification frequency** (daily or every 3 days recommended)
- Assign the policy to the relevant anti-spam policy under `Defender → Threat policies → Anti-spam → [policy name] → Edit → Spam quarantine action → Quarantine policy`

Users will receive an email digest listing their quarantined messages with a Release / Block option.

<details>
<summary>PowerShell — setup and read-only review</summary>

```powershell
# Resolve one exact Exchange Online module version from the canonical PowerShell Gallery endpoint.
$moduleName = 'ExchangeOnlineManagement'
$repositoryName = 'PSGallery'
$expectedRepositorySource = 'https://www.powershellgallery.com/api/v2'
$repository = Get-PSRepository -Name $repositoryName -ErrorAction Stop
if ($repository.SourceLocation.TrimEnd('/') -cne $expectedRepositorySource) { throw "PSGallery source mismatch. No module was installed." }
$moduleVersionText = Read-Host "Enter the independently reviewed exact $moduleName version (for example, 3.0.0)"
if ($moduleVersionText -cnotmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') { throw "An exact stable module version is required. No module was installed." }
$candidate = Find-Module -Name $moduleName -Repository $repositoryName -RequiredVersion $moduleVersionText -ErrorAction Stop
if ([string]$candidate.Name -cne $moduleName -or [string]$candidate.Version -cne $moduleVersionText) { throw "Module preflight did not resolve the exact requested package. No module was installed." }
# SAFETY GATE [install-exchange-quarantine]
# Target: exact $moduleName version $moduleVersionText from canonical $repositoryName
# Effect: installs one local PowerShell module without changing quarantine state
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

# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName "[UPN]"   # sign in with an admin account

# List quarantined messages for a specific recipient
Get-QuarantineMessage -RecipientAddress "[USER@DOMAIN.COM]" |   # filter by recipient
    Select-Object Subject, SenderAddress, ReceivedTime, QuarantineTypes, Released  # show key fields

# Get details on a specific quarantined message (grab Identity from above output)
Get-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]"   # view full headers and quarantine reason
```
</details>

<details>
<summary>PowerShell — release to every original recipient</summary>

```powershell
Connect-ExchangeOnline -UserPrincipalName "[UPN]"
$messageIdentity = "[MESSAGE_IDENTITY_GUID]"
$message = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
if ([string]$message.Identity -cne $messageIdentity) { throw "Resolved quarantine identity did not match. No release was sent." }
$recipients = @($message.RecipientAddress | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Sort-Object -Unique)
if ($recipients.Count -eq 0) { throw "No original recipients were resolved. No release was sent." }
$recipientManifest = $recipients -join "`n"
$recipientSetHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($recipientManifest))).Replace('-', '').ToLowerInvariant()
Write-Host "Message: $messageIdentity; recipient count: $($recipients.Count)"
$recipients | ForEach-Object { Write-Host "  recipient: $_" }
Write-Host "Recipient-set SHA256: $recipientSetHash"
# SAFETY GATE [quarantine-release-all]
# Target: the resolved quarantine message identity and immutable $recipientSetHash
# Effect: delivers the reviewed quarantined message to every original recipient
# Scope: exactly the displayed recipient count for one message identity
# Reversibility: R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, ">10 objects"; the recipient count can pass 10 and delivery cannot be recalled, so the higher class): delivery cannot be recalled reliably
# Read-back: none, Defender quarantine: no connector reads it
$requiredConfirmation = "RELEASE QUARANTINED MESSAGE $messageIdentity TO $($recipients.Count) RECIPIENTS SET SHA256 $recipientSetHash"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm after header and recipient review"
if ($confirmation -ceq $requiredConfirmation) {
    $currentMessage = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    $currentRecipients = @($currentMessage.RecipientAddress | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Sort-Object -Unique)
    $currentRecipientHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes(($currentRecipients -join "`n")))).Replace('-', '').ToLowerInvariant()
    if ([string]$currentMessage.Identity -cne $messageIdentity -or $currentRecipientHash -cne $recipientSetHash) { throw "Quarantine target drifted after approval. The message was not released." }
    Release-QuarantineMessage -Identity $messageIdentity -ReleaseToAll -ErrorAction Stop
    $releaseReadBack = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    if ($releaseReadBack.Released -ne $true) { throw "Release returned but read-back does not show Released. Treat delivery state as UNKNOWN and do not retry blindly." }
} else {
    throw "Confirmation did not match. The message was not released."
}
```
</details>

<details>
<summary>PowerShell — release to one verified original recipient</summary>

```powershell
Connect-ExchangeOnline -UserPrincipalName "[UPN]"
$messageIdentity = "[MESSAGE_IDENTITY_GUID]"
$recipient = "[USER@DOMAIN.COM]"
$message = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
if ([string]$message.Identity -cne $messageIdentity) { throw "Resolved quarantine identity did not match. No release was sent." }
$originalRecipients = @($message.RecipientAddress | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Sort-Object -Unique)
if ($originalRecipients -notcontains $recipient.ToLowerInvariant()) { throw "The requested recipient is not in the original recipient set. No release was sent." }
Write-Host "Message: $messageIdentity; recipient: $recipient"
# SAFETY GATE [quarantine-release-one]
# Target: the resolved quarantine message identity and one verified original recipient
# Effect: delivers the reviewed quarantined message to one recipient
# Scope: one message identity and one verified original recipient
# Reversibility: R2 (CLAUDE.md, Risk-Classified Execution Policy, the multi-object or hard-to-reverse row: "reversal needs data you'd have to reconstruct"): delivery cannot be recalled reliably
# Read-back: none, Defender quarantine: no connector reads it
$requiredConfirmation = "RELEASE QUARANTINED MESSAGE $messageIdentity TO $recipient"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm after header review"
if ($confirmation -ceq $requiredConfirmation) {
    $currentMessage = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    $currentRecipients = @($currentMessage.RecipientAddress | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Sort-Object -Unique)
    if ([string]$currentMessage.Identity -cne $messageIdentity -or $currentRecipients -notcontains $recipient.ToLowerInvariant()) { throw "Quarantine target drifted after approval. The message was not released." }
    Release-QuarantineMessage -Identity $messageIdentity -User $recipient -ErrorAction Stop
    $releaseReadBack = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    if ($releaseReadBack.Released -ne $true) { throw "Release returned but read-back does not show Released. Treat delivery state as UNKNOWN and do not retry blindly." }
} else {
    throw "Confirmation did not match. The message was not released."
}
```
</details>

<details>
<summary>PowerShell — permanently delete one reviewed quarantine item</summary>

```powershell
Connect-ExchangeOnline -UserPrincipalName "[UPN]"
$messageIdentity = "[MESSAGE_IDENTITY_GUID]"
$message = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
if ([string]$message.Identity -cne $messageIdentity) { throw "Resolved quarantine identity did not match. No deletion was attempted." }
Write-Host "Delete target: $($message.Identity); subject and sender reviewed in the read-only setup block."
# SAFETY GATE [quarantine-permanent-delete]
# Target: the resolved quarantine message identity
# Effect: permanently deletes the quarantined message
# Scope: one reviewed quarantine item
# Reversibility: R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): irreversible; the message cannot be released afterward
# Read-back: none, Defender quarantine: no connector reads it
$requiredConfirmation = "DELETE QUARANTINED MESSAGE $messageIdentity"
$confirmation = Read-Host "Type '$requiredConfirmation' to confirm"
if ($confirmation -ceq $requiredConfirmation) {
    $currentMessage = Get-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    if ([string]$currentMessage.Identity -cne $messageIdentity) { throw "Quarantine target drifted after approval. The message was not deleted." }
    Delete-QuarantineMessage -Identity $messageIdentity -ErrorAction Stop
    $remaining = @(Get-QuarantineMessage -Identity $messageIdentity -ErrorAction SilentlyContinue)
    if ($remaining.Count -ne 0) { throw "Delete returned but the quarantine item is still present on read-back." }
} else {
    throw "Confirmation did not match. The message was not deleted."
}
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
- [ ] False-positive submission [separately approved and completed / not requested]
- [ ] Tenant Allow/Block entry [separately approved with expiry / not requested]
- [ ] Quarantine notification policy [separately approved and verified / unchanged]

## 📝 Jira-ready note
> Resolved [date/time]. Quarantined message `[MESSAGE_IDENTITY_GUID]` from [SENDER] to [USER@DOMAIN.COM] reviewed — flagged as [spam/bulk/phish]. Determined to be a false positive: [brief reason]. Release scope: [one named recipient / all `$recipientCount` reviewed recipients / not released]. Separate actions: Microsoft submission [completed / not requested]; Tenant Allow/Block entry [completed, expires [date] / not requested]; notification policy [verified unchanged / separately changed under [JIRA-###]]. Time spent: [X] min.
