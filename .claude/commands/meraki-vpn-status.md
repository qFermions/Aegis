---
description: Check Meraki MX site-to-site VPN tunnel status, latency, advertised subnets, and topology — troubleshoot down tunnels including NAT-T and subnet conflicts. Meraki dashboard first. Placeholders only.
---

# /meraki-vpn-status

**Verdict:** Most VPN tunnel failures come from an MX uplink being down, a mismatched or overlapping subnet, or a firewall rule blocking UDP 500/4500. Check the VPN status page first — green/amber/red tells you which peer to dig into.

> **Migration context:** [@Aegion] is mid-migration from the [@Aegion_WAN] point-to-point fiber link (main ↔ [@Aegion_SITE_2]) to Meraki MX-to-MX site-to-site VPN. [@Aegion_REMOTE_ACCESS] is still on the old [@Aegion_WAN] link and has not yet been migrated — treat any [@Aegion_REMOTE_ACCESS] VPN issue as a [@Aegion_WAN] issue until migration completes.

## What to check first
- Is one tunnel down or all tunnels down? One = peer-specific issue. All = local MX uplink or ISP issue at your site
- Check the MX uplink first: `Security & SD-WAN → Appliance status` — if the WAN is down, the VPN follows
- Is this a newly configured tunnel or a previously working one? New = config error. Working → broken = upstream change

## Step-by-step fix

**1. VPN status overview**
`Meraki dashboard → Security & SD-WAN → VPN status`
- Each peer site shows a coloured status badge:
  - **Green** = tunnel up, traffic flowing
  - **Amber** = tunnel up but degraded (high latency / packet loss)
  - **Red** = tunnel down
- Columns to review: Peer name · Status · Latency (ms) · Loss (%) · Last contact

**2. Latency + packet loss per tunnel**
On the VPN status page, click any peer row to expand — you'll see a latency/loss graph over time
- Latency >100 ms sustained or loss >1% = degraded tunnel; check ISP or QoS settings
- Latency spikes that self-recover = ISP flap; contact [@Aegion_ISP] if persistent

**3. Verify local subnets advertised**
`Meraki dashboard → [Hub Network] → Security & SD-WAN → Site-to-site VPN → Local networks`
- Each subnet you want remote sites to reach must be listed here with "VPN mode: Yes"
- Missing subnet = remote site can't reach that VLAN. Add it and save — tunnel updates within ~60 seconds

**4. Verify remote subnets received**
On the VPN status page, click a peer → expand "Remote subnets"
- The subnets the peer is advertising should all appear here
- Missing remote subnet = routing gap. Fix on the peer MX (Step 3 on that device)

**5. VPN topology — hub-and-spoke vs full mesh**
`Meraki dashboard → Security & SD-WAN → Site-to-site VPN → Organization-wide settings`
- [@Aegion] uses **hub-and-spoke**: the main office MX is the hub; all branch sites peer to the hub only
- Full mesh would have every site peering to every other site — confirm topology matches design before troubleshooting

**6. Troubleshoot a down (red) tunnel**

**Step 6a — Check local MX uplink**
`Meraki dashboard → [Your Network] → Security & SD-WAN → Appliance status`
- If WAN1 is down: ISP issue at your site. VPN will not come up until uplink recovers

**Step 6b — Check peer MX uplink**
Switch to the peer's network in the dashboard and check its Appliance status
- If the peer's WAN is down: issue is on their end. Contact [@Aegion_ISP] or visit the site

**Step 6c — NAT traversal (NAT-T)**
`Meraki dashboard → Security & SD-WAN → Site-to-site VPN`
- Meraki auto-negotiates NAT-T over UDP 4500 when both sides are behind NAT
- If one MX is behind a third-party router/firewall: confirm UDP 500 and UDP 4500 are allowed inbound to the MX WAN IP
- Check `Organization → Firewall → Outbound rules` — confirm no rule blocks UDP 500/4500 outbound

