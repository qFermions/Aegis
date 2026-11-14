---
description: Troubleshoot Outlook desktop — won't open, not syncing, send/receive failures, shared mailbox missing, calendar issues, password prompts, search broken, Out of Office. Windows GUI first. Placeholders only.
disable-model-invocation: true
---

# /outlook-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Most Outlook problems are caused by a corrupt profile, a stuck add-in, or a broken cache file. Start with safe mode to isolate, then repair or rebuild as needed. EAC is only needed for server-side checks (message trace, mailbox status).

## What to check first
- **How wide first** (answer-format section 2, "How wide before why"): when mail or Outlook is reported down or unreachable, the first step fixes the scope and reads Microsoft's status together. One person or everyone? One site or all? Outlook only, or other internet services too (does Outlook on the web open; does a public website open on the same machine)? Then Microsoft 365 admin center → Health → Service health for Exchange Online, and its **Issue history** tab for an incident that has just closed; when the admin center itself does not load, https://status.cloud.microsoft (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-30 to MB-32).
- With no Microsoft incident, the network and name-resolution path come before any account-level cause: the same mailbox on another network (a phone hotspot), then `nslookup` on the server address the error names from the affected machine. Works elsewhere, or the name does not resolve: it is `/lan-wan` or DNS, not the profile or the account. Only after that go on to the profile, the licence and the sign-in logs.
- Is Outlook running already? Check Task Manager → `OUTLOOK.EXE`. Kill stale processes before launching.
- Is it the new Outlook (web-based toggle, no safe mode) or classic Outlook (.exe)? Steps differ — confirm which build the user has.

## Step-by-step fix

**Won't open**

