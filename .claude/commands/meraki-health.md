---
description: Check overall Meraki network health across all sites — dashboard overview, MX uplinks, APs, switches, WAN throughput, top talkers, event log, firmware. Meraki dashboard first. Placeholders only.
---

# /meraki-health

**Verdict:** Start at Organization Overview for a fleet-wide snapshot, then drill per-site into MX uplinks, AP status, and switch ports. Most issues surface in the event log or as a red/amber uplink on the dashboard.

## What to check first
- Organization → Summary report: any red/amber alerts at a glance across all sites
- Organization → Overview → Network health: devices alerting, offline APs, offline MXes
- Note which sites are affected before drilling deeper — site-wide vs single-device determines your next move

## Step-by-step fix

**1. Organization-wide health overview**
`Meraki dashboard → Organization → Overview`
- Review the device inventory panel — any devices shown as offline or alerting
- Check "Alerting devices" count; click through to see which site/device
- Review the "Networks" list — confirm all 4 networks are present: Main, [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4]

**2. MX uplink status per site**
`Meraki dashboard → [Select Network] → Security & SD-WAN → Appliance status`
- **Uplink status:** WAN1 and WAN2 (if dual-WAN) should show Active/Ready — red = down, amber = degraded
- **WAN throughput:** check current Mbps sent/received vs expected capacity for that site
- **Latency + packet loss:** visible on the uplink graph — spikes indicate ISP issues
- Repeat for all 4 sites: Main, [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4]

**3. AP status (wireless)**
`Meraki dashboard → [Select Network] → Wireless → Access points`
- APs should show green (online). Red = offline, amber = alerting
- Check client count per AP — unusually high counts may indicate a rogue-AP or AP failure nearby
- Click an AP → check "Connected clients" and signal quality distribution
- For each site, confirm the expected number of APs matches what's listed

**4. Switch port status**
`Meraki dashboard → [Select Network] → Switch → Switches`
- Select a switch → **Ports** tab: look for unexpected disconnected (grey) ports or error-disabled (red) ports
- Check PoE budget if APs are PoE-powered — a switch near PoE limit will amber-alert

**5. Client count per site**
`Meraki dashboard → [Select Network] → Network-wide → Clients`
- Review total client count. Abnormally low = devices not connecting; abnormally high = unexpected devices
- Filter by SSID or VLAN to isolate staff vs guest traffic

**6. WAN throughput + latency trending**
`Meraki dashboard → [Select Network] → Security & SD-WAN → Appliance status → Uplink`
- Change time window to 24h or 7d for trending
- Sustained >80% utilization = congestion; spikes + high latency = ISP issue

**7. Top talkers / application usage**
`Meraki dashboard → [Select Network] → Network-wide → Traffic analysis`
- Review top applications by bandwidth — streaming, software updates, or backup jobs often spike WAN usage
- Filter by client to identify a single device consuming disproportionate bandwidth

**8. Event log**
`Meraki dashboard → [Select Network] → Network-wide → Event log`
- Filter by: VPN changes, MX reboots, AP disassociations, DHCP failures, firewall deny events
- Look for repeating events in the last 1-24 hours — repeating DHCP failures or auth failures signal a config issue

**9. Firmware notifications**
`Meraki dashboard → Organization → Firmware upgrades`
- Check for pending or scheduled firmware updates across networks
- Review release notes if an upgrade is pending — schedule during off-hours to avoid service disruption
- Confirm no upgrade is mid-flight if you're investigating unexpected reboots

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Meraki has no native PowerShell module — use the Meraki Dashboard API (REST) for scripted checks.
# The commands below are illustrative; substitute your actual API key and org/network IDs via env vars.

$headers = @{ "X-Cisco-Meraki-API-Key" = $env:MERAKI_API_KEY }  # pull API key from environment variable — never hardcode it

# Get all networks in the org
Invoke-RestMethod -Uri "https://api.meraki.com/api/v1/organizations/$env:MERAKI_ORG_ID/networks" `
    -Headers $headers -Method Get |
    Select-Object id, name, productTypes  # list every network with its ID and product types

# Get uplink statuses across all networks in the org
Invoke-RestMethod -Uri "https://api.meraki.com/api/v1/organizations/$env:MERAKI_ORG_ID/appliances/uplinks/statuses" `
    -Headers $headers -Method Get |
    Select-Object networkId, @{n='uplinks';e={$_.uplinks | ConvertTo-Json}}  # show WAN uplink state per MX
```

</details>

## ⚠️ Risk warning
- **Do not schedule firmware upgrades** during business hours — MX/AP reboots will drop all clients at that site for 2-5 minutes
- A WAN uplink flap at the main office affects all inter-site traffic including [@Aegion_SITE_2] P2P fiber link and any VPN tunnels — check main site first when multiple sites report issues
- Investigating top talkers is read-only and safe; any ACL/firewall rule changes require a separate change-control step

## ✅ Verification checklist
- [ ] Organization Overview shows 0 alerting devices (or known/expected exceptions documented)
- [ ] All 4 sites — Main, [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4] — have green MX uplinks
- [ ] AP count per site matches expected inventory; no red offline APs
- [ ] Switch ports: no unexpected error-disabled ports
- [ ] WAN utilization under 80% sustained on all site uplinks
- [ ] Event log reviewed; no repeating critical errors in the last 24 hours
- [ ] Firmware: no urgent upgrades overdue; any pending upgrades scheduled for off-hours

## 📝 Jira-ready note
> Performed full Meraki network health check across all 4 [@Aegion] sites (Main, [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4]). Reviewed: MX uplink status, AP online/offline counts, switch port status, WAN throughput + latency, top talkers, event log (last 24h), firmware upgrade notifications. Findings: [SUMMARY_OF_FINDINGS]. Action taken: [ACTION_OR_NO_ACTION_REQUIRED]. Time spent: [X] min.
