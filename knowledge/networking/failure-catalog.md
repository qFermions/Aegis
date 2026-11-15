# Failure catalog

> **Execution boundary:** reference text. A fix named here is applied by its owner through `safe-changes.md` and the runbook it names; nothing here authorizes a change.

Each row: the symptom as people report it, the likely causes ranked (most common first, for a ticket nobody has written yet), the smallest test that tells the top causes apart, the fix, and the rollback. "R" is the risk class of the fix (CLAUDE.md, R0 to R3).

## Name resolution (DNS)

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| A new or changed record is not seen by some users | 1. Old answer cached until its old TTL runs out. 2. Negative answer cached (the name was queried before it existed). 3. Record added in the wrong zone or the wrong view (internal against external). | `dig name @authoritative +norecurse` against `dig name` on the user's resolver; read the TTL counting down on the resolver | Wait out the TTL, or flush the one resolver the company runs (R1). Next time, lower the TTL a full old-TTL before the change. | None needed for a wait; a flush only empties a cache. |
| NXDOMAIN for a name that "exists" | 1. Typo or missing record. 2. Split horizon: the internal zone answers for the whole domain and lacks the name. 3. The zone at the provider is not the one the registrar delegates to. | Ask the authoritative server directly, then compare the NS at the parent (`dig NS zone @parent-server`) with the NS in the zone | Add the record in the right zone or view (R2: a zone change); for split horizon, add the name to the internal zone or forward it. | Remove the added record; keep the pre-change zone export. |
| SERVFAIL for one domain from a validating resolver, fine elsewhere | 1. DNSSEC: expired signatures, or the DS at the parent does not match the zone's key after a key or provider change. 2. All authoritative servers unreachable from that resolver. 3. Lame delegation. | `dig name +cd` against the same resolver: an answer with `+cd` means validation fails | Re-sign or roll back to the matching key; or, during a provider move, remove the DS at the registrar before the move and add the new one after (R3). | Restore the previous DS or key; keep both until the parent's DS TTL has passed. |
| REFUSED | 1. Asked an authoritative-only server to recurse. 2. The resolver's access list does not include this client's network (a new subnet, a VPN pool). | Ask the same server for a name in its own zone with `+norecurse` | Use the right resolver; add the new subnet to the resolver's access list (R2). | Remove the added network from the list. |
| Mail or a service fails after moving the apex to a CDN or load balancer | 1. A CNAME at the zone apex (not allowed beside SOA and NS; providers offer flattening or alias records instead). 2. MX or TXT records lost in the move. | `dig zone ANY` is unreliable; ask for SOA, NS, MX, TXT and A at the apex one by one | Use the provider's apex feature (Cloudflare CNAME flattening, a Route 53 alias, an Azure DNS alias) and restore the lost records (R2). | Restore the zone export taken before the move. |
| Works on the office network, fails on VPN or off-site (or the reverse) | 1. Split DNS: the VPN or zero-trust client sends queries for the domain to an internal resolver, or does not. 2. The internal resolver is unreachable from the remote path. | `dig name` on and off the VPN, and note which resolver answered (the SERVER line) | Fix the client's DNS settings for that domain (local domain fallback, split-DNS list) (R2 for a policy shared by many). | Restore the previous client DNS list. |

