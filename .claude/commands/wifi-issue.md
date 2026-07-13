---
description: Systematic Wi-Fi troubleshooting decision tree for a Meraki MR environment — symptom → isolation → ranked causes → fix → verification. Meraki dashboard first. Placeholders only.
---

# /wifi-issue

**Verdict:** Isolate first — **one client, one AP, or site-wide?** That single question routes the whole tree. Meraki dashboard → Wireless tells you most of it.

## Decision tree

### 1. Scope (ask this first)
- **One client** → client-side (below).
- **Everyone on one AP / one area** → AP-side.
- **Site-wide / all SSIDs** → controller/WAN-side (likely a `/lan-wan` problem, not Wi-Fi).

### 2. "Can't connect" (won't associate)
Ranked causes → fix:
1. **Wrong PSK / expired creds** → re-enter; for 802.1X check the user's account/MFA.
2. **SSID not broadcast** → Meraki → Wireless → SSIDs → enabled? AP radio up? (Wireless → Access points → `[AP_NAME]` status green.)
3. **Client blocklisted / failed auth** → Wireless → Clients → `[CLIENT]` → connection log (association/auth/DHCP stages).
4. **Band/driver** → forget network, update Wi-Fi driver, retry.

### 3. "Connected, no internet"
1. **DHCP** — did it get an IP/gateway? (Client details → IP.) Scope exhausted? → check DHCP on the MX/switch.
2. **DNS** — IP but no name resolution → test 8.8.8.8 vs name.
3. **Upstream/WAN** — if site-wide, jump to `/lan-wan` (MX uplink/ISP).
4. **Captive portal/guest** — guest SSID stuck on splash → Wireless → splash settings.

### 4. "Slow / intermittent drops"
1. **RF/channel** — Wireless → RF spectrum / channel utilization; high interference → re-channel or check for rogue APs.
2. **Signal** — client RSSI low (far/walls) → AP placement/power.
3. **Overloaded AP** — client count high → load-balance / add AP.
4. **Roaming** — drops moving between APs → check min bitrate / band steering.

<details>
<summary>Meraki dashboard paths — for reference</summary>

```text
Wireless → Access points → [AP_NAME]        # AP status, clients, channel, utilization
Wireless → Clients → [CLIENT]               # per-client connection log (assoc/auth/DHCP/DNS)
Wireless → RF spectrum                       # interference / channel utilization
Wireless → SSIDs                             # SSID enabled, band, splash, access control
```
</details>

## ⚠️ Risk warning
- Don't reboot an AP serving many clients during business hours without warning — it drops everyone on it.
- Channel-width / power changes affect the whole area; change one variable at a time.

## ✅ Verification checklist
- [ ] Affected client(s) associate, get DHCP, resolve DNS, reach internet
- [ ] Meraki client log shows clean assoc→auth→DHCP
- [ ] Signal/utilization back in normal range
- [ ] If AP rebooted, all clients re-associated

## 📝 Jira-ready note
> Resolved [date/time]. Wi-Fi issue scope: [one client/AP/site]. Root cause: [PSK/DHCP/RF/signal/etc.]. Fix: [action]. Verified client connectivity + Meraki connection log clean. Time spent: [X] min. [Escalated to [@Aegion_NETPARTNER] if RF/cabling.]
