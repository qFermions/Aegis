# Network Operations

Cisco Meraki management, site-to-site VPN configuration, and wireless troubleshooting
for a multi-site deployment.

---

## Network Overview

| Site | Firewall | APs | WAN | Status |
|------|---------|-----|-----|--------|
| Main office | Meraki MX | Meraki MR | [@Aegion_ISP] fiber | Active |
| [@Aegion_SITE_2] | Meraki MX | Meraki MR | Shared WAN | VPN migration in progress |
| [@Aegion_SITE_3] | Meraki MX | Meraki MR | [@Aegion_ISP] | Active |
| Site 4 | [DEVICE] | [DEVICE] | [ISP] | [STATUS] |

---

## Meraki Dashboard Navigation

| Task | Path |
|------|------|
| Client list (all sites) | Network-wide → Clients |
| AP status | Wireless → Access points |
| Firewall rules | Security & SD-WAN → Firewall → L3 firewall rules |
| Site-to-site VPN | Security & SD-WAN → Site-to-site VPN |
| Event log | Network-wide → Event log |
| MX uplink status | Security & SD-WAN → Appliance status |
| Switch ports | Switching → Switches → [switch] → Ports |
| SSID config | Wireless → SSIDs |
| Traffic analytics | Network-wide → Summary report |

---

## Firewall (Meraki MX) Operations

### Checking WAN Health

1. Dashboard → Security & SD-WAN → Appliance status
2. Check: Uplink health, throughput, latency, packet loss per WAN interface
3. Compare against contracted speeds

### Adding an L3 Firewall Rule

1. Security & SD-WAN → Firewall → L3 firewall rules
2. Click `Add rule` at top (rules are evaluated top-to-bottom, first match wins)
3. Set: Policy (Allow/Deny), Protocol, Source, Destination, Port, Comment
4. Click Save → changes apply within ~30 seconds

**Rule ordering:** More specific rules must come BEFORE broader rules.
A "Deny all" at the bottom blocks anything not explicitly allowed above it.

### Port Forwarding (Inbound NAT)

1. Security & SD-WAN → Firewall → Port forwarding
2. Click Add rule
3. Set: Public IP (WAN), Public port, LAN IP, LAN port, Protocol, Allowed remote IPs
4. `Allowed remote IPs` — restrict to known source IPs when possible (don't leave open to Any unless required)

---

## Site-to-Site VPN

### Current State
- Main ↔ [@Aegion_SITE_2]: Being migrated from P2P fiber to Meraki site-to-site VPN
- [@Aegion_REMOTE_ACCESS] still on the P2P circuit — migrate after VPN is stable
- All Meraki MX units should be enrolled in the same organization dashboard for Auto VPN

### Meraki Auto VPN Configuration

**Hub (main office):**
1. Security & SD-WAN → Site-to-site VPN → Type = Hub
2. Set subnets to participate in VPN
3. Auto VPN will negotiate with spokes automatically

**Spoke (remote site):**
1. Security & SD-WAN → Site-to-site VPN → Type = Spoke
2. Hub = [Main office network name]
3. Subnets: include the local LAN subnet

**Verify tunnel is up:**
1. Security & SD-WAN → Site-to-site VPN → VPN status tab
2. Status = `Connected` · Latency should be < 10ms for LAN-to-LAN

### VPN Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| Tunnel shows `Not connected` | MX uplink on both sides | Check WAN connectivity at both sites |
| Tunnel up but no traffic | Firewall rules | Check L3 rules aren't blocking VPN subnet traffic |
| Intermittent drops | Packet loss on WAN | Open ISP ticket; check MX event log |
| Latency high | WAN saturation | Check client bandwidth usage; check QoS rules |
| Can't reach specific subnet | Subnet not advertised | Add subnet to VPN participation list on spoke |

---

## Wireless (Meraki MR) Operations

### Checking AP Status

1. Wireless → Access points
2. Green dot = online and broadcasting
3. Orange = warning (check: firmware, client count, channel interference)
4. Red/grey = offline

**Common causes of AP going offline:**
- PoE switch port failure → check Switching → [switch] → [port] → is it delivering PoE?
- VLAN misconfiguration → check AP trunk port allows management VLAN
- Firmware update in progress → wait 10 min, then check

### SSID Configuration

1. Wireless → SSIDs → click SSID name
2. Key settings:
   - Security: WPA2/WPA3 Enterprise (Radius) or WPA2 PSK
   - VLAN tagging: assign each SSID to its VLAN
   - Band steering: enabled (pushes clients to 5 GHz when available)
   - Minimum bitrate: set to 12 Mbps or higher (drops weak clients before they drag everyone)

### Wireless Troubleshooting

| Issue | Check |
|-------|-------|
| Client can't connect | SSID broadcasting? Client in coverage? Correct password? |
| Slow WiFi | AP client count (>25 = overloaded), channel utilization, interference |
| Roaming drops | AP placement gaps, minimum RSSI not set, same SSID on all APs? |
| One area has no signal | AP offline? Dead zone? Need additional AP? |

**Channel utilization threshold:** > 70% utilization on a channel = likely causing congestion.
Fix: Wireless → RF profiles → adjust channel width or enable auto-channel.

### QoS for VoIP

VoIP traffic should be prioritized over bulk data to prevent call quality issues.

1. Security & SD-WAN → SD-WAN & traffic shaping
2. Application-based traffic shaping:
   - VoIP/Video: High priority (Expedited Forwarding DSCP)
   - File sharing / backups: Low priority or throttled
3. Per-client bandwidth limit: prevents one user from saturating the link

---

## ISP and Connectivity

### Reporting a Circuit Outage

When a site loses internet:
1. Confirm it is the ISP circuit (not internal routing): connect a laptop directly to the MX WAN port
2. Meraki → Appliance status → check uplink status and loss
3. Check ISP status page for known outages
4. Open an ISP support ticket:
   > "We are experiencing a complete outage on our [@Aegion_ISP] circuit at [SITE_ADDRESS].
   > Account: [ACCOUNT_NUMBER]. Circuit ID: [CIRCUIT_ID].
   > Outage began: [DATE/TIME]. All internal devices confirmed — issue is WAN uplink.
   > Please escalate — this affects all users at this location."

### Documenting Circuit Info

| Site | ISP | Circuit ID | Account # | Support # |
|------|-----|-----------|----------|----------|
| Main | [@Aegion_ISP] | [CIRCUIT_ID] | [ACCOUNT] | [SUPPORT_PHONE] |
| [@Aegion_SITE_2] | [@Aegion_ISP] | [CIRCUIT_ID] | [ACCOUNT] | [SUPPORT_PHONE] |
| [@Aegion_SITE_3] | [@Aegion_ISP] | [CIRCUIT_ID] | [ACCOUNT] | [SUPPORT_PHONE] |

---

## Network Change Log

| Date | Change | Site | Performed by | Ticket |
|------|--------|------|-------------|--------|
| | | | [ADMIN_NAME] | [JIRA-###] |
