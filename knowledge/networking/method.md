# The method: from the link to the application

> **Execution boundary:** reference text. It authorizes no change; a person applies every change through their own process.

A senior network engineer does not start with a theory. They fix the scope, read what the failure already wrote down, and then walk the layers with the smallest test that tells one layer from the next. Every step below is general: it fits a ticket nobody has written yet.

## Step 0: how wide before why

Answer-format section 2, "How wide before why", is step one of every networking ticket. Before any cause, fix the scope:

| Question | What each answer points to |
|---|---|
| One person, one device, or many? | One device: that device's link, address, client software or cache. Many: something they share (a site, a resolver, a firewall, a tunnel, an ISP, the service). |
| One site, or every site? | One site: that site's uplink, firewall, switch or tunnel. Every site: the shared service, the DNS zone, the cloud side, or the vendor. |
| This service only, or other internet services too? | Only this one: its name, its certificate, its origin, a policy for it. Everything: the local link, DHCP, DNS resolver or uplink. |
| By name and by address, or only by name? | Works by address but not by name: name resolution. Fails both ways: routing, filtering or the service itself. |
| On the office network, at home, on the VPN, with the zero-trust client on? | Fails only on one path: that path's policy, proxy, MTU or split-tunnel rule. |
| IPv4 and IPv6, or one of them? | One family only: that family's route, record (A against AAAA) or firewall rule. |
| Since when, and what changed then? | A change in the same window is the first suspect (a firewall rule, a DNS record, a certificate renewal, a firmware upgrade, a new ISP circuit, a new zero-trust policy). |

Read the vendor's status page in the same step: the ISP, Cisco Meraki (`status.meraki.net`), Cloudflare (`www.cloudflarestatus.com`), Zscaler (`trust.zscaler.com`), the cloud provider. With no vendor incident listed, the network path and name resolution come before any account-level cause.

## Step 1: what changed, then look before guessing

- **What changed.** Tie the first diagnostic to the change named in the ticket or found in a change log. Stale state is the first suspect: a cached DNS answer inside its TTL, a negative answer inside its negative-cache time, an old certificate still bound to a listener, an ARP or MAC entry for a replaced device, a VPN security association built before a proposal changed, a DHCP lease from a server that should not exist.
- **Look before guessing.** When a log or a read can show the failing event, read it first and say what each result would mean: the Meraki event log (Network-wide, Monitor, Event Log) for VPN negotiation and DHCP events, the firewall's own log or a packet capture, the zero-trust activity log for the policy that matched, a resolver's answer with its status, the certificate the host serves.
- **No runbook covers it.** Say so in one line and mark the steps as reasoning, not a known fix.

## Step 2: walk the layers

Start at the lowest layer the scope points to, and move up only when the test at a layer passes.

| Layer | What to read | Healthy | Broken looks like |
|---|---|---|---|
| 1. Physical and link | Link light and negotiated speed, switch port counters (CRC, input errors), Wi-Fi association with signal (RSSI) and signal-to-noise (SNR), PoE budget | Link up at the expected speed, no counter growth; Wi-Fi signal and SNR at the site's design target (a common target is about -67 dBm or stronger for voice and video [unconfirmed: check the vendor page]) | Flapping link, half duplex, growing CRC errors; Wi-Fi roams often, weak signal, retries |
| 2. Addressing and DHCP | The device's address, mask, gateway and DNS servers; the lease and which server granted it | An address in the expected subnet from the expected DHCP server, the expected gateway and resolvers | A 169.254.x.x address (no DHCP answer), an address from an unexpected server, a wrong gateway or DNS server, a duplicate address |
| 3. Routing | Ping the gateway, then a public address by number, then `traceroute` to where it stops | Each hop answers or is silent in a pattern that still reaches the end | Stops at the gateway (local), stops at the ISP edge (uplink), loops between two hops (routing loop), many sites failing to one network (an upstream routing or BGP event) |
| 4. Name resolution | `dig` the name against the configured resolver, a public resolver, and the authoritative server | NOERROR with the expected answer; the same answer from each, or a difference you can explain (split horizon) | NXDOMAIN, SERVFAIL, REFUSED, a stale answer, an answer that differs inside and outside with no reason |
| 5. Transport | A TCP connect to the port (`nc -vz`, `Test-NetConnection -Port`), or a capture | The three-way handshake completes | SYN with no SYN-ACK (dropped or filtered), RST (closed port or an active reject), ICMP unreachable (a reject or no route) |
| 6. TLS | `openssl s_client -connect host:443 -servername host`, or `curl -v` | "Verify return code: 0 (ok)", the right names, dates in range, the full chain | Expired, name mismatch, unable to get local issuer (missing intermediate), handshake failure (protocol or cipher), a certificate from an inspecting proxy |
| 7. Application | The HTTP status, the response headers, the application's own log | The expected status from the expected server | A 4xx or 5xx, and the headers say who produced it |
| 8. Policy and proxies | The zero-trust client's state and activity log, the proxy or firewall log, the WAF events | The request is logged as allowed, or not seen at all because it does not pass that layer | A block or isolate action with a policy name, a page served by the proxy rather than the origin, a TLS certificate issued by the inspecting proxy |

