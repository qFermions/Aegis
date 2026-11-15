# Decision trees

> **Execution boundary:** reference text. Each tree ends in a diagnosis and points to the runbook or the change pattern; it authorizes no change.

Every tree starts with step 0 of `method.md` (how wide, vendor status, what changed). The trees below assume that step is done.

## A. "A name does not resolve" or "the site will not load by name"

1. Does it work by address? If yes, this is name resolution; continue. If no, go to tree E (unreachable).
2. `dig name` against the resolver the device uses. Read the status line.
   - **NOERROR with an answer:** resolution works from that resolver. Compare the answer with the public answer (`net_dns`, or `dig` against a public resolver). Different answers: split horizon (expected or not), a stale cache inside the TTL, or a change not yet seen. Same answer and the device still fails: the device's cache, its hosts file, or a proxy or zero-trust client resolving for it.
   - **NOERROR with no answer (NODATA):** the name exists but not that record type (an AAAA question for a name with only A, or the reverse). Check which type the client asks for.
   - **NXDOMAIN:** the name does not exist in the zone that answered. Ask the authoritative server directly (`dig name @ns +norecurse`). Authoritative also says NXDOMAIN: the record is missing or spelled differently. Authoritative has it: the resolver holds a negative answer (it lasts the SOA minimum or the SOA TTL, whichever is lower), or the resolver forwards to the wrong place (a split-horizon internal zone that lacks the name).
   - **SERVFAIL:** repeat with `+cd`. An answer with `+cd`: DNSSEC validation fails; check the signatures' dates and the DS at the parent against the zone's DNSKEY (`/dns-troubleshoot`, DNSSEC section). Still SERVFAIL: the resolver cannot reach any authoritative server, or the delegation is broken (lame name servers, missing glue); walk it with `dig +trace`.
   - **REFUSED:** that server will not answer this client for policy reasons (an authoritative-only server asked to recurse, a resolver that serves only its own networks). Ask the right server.
   - **Timeout:** the resolver is unreachable (routing, firewall on UDP and TCP 53, a zero-trust client intercepting DNS). Go to tree E for the resolver's address.
3. Recent change to the record? The old answer lives until the old TTL expires at every resolver that cached it. Lowering the TTL after the fact does not shorten caches already holding the old one.

## B. A TLS or certificate error

