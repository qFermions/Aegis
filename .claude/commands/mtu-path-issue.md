---
description: Small things work and large things hang - find the path MTU with the do-not-fragment ping, tell a path MTU black hole from loss, read the capture (retransmitted full-size segments, ICMP fragmentation needed), and fix at the encapsulation with an MSS clamp or tunnel MTU and the ICMP that path MTU discovery needs, as reviewed previews. Placeholders only.
disable-model-invocation: true
---

# /mtu-path-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview under a PREVIEW ONLY marker: the network owner applies it through a separately reviewed change. Aegis advises; a human administrator runs every step (HUMAN-RUN).

**Answer mode (answer-format section 9):** Engineer answer when ping, traceroute or capture output is pasted, or the question names a tunnel, an overlay or a new circuit. Fix card when one person's VPN or app "connects but hangs" and nothing is pasted: the card's first step is the do-not-fragment ping. Ask first when someone asks to lower the MTU on every device or to allow all ICMP with no test result (judgment rule d).

**Placeholders:** `[IP_ADDRESS]` (a host across the failing path) · `[INTERFACE]` (the tunnel or edge interface) · `[DEVICE_NAME]` · `[@Aegion_SITE_2]` · `[JIRA-###]`. Evidence reading: `knowledge/networking/reading-evidence.md` sections 5 and 6; decision tree F in `knowledge/networking/decision-trees.md`.

## Phase 1: How wide before why (R0)

1. The signs: pages partly load, uploads or file copies stall, SSH logs in and freezes on large output, a VPN passes ping but not file shares, one app times out on large replies only.
2. One path or every path? Only through a tunnel, an overlay, a zero-trust client or one site's circuit?
3. What changed: a new tunnel or VPN, a new ISP circuit (PPPoE adds 8 bytes), a new cloud VPN, a zero-trust client rollout, a firewall change that drops ICMP.
4. Read the provider's status page for the circuit or the VPN service involved.

## Phase 2: Find the path MTU (R0)

Read the interface MTUs where the encapsulation lives first: on Meraki, Meraki dashboard → Security & SD-WAN → Configure → Site-to-site VPN for the tunnels, and the capture tool at Network-wide → Monitor → Packet Capture for the evidence; on a cloud VPN, its documented limits.

On Windows, in `ping /f /l <size>` the first switch sets the do-not-fragment flag (IPv4 only) and the second the data size:

```cmd
:: Windows command prompt, read-only. The largest normal Ethernet packet, 1472 bytes of data plus 28 bytes of headers is 1500
ping /f /l 1472 [IP_ADDRESS]
:: step down until it passes; the largest passing size plus 28 is the path MTU
ping /f /l 1400 [IP_ADDRESS]
ping /f /l 1372 [IP_ADDRESS]
```

```bash
# HUMAN-RUN, read-only. Linux: -M do sets do-not-fragment; macOS uses -D instead [unconfirmed: check the vendor page]
ping -M do -s 1472 -c 3 [IP_ADDRESS]
ping -M do -s 1400 -c 3 [IP_ADDRESS]
# the path, to see where the encapsulation sits
traceroute -n [IP_ADDRESS]
# full-size segments and any ICMP fragmentation-needed messages, on the sending host, while the transfer hangs
sudo tcpdump -ni [INTERFACE] -c 50 'icmp or (tcp and greater 1300)'
```

| What comes back | Meaning |
|---|---|
| Large pings pass at 1472 | No MTU problem on this path for ICMP; look elsewhere (loss, the application) |
| `Packet needs to be fragmented but DF set` or `message too long` from the sender itself | The sender's own interface MTU is smaller than the packet |
| `Frag needed and DF set (mtu = N)` from a router | A hop has MTU N and says so (RFC 1191); path MTU discovery works here. If transfers still hang, the sending host or a middlebox ignores the message |
| Large pings time out with no message, small ones pass | A black hole: something drops ICMP "fragmentation needed" and TCP stalls on its first full-size segment (RFC 2923) |
| The capture shows the same full-size segment retransmitted again and again, small segments acknowledged | The same black hole, seen in TCP |

## Phase 3: Where the fix belongs (R0)

