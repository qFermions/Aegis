---
description: Systematic VPN troubleshooting decision tree — Meraki site-to-site + client VPN — symptom → isolation → ranked causes → fix → escalation. Meraki dashboard first. Placeholders only.
---

# /vpn-check

**Verdict:** Split it: **site-to-site (S2S)** vs **client VPN**. Then "tunnel down" vs "tunnel up but no traffic" — they have different causes. Context: the org is migrating `[@Aegion_WAN]` (P2P fiber) → Meraki MX-to-MX S2S; `[@Aegion_REMOTE_ACCESS]` still on the old link.

## Decision tree

### Site-to-site (Meraki MX ↔ MX)
**Tunnel DOWN:**
1. **Both MX uplinks up?** Security & SD-WAN → Appliance status at `[SITE_A]` and `[SITE_B]`.
2. **VPN registry/peers** — Security & SD-WAN → Site-to-site VPN → both sites in the same topology (hub/spoke or mesh), enabled.
3. **Subnets advertised** — each site's local subnets toggled into the VPN; **no overlapping subnets** between sites (the #1 silent killer).
4. **Firewall** — S2S firewall rules / upstream firewall not blocking UDP 500/4500 (IPsec).

**Tunnel UP, no traffic:**
1. **Subnet overlap / missing route** — destination subnet actually advertised at the far end?
2. **MX firewall rules** — Security & SD-WAN → Firewall blocking the traffic.
3. **DNS over VPN** — reaching by IP but not name → DNS server reachable across the tunnel?

### Client VPN
1. **Auth** — wrong creds / account disabled / MFA (if RADIUS). Check Event log / Meraki client VPN auth.
2. **Connects, no internet** — **split vs full tunnel**: split = only org subnets route over VPN (expected); full = all traffic. Set per requirement.
3. **Connects, can't reach internal** — subnet/route + MX firewall + DNS over VPN.
4. **Can't connect at all** — client VPN enabled on MX? shared secret correct? UDP 500/4500 reachable from the client's network?

<details>
<summary>Meraki dashboard paths — for reference</summary>

```text
Security & SD-WAN → Site-to-site VPN     # topology, peers, advertised subnets, status
Security & SD-WAN → Appliance status     # MX uplink up/down at each site
Security & SD-WAN → Firewall             # S2S + client-VPN rules
Security & SD-WAN → Client VPN           # client VPN enable, secret, RADIUS/auth
```
</details>

## ⚠️ Risk warning
- Changing advertised subnets or S2S topology can drop the inter-site tunnel for everyone — change one site at a time, verify, keep rollback. Coordinate cutover with `[@Aegion_NETPARTNER]`; route through Nova if irreversible.
- Don't "just restart" the MX during hours — it drops the site's internet + tunnel.

## ✅ Verification checklist
- [ ] S2S tunnel shows green/up between `[SITE_A]` and `[SITE_B]`
- [ ] Test traffic crosses (ping/SMB by IP **and** by name) both directions
- [ ] No overlapping subnets; correct subnets advertised
- [ ] Client VPN: auth succeeds + intended split/full-tunnel behavior

## 📝 Jira-ready note
> Resolved [date/time]. VPN issue: [S2S [SITE_A]↔[SITE_B] / client VPN]. Symptom: [tunnel down / up-no-traffic / auth]. Root cause: [uplink/subnet overlap/firewall/DNS/auth]. Fix: [action]. Verified bidirectional traffic. Time spent: [X] min.