> **PREVIEW ONLY [outlook-open-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Launch in safe mode: Win+R → type `outlook /safe` → Enter. If it opens, an add-in is the culprit.
2. Disable add-ins (safe mode): File → Options → Add-ins → COM Add-ins → Go → uncheck all → restart normally. Re-enable one at a time to find the bad one.
3. If safe mode also fails → repair Office: Settings → Apps → Microsoft 365 → Modify → Quick Repair first; Online Repair if Quick doesn't fix it.
4. If repair fails → create a new Outlook profile: Control Panel → Mail → Show Profiles → Add → name it `[FIRST_NAME]-New` → set up the account → set as default. Keep the old profile until confirmed working.

**Not syncing / emails not updating**

> **PREVIEW ONLY [outlook-sync-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Check offline mode: Send/Receive tab → confirm "Work Offline" is NOT highlighted. Click it to toggle back online if it is.
2. Manual sync: Send/Receive tab → Send/Receive All Folders (F9).
3. Repair the OST/data file: File → Account Settings → Account Settings → Data Files tab → select the account → Settings → Compact Now. If issues persist, close Outlook, delete the `.ost` file (Outlook rebuilds it), reopen.
   - OST location: `C:\Users\[FIRST_NAME]\AppData\Local\Microsoft\Outlook\`

**Can't send / receive — stuck Outbox**

> **PREVIEW ONLY [outlook-outbox-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Send/Receive All (F9) first.
2. Check Outbox: if a message is stuck, open it and delete or move to Drafts — a stuck send can block the whole queue.
3. Confirm server settings: File → Account Settings → select account → Change → check server addresses. For M365 accounts these should be auto-configured.
4. EAC check if still failing: admin.exchange.microsoft.com → Mail flow → Message trace → search [USER@DOMAIN.COM] sent items in the last hour. Confirms whether the message left the server.

**Shared mailbox not showing**

> **PREVIEW ONLY [outlook-shared-mailbox]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Auto-mapping check: the mailbox auto-appears if Full Access was granted and auto-mapping is enabled. Give it up to 60 minutes after permission change.
2. Add manually: File → Account Settings → Account Settings → Email tab → Change → More Settings → Advanced tab → Add → type `[MAILBOX]` → OK.
3. If still not appearing: EAC → Recipients → Mailboxes → open `[MAILBOX]` → Delegation → confirm [UPN] has Full Access. If not, add it there.

**Calendar issues (missing events, wrong time zone, can't accept invites)**

> **PREVIEW ONLY [outlook-calendar-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Time zone: File → Options → Calendar → Time zones → confirm the correct zone. Mismatch causes events to appear at the wrong time.
2. Shared calendar permissions: Home → Calendar → Open Calendar → From Address Book → search [UPN]. If no view access, the calendar owner must grant it: right-click their calendar → Share → Calendar Permissions → add [UPN] with at least "Can view all details."
3. If events won't accept/decline: try from Outlook Web (outlook.office.com) — isolates desktop vs server issue.

**Keeps asking for password**

> **PREVIEW ONLY [outlook-credential-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Clear saved credentials: Control Panel → Credential Manager → Windows Credentials tab → expand any `MicrosoftOffice` or `outlook` entries → Remove. Restart Outlook and sign in fresh.
2. Confirm modern auth is on: File → Office Account → the sign-in method should be Microsoft/AAD, not basic. If it shows a plain username/password box, modern auth may be disabled tenant-side — check Entra.
3. Re-add the account: File → Account Settings → select account → Remove → re-add with [USER@DOMAIN.COM]. Let it go through the modern auth browser popup.

**Search not working**

> **PREVIEW ONLY [outlook-search-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. New Outlook: search is cloud-indexed — no local rebuild needed. If results are missing, wait 24 hours for index to catch up or report to Microsoft.
2. Classic Outlook: rebuild the Windows Search index. Settings → Search → Searching Windows → Advanced Search Indexer Settings → Advanced → Rebuild. Takes 15–30 min; keep Outlook open.
3. Check Outlook is indexed: same Advanced settings → Index Settings → Modify → confirm Outlook/Microsoft Outlook is checked.

**Out of Office not saving / not sending**

> **PREVIEW ONLY [outlook-auto-reply-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. Set via Outlook: File → Automatic Replies → confirm the date range and toggle "Send automatic replies" on. Test with an external sender.
2. Set via OWA if desktop fails: outlook.office.com → Settings (gear) → Automatic replies. Confirms if the issue is desktop-only.
3. If OWA setting also fails: EAC → Recipients → Mailboxes → open [MAILBOX] → Manage automatic replies. Admin can force-set it here.
4. External replies blocked? EAC → Mail flow → Remote domains → Default → confirm "Allow automatic replies" is enabled if the user needs to send OOO to external contacts.

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Connect to Exchange Online
Connect-ExchangeOnline                                                          # sign in to Exchange Online Management

# Check if Out of Office is set on the mailbox
Get-MailboxAutoReplyConfiguration -Identity "[UPN]"                             # shows OOO status and message for the user

# PREVIEW ONLY [outlook-auto-reply] — non-executing mailbox-setting reference.
# Set-MailboxAutoReplyConfiguration -Identity "[UPN]" -AutoReplyState Enabled `
#   -InternalMessage "OOO message here" -ExternalMessage "OOO message here"

# Run a message trace for stuck mail
Get-MessageTrace -SenderAddress "[USER@DOMAIN.COM]" -StartDate (Get-Date).AddHours(-2) -EndDate (Get-Date) | Select-Object Received, Subject, Status  # last 2 hours of sent mail with delivery status

# Check if auto-mapping is enabled for a shared mailbox delegate
Get-MailboxPermission -Identity "[MAILBOX]" | Where-Object { $_.User -like "*[UPN]*" }  # shows full access grants on the shared mailbox
```
</details>

## ⚠️ Risk warning
- Deleting the `.ost` file forces a full re-download of all mailbox data — warn the user it may take 30–90 min depending on mailbox size before email is fully available.
- Removing a profile deletes locally cached data — confirm the user has no local-only drafts or calendar items before removing the old profile.
- Clearing Credential Manager entries will require the user to sign in again to all Office apps — normal and expected.

## ✅ Verification checklist
- [ ] Outlook opens normally (not in safe mode)
- [ ] Inbox updates when a test email is sent
- [ ] Sent items deliver — confirmed via message trace or recipient receipt
- [ ] Shared mailbox [MAILBOX] appears in folder list
- [ ] Calendar shows correct events in correct time zone
- [ ] No password prompt loop on next restart
- [ ] Search returns results for a known recent email
- [ ] OOO reply received by test sender

## 📝 Jira-ready note
> Resolved [date/time]. Troubleshot Outlook issue for [UPN]: [brief description — e.g. "corrupt profile rebuilt", "OST deleted and re-synced", "Credential Manager cleared to fix password loop"]. Verified [what was confirmed — e.g. "inbox syncing, sent mail delivering, shared mailbox visible"]. No data loss. Time spent: [X] min.