1. At the encapsulation: the tunnel or edge interface whose overhead lowers the MTU (IPsec, WireGuard, GRE, PPPoE, a zero-trust tunnel). Clamp TCP MSS there, or set the tunnel's MTU, so hosts never send what cannot pass.
2. AWS Site-to-Site VPN supports an MTU of 1446 and an MSS of 1406 bytes and does not support path MTU discovery: clamp on the customer gateway (AWS notes some algorithms lower that maximum further).
3. ICMP that path MTU discovery needs: ICMP type 3 code 4 (IPv4 "fragmentation needed") and ICMPv6 type 2 ("packet too big") must pass the firewalls and access lists on the path. In AWS, a network ACL needs that rule inbound and outbound; security groups are stateful.
4. Never lower the MTU on every end-user device as the fix: it is the wrong layer and it is hard to undo at scale.

## Phase 4: The fix, lightest first (changes: PREVIEW ONLY)

1. **Lighter step:** allow ICMP "fragmentation needed" and "packet too big" through the firewall or ACL that drops them, so path MTU discovery works (R2 for one rule; R3 when the rule set is shared).
2. **Lighter step:** clamp TCP MSS on the one tunnel or edge interface (R2 for one tunnel).
3. Lower a tunnel interface's MTU (R2 for one tunnel; R3 for a site edge, change window).

> **PREVIEW ONLY [mtu-path-issue-icmp-allow]:** R2 for one rule, R3 for a shared rule set. Planning only: this runbook does not authorize the change. The firewall owner allows ICMP type 3 code 4 and ICMPv6 type 2 from the path's routers toward the senders, after exporting the rule set to the ticket. In an AWS network ACL: a Custom ICMP rule for Destination Unreachable, fragmentation required and DF flag set, inbound and outbound. Rollback: remove the rule. Stop if the rule's hit counter shows traffic other than these ICMP messages.

```bash
# PREVIEW ONLY [mtu-path-issue-mss-clamp]
# HUMAN-RUN by the network owner on the Linux tunnel or edge host. R2 for one tunnel. Aegis runs nothing.
# Save the current rule set first, as the rollback.
# sudo cp /etc/nftables.conf /etc/nftables.conf.before-change
# Clamp the MSS of forwarded SYNs to the route MTU, in the forward chain of an inet filter table.
# sudo nft add rule inet filter forward tcp flags syn tcp option maxseg size set rt mtu
# Or set the tunnel interface MTU, for example to the size Phase 2 measured.
# sudo ip link set dev [INTERFACE] mtu 1400
# Rollback: restore the saved rule set, and the interface MTU recorded before the change.
# sudo cp /etc/nftables.conf.before-change /etc/nftables.conf
# Read-back: the Phase 2 do-not-fragment ping passes at the new size, and the transfer that hung completes.
```

> **PREVIEW ONLY [mtu-path-issue-appliance-mss]:** R3 at a site edge. Planning only: this runbook does not authorize the change. On a firewall or VPN appliance (an MX, a cloud gateway's customer side), the network owner sets the MSS adjustment or tunnel MTU in that device's configuration in a change window, with the current values saved; on Meraki, check the model's documentation for where MSS and MTU are set before planning [unconfirmed: check the vendor page]. Rollback: restore the saved values. Stop if any flow that worked before fails.

## ⚠️ Risk warning

- An MSS clamp or MTU change touches every TCP flow on that interface; a wrong value can break traffic that worked. Measure first (Phase 2), change one interface, verify.
- Allowing all ICMP is broader than needed: allow the two messages path MTU discovery needs.
- Lowering the MTU on end-user devices hides the fault, cannot be rolled back easily, and breaks again when the path changes.

## ✅ Verification checklist

- [ ] Scope, the path and the recent change are in the ticket
- [ ] The largest passing do-not-fragment size, and whether a "frag needed" message came back, are recorded
- [ ] The encapsulation that lowers the MTU is named
- [ ] Any change followed its PREVIEW ONLY plan with the previous values saved
- [ ] Read-back: the do-not-fragment ping passes at the new size and the large transfer that hung now completes, from the user's side

## 📝 Jira-ready note

> [JIRA-###] MTU: large transfers over [path / tunnel to [@Aegion_SITE_2] / cloud VPN] hung since [time]. Measured: DF ping passes at [size] and fails at [size], [no ICMP / frag needed (mtu N)] returned. Cause: [encapsulation] lowers the path MTU and [ICMP dropped at / no MSS clamp on] [device]. Change: [ICMP allowed / MSS clamped on [INTERFACE] / tunnel MTU set], previous values saved. Verified: DF ping and the user's transfer succeed.
