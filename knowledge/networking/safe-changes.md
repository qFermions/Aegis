# Safe change patterns

> **Execution boundary:** planning reference only. Nothing in this file authorizes a change. Every change below is applied by the person named in its row, through their change process, after its pre-state is saved and its rollback is written. Every command that changes anything sits under a PREVIEW ONLY marker and is HUMAN-RUN; Aegis runs none of them.

## The rules every pattern shares

1. **Narrowest first.** One record, one rule, one peer, one listener, one access point group, one site, before many.
2. **Pre-state before the change.** Export the zone, the rule set, the tunnel settings, the radio profile, the config file. Save it with the ticket. A change with no saved pre-state is not started (CLAUDE.md, R2 and R3).
3. **Rollback written first.** The exact values to put back, and how long the rollback takes to reach users (a DNS rollback waits for caches; a firewall rollback is near instant).
4. **One change, then verify, then the next.** Verify from the user's side and from outside (a public lookup or a test from another network).
5. **Stop conditions.** Stop and roll back when the verify step shows anything the plan did not predict: a different answer, a lost tunnel, a rule that matches more than expected.
6. **Who applies it.** The owner of the system: the DNS owner, the firewall or network owner, the certificate owner, the zero-trust policy owner. A change that reaches a whole site or the internet is R3: a change window, a second person reviewing the plan, and the business told in advance.

## Pattern table

| Change | Blast radius | Applied by | R | Pre-state to save | Rollback | Stop if |
|---|---|---|---|---|---|---|
| Change or add one DNS record (A, AAAA, CNAME, TXT) | Everyone who resolves the name, for the old TTL | DNS owner, in the provider's console | R2 | Zone export, or the record's current values and TTL | Put the old values back; caches keep the new answer until its TTL ends | The authoritative answer after the change is not the planned one |
| Lower a TTL ahead of a migration | None by itself | DNS owner | R1 | The current TTL | Raise it again | Never needed; do it one full old TTL before the move |
| Change MX, NS, the apex, or DNSSEC (DS at the registrar, keys) | Mail delivery, or the whole domain | DNS owner and registrar account owner, change window | R3 | Zone export; NS and DS at the parent (`dig NS`, `dig DS` against the parent) | Restore the previous NS or DS; the parent's TTL decides how long the rollback takes | Any validating resolver returns SERVFAIL for the zone |
| Replace a certificate on a listener | Every client of that listener | Owner of the listener (load balancer, web server, CDN origin) | R2 per listener | Serial, expiry and chain of the current certificate; the binding | Rebind the previous certificate, only while it is still valid | The served chain does not verify, or a client group fails after the swap |
| Add, narrow or reorder a firewall rule | Every flow that matches the rule set | Firewall owner | R3 for a shared rule set; R2 for one host's rule | Rule set export, with hit counters | Restore the export | The new rule's hit counter grows on flows it was not meant for, or anything else breaks |
| Change an IPsec proposal or protected subnets | The whole tunnel, both sites | Network owners of both sides together, change window | R3 | Both sides' phase 1 and phase 2 settings, side by side | Restore the side that changed | The tunnel does not re-establish within the agreed minutes |
| Change one WireGuard peer (endpoint, allowed IPs, keepalive) | That peer's traffic | Owner of the gateway host | R2 | A copy of the config file | Restore the copy and reload the interface | No handshake within two minutes, or a subnet lost |
| Clamp TCP MSS, or set a tunnel MTU | Every TCP flow through that interface | Network owner | R2 for one tunnel; R3 for a site edge | Current MTU and MSS settings | Remove the clamp, restore the MTU | Small flows that worked before now fail |
| Change a Wi-Fi radio profile (channel width, bitrate, band steering, power) | Every access point using the profile, every client near them | Network owner, outside busy hours | R3 | Screenshot or export of the profile | Restore the previous values | Client counts or connection success drop after the change |
| Add a zero-trust exception (allow, do-not-inspect, split-tunnel exclude) | The people and destinations the exception names; less visibility | Zero-trust policy owner, approved by the security owner | R2 when narrow and time-limited; R3 when broad | The policy list and order | Remove the exception | It matches more users or destinations than planned |
| Change a DHCP scope, lease time or relay | Every client on that VLAN | Network owner | R2 | Scope settings and the current lease count | Restore the settings | Clients lose addresses or get unexpected ones |

## DNS: a record change, step by step

> **PREVIEW ONLY [net-safe-dns-record-change]:** planning steps for the DNS owner; this file does not authorize the change. Save the zone export first.