**Step 6d — Overlapping or duplicate subnets**
`Meraki dashboard → Security & SD-WAN → Site-to-site VPN → Local networks` on both MXes
- Two sites advertising the same subnet (e.g., 192.168.1.0/24 on both sides) will cause routing failures
- Fix: re-IP one site's VLAN so subnets are unique across all locations
- Common duplicates: 192.168.1.x, 10.0.0.x — check all 4 sites

**Step 6e — Firewall rules blocking VPN traffic**
`Meraki dashboard → Security & SD-WAN → Firewall`
- Review Layer 3 outbound rules: confirm no deny rule above a VPN-related allow
- VPN peers use the MX WAN IP — ensure the firewall isn't blocking inter-MX communication

**7. Meraki S2S VPN migration status**
| Site | VPN migration status |
|------|---------------------|
| Main office (hub) | Configured as hub |
| [@Aegion_SITE_2] | Migrating from [@Aegion_WAN] P2P |
| [@Aegion_SITE_3] | [STATUS — confirm before working phone/VPN ticket] |
| [@Aegion_SITE_4] | [STATUS] |
| [@Aegion_REMOTE_ACCESS] | Still on [@Aegion_WAN] — NOT yet migrated |

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Use the Meraki Dashboard REST API — no native PowerShell module exists.
# Requires env vars: MERAKI_API_KEY, MERAKI_ORG_ID, MERAKI_NETWORK_ID

$headers = @{ "X-Cisco-Meraki-API-Key" = $env:MERAKI_API_KEY }  # API key from environment variable — never hardcode

# Get VPN statuses for all MX devices in the org
Invoke-RestMethod `
    -Uri "https://api.meraki.com/api/v1/organizations/$env:MERAKI_ORG_ID/appliances/vpn/statuses" `
    -Headers $headers -Method Get |
    Select-Object networkId, deviceSerial,
        @{n='tunnels';e={$_.merakiVpnPeers | ConvertTo-Json -Depth 3}}  # show per-peer tunnel state for every MX in the org

# Get VPN stats (latency/loss) for a specific network
Invoke-RestMethod `
    -Uri "https://api.meraki.com/api/v1/networks/$env:MERAKI_NETWORK_ID/appliance/vpn/stats?timespan=3600" `
    -Headers $headers -Method Get  # pull VPN latency and loss stats for the last 1 hour
```

</details>

## ⚠️ Risk warning
- **Fixing subnet overlaps requires re-IPing a VLAN** — this is a major change affecting all devices on that VLAN. Run through Nova for plan review before executing
- **Do not remove the [@Aegion_WAN] P2P fiber link** until Meraki S2S VPN is confirmed stable and [@Aegion_REMOTE_ACCESS] is migrated — cutting it prematurely will isolate [@Aegion_SITE_2] and [@Aegion_REMOTE_ACCESS]
- Saving changes to `Site-to-site VPN → Local networks` will momentarily re-negotiate the tunnel (~30-60 sec interruption)
- Changing the VPN topology (hub-spoke ↔ full mesh) affects ALL tunnels across ALL sites simultaneously

## ✅ Verification checklist
- [ ] VPN status page: all expected peer tunnels show green
- [ ] Latency <50 ms, packet loss <0.5% on all tunnels
- [ ] Local subnets: all intended VLANs listed with "VPN mode: Yes"
- [ ] Remote subnets: all peer subnets visible in the expanded peer view
- [ ] No overlapping subnets across Main, [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4]
- [ ] [@Aegion_REMOTE_ACCESS] migration status confirmed before any [@Aegion_WAN] changes
- [ ] Ping test from a device at one site to a device at the remote site succeeds

## 📝 Jira-ready note
> Checked Meraki MX site-to-site VPN status for [@Aegion]. Reviewed tunnel status per peer, latency/loss metrics, advertised + received subnets, and VPN topology. Migration note: [@Aegion_REMOTE_ACCESS] is still on [@Aegion_WAN] P2P — not yet on Meraki VPN. Findings: [SUMMARY]. Action taken: [ACTION_OR_MONITORING]. Time spent: [X] min.
