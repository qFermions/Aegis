# Systems Module

Infrastructure health monitoring, capacity checks, and network operations for hybrid
on-premises / M365 cloud environments.

## Contents

| File | Purpose |
|------|---------|
| [health_checks.md](health_checks.md) | Daily/weekly checks for AD, Entra, Intune, Exchange health |
| [infrastructure.md](infrastructure.md) | Server roles, domain controller procedures, AD Connect operations |
| [network_ops.md](network_ops.md) | Meraki dashboard operations, VPN config, wireless management |
| [scripts/health-check.js](scripts/health-check.js) | System health report — CPU, memory, disk, uptime with OK/WARNING/CRITICAL thresholds |

## Infrastructure Stack

| Layer | Technology | Management |
|-------|-----------|-----------|
| Identity (cloud) | Microsoft Entra ID | entra.microsoft.com |
| Identity (on-prem) | Windows Server AD | ADUC / RSAT |
| Identity sync | Microsoft Entra Connect | AD Connect server (on-prem) |
| MDM | Microsoft Intune | intune.microsoft.com |
| Email + collaboration | Exchange Online / Teams | EAC + admin.microsoft.com |
| Network | Cisco Meraki MX + MR | dashboard.meraki.com |
| VoIP | [@Aegion_VOIP] | [@Aegion_VOIP] admin portal |

## Health Check Schedule

| Check | Frequency | File |
|-------|-----------|------|
| AD Connect sync status | Daily | health_checks.md |
| Entra risky users | Daily | health_checks.md |
| Intune non-compliant devices | Weekly | health_checks.md |
| AD replication health | Weekly | health_checks.md |
| Meraki uplink status | As needed / on alert | network_ops.md |
| License utilization | Monthly | health_checks.md |
