# Lab evidence — Google Workspace / Okta / Jamf runbooks (capture template)

This folder holds the batch evidence for G1 (`g1-checks.md`, the red/green and
final-battery outputs) and, later, the operator's own lab proof that each Google /
Okta / Jamf runbook does what it says. The lab excerpts are **pending**: none is
in the tree yet, and the claim ledger (`docs/evidence/claim-ledger.md`) says so.
This README is the template the operator follows when adding one.

## The one rule that is never relaxed

Nothing in this folder may carry the lab domain, a real address, a customer ID,
a device serial, an IP address, a token, or a person's name. The lab domain is
env-var only (`AEGION_DOMAIN`); every excerpt uses the dictionary tokens
(`modules/security/placeholder-dictionary.md`). The repository is public and the
full-tree scanner (`node scripts/pre-commit-check.js --all`) runs on every pull
request — it blocks an address-shaped string, a secret format, or a configured
tenant literal, but it cannot recognize every identifier, so sanitize before you
paste.

## File name

`evidence-<command>-<yyyy-mm-dd>.md` — for example `evidence-gws-offboard-2026-11-02.md`.
One file per runbook run; the date is the day of the lab run.

## What to capture after each runbook

| Runbook | Admin log event (or vendor log) to look for | Read-back to paste (sanitized) |
|---|---|---|
| gws-new-user | Admin log events: user creation, OU assignment, group membership change | `gam info user` showing status, OU, licence |
| gws-offboard | Okta System Log: user deactivation; Admin log events: suspension, data transfer, deletion | Okta status, `gam info user`, `gam print datatransfers` |
| gws-password-reset | Admin log events: password change by an admin | the status banner after reset (no password, ever) |
| gws-2sv-reset | Admin log events: backup codes generated / 2SV turned off / security key removed | the user's Security page summary |
| gws-group-membership | Admin log events (Groups): member added / removed | `gam print groups member` for the user |
| gws-ou-move | Admin log events: organizational unit change | `gam info user` showing the new OU |
| gws-license-assign | Admin log events: licence assignment / removal | the user's Licenses page summary |
| gws-drive-transfer | Admin log events: data transfer; Drive log events: ownership change | pre-state and post-state owned-file counts |
| gws-audit-log | (read-only) the query you ran and the event names returned | the filter you used and the count of matching events |
| gws-chromeos-device | Admin log events: device disabled / re-enabled / deprovisioned / reset | device status in Devices → Chrome → Devices |
| gws-gmail-delivery | Email Log Search result (status only — it never shows content) | the delivery status line, with addresses replaced by tokens |
| okta-app-assignment | Okta System Log: app assigned / unassigned | the user's Applications tab summary |
| okta-mfa-reset | Okta System Log: authenticator reset / factors reset | the user's authenticator list summary |
| okta-user-lifecycle | Okta System Log: the lifecycle event | the user status read back |
| jamf-enroll-mac | Jamf Pro: enrollment and inventory history for the computer record | the computer record's management status |
| jamf-lock-erase | Jamf Pro: the command in History (completed, pending, failed) | the command status — never the lock PIN |
| mac-new-hire-laptop | Apple Business assignment; Jamf enrollment history; Okta and Admin log events for the account | each hand-off's read-back, in order |
| mac-troubleshoot | Jamf Pro inventory and command history | `fdesetup status` / `profiles show` output, sanitized |
| zoom-room-issue | Zoom web portal room history (restart, online/offline) | room status before and after |

## How to sanitize an excerpt

1. Replace every address with `[USER@DOMAIN.COM]` (or `[MANAGER_UPN]`, `[GROUP_EMAIL]`),
   every Okta login with `[UPN]`, every ID with `[USER_ID]` / `[DEVICE_ID]`, every serial
   with `[SERIAL_NUMBER]`, the customer ID with `[@Aegion_GWS_CUSTOMER_ID]`.
2. Remove timestamps to the minute only if they could identify a person; keep the date.
3. Never paste a password, a backup code, a lock PIN, an API token, or a recovery key —
   not even a redacted fragment.
4. Run `node scripts/pre-commit-check.js` on the staged file before committing.

## Excerpt layout

```text
Runbook: /<command>        Run date: <yyyy-mm-dd>        Operator: [ADMIN_NAME]
Ticket: [JIRA-###]         Lab tenant: [@Aegion_DOMAIN]
Steps run (gate ids): <ids>
Log event(s): <event name> at <date> by [ADMIN_NAME] for [USER@DOMAIN.COM]
Read-back: <sanitized output>
Result: PASS | FAIL — <one line>
```