1. Who shows the error: a browser, an API client, a load balancer health check, a CDN edge (a Cloudflare 525 or 526), a mail server?
2. Read the certificate the host serves, with the name the client uses: `openssl s_client -connect host:443 -servername host`, or `net_tls` for a public host.
   - **Expired:** the renewal did not run, or it ran and the new certificate is not bound where traffic lands (another listener, another node behind the balancer, the CDN's origin). Compare the serial the host serves with the newest issued one.
   - **Name mismatch:** the name the client uses is not in the subject alternative names. Often SNI: the client sent no name or another name, and the server returned its default certificate.
   - **Unable to get local issuer certificate:** the server sends only the leaf, not the intermediate. Browsers may cope (cached intermediates); APIs, older clients and health checks fail.
   - **Self-signed or an unknown issuer named after a security product:** an inspecting proxy or zero-trust client re-signed the traffic; the device lacks that proxy's root, or the app pins its certificate. Tree D.
   - **Handshake failure, protocol version or no shared cipher:** the client and server share no TLS version or suite (a legacy client against a TLS 1.2-and-up server, or the reverse).
3. A certificate change goes through `/tls-certificate`; binding a new certificate on a shared listener is a change for the owner of that listener.

## C. A VPN tunnel is down, or up with no traffic

1. Which kind: site-to-site IPsec (Meraki Auto VPN, Meraki to a non-Meraki peer, a cloud VPN gateway), WireGuard, or a client VPN?
2. **Down.**
   - IPsec: is UDP 500 and 4500 open both ways between the public addresses? Do phase 1 proposals match (encryption, integrity, DH group, lifetime, IKE version, pre-shared key or certificate)? Do phase 2 proposals match (encryption, PFS group, lifetime, and the protected subnets on each side, mirrored)? The peer's log names the failing phase: "no proposal chosen" and authentication failures are phase 1; a traffic-selector or proxy-ID mismatch is phase 2.
   - Meraki Auto VPN: both peers must reach the VPN registry (outbound UDP 9350 to 9381) and each other on the high UDP range; the dashboard marks a peer unreachable when they cannot.
   - WireGuard: `wg show` gives the latest handshake per peer. No handshake ever: endpoint address or port wrong, UDP blocked, or the public keys do not match. A handshake that stopped: the endpoint moved, a NAT mapping expired (no keepalive), or the remote side restarted with another key.
   - Client VPN: authentication (account, MFA, certificate), then the client's reachability to the gateway on its ports, then the client software version.
3. **Up, no traffic.**
   - Routes: does each side route the far subnet into the tunnel, and the return traffic back the same way?
   - Protected subnets: is the subnet in the phase 2 selectors (IPsec) or in `AllowedIPs` (WireGuard) on both sides? A host outside them goes out to the internet instead.
   - Overlap: the same subnet at both ends breaks routing quietly.
   - Firewall: the site-to-site firewall or a security group can allow the tunnel and still drop the traffic in it.
   - MTU: small pings pass, file copies and web pages over the tunnel hang. Tree F.
4. Go to `/vpn-tunnel-down`; for Meraki Auto VPN status pages and a migration, `/vpn-check`, `/meraki-vpn-status` and `/meraki-site-vpn`.

## D. "Blocked" or an error page: the policy layer or the origin?

1. Who served the page? Read the headers and the page itself.
   - A branded block page from the zero-trust vendor, naming a policy, a rule or a category: a policy decision. Read the vendor's activity log for that user, time and URL to get the matched policy and action.
   - An HTTP 403 with a WAF or bot-check page from the site's own CDN: the site's protection, not yours. The site owner decides.
   - A Cloudflare 52x page with a Ray ID: the edge reached out to the site's origin and failed (520 unknown error, 521 web server down, 522 timed out, 523 unreachable, 524 timeout, 525 SSL handshake failed, 526 invalid certificate). An origin problem for the site owner, not a block.
   - A certificate warning whose issuer is the inspecting proxy: TLS inspection on a device that does not trust the proxy's root, or an app that pins its certificate.
2. Same URL from a network without the zero-trust path (a test device on another network): does it load? Yes: the policy layer. No: the origin or the internet path.
3. A request to allow, exempt or bypass without the block page's text or the log entry gets Ask first (judgment rule d). With the evidence, the narrowest exception (one URL or app, one group, an end date) goes through `/zero-trust-block`.

## E. Unreachable: nothing comes back

1. Gateway, then a public address, then the service's address: where does it stop?
2. `traceroute` or `mtr` to the service:
   - Stops inside your network: a local route, VLAN or firewall.
   - Stops at the first ISP hops: the uplink or the ISP. Read the ISP's status and the firewall's uplink health.
   - Reaches the provider's network and stops near the end: the service's firewall or the service.
   - Many users at many companies report the same service down, and traces die inside one network: an upstream routing event. Read status pages and a public looking glass; a BGP leak or withdrawal is the provider's or the ISP's to fix.
3. A TCP connect to the port: SYN with no answer is a drop (a firewall, a security group, an asymmetric return path); RST is a refusal.

## F. Small things work, large things hang (MTU)

1. Pages partly load, file copies or uploads stall, SSH logs in but freezes on large output, a VPN passes ping but not file shares. Often after a new tunnel, a new ISP circuit (PPPoE), a new overlay or a zero-trust client.
2. `ping` with the do-not-fragment bit: Windows `ping /f /l 1472 host`, Linux `ping -M do -s 1472 host`, macOS `ping -D -s 1472 host` (the Linux and macOS flags [unconfirmed: check the vendor page]). Lower the size until it passes; the path MTU is that size plus 28 bytes (IPv4).
3. Large sizes fail with no "fragmentation needed" message coming back: something drops the ICMP that path MTU discovery needs (a black hole). Large sizes fail with a "frag needed" message naming an MTU: the path is smaller than the sender thinks and the sender can learn it, so look at what ignores it.
4. Fix where the encapsulation is: clamp TCP MSS on the tunnel or the edge, or set the tunnel interface MTU; allow ICMP "fragmentation needed" (type 3 code 4) and IPv6 "packet too big" through firewalls and ACLs. `/mtu-path-issue`.

## G. Wi-Fi complaints at scale

1. One person or many? One place or many? Since a change (new access points, a firmware upgrade, a new SSID, an event with many guests)?
2. One client everywhere: the client (driver, OS update, power saving, an old profile). `/wifi-issue`.
3. Many clients in one area: read the access point's channel, utilization, client count and interference in the dashboard. Neighbouring access points on the same channel share its airtime: in 2.4 GHz only channels 1, 6 and 11 do not overlap in most regions, and 5 GHz offers many more non-overlapping 20 MHz channels. High utilization with many clients: density; narrower channels (20 MHz), more 5 or 6 GHz, a higher minimum bitrate. High utilization with few clients: interference or co-channel overlap.
4. Roaming complaints (calls drop when walking): read the client's roaming events and signal at the moment it moved; sticky clients and too-strong transmit power are common causes.
5. Radio profile changes reach every access point that uses the profile: a site change for the network owner (`safe-changes.md`, Wi-Fi radio profile).

## H. No address, or the wrong address (DHCP)

1. A 169.254.x.x address: no DHCP answer reached the client. Link and VLAN first, then whether the scope has free leases, then the relay (the router's helper address) for a scope on another subnet.
2. An address in an unexpected range, or a gateway or DNS server nobody configured: a second DHCP server answers on that VLAN. Find it (the lease names the server; switch DHCP-server detection lists them) and treat an unknown one as a security matter (judgment rule a): it can send clients to a hostile resolver.
3. Some clients get addresses and others do not, worse in the morning: scope exhaustion. Read the scope's use and lease time; many short-lived guests need a shorter lease or a larger scope.
4. A duplicate address warning: a static address inside the DHCP range, or a stale lease. The client declines an address that answers ARP and asks again.
