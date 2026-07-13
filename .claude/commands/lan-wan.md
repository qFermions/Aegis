---
description: Systematic LAN/WAN troubleshooting decision tree for a Meraki MX/MS environment — symptom → isolation → ranked causes → fix → escalation. Meraki dashboard first. Placeholders only.
---

# /lan-wan

**Verdict:** Isolate the blast radius first — **one user, one switch/area, or whole site (WAN)?** Meraki dashboard shows uplink + switch + client health in one place. WAN-down → it's the MX uplink or `[@Aegion_ISP]`, not the LAN.

## Decision tree

### 1. Scope (ask first)
- **One user** → cable/NIC/DHCP (client-side).
- **A group / one switch or area** → switch/VLAN.
- **Whole site, no internet** → WAN/MX uplink/ISP.

### 2. Single user down
1. **Physical** — cable seated? link light? try another port/cable.
2. **NIC** — disabled/driver? `ipconfig` shows a 169.254 (APIPA) → no DHCP.
3. **DHCP** — Meraki → Switch → client → got an IP? scope exhausted? wrong VLAN on the port?
4. **Port config** — Switch → Ports → `[SWITCH_NAME]` port → correct VLAN / not disabled / not err-disabled.

### 3. Group / one switch or area down
1. **Switch/AP offline** — Meraki → Switches → `[SWITCH_NAME]` status; PoE/power; uplink to MX.
2. **VLAN** — `[VLAN_ID]` misconfig / trunk dropped → Switch → VLAN settings + trunk allowed list.
3. **Loop/STP** — broadcast storm → check port counters / STP events.

### 4. Whole site / WAN down
1. **MX uplink** — Meraki → Appliance → Appliance status → uplink up? Security & SD-WAN → uplink. Down → check modem/handoff.
2. **ISP** — modem lights, then call `[@Aegion_ISP]` with the circuit ref. Confirm outage vs. on-prem.
3. **Failover** — secondary uplink/cellular present? did it fail over?
4. **DNS** — internet up but nothing resolves → upstream DNS / MX DNS settings.

### 5. "Network slow" (up but degraded)
1. **Bandwidth** — Appliance → Traffic analytics; one host saturating? (backup, large upload.)
2. **Client count / saturation**, **duplex mismatch** (port errors), **WAN latency/jitter** (uplink stats).

<details>
<summary>Meraki dashboard paths — for reference</summary>

```text
Security & SD-WAN → Appliance status     # MX uplink up/down, failover, latency/loss
Switching → Switches → [SWITCH_NAME]     # switch status, ports, PoE, VLANs
Network-wide → Clients → [CLIENT]        # per-client IP/VLAN/usage history
Security & SD-WAN → Traffic analytics    # top talkers / bandwidth hogs
```
</details>

## ⚠️ Risk warning
- VLAN/trunk or firewall-rule changes on the MX can cut a whole site — change one thing, verify, and have a rollback. Route risky cutovers through Nova / `[@Aegion_NETPARTNER]`.
- Don't reboot a core switch/MX during hours without warning.

## ✅ Verification checklist
- [ ] Affected scope back online (client IP/gateway/DNS/internet)
- [ ] Meraki shows switch/MX/uplink green
- [ ] No port errors / STP events recurring
- [ ] (WAN) uplink stable; ISP ticket # logged if their fault

## 📝 Jira-ready note
> Resolved [date/time]. LAN/WAN issue scope: [user/switch/site]. Root cause: [cable/DHCP/VLAN/MX uplink/ISP]. Fix: [action]. Verified via Meraki dashboard. [ISP case # / escalated to [@Aegion_NETPARTNER].] Time spent: [X] min.