## Step 3: the smallest test that splits two layers

The cheapest discriminating test beats a long checklist. Each row tells one suspect from its neighbour.

| To tell apart | Smallest test | Reading |
|---|---|---|
| Link or Wi-Fi from addressing | Read the device's address and gateway | No address, or 169.254.x.x: DHCP or the link. A good address: move up. |
| Local network from upstream | Ping the default gateway, then a public address by number | Gateway fails: local link, VLAN or switch. Gateway works, public fails: uplink, firewall or ISP. |
| Routing from name resolution | Reach the service by address, then by name | By address works, by name fails: DNS. |
| Resolver from authoritative | `dig name @resolver`, then `dig name @authoritative-server +norecurse` | Authoritative right, resolver wrong: cache, forwarder, split horizon or DNSSEC on the resolver. Authoritative wrong: the zone itself. |
| DNSSEC failure from other SERVFAIL | `dig name` then `dig name +cd` against the same validating resolver | SERVFAIL without `+cd`, an answer with `+cd`: DNSSEC validation fails (expired signatures, DS and DNSKEY mismatch). |
| Filtered from closed | A TCP connect, or a capture of the SYN | No reply at all: dropped (firewall, security group, wrong route back). RST: the host answered, nothing listens or a firewall rejects. |
| TLS from the application | `curl -v` | The handshake completes and a status comes back: TLS is fine, read the status. The handshake fails: TLS. |
| Origin error from proxy or zero-trust block | Read the response's headers and body: who served it | A Cloudflare error page with a Ray ID and a 52x status (a `cf-ray` response header too [unconfirmed: check the vendor page]): the Cloudflare edge could not get a good answer from the origin. A branded block page with a policy or rule name: the policy layer. The origin's own error page and server header: the application. |
| MTU from everything else | `ping` with the do-not-fragment bit at 1472 bytes, then smaller | Small pings pass, large ones fail or vanish: a path MTU problem. Both fail: something else. |
| Client from infrastructure (Wi-Fi) | Another device in the same spot, and the same device near another access point | One device fails everywhere: the client (driver, profile, power saving). Every device fails in one place: the access point, the channel or the density there. |
| Tunnel down from tunnel up with no traffic | Read the tunnel status, then send traffic from a host in one protected subnet to a host in the other | Down: phase 1 or 2, keys, reachability on UDP 500 and 4500 (IPsec) or the WireGuard endpoint. Up with no traffic: routes, the protected subnets (proxy IDs or allowed IPs), a firewall rule, overlap, MTU. |

## Step 4: lightest fix first, then the change discipline

- Before a change that cannot be undone, or that resets, deletes or re-registers, list the lighter actions that can be undone: renew the DHCP lease, flush a local DNS cache, reconnect the VPN client, re-push a profile, clear one stale security association, reload one certificate binding. The heavy action is the last step, labeled last resort.
- One change at a time, narrowest scope first (one host, one rule, one record, one site), with the pre-state captured and the rollback written before the change.
- A change that touches a whole site or the internet (a firewall rule set, a tunnel proposal, a zone's name servers, a site's MTU) is R3: the network owner applies it in a change window, with a second person checking the plan.
- Verify from two sides: the user's side (the failing action now works) and outside (a public lookup or a test from another network sees the expected state).
- Stop when a result is not the one the plan predicted. A count, a route or an answer you did not expect means the model of the problem is wrong.

## Step 5: say what was proved and what was not

The answer keeps observations, hypotheses and the recommendation apart. It says which test settled a hypothesis and which hypotheses are still open, and what would show the next one. A clean public lookup proves the public path, not the user's path; a passing ping proves ICMP, not the application's port.