1. One full old TTL before the change: lower the record's TTL (for example from 3600 to 300) and wait the old TTL out.
2. Change the record in the provider's console (Cloudflare dashboard, DNS, Records; Route 53, Hosted zones; Azure portal, DNS zones).
3. Verify at the authoritative server (`dig name @ns1 +norecurse`), then publicly (a `net_dns` lookup reports what the public resolvers see), then from the user's resolver.
4. After the change has held for a day, raise the TTL again.

At the zone apex, a CNAME cannot sit beside the SOA and NS records (RFC 1034). Use the provider's apex feature instead: Cloudflare CNAME flattening, a Route 53 alias record, an Azure DNS alias record set.

## Firewall: review first, then the narrowest rule

What a review reads, for each rule, top to bottom:

| Look for | Why it matters | What to do |
|---|---|---|
| Any source, any destination, any port, allow | Allows everything that reaches it; often a temporary rule left behind | Find the flows its hit counter shows; replace with rules for those flows only; owner and end date |
| A rule never hit in 30 to 90 days | Dead weight, or shadowed by a broader rule above it | Check whether a rule above matches the same flows first; remove only after the owner agrees |
| A specific rule below a broader rule with the opposite action | Shadowed: it never matches | Move it above, or narrow the broad rule |
| No logging on deny rules, or on broad allows | No evidence when something breaks or something leaks | Turn on logging for denies and for broad allows |
| Rules with no owner, ticket or comment | Nobody can say whether they are still needed | Ask, record, then decide |
| Inbound rules open to the internet on management ports (SSH, RDP, admin consoles) | The most attacked surface | Restrict to known sources or move behind a VPN or zero-trust access; tell the security owner |

On Meraki MX, the L3 rules live under Security & SD-WAN, Configure, Firewall; outbound traffic is allowed by default, and a final deny rule is added only where the design needs an allow-list. In AWS, security groups are stateful and network ACLs are stateless and read lowest rule number first; in Azure, NSG rules are read lowest priority number first and stop at the first match.

> **PREVIEW ONLY [net-safe-firewall-rule-change]:** planning steps for the firewall owner; this file does not authorize the change.

1. Export the rule set with hit counters and save it with the ticket.
2. Write the new rule as narrow as the flow: one source, one destination, one port, an owner, a ticket number in the comment, an end date if temporary, logging on.
3. Place it above any broader rule it must beat, and below any deny it must not bypass.
4. After saving, read the new rule's hit counter while the user tests; read the broad rules' counters for anything unexpected.
5. Roll back by restoring the export if the stop conditions in the table above are met.

## WireGuard peer change on a Linux gateway

```bash
# PREVIEW ONLY [net-safe-wireguard-peer-change]
# HUMAN-RUN by the owner of the gateway host, in a change window. Aegis runs nothing.
# Keep a copy of the current config first, as the rollback.
# sudo cp /etc/wireguard/wg0.conf /etc/wireguard/wg0.conf.before-change
# Edit the one peer block, for example add the far subnet to AllowedIPs or set PersistentKeepalive = 25.
# sudo wg syncconf wg0 /etc/wireguard/wg0.conf
# Rollback: copy the saved file back and sync again.
# sudo cp /etc/wireguard/wg0.conf.before-change /etc/wireguard/wg0.conf
```

Verify: `sudo wg show wg0` shows a recent handshake and the new allowed IPs, and a ping from a host in each subnet crosses.

## MSS clamp on a Linux edge or tunnel host

```bash
# PREVIEW ONLY [net-safe-mss-clamp-linux]
# HUMAN-RUN by the network owner. Aegis runs nothing.
# Save the current rule set first, as the rollback.
# sudo cp /etc/nftables.conf /etc/nftables.conf.before-change
# Clamp TCP MSS on forwarded SYNs to the route MTU, in the forward chain of an inet filter table.
# sudo nft add rule inet filter forward tcp flags syn tcp option maxseg size set rt mtu
# Rollback: restore the saved file and reload it.
# sudo cp /etc/nftables.conf.before-change /etc/nftables.conf
```

Verify: a do-not-fragment ping at the old failing size now gets a "frag needed" answer or passes at the new size, and the large transfer that hung completes.

## A local DNS cache flush on one Windows device

```powershell
# PREVIEW ONLY [net-safe-dns-cache-flush-windows]
# HUMAN-RUN on the one affected device by the tech or the user. R1: it only empties a cache.
# Clear-DnsClientCache
# Read-back: Resolve-DnsName shows the current answer.
```

## Zero-trust exception, least privilege

Judgment rule b applies to a policy exception the same way it applies to access: the narrowest exception that does the job (one URL or application, not a category; do-not-inspect for one pinned app, not for all traffic), for a group rather than one person, approved by the owner of the policy and the security owner, with an end date when it is temporary. An exception asked for with no block page text and no log entry gets Ask first (judgment rule d). `/zero-trust-block` has the steps.
