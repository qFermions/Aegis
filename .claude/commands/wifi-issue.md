---
description: Systematic Wi-Fi troubleshooting decision tree for a Meraki MR environment — symptom → isolation → ranked causes → fix → verification. Meraki dashboard first. Placeholders only.
disable-model-invocation: true
---

# /wifi-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Isolate first — **one client, one AP, or site-wide?** That single question routes the whole tree. Meraki dashboard → Wireless tells you most of it.

## Decision tree

### 1. Scope (ask this first)
- **One client** → client-side (below).
- **Everyone on one AP / one area** → AP-side.
- **Site-wide / all SSIDs** → controller/WAN-side (likely a `/lan-wan` problem, not Wi-Fi).
- **Which service** (answer-format section 2, "How wide before why"): connected to Wi-Fi but one service will not load, or nothing loads? Does the same device work on a cable or a phone hotspot? One cloud service down on Wi-Fi and on a cable alike is not Wi-Fi: read that vendor's own status page first; with no incident there, name resolution comes next.
- **Vendor status, read together with the scope:** https://status.meraki.net for the Meraki cloud, and for a site-wide loss the provider's own status page or outage line for `[@Aegion_ISP]` (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-33).
- **No vendor incident:** the network path and name resolution come before any account-level cause. Association, address (DHCP) and gateway first, then `nslookup` on the name that fails; only then the user's account or certificate for 802.1X.

### 2. "Can't connect" (won't associate)

> **PREVIEW ONLY [wifi-client-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
Ranked causes → fix:
1. **Wrong PSK / expired creds** → re-enter; for 802.1X check the user's account/MFA.
2. **SSID not broadcast** → Meraki → Wireless → SSIDs → enabled? AP radio up? (Wireless → Access points → `[AP_NAME]` status green.)
3. **Client blocklisted / failed auth** → Wireless → Clients → `[CLIENT]` → connection log (association/auth/DHCP stages).
4. **Band/driver** → forget network, update Wi-Fi driver, retry.

### 3. "Connected, no internet"

> **PREVIEW ONLY [wifi-network-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. **DHCP** — did it get an IP/gateway? (Client details → IP.) Scope exhausted? → check DHCP on the MX/switch.
2. **DNS** — IP but no name resolution → test 8.8.8.8 vs name.
3. **Upstream/WAN** — if site-wide, jump to `/lan-wan` (MX uplink/ISP).
4. **Captive portal/guest** — guest SSID stuck on splash → Wireless → splash settings.

### 4. "Slow / intermittent drops"

> **PREVIEW ONLY [wifi-radio-remediation]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
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
