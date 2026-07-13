# IT Support Module

Tier 1–2 support workflows for Microsoft 365 hybrid environments. Covers the most
common ticket categories with exact portal steps and PowerShell fallbacks.

## Contents

| File | Purpose |
|------|---------|
| [workflows.md](workflows.md) | End-to-end procedures: onboarding, offboarding, MFA reset, device enrollment |
| [troubleshooting.md](troubleshooting.md) | Diagnostic trees for the 10 most common ticket types |

## Guiding Principles

- **Portal first** — every procedure leads with admin center click-steps. PowerShell is
  a fallback for when the portal can't do the job, or when bulk operations require it.
- **Confirmation before destructive actions** — wipe, delete, disable, revoke, bulk changes
  all require explicit operator confirmation before execution.
- **Placeholder-only** — no real employee names, UPNs, emails, or device names in any procedure.
  Replace bracketed placeholders before use.
- **Verify completion** — every procedure ends with a verification step that proves the
  change took effect before the ticket is closed.

## Quick Reference

| Ticket Type | First Check | Portal Path |
|------------|-------------|-------------|
| Can't sign in | Is sign-in blocked? | Entra → Users → [UPN] → Edit properties |
| MFA issues | Auth methods registered? | Entra → Users → [UPN] → Authentication methods |
| Password reset | Cloud-only or hybrid AD? | admin.microsoft.com → Users → Reset password |
| Missing email | Quarantine? | security.microsoft.com → Quarantine |
| Device not enrolling | Enrollment restrictions? | Intune → Devices → Enrollment restrictions |
| No phone dial tone | Extension status? | [@Aegion_VOIP] admin → Extensions |
| Slow internet | Which site, which device? | Meraki → Network-wide → Clients |
| New user not in M365 | AD sync ran? | Entra → Hybrid management → Entra Connect |
| Shared mailbox access | Delegation set? | EAC → Recipients → Mailboxes → Delegation |
| Account locked | Too many failed attempts? | Entra → Users → [UPN] → Sign-in logs |
