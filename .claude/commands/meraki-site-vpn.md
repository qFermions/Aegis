---
description: Configure and verify a Meraki MX-to-MX site-to-site VPN — topology, advertised subnets, no-overlap, firewall, verification. Supports the [@Aegion_WAN]→S2S migration. Dashboard first. Placeholders only.
---

# /meraki-site-vpn

**Verdict:** Meraki Auto VPN makes MX-to-MX simple: set each site's role (hub/spoke or mesh), advertise the right local subnets, and **never overlap subnets** between sites. This is the target state for the `[@Aegion_WAN]` → site-to-site migration (`[@Aegion_REMOTE_ACCESS]` still on the old link → migrate it). For *troubleshooting* an existing tunnel, use `/vpn-check`.

## What to check first
- Both MX appliances online with healthy uplinks (Security & SD-WAN → Appliance status) at `[SITE_A]` and `[SITE_B]`.
- Plan subnets so they **don't overlap** (e.g., Site A 10.1.0.0/24, Site B 10.2.0.0/24).

## Step-by-step (dashboard first)
1. **Per site:** Security & SD-WAN → **Site-to-site VPN** → set **Type**: Hub (mesh) or Spoke. For two sites, mesh/hub-and-spoke both work.
2. **Advertise subnets:** in the same page → **Local networks** → toggle **VPN: On** for the subnets each site should share. Leave guest/IoT subnets **off** unless intended.
3. **NAT traversal / uplink:** leave Auto unless behind a strict upstream firewall (then Manual + port-forward UDP 500/4500).
4. **Firewall:** Security & SD-WAN → **Site-to-site VPN firewall** → allow the intended inter-site traffic (default allow; tighten per policy).
5. **Migration cutover:** stand up the S2S tunnel alongside `[@Aegion_WAN]`, verify traffic crosses, then decommission the old P2P link. Migrate `[@Aegion_REMOTE_ACCESS]` last. Coordinate with `[@Aegion_NETPARTNER]`.

<details>
<summary>Verification commands — for reference (run from a client)</summary>

```powershell
Test-NetConnection -ComputerName [SITE_B_HOST] -Port 445   # reach a far-site host across the tunnel (SMB)
ping [SITE_B_GATEWAY]                                       # basic reachability to the far subnet gateway
nslookup [SITE_B_HOST]                                      # confirm DNS resolves across the tunnel
```
</details>

## ⚠️ Risk warning
- Toggling subnets or changing topology can drop the tunnel for **both** sites — change one site, verify, keep a rollback. Irreversible/cutover steps → route through Nova and schedule with `[@Aegion_NETPARTNER]`.
- Overlapping subnets will make the tunnel "up" but traffic fails — the most common Auto VPN mistake.

## ✅ Verification checklist
- [ ] Site-to-site VPN page shows the peer **reachable/green** both ways
- [ ] Correct subnets advertised; **no overlap**
- [ ] Test traffic crosses by **IP and by name** in both directions
- [ ] Old `[@Aegion_WAN]` link only decommissioned after S2S verified
- [ ] `[@Aegion_REMOTE_ACCESS]` migration tracked

## 📝 Jira-ready note
> Resolved [date/time]. Configured/verified Meraki S2S VPN `[SITE_A]`↔`[SITE_B]` (Auto VPN, subnets advertised, no overlap). Bidirectional traffic confirmed by IP + name. [Migration: old P2P pending decommission / [@Aegion_REMOTE_ACCESS] pending.] Coordinated with [@Aegion_NETPARTNER]. Time spent: [X] min.