## TLS and certificates

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| "Certificate expired" on a site that was fine yesterday | 1. Renewal failed (validation record removed, DNS challenge failing, rate limit, payment). 2. Renewed but not bound (another listener, another node, the CDN's origin certificate). | Compare the serial and dates the host serves (`openssl s_client`, or `net_tls`) with the newest certificate issued | Fix the renewal and bind the new certificate on every listener that serves the name (R2 per listener). | Rebind the previous certificate only while it is still valid; an expired one is no rollback. |
| Name mismatch | 1. No SNI or the wrong SNI, so the default certificate is served. 2. The name was never in the subject alternative names. 3. The wrong listener answers (DNS points at an old host). | `openssl s_client -connect host:443 -servername host` against the same without `-servername`; `dig` the name | Send SNI (client fix), add the name to the certificate (reissue, R2), or fix the DNS record (R2). | Rebind the previous certificate; restore the record. |
| Works in browsers, fails for APIs, scripts or health checks | 1. The intermediate is missing from the chain the server sends. 2. The client's trust store is old. | `openssl s_client -showcerts`: count the certificates and read "Verify return code" | Install the full chain (leaf, then intermediates) on the server (R2). | Rebind the previous bundle. |
| Every HTTPS site shows a certificate from a security product | 1. TLS inspection by a proxy or zero-trust client on a device without its root certificate. 2. A captive portal or a hostile middlebox. | Read the issuer on two unrelated sites; a shared issuer naming the proxy is inspection | Deploy the proxy's root through device management, or exclude pinned apps from inspection (R2); an unknown issuer nobody runs is a security escalation. | Remove the exclusion or the pushed certificate profile. |
| Cloudflare 525 or 526 | 525: the edge and the origin share no TLS handshake. 526: the origin's certificate is invalid while the zone requires a valid one (Full strict). | Read the origin's certificate directly (bypassing the edge, from a host allowed to reach the origin) | Fix the origin's certificate or TLS settings (R2); do not lower the zone's SSL mode as the first fix. | Rebind the previous origin certificate. |

## Routing, reachability and BGP

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| One site cannot reach anything | 1. Uplink or ISP down. 2. Firewall or gateway failure. 3. Upstream routing. | Gateway ping, then a public address by number, from a wired client at that site; the firewall's uplink status | ISP ticket with times and the circuit id; fail over to the second uplink if one exists (R2). | Fail back after the primary is proven stable. |
| One SaaS or website down for many companies at once | 1. The provider's incident. 2. An upstream routing event (a route leak or a withdrawal). | Status pages, then `traceroute` from two networks: both dying inside one network points upstream | Nothing local to fix; tell users and track the provider's status. | None. |
| Traffic to a cloud subnet dies, return path suspected | 1. Asymmetric routing (the reply leaves by another firewall that drops it as invalid). 2. A missing route back. | A capture on both sides: the SYN arrives, the SYN-ACK leaves by the other path or never leaves | Add the return route or keep the flow symmetric (R2 or R3 by scope). | Remove the added route. |

## VPN

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| IPsec tunnel never comes up | 1. Phase 1 proposal mismatch (encryption, integrity, DH group, IKE version) or a pre-shared key mismatch. 2. UDP 500 or 4500 blocked, or the peer address changed. 3. Peer identity mismatch. | The peer's or the dashboard's event log for the negotiation messages; a capture on UDP 500 and 4500 at the public interface | Make both sides match, one side changed to the other's documented values (R3: a site's tunnel). | Restore the saved proposal on the side that changed. |
| Tunnel up, one subnet unreachable | 1. The subnet is not in the phase 2 selectors or the advertised local networks on one side. 2. Overlapping subnets. 3. A firewall rule inside the tunnel. | Read both sides' protected subnets side by side; ping from a host in each protected subnet | Add the subnet on both sides, mirrored (R3). | Remove the added subnet. |
| WireGuard: no handshake | 1. Endpoint address or port wrong, or UDP blocked. 2. Public keys swapped or mistyped. | `wg show` latest handshake on both ends; a capture of UDP on the listen port | Correct the endpoint or key (R2 for one peer). | Restore the saved config file. |
| WireGuard: handshakes, but some addresses unreachable | 1. `AllowedIPs` lacks the far subnet on one side (it is the route and the filter). 2. No IP forwarding or NAT on the gateway peer. | `wg show` allowed IPs on both ends; a ping from inside the tunnel address | Add the subnet to `AllowedIPs` on both sides (R2). | Restore the saved config. |
| Tunnel drops after idle time behind NAT | 1. The NAT mapping expires: no keepalive. 2. Dead peer detection timers too aggressive. | Time between last traffic and the drop; the NAT device's UDP timeout | WireGuard `PersistentKeepalive` on the side behind NAT; IPsec NAT keepalives or DPD settings that match (R2). | Remove the keepalive line. |

