# Operator context: live environment state, physical security, Jira fields and projects

Moved out of `CLAUDE.md` in batch 1 (2026-10-27, base `d5fc8c0`) so the instruction file stays under 20,000 bytes; `CLAUDE.md` points here with one line. The text below is the `CLAUDE.md` wording unchanged except that each long dash became " - " and later fixes are named in the git log. Where a passage says "this file", read `CLAUDE.md` and the documents it points to.

## Default sites, device names, servers and vendors

Moved out of `CLAUDE.md` in batch 11 (2026-11-13, base `3ca7a12`) to keep the instruction file under 20,000 bytes with the new answer rules in it; the text is the `CLAUDE.md` wording unchanged except that each long dash became " - ". It belongs to the default environment: a customer profile, when given, replaces it.

### Office Sites
| Site | Notes |
|------|-------|
| Main office | Primary hub, AD Connect server, Meraki MX + MR |
| [@Aegion_SITE_2] | Connected via [@Aegion_WAN] (migrating to VPN), VoIP migration in progress |
| [@Aegion_SITE_3] | VoIP migration in progress |
| [@Aegion_SITE_4] | [STATUS] |

### Device Naming Convention
- Desktops: `DT-FirstName,LastName`
- Laptops: `LT-FirstName,LastName`
- Enforce this. If a ticket mentions a wrong format, flag it.

### Server Infrastructure
| Server | Role |
|--------|------|
| AD Connect server | Syncs on-prem AD → Entra ID. Check here first if new users don't appear in M365. |
| [@Aegion_FINANCE_SERVER] | Dedicated Windows Server for finance/accounting. Check with senior IT for access. |
| Third tower | Unknown role - ask senior IT: "File storage, backup, or app hosting?" |

### Key Vendors
| Vendor | Relationship | Use for |
|--------|-------------|---------|
| [@Aegion_NETPARTNER] | Long-term partner | Networking, cabling, VoIP install, VPN migration |
| [@Aegion_ISP] | ISP / contractual | Fiber, landlines (being eliminated) |
| [@Aegion_VOIP] | VoIP provider | Phone system support |
| [@Aegion_ALARM] | Security | Alarm monitoring, upgrading to internet-based |
| Microsoft | Platform | M365, Azure, Entra, Intune support |

## Live environment state (from the CLAUDE.md troubleshooting section)

### Environment-specific state

- **VoIP migration:** Main office ✅ complete · [@Aegion_SITE_2] 🔄 in progress · [@Aegion_SITE_3] 🔄 in progress · [@Aegion_SITE_4] [STATUS]. Check a site's migration status before working a phone ticket there.
- **Site-to-site VPN migration:** current link is [@Aegion_WAN] (main ↔ [@Aegion_SITE_2]); target is Meraki MX-to-MX S2S. [@Aegion_REMOTE_ACCESS] still on [@Aegion_WAN] - needs migration. VPN down → check MX uplink, firewall rules, VPN peers list, subnet conflicts.
- **MFA reset gotcha:** if a Conditional Access policy blocks login *before* the user can re-register, temporarily exclude the user from the CA policy, let them register at aka.ms/mfasetup, then re-add. Treat the exclusion as a Temporary Exception (see Security Behavior).

## [@Aegion_ALARM] / Physical Security

Landline-based alarm monitoring, upgrading to internet-based - timed with the VoIP migration: once [@Aegion_VOIP] is live at a site, the [@Aegion_ISP] landline can be cut. Alarm offline → check site internet (Meraki dashboard) → [@Aegion_ALARM] support. Scheduling coordinates [@Aegion_NETPARTNER] (cabling) + [@Aegion_ALARM] (cutover) + [@Aegion_ISP] (disconnect).

## Jira Service Management

**New ticket fields:** Summary (one line) · Reporter · Assignee [ADMIN_NAME] · Priority (Low/Med/High/Critical) · Department · Description (2-3 sentences) · Affected users/devices · Impact.

**Resolution note** - Resolved [date/time] · Issue (one sentence) · Root cause · Fix applied · Verified (how confirmed) · Time spent.

## Active Projects (2026)

| Project | Status | Notes |
|---------|--------|-------|
| VoIP migration ([@Aegion_VOIP]) | In progress | [@Aegion_SITE_2] + [@Aegion_SITE_3] remaining. [@Aegion_NETPARTNER] handling install. |
| [@Aegion_WAN] → Site-to-site VPN | In progress | Meraki MX-to-MX. [@Aegion_REMOTE_ACCESS] still on [@Aegion_WAN] - migrate it. |
| [@Aegion_ALARM] upgrade | Planning | Internet-based monitoring. Timed with VoIP cutover. |
| 1Password rollout | Evaluating | Teams Starter, ~6 paid seats + guest accounts for dept heads. |
| Aegis | Active | This agent - the adaptive IT-ops harness (ADR-006). `shared/` submodule is read-only historical. |
