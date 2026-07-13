# 2026 Admin Portal Navigation

Exact navigation paths for the 2026 admin center layouts. Aegis reads this on demand
when a ticket needs a specific portal path — keeps `CLAUDE.md` lean while preserving
the exact-path reference that makes Aegis useful. Update this file when Microsoft
moves things around.

---

## Entra (entra.microsoft.com)
- Users: Identity → Users → All Users
- Groups: Identity → Groups → All Groups
- MFA per user: Identity → Users → [user] → Authentication methods
- Conditional Access: Protection → Conditional Access → Policies
- Entra Connect: Identity → Hybrid management → Microsoft Entra Connect
- Sign-in logs: Identity → Users → [user] → Sign-in logs
- Risky users: Protection → Identity Protection → Risky users
- Roles: Identity → Roles & admins → All roles

## Intune (intune.microsoft.com)
- All devices: Devices → All devices
- Compliance: Devices → Compliance
- Config profiles: Devices → Configuration
- Wipe/Retire/Delete: Devices → All devices → [device] → Wipe / Retire / Delete
- Apps: Apps → All apps
- Autopilot: Devices → Enrollment → Windows Autopilot → Devices
- Update rings: Devices → Windows → Update rings for Windows 10 and later

## M365 Admin (admin.microsoft.com)
- Active users: Users → Active users
- Licenses: Users → [user] → Licenses and apps tab
- Password reset: Users → Active users → [user] → Reset password
- Delete user: Users → Active users → [user] → Delete user
- Distribution groups: Teams & groups → Active teams & groups → Distribution list tab
- Shared mailboxes: Teams & groups → Active teams & groups → Shared mailboxes tab
- Aliases: Users → [user] → Mail tab → Manage email aliases

## Exchange (admin.exchange.microsoft.com)
- Mailboxes: Recipients → Mailboxes
- Shared mailbox permissions: Recipients → Mailboxes → [mailbox] → Delegation tab
- Mail flow rules: Mail flow → Rules
- Message trace: Mail flow → Message trace

## Defender (security.microsoft.com)
- Quarantine: Email & collaboration → Review → Quarantine
- Anti-spam allow list: Policies → Anti-spam → Allow list

## Meraki (dashboard.meraki.com)
- Clients: Network-wide → Clients
- AP status: Wireless → Access points
- Firewall rules: Security & SD-WAN → Firewall → L3 firewall rules
- VPN: Security & SD-WAN → Site-to-site VPN
- Event log: Network-wide → Event log

## [@Aegion_VOIP] ([@Aegion_VOIP_URL])
- Users: Users → Manage users
- Extensions: Phone system → Extensions
- Auto-attendant: Phone system → Auto attendant
- Call routing: Phone system → Call routing

## Jira ([@Aegion_JIRA_URL])
- Space: [@Aegion_JIRA_SPACE]
- Add fields: Work item view → Request form tab → drag field
- Department field: Custom dropdown (confirmed working, March 2026)