## MTU and fragmentation

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| Small pages and pings work, big transfers hang | 1. Path MTU black hole: an encapsulation (IPsec, WireGuard, GRE, PPPoE, a zero-trust tunnel) lowers the MTU and ICMP "fragmentation needed" is dropped. 2. A device with a wrong interface MTU. | `ping` with do-not-fragment at 1472, then smaller, across the failing path | Clamp TCP MSS at the tunnel or edge; allow ICMP type 3 code 4 and ICMPv6 type 2 (R2 or R3 by scope). | Remove the clamp or rule. |
| AWS site-to-site VPN slow or stalls on large flows | MTU above what the tunnel supports; the service does not do path MTU discovery. | DF ping across the tunnel | Clamp MSS on the customer gateway to the documented value (R2). | Remove the clamp. |

## Firewall rules

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| A new allow rule "does nothing" | 1. A broader deny above it is matched first (the new rule is shadowed). 2. The rule is on the wrong interface, direction or zone. 3. The return traffic is blocked by a stateless ACL. | Read the rules top down for the first one the flow matches; read the hit counters | Move the specific rule above the broad one, or narrow the broad one (R3 for a shared rule set). | Restore the exported rule order. |
| Review finds "any any" allow rules | Temporary rules never removed; rules added for a vendor without an end date. | Hit counters over 30 days, owner and ticket for each rule | Narrow to the source, destination and port in use, with an owner and an end date (R3). | Restore the export. |
| Cloud: inbound allowed, still no connection | Stateless network ACL drops the return traffic (security groups are stateful, network ACLs are not). | Read both: the security group and the subnet's network ACL, inbound and outbound | Allow the ephemeral return ports in the ACL (R2). | Remove the added ACL entry. |

## Wi-Fi

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| Slow and dropping in one crowded room | 1. Density: too many clients for the airtime. 2. Wide channels causing co-channel overlap. 3. 2.4 GHz crowding. | Read channel utilization and client count on the room's access points at the busy hour | 20 MHz channels, band steering to 5 GHz, a higher minimum bitrate (R3: a radio profile shared by a site). | Restore the previous radio profile values. |
| One laptop drops everywhere | Client driver, power saving, an old saved profile, a recent OS update. | Another device in the same spot works | `/wifi-issue` on that client (R1). | Reinstall the previous driver. |
| Calls drop when walking | Sticky clients and roaming thresholds; transmit power too high; a gap in coverage. | The client's roaming events and signal at the drop | Adjust power and minimum bitrate for the area (R3 for a profile). | Restore the profile. |

## Uplink saturation and traffic shaping

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| Calls choppy and video freezing at busy hours, fine early morning | 1. The uplink is full (backups, updates, large uploads) and voice has no priority. 2. Loss or jitter on the ISP path. 3. Wi-Fi in one area (tree G). | The uplink's use over the day against the bad times; an `mtr` to the voice provider at a bad time, read per section 4 of `reading-evidence.md` | A traffic shaping rule that gives voice and video priority and caps bulk traffic, on the site's firewall (on Meraki MX, the SD-WAN and traffic shaping page [unconfirmed: check the vendor page]) (R3: every flow at the site) | Restore the exported shaping rules |
| One application slow for everyone, others fine | 1. A shaping or bandwidth limit rule matches it. 2. The application's own service. | Read the shaping rules for a rule that names that application or category; check its status page | Narrow or remove that limit (R3) | Restore the export |

## DHCP

| Symptom | Likely causes, ranked | Smallest splitting test | Fix (R) | Rollback |
|---|---|---|---|---|
| New devices get 169.254.x.x | 1. Scope exhausted. 2. Relay (helper address) missing or wrong on that VLAN. 3. Link or VLAN wrong. | The scope's free lease count; a capture showing DISCOVER with no OFFER | Shorter lease or larger scope (R2); fix the relay (R2). | Restore the previous lease time or scope. |
| Clients get a gateway or DNS server nobody configured | A rogue or misconfigured DHCP server on the VLAN. | The lease's server identifier against the known DHCP servers | Find and disconnect the port; turn on DHCP snooping or the switch's DHCP-server policy (R3). Unknown server: security escalation first. | Re-enable the port once the device is identified as harmless. |
